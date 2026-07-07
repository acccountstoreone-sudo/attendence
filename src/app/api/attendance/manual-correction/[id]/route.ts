import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError, getSafeIpAddress } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireRole(['admin', 'branch_manager']);
    const body = await request.json();
    const { status, review_note } = body;

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch the request
    const { data: correctionRequest, error: fetchErr } = await supabase
      .from('correction_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !correctionRequest) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    // Branch manager constraint
    if (user.role === 'branch_manager' && correctionRequest.branch_id !== user.branch_id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (correctionRequest.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Request already processed' }, { status: 400 });
    }

    // Update the request
    const { error: updateErr } = await supabase
      .from('correction_requests')
      .update({
        status,
        reviewer_note: review_note || null,
        reviewed_by: user.id,
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    // Apply the correction if approved
    if (status === 'approved') {
      let recordId = correctionRequest.record_id;

      if (recordId) {
        // Update existing record
        const updateData: any = { is_manual_override: true, override_reason: correctionRequest.reason };
        if (correctionRequest.type === 'check_in') {
          updateData.check_in_time = correctionRequest.requested_time;
        } else {
          updateData.check_out_time = correctionRequest.requested_time;
        }

        await supabase
          .from('attendance_records')
          .update(updateData)
          .eq('id', recordId);
      } else {
        // Create new record
        const insertData: any = {
          employee_id: correctionRequest.employee_id,
          branch_id: correctionRequest.branch_id,
          date: correctionRequest.date,
          status: 'present',
          is_manual_override: true,
          override_reason: correctionRequest.reason,
          check_in_method: 'manual',
        };
        if (correctionRequest.type === 'check_in') {
          insertData.check_in_time = correctionRequest.requested_time;
        } else {
          insertData.check_out_time = correctionRequest.requested_time;
        }
        await supabase.from('attendance_records').insert(insertData);
      }
      
    }

    return NextResponse.json({
      success: true,
      message: `Correction request ${status} successfully.`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
