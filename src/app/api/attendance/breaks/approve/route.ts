import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { dispatchNotification } from '@/lib/notification-service';
import { z } from 'zod';

const approveBreakSchema = z.object({
  break_id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
});

export async function POST(request: NextRequest) {
  try {
    // Bug 2 fix: Employees are excluded from this endpoint. Only BMs and admins may
    // approve or reject gate passes. Employees cancel their own pending requests via
    // a dedicated self-cancel flow (action=reject on /api/attendance/breaks/cancel).
    const user = await requireRole(['branch_manager', 'admin']);
    const body = await request.json();
    const input = approveBreakSchema.parse(body);

    const supabase = await createClient();

    // 1. Get the break record to verify branch/employee access
    const { data: breakRecord, error: fetchErr } = await supabase
      .from('attendance_breaks')
      .select('id, status, branch_id, employee_id, break_type, expected_duration_minutes')
      .eq('id', input.break_id)
      .single();

    if (fetchErr || !breakRecord) {
      throw new Error('Gate Pass request not found.');
    }

    if (breakRecord.status !== 'pending') {
      return NextResponse.json({
        success: false,
        error: `This gate pass is already ${breakRecord.status}.`
      }, { status: 400 });
    }

    // Only branch managers and admins reach this point (requireRole enforces this).
    if (user.role === 'branch_manager' && breakRecord.branch_id !== user.branch_id) {
      throw new Error('FORBIDDEN: You can only approve gate passes for your own store.');
    }

    // 2. Update the status
    const newStatus = input.action === 'approve' ? 'active' : 'rejected';
    const outTime = input.action === 'approve' ? new Date().toISOString() : null;

    const { data: updatedBreak, error: updateErr } = await supabase
      .from('attendance_breaks')
      .update({
        status: newStatus,
        approved_by: user.id,
        ...(outTime && { out_time: outTime }),
      })
      .eq('id', input.break_id)
      .select()
      .single();

    if (updateErr) {
      throw new Error(`Failed to update gate pass: ${updateErr.message}`);
    }

    // 3. Notify the employee of the approval/rejection decision
    const breakTitles: Record<string, string> = {
      namaz_prayer: 'Prayer / Namaz',
      tea_lunch: 'Tea / Lunch Break',
      official_bank: 'Official Bank Duty',
      short_emergency: 'Emergency Out',
      personal: 'Personal Pass'
    };
    const title = breakTitles[breakRecord.break_type] || 'Gate Pass';
    if (newStatus === 'active') {
      dispatchNotification({
        userId: breakRecord.employee_id,
        title: `Gate Pass Approved: ${title}`,
        message: `Your gate pass request has been approved for ${breakRecord.expected_duration_minutes} minutes. Remember to verify return when you get back!`,
        type: 'attendance_approval',
        actionUrl: '/employee/gate-pass',
      }).catch(err => console.error('Failed to dispatch notification:', err));
    } else {
      dispatchNotification({
        userId: breakRecord.employee_id,
        title: `Gate Pass Request Declined: ${title}`,
        message: `Your gate pass request for ${title} was declined by the store manager.`,
        type: 'alert',
        actionUrl: '/employee/gate-pass',
      }).catch(err => console.error('Failed to dispatch notification:', err));
    }

    return NextResponse.json({
      success: true,
      data: updatedBreak,
      message: `Gate Pass successfully ${newStatus}.`
    });

  } catch (error) {
    return handleApiError(error);
  }
}
