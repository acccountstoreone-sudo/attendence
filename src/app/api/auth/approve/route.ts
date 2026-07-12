import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { dispatchNotification } from '@/lib/notification-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { userId, action } = await request.json(); // action = 'approve' | 'reject'

    if (!userId || !action) {
      return NextResponse.json({ error: 'User ID and Action (approve/reject) are required.' }, { status: 400 });
    }

    const supabase = await createClient();
    const adminClient = getAdminClient(supabase);

    // 1. Verify caller authentication
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    // 2. Check caller authorization (Must be admin or branch manager)
    const { data: callerProfile, error: callerError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    if (callerError || !callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'branch_manager')) {
      return NextResponse.json({ error: 'Forbidden: Only Administrators and Branch Managers can approve or reject employee accounts.' }, { status: 403 });
    }

    // 3. Inspect target profile
    const { data: targetProfile, error: targetError } = await adminClient
      .from('profiles')
      .select('role, branch_id')
      .eq('id', userId)
      .single();

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'Target employee profile not found.' }, { status: 404 });
    }

    if (action === 'approve') {
      if (targetProfile.role !== 'admin' && !targetProfile.branch_id) {
        return NextResponse.json({ error: 'Cannot approve an employee without an assigned branch. Please edit their profile first.' }, { status: 400 });
      }

      const { error: updateError } = await adminClient
        .from('profiles')
        .update({
          registration_step: 'completed',
          kyc_status: 'verified',
          is_active: true,
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      await dispatchNotification({
        userId,
        title: '🎉 Account Approved & Activated!',
        message: 'Congratulations! Your KYC documents and biometric verification have been approved by management. You can now log in and check in.',
        type: 'welcome',
        actionUrl: '/employee/check-in',
        sendEmail: true,
      });

      return NextResponse.json({ success: true, message: 'Employee successfully approved and activated.' });
    } else if (action === 'reject') {
      const { error: updateError } = await adminClient
        .from('profiles')
        .update({
          registration_step: 'rejected',
          kyc_status: 'rejected',
          is_active: false,
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      await dispatchNotification({
        userId,
        title: '⚠️ Account Registration Rejected',
        message: 'Your registration request was not approved by management. Please contact your Branch Manager or HR for clarification.',
        type: 'warning',
        actionUrl: '/login',
        sendEmail: true,
      });

      return NextResponse.json({ success: true, message: 'Employee registration rejected.' });
    } else {
      return NextResponse.json({ error: 'Invalid action specified. Must be "approve" or "reject".' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Approve/Reject Endpoint Error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg || 'Internal server error during account review.' }, { status: 500 });
  }
}
