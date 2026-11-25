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

    // Branch manager constraint — NEW-06 fix: handle null branch_id (admin-created corrections)
    if (user.role === 'branch_manager') {
      // If correction has a branch_id, use it; otherwise look up the employee's branch
      const correctionBranchId = correctionRequest.branch_id || await (async () => {
        const { data: emp } = await supabase
          .from('profiles')
          .select('branch_id')
          .eq('id', correctionRequest.employee_id)
          .single();
        return emp?.branch_id;
      })();
      if (correctionBranchId !== user.branch_id) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
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
      const recordId = correctionRequest.record_id;

      if (recordId) {
        // Update existing record
        const updateData: Record<string, string | boolean> = { is_manual_override: true, override_reason: correctionRequest.reason };
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
        // Resolve branch coordinates to satisfy NOT NULL constraints on attendance_records
        const { data: branchGeo } = correctionRequest.branch_id
          ? await supabase
              .from('branches')
              .select('latitude, longitude')
              .eq('id', correctionRequest.branch_id)
              .maybeSingle()
          : { data: null };

        const fallbackLat = Number(branchGeo?.latitude ?? 23.8103);
        const fallbackLng = Number(branchGeo?.longitude ?? 90.4125);

        // Create new record
        const insertData: Record<string, string | number | boolean> = {
          employee_id: correctionRequest.employee_id,
          branch_id: correctionRequest.branch_id,
          check_in_lat: fallbackLat,
          check_in_lng: fallbackLng,
          face_verified: false,
          status: 'present',
          approval_status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          approval_note: review_note || correctionRequest.reason,
          is_manual_override: true,
          override_reason: correctionRequest.reason,
        };
        if (correctionRequest.type === 'check_in') {
          insertData.check_in_time = correctionRequest.requested_time;
        } else {
          insertData.check_in_time = correctionRequest.requested_time;
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
