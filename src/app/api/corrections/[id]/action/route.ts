import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const actionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reviewer_note: z.string().optional(),
});

/**
 * POST /api/corrections/[id]/action
 * Approves or rejects an attendance correction request.
 * If approved, updates or inserts the exact timestamp in attendance_records.
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

    // 1. Fetch the correction request
    const { data: correction, error: fetchErr } = await supabase
      .from('correction_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !correction) {
      return NextResponse.json(
        { success: false, error: 'Correction request not found.' },
        { status: 404 }
      );
    }

    // 2. Enforce Branch Manager scope
    if (user.role === 'branch_manager' && correction.branch_id !== user.branch_id) {
      return NextResponse.json(
        { success: false, error: 'You can only manage corrections for your assigned branch.' },
        { status: 403 }
      );
    }

    if (correction.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `This correction request is already ${correction.status}.` },
        { status: 400 }
      );
    }

    // 3. If approved, apply the correction to attendance_records
    if (input.action === 'approve') {
      const targetDate = correction.date;
      const requestedISO = correction.requested_time;
      const recordId = correction.record_id;

      if (recordId) {
        // Update existing record
        const updateField = correction.type === 'check_in' ? { check_in_time: requestedISO } : { check_out_time: requestedISO };
        const { error: recUpdErr } = await supabase
          .from('attendance_records')
          .update({
            ...updateField,
            is_manual_entry: true,
            manual_reason: `Approved Correction: ${correction.reason}`,
          })
          .eq('id', recordId);

        if (recUpdErr) {
          // If is_manual_entry column is missing on older schema, update timestamp directly
          await supabase.from('attendance_records').update(updateField).eq('id', recordId);
        }
      } else {
        // No record_id attached: search for existing record on that date or insert new one
        const startOfDayISO = `${targetDate}T00:00:00.000+06:00`;
        const endOfDayISO = `${targetDate}T23:59:59.999+06:00`;

        const { data: existingRecs } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('employee_id', correction.employee_id)
          .gte('check_in_time', startOfDayISO)
          .lte('check_in_time', endOfDayISO)
          .order('check_in_time', { ascending: true });

        if (existingRecs && existingRecs.length > 0) {
          const targetRec = correction.type === 'check_in' ? existingRecs[0] : existingRecs[existingRecs.length - 1];
          const updateField = correction.type === 'check_in' ? { check_in_time: requestedISO } : { check_out_time: requestedISO };
          await supabase.from('attendance_records').update(updateField).eq('id', targetRec.id);
        } else if (correction.type === 'check_in') {
          // Create new attendance check-in record
          await supabase.from('attendance_records').insert({
            employee_id: correction.employee_id,
            branch_id: correction.branch_id,
            check_in_time: requestedISO,
            status: 'present',
            is_manual_entry: true,
            manual_reason: `Approved Correction: ${correction.reason}`,
          });
        }
      }
    }

    // 4. Update status of correction request
    const { data: updatedCorrection, error: updErr } = await supabase
      .from('correction_requests')
      .update({
        status: input.action === 'approve' ? 'approved' : 'rejected',
        reviewed_by: user.id,
        reviewer_note: input.reviewer_note || (input.action === 'approve' ? 'Approved' : 'Rejected'),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updErr) throw new Error(updErr.message);

    return NextResponse.json({
      success: true,
      data: updatedCorrection,
      message: `Correction request has been ${input.action}d successfully.`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
