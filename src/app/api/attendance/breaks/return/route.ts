import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { dispatchToAdmins, dispatchToBranchManagers } from '@/lib/notification-service';
import { z } from 'zod';

const returnBreakSchema = z.object({
  break_id: z.string().uuid().optional(),
  employee_id: z.string().uuid().optional(),
  return_note: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['employee', 'branch_manager', 'admin']);
    const body = await request.json().catch(() => ({}));
    const input = returnBreakSchema.parse(body);

    const supabase = await createClient();

    let targetEmployeeId = user.id;
    if (input.employee_id && input.employee_id !== user.id) {
      if (user.role === 'employee') {
        throw new Error('FORBIDDEN: Employees can only verify return for themselves.');
      }
      targetEmployeeId = input.employee_id;
    }

    // 1. Find active break record
    let query = supabase
      .from('attendance_breaks')
      .select('*, profiles(full_name, branch_id)')
      .eq('status', 'active');

    if (input.break_id) {
      query = query.eq('id', input.break_id);
    } else {
      query = query.eq('employee_id', targetEmployeeId);
    }

    const { data: breakRecord, error: findErr } = await query.order('out_time', { ascending: false }).limit(1).maybeSingle();

    if (findErr || !breakRecord) {
      return NextResponse.json({
        success: false,
        error: 'No active Gate-Pass found to return from.'
      }, { status: 404 });
    }

    // Role check if verifying someone else's break
    if (user.role === 'branch_manager' && breakRecord.branch_id !== user.branch_id) {
      throw new Error('FORBIDDEN: This Gate-Pass belongs to another store.');
    }

    const now = new Date();
    const outTime = new Date(breakRecord.out_time);
    const diffMillis = now.getTime() - outTime.getTime();
    const actualDurationMinutes = Math.max(1, Math.round(diffMillis / 60000));

    // Allow 15 minutes buffer over expected duration before marking as overstayed
    const isOverstayed = actualDurationMinutes > (breakRecord.expected_duration_minutes + 15);
    const newStatus = isOverstayed ? 'overstayed' : 'completed';

    // 2. Update break record
    const { data: updatedBreak, error: updateErr } = await supabase
      .from('attendance_breaks')
      .update({
        return_time: now.toISOString(),
        actual_duration_minutes: actualDurationMinutes,
        status: newStatus,
        updated_at: now.toISOString(),
      })
      .eq('id', breakRecord.id)
      .select('*')
      .single();

    if (updateErr || !updatedBreak) {
      throw new Error(`Failed to update Gate-Pass return time: ${updateErr?.message}`);
    }

    // 3. Send notification alert
    const empName = breakRecord.profiles?.full_name || 'Employee';
    const breakLabelMap: Record<string, string> = {
      namaz_prayer: '🕌 Prayer / Namaz Break',
      tea_lunch: '☕ Tea / Lunch Break',
      official_bank: '🏦 Official Duty / Bank Pass',
      short_emergency: '🏥 Short Emergency Leave',
      personal: '🚶 Personal Gate Pass',
    };
    const breakTitle = breakLabelMap[breakRecord.break_type] || 'Gate Pass';

    if (isOverstayed) {
      await dispatchToBranchManagers({
        branchId: breakRecord.branch_id,
        title: `⚠️ Gate-Pass Overstay Alert: ${empName}`,
        message: `Returned from ${breakTitle} after ${actualDurationMinutes}m (Expected: ${breakRecord.expected_duration_minutes}m. Overstayed by ${actualDurationMinutes - breakRecord.expected_duration_minutes}m).`,
        type: 'alert',
        actionUrl: `/admin/attendance?branch=${breakRecord.branch_id}&tab=breaks`,
      });
      await dispatchToAdmins({
        title: `⚠️ Gate-Pass Overstay: ${empName}`,
        message: `${empName} overstayed ${breakTitle} by ${actualDurationMinutes - breakRecord.expected_duration_minutes} minutes (${actualDurationMinutes}m total vs ${breakRecord.expected_duration_minutes}m allowed).`,
        type: 'alert',
        actionUrl: `/admin/attendance?branch=${breakRecord.branch_id}&tab=breaks`,
      });
    } else {
      await dispatchToBranchManagers({
        branchId: breakRecord.branch_id,
        title: `✅ ${empName} Returned to Store`,
        message: `Verified return from ${breakTitle} inside allowed limit (${actualDurationMinutes} mins total).`,
        type: 'success',
        actionUrl: `/admin/attendance?branch=${breakRecord.branch_id}&tab=breaks`,
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedBreak,
      message: isOverstayed 
        ? `Returned and verified after ${actualDurationMinutes} mins (Marked OVERSTAYED by ${actualDurationMinutes - breakRecord.expected_duration_minutes} mins).`
        : `Break return verified successfully (${actualDurationMinutes} mins). Welcome back!`
    });

  } catch (error) {
    return handleApiError(error);
  }
}
