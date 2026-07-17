import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { dispatchToAdmins, dispatchToBranchManagers } from '@/lib/notification-service';
import { z } from 'zod';

const requestOvertimeSchema = z.object({
  date: z.string().min(10, 'Must be a valid date'),
  check_in_time: z.string().min(4, 'Must be a valid time'),
  check_out_time: z.string().min(4, 'Must be a valid time'),
  reason: z.string().min(2, 'Reason is required.'),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['employee', 'branch_manager', 'admin']);
    const body = await request.json();
    const payload = requestOvertimeSchema.parse(body);

    const supabase = await createClient();

    // Prevent duplicate records for the same day
    const startOfDay = `${payload.date}T00:00:00+06:00`;
    const endOfDay = `${payload.date}T23:59:59+06:00`;
    const { data: existingRec } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('employee_id', user.id)
      .gte('check_in_time', startOfDay)
      .lte('check_in_time', endOfDay)
      .limit(1);

    if (existingRec && existingRec.length > 0) {
      return NextResponse.json(
        { success: false, error: { message: 'An attendance record already exists for this date. Use Corrections to edit it instead.' } },
        { status: 400 }
      );
    }

    // Construct valid ISO strings for Bangladesh time
    const inTimeStr = payload.check_in_time.length === 5 ? `${payload.check_in_time}:00` : payload.check_in_time;
    const outTimeStr = payload.check_out_time.length === 5 ? `${payload.check_out_time}:00` : payload.check_out_time;
    const checkInISO = `${payload.date}T${inTimeStr}+06:00`;
    const checkOutISO = `${payload.date}T${outTimeStr}+06:00`;

    // Calculate overtime minutes safely
    const inDate = new Date(checkInISO);
    const outDate = new Date(checkOutISO);
    let diffMins = Math.round((outDate.getTime() - inDate.getTime()) / 60000);
    if (diffMins < 0) {
      return NextResponse.json(
        { success: false, error: { message: 'Check-out time must be after check-in time.' } },
        { status: 400 }
      );
    }

    const { data: requestRecord, error: insertErr } = await supabase
      .from('attendance_records')
      .insert({
        employee_id: user.id,
        branch_id: user.branch_id,
        check_in_time: checkInISO,
        check_out_time: checkOutISO,
        status: 'present', // or pending
        is_manual_entry: true,
        is_holiday_duty: true, // Marked explicitly as holiday/off-day duty
        approval_status: 'pending',
        overtime_approval_status: 'pending',
        overtime_minutes: diffMins, // the entire duration is overtime on an off-day
        manual_reason: `[Off-Day Overtime Request] ${payload.reason}`,
      })
      .select()
      .single();

    if (insertErr || !requestRecord) {
      throw new Error(`Failed to create overtime request: ${insertErr?.message}`);
    }

    // Notify Admins & Branch Managers about the request
    try {
      const msg = `${user.full_name || 'An employee'} submitted an off-day overtime request for ${payload.date} (${Math.round(diffMins/60)} hrs). Reason: ${payload.reason}`;
      if (user.branch_id) {
        await dispatchToBranchManagers({
          branchId: user.branch_id,
          title: 'New Overtime Duty Request ⏱️',
          message: msg,
          type: 'attendance_approval',
          actionUrl: '/branch-manager/corrections',
          sendEmail: true,
        });
      }
      await dispatchToAdmins({
        title: 'New Overtime Duty Request ⏱️',
        message: msg,
        type: 'attendance_approval',
        actionUrl: '/admin/corrections',
        sendEmail: true,
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      data: requestRecord,
      message: 'Overtime request submitted successfully.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
