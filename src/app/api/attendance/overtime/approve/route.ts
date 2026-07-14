import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const approveOvertimeSchema = z.object({
  record_id: z.string().uuid(),
  status: z.enum(['approved', 'rejected', 'pending']),
  approved_minutes: z.number().int().min(0).optional(),
  note: z.string().max(500).optional(),
});

/**
 * PUT /api/attendance/overtime/approve
 * Allows Admin or Branch Manager to approve/reject overtime for an attendance record.
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const body = await request.json();
    const payload = approveOvertimeSchema.parse(body);

    const supabase = await createClient();

    // Fetch the attendance record first to check branch ownership
    const { data: record, error: fetchErr } = await supabase
      .from('attendance_records')
      .select('id, branch_id, overtime_minutes')
      .eq('id', payload.record_id)
      .single();

    if (fetchErr || !record) {
      throw new Error('NOT_FOUND: Attendance record not found');
    }

    // Branch Managers can only approve overtime for records in their assigned store
    if (user.role === 'branch_manager' && record.branch_id !== user.branch_id) {
      throw new Error('FORBIDDEN: You can only verify overtime for employees in your assigned branch.');
    }

    const approvedMins = payload.status === 'rejected' 
      ? 0 
      : (payload.approved_minutes !== undefined ? payload.approved_minutes : record.overtime_minutes);

    const { data: updatedRecord, error: updateErr } = await supabase
      .from('attendance_records')
      .update({
        overtime_approval_status: payload.status,
        approved_overtime_minutes: approvedMins,
        overtime_approval_note: payload.note || null,
        is_manual_override: true,
      })
      .eq('id', payload.record_id)
      .select()
      .single();

    if (updateErr || !updatedRecord) {
      throw new Error(`Failed to update overtime approval status: ${updateErr?.message}`);
    }

    return NextResponse.json({
      success: true,
      data: updatedRecord,
      message: `Overtime status updated to ${payload.status.toUpperCase()} (${approvedMins} mins approved).`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
