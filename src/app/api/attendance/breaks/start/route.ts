import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { dispatchToAdmins, dispatchToBranchManagers } from '@/lib/notification-service';
import { z } from 'zod';

const startBreakSchema = z.object({
  break_type: z.enum(['namaz_prayer', 'tea_lunch', 'official_bank', 'short_emergency', 'personal']),
  expected_duration_minutes: z.number().int().min(5).max(480),
  reason: z.string().min(3, 'Please provide a brief reason for leaving.'),
  employee_id: z.string().uuid().optional(), // Admin or BM can start break for staff
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['employee', 'branch_manager', 'admin']);
    const body = await request.json();
    const input = startBreakSchema.parse(body);

    const supabase = await createClient();

    // Determine target employee ID and branch ID
    let targetEmployeeId = user.id;
    let targetBranchId = user.branch_id;
    let targetEmployeeName = user.full_name;

    if (input.employee_id && input.employee_id !== user.id) {
      if (user.role === 'employee') {
        throw new Error('FORBIDDEN: Employees can only request gate passes for themselves.');
      }
      const { data: targetProf, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name, branch_id')
        .eq('id', input.employee_id)
        .single();
      
      if (profErr || !targetProf) {
        throw new Error('Target employee profile not found.');
      }
      if (user.role === 'branch_manager' && targetProf.branch_id !== user.branch_id) {
        throw new Error('FORBIDDEN: Employee does not belong to your assigned store.');
      }
      targetEmployeeId = targetProf.id;
      targetBranchId = targetProf.branch_id;
      targetEmployeeName = targetProf.full_name;
    }

    if (!targetBranchId) {
      throw new Error('No branch assigned to this employee. Cannot issue Gate Pass without store assignment.');
    }

    // 1. Check if employee already has an active or pending break right now
    const { data: activeBreak } = await supabase
      .from('attendance_breaks')
      .select('id, break_type, out_time, status')
      .eq('employee_id', targetEmployeeId)
      .in('status', ['active', 'pending'])
      .limit(1)
      .maybeSingle();

    if (activeBreak) {
      if (activeBreak.status === 'pending') {
        return NextResponse.json({
          success: false,
          error: `You already have a pending Gate-Pass request (${activeBreak.break_type.replace('_', ' ')}). Please wait for approval or cancel it.`
        }, { status: 409 });
      }
      return NextResponse.json({
        success: false,
        error: `You already have an active Gate-Pass (${activeBreak.break_type.replace('_', ' ')}) running since ${new Date(activeBreak.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Please verify return first.`
      }, { status: 409 });
    }

    // 2. Find today's check-in attendance record if available
    const today = new Date();
    const dhakaFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' });
    const [mo, da, yr] = dhakaFormatter.format(today).split('/');
    const todayStart = new Date(`${yr}-${mo}-${da}T00:00:00+06:00`).toISOString();

    const { data: todayAttendance } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('employee_id', targetEmployeeId)
      .gte('check_in_time', todayStart)
      .limit(1)
      .maybeSingle();

    const status = user.role === 'employee' ? 'pending' : 'active';
    const outTime = status === 'active' ? new Date().toISOString() : undefined;

    // 3. Insert into attendance_breaks
    const { data: breakRecord, error: insertErr } = await supabase
      .from('attendance_breaks')
      .insert({
        employee_id: targetEmployeeId,
        branch_id: targetBranchId,
        attendance_id: todayAttendance?.id || null,
        break_type: input.break_type,
        expected_duration_minutes: input.expected_duration_minutes,
        reason: input.reason,
        status: status,
        approved_by: user.role !== 'employee' ? user.id : null,
        ...(outTime && { out_time: outTime })
      })
      .select('*')
      .single();

    if (insertErr || !breakRecord) {
      throw new Error(`Failed to start Gate-Pass: ${insertErr?.message}`);
    }

    // 4. Dispatch real-time alert to Branch Manager & Admins
    const breakLabelMap: Record<string, string> = {
      namaz_prayer: '🕌 Prayer / Namaz Break',
      tea_lunch: '☕ Tea / Lunch Break',
      official_bank: '🏦 Official Duty / Bank Pass',
      short_emergency: '🏥 Short Emergency Leave',
      personal: '🚶 Personal Gate Pass',
    };
    const breakTitle = breakLabelMap[input.break_type] || 'Gate Pass';

    const isEmployeeRequest = user.role === 'employee';
    
    await dispatchToBranchManagers({
      branchId: targetBranchId,
      title: `${targetEmployeeName} ${isEmployeeRequest ? 'requested' : 'started'} ${breakTitle}`,
      message: `${isEmployeeRequest ? 'Requested at' : 'Out time'}: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | Expected: ${input.expected_duration_minutes} mins | Reason: "${input.reason}"`,
      type: 'warning',
      actionUrl: `/admin/attendance?branch=${targetBranchId}&tab=breaks`,
    });

    await dispatchToAdmins({
      title: `${targetEmployeeName} (Gate-Pass ${isEmployeeRequest ? 'Requested' : 'Issued'})`,
      message: `${breakTitle} at store (${input.expected_duration_minutes}m limit). Reason: ${input.reason}`,
      type: 'info',
      actionUrl: `/admin/attendance?branch=${targetBranchId}&tab=breaks`,
    });

    return NextResponse.json({
      success: true,
      data: breakRecord,
      message: user.role === 'employee' 
        ? `Gate-Pass requested. Waiting for manager approval.`
        : `Gate-Pass issued successfully for ${input.expected_duration_minutes} minutes.`
    }, { status: 201 });

  } catch (error) {
    return handleApiError(error);
  }
}
