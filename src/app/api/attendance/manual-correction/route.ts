import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError, getSafeIpAddress } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const manualCorrectionSchema = z.object({
  record_id: z.string().uuid(),
  check_in_time: z.string().datetime(),
  check_out_time: z.string().datetime().nullable(),
  status: z.enum(['present', 'late', 'half_day']),
  reason: z.string().min(5, 'Reason must be at least 5 characters long for audit compliance.'),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Only Admins and Branch Managers can perform manual overrides
    const user = await requireRole(['admin', 'branch_manager']);
    const body = await request.json();
    const payload = manualCorrectionSchema.parse(body);

    const supabase = await createClient();

    // 2. Fetch existing record to verify branch ownership and record old values
    const { data: oldRecord, error: fetchErr } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('id', payload.record_id)
      .single();

    if (fetchErr || !oldRecord) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Attendance record not found.' } },
        { status: 404 }
      );
    }

    // Branch Managers can only modify records within their own store
    if (user.role === 'branch_manager' && oldRecord.branch_id !== user.branch_id) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'FORBIDDEN', message: 'Cannot modify records of another branch.' } },
        { status: 403 }
      );
    }

    // 3. Compute new overtime minutes if check_out_time is present
    let newOvertime = 0;
    if (payload.check_out_time) {
      // Bug 12 fix: Fetch actual shift end time from company profile instead of hardcoding 18:00
      const { data: companyProfile } = await supabase
        .from('company_profile')
        .select('default_work_end_time')
        .limit(1)
        .maybeSingle();

      const shiftEndStr = companyProfile?.default_work_end_time || '18:00';
      const [shiftHour, shiftMin] = shiftEndStr.split(':').map(Number);

      const checkOutDate = new Date(payload.check_out_time);
      const shiftEndMs = new Date(checkOutDate).setHours(shiftHour, shiftMin, 0, 0);
      if (checkOutDate.getTime() > shiftEndMs) {
        newOvertime = Math.max(0, Math.floor((checkOutDate.getTime() - shiftEndMs) / 60000));
      }
    }

    // 4. Update Attendance Record with is_manual_override = true
    const { data: updatedRecord, error: updateErr } = await supabase
      .from('attendance_records')
      .update({
        check_in_time: payload.check_in_time,
        check_out_time: payload.check_out_time,
        status: payload.status,
        overtime_minutes: newOvertime,
        is_manual_override: true,
      })
      .eq('id', payload.record_id)
      .select()
      .single();

    if (updateErr || !updatedRecord) {
      throw new Error(`Failed to update record: ${updateErr?.message}`);
    }

    // 5. Mandatory Audit Logging (Spec P19 & P10)
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'MANUAL_ATTENDANCE_CORRECTION',
      table_name: 'attendance_records',
      record_id: payload.record_id,
      old_values: {
        check_in_time: oldRecord.check_in_time,
        check_out_time: oldRecord.check_out_time,
        status: oldRecord.status,
        overtime_minutes: oldRecord.overtime_minutes,
      },
      new_values: {
        check_in_time: payload.check_in_time,
        check_out_time: payload.check_out_time,
        status: payload.status,
        overtime_minutes: newOvertime,
        reason: payload.reason,
        corrected_by: user.full_name,
        corrected_role: user.role,
      },
      ip_address: getSafeIpAddress(request),
    });

    return NextResponse.json({
      success: true,
      data: updatedRecord,
      message: `Attendance record corrected successfully. Audit log created.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const supabase = await createClient();

    let query = supabase
      .from('correction_requests')
      .select('*, profiles!correction_requests_employee_id_fkey(full_name)')
      .order('created_at', { ascending: false });

    // Branch managers only see their branch's requests
    if (user.role === 'branch_manager' && user.branch_id) {
      query = query.eq('branch_id', user.branch_id);
    }

    const { data: requests, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch correction requests: ${error.message}`);
    }

    const formattedData = (requests || []).map(req => ({
      id: req.id,
      user_id: req.employee_id,
      employee_name: (req.profiles as any)?.full_name || 'Unknown',
      date: req.date,
      type: req.type,
      original_time: req.original_time,
      requested_time: req.requested_time,
      reason: req.reason,
      status: req.status,
      created_at: req.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: formattedData,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
