import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending'; // pending, approved, rejected, all
    const branchId = searchParams.get('branchId');

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, branch_id')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    if (profile.role !== 'admin' && profile.role !== 'branch_manager') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    let query = supabase
      .from('off_day_overtime_requests')
      .select(`
        id,
        requested_date,
        reason,
        status,
        created_at,
        reviewer_note,
        profiles!off_day_overtime_requests_employee_id_fkey(full_name, employee_id),
        branches!off_day_overtime_requests_branch_id_fkey(name)
      `)
      .order('created_at', { ascending: false });

    // Role-based filtering
    if (profile.role === 'branch_manager') {
      query = query.eq('branch_id', profile.branch_id);
    } else if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    // Status filtering
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase.from('profiles').select('role, branch_id').eq('id', user.id).single();
    if (!profile || (profile.role !== 'admin' && profile.role !== 'branch_manager')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { requestId, status: actionStatus, reviewer_note } = body;

    let finalStatus = actionStatus;
    if (actionStatus === 'approve') finalStatus = 'approved';
    if (actionStatus === 'reject') finalStatus = 'rejected';

    if (!requestId || !['approved', 'rejected'].includes(finalStatus)) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    // Update the request
    const { data: request, error: fetchErr } = await supabase
      .from('off_day_overtime_requests')
      .select('branch_id')
      .eq('id', requestId)
      .single();

    if (fetchErr || !request) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    // Ensure branch manager can only approve their own branch
    if (profile.role === 'branch_manager' && request.branch_id !== profile.branch_id) {
      return NextResponse.json({ success: false, error: 'Cannot approve for another branch' }, { status: 403 });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('off_day_overtime_requests')
      .update({
        status: finalStatus,
        reviewer_note,
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
