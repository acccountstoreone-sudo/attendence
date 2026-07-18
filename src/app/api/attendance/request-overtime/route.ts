import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { dispatchToAdmins, dispatchToBranchManagers } from '@/lib/notification-service';
import { z } from 'zod';

const requestOvertimeSchema = z.object({
  date: z.string().min(10, 'Must be a valid date'),
  reason: z.string().min(2, 'Reason is required.'),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['employee', 'branch_manager', 'admin']);
    const body = await request.json();
    const payload = requestOvertimeSchema.parse(body);

    const supabase = await createClient();

    // Prevent duplicate requests for the same day
    const { data: existingRec } = await supabase
      .from('off_day_overtime_requests')
      .select('id')
      .eq('employee_id', user.id)
      .eq('requested_date', payload.date)
      .limit(1);

    if (existingRec && existingRec.length > 0) {
      return NextResponse.json(
        { success: false, error: { message: 'You have already sent an off-day request for this date.' } },
        { status: 400 }
      );
    }

    const { data: requestRecord, error: insertErr } = await supabase
      .from('off_day_overtime_requests')
      .insert({
        employee_id: user.id,
        branch_id: user.branch_id,
        requested_date: payload.date,
        reason: payload.reason,
        status: 'pending',
      })
      .select()
      .single();

    if (insertErr || !requestRecord) {
      throw new Error(`Failed to create off-day overtime request: ${insertErr?.message}`);
    }

    // Notify Admins & Branch Managers about the request
    try {
      const msg = `${user.full_name || 'An employee'} submitted an off-day overtime request for ${payload.date}. Reason: ${payload.reason}`;
      if (user.branch_id) {
        await dispatchToBranchManagers({
          branchId: user.branch_id,
          title: 'New Off-Day Overtime Request ⏱️',
          message: msg,
          type: 'attendance_approval',
          actionUrl: '/branch-manager/corrections',
          sendEmail: true,
        });
      }
      await dispatchToAdmins({
        title: 'New Off-Day Overtime Request ⏱️',
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
      message: 'Off-day overtime request submitted successfully. Pending approval.',
      data: requestRecord,
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}
