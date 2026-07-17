import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const approveBreakSchema = z.object({
  break_id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['branch_manager', 'admin']);
    const body = await request.json();
    const input = approveBreakSchema.parse(body);

    const supabase = await createClient();

    // 1. Get the break record to verify branch access
    const { data: breakRecord, error: fetchErr } = await supabase
      .from('attendance_breaks')
      .select('id, status, branch_id')
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

    return NextResponse.json({
      success: true,
      data: updatedBreak,
      message: `Gate Pass successfully ${newStatus}.`
    });

  } catch (error) {
    return handleApiError(error);
  }
}
