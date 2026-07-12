import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { dispatchNotification } from '@/lib/notification-service';
import { z } from 'zod';

const actionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reviewer_note: z.string().optional(),
});

/**
 * POST /api/leaves/[id]/action
 * Approves or rejects a pending leave request.
 * If approved, automatically increments used_days in the employee's leave_balances.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const { id } = await params;
    const body = await request.json();
    const input = actionSchema.parse(body);

    const supabase = await createClient();

    // 1. Fetch the target leave request
    const { data: leave, error: fetchErr } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !leave) {
      return NextResponse.json(
        { success: false, error: 'Leave request not found.' },
        { status: 404 }
      );
    }

    // 2. Enforce Branch Manager scope
    if (user.role === 'branch_manager' && leave.branch_id !== user.branch_id) {
      return NextResponse.json(
        { success: false, error: 'You can only manage leave requests for employees in your assigned branch.' },
        { status: 403 }
      );
    }

    // 3. Ensure leave is still pending
    if (leave.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `This leave request is already ${leave.status}.` },
        { status: 400 }
      );
    }

    const targetUserId = leave.user_id || leave.employee_id;
    const leaveYear = new Date(leave.start_date || new Date()).getFullYear();
    const totalDays = Number(leave.total_days || 1);

    // 4. Update leave request status FIRST before mutating balances
    const updatePayload: Record<string, unknown> = {
      status: input.action === 'approve' ? 'approved' : 'rejected',
      updated_at: new Date().toISOString(),
    };

    updatePayload.approved_by = user.id;
    updatePayload.approved_at = new Date().toISOString();
    if (input.reviewer_note) {
      updatePayload.reviewer_note = input.reviewer_note;
    }

    let updatedLeave;
    const { data: primaryLeave, error: updErr } = await supabase
      .from('leave_requests')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updErr) {
      // If approved_by/approved_at columns caused error on older schema, fallback update with status only
      const { data: fallbackLeave, error: fallbackErr } = await supabase
        .from('leave_requests')
        .update({ status: input.action === 'approve' ? 'approved' : 'rejected', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (fallbackErr) throw new Error(fallbackErr.message);
      updatedLeave = fallbackLeave;
    } else {
      updatedLeave = primaryLeave;
    }

    // 5. If approved successfully, safely increment used_days in the employee's leave_balances
    if (input.action === 'approve') {
      if (leave.leave_type_id && targetUserId) {
        const { data: balance } = await supabase
          .from('leave_balances')
          .select('*')
          .eq('user_id', targetUserId)
          .eq('leave_type_id', leave.leave_type_id)
          .eq('year', leaveYear)
          .single();

        if (balance) {
          const newUsed = Number(balance.used_days || 0) + totalDays;
          await supabase
            .from('leave_balances')
            .update({ used_days: newUsed })
            .eq('id', balance.id);
        }
      }
    }

    // Notify the employee about the decision (real-time pip sound + beautiful email)
    if (targetUserId) {
      try {
        const actionText = input.action === 'approve' ? 'Approved ✅' : 'Rejected ❌';
        await dispatchNotification({
          userId: targetUserId,
          title: `Leave Request ${actionText}`,
          message: `Your leave request for ${totalDays} day(s) starting ${leave.start_date} has been ${input.action === 'approve' ? 'approved' : 'rejected'}.${input.reviewer_note ? ` Note: ${input.reviewer_note}` : ''}`,
          type: 'leave',
          actionUrl: '/employee/leaves',
          sendEmail: true,
        });
      } catch {
        // Non-fatal
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedLeave,
      message: `Leave request has been ${input.action}d successfully.`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

