import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const cancelSchema = z.object({
  reason: z.string().optional(),
});

/**
 * POST /api/leaves/[id]/cancel
 * MISS-02 fix: Allows an employee to cancel their own PENDING leave request.
 * Admins and BMs can cancel any leave in their scope.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(['employee', 'branch_manager', 'admin']);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const input = cancelSchema.parse(body);

    const supabase = await createClient();

    // Fetch the leave request
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

    // Employees can only cancel their own leave requests
    const employeeOwnerId = leave.user_id || leave.employee_id;
    if (user.role === 'employee' && employeeOwnerId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'You can only cancel your own leave requests.' },
        { status: 403 }
      );
    }

    // Branch managers can only cancel leaves in their branch
    if (user.role === 'branch_manager' && leave.branch_id !== user.branch_id) {
      return NextResponse.json(
        { success: false, error: 'You can only cancel leave requests for your branch.' },
        { status: 403 }
      );
    }

    // Can only cancel pending or approved leaves
    if (leave.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'This leave request is already cancelled.' },
        { status: 400 }
      );
    }
    if (leave.status === 'rejected') {
      return NextResponse.json(
        { success: false, error: 'A rejected leave request cannot be cancelled.' },
        { status: 400 }
      );
    }

    // If leave was approved, refund the used_days balance
    if (leave.status === 'approved' && leave.leave_type_id && employeeOwnerId) {
      const leaveYear = new Date(leave.start_date || new Date()).getFullYear();
      const totalDays = Number(leave.total_days || 1);

      const { data: balance } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('user_id', employeeOwnerId)
        .eq('leave_type_id', leave.leave_type_id)
        .eq('year', leaveYear)
        .single();

      if (balance) {
        const refunded = Math.max(0, Number(balance.used_days || 0) - totalDays);
        await supabase.from('leave_balances').update({ used_days: refunded }).eq('id', balance.id);
      }
    }

    const { data: cancelled, error: cancelErr } = await supabase
      .from('leave_requests')
      .update({
        status: 'cancelled',
        reviewer_note: input.reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (cancelErr) throw new Error(cancelErr.message);

    return NextResponse.json({
      success: true,
      data: cancelled,
      message: 'Leave request cancelled successfully.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
