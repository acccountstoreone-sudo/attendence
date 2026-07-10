import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, credentialId: string }> }
) {
  try {
    const { id: targetEmployeeId, credentialId } = await params;
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'branch_manager')) {
      return NextResponse.json(
        { success: false, error: { message: 'UNAUTHORIZED: Only Admin or Branch Manager can delete fingerprints.' } },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    // Verify target exists
    const { data: targetProfile, error: profErr } = await supabase
      .from('profiles')
      .select('id, full_name, role, branch_id')
      .eq('id', targetEmployeeId)
      .single();

    if (profErr || !targetProfile) {
      return NextResponse.json(
        { success: false, error: { message: 'Employee profile not found.' } },
        { status: 404 }
      );
    }

    if (user.role === 'branch_manager' && targetProfile.branch_id !== user.branch_id) {
      return NextResponse.json(
        { success: false, error: { message: 'UNAUTHORIZED: Cannot manage biometrics for employee in another branch.' } },
        { status: 403 }
      );
    }

    // Delete the credential
    const { error: delErr } = await supabase
      .from('webauthn_credentials')
      .delete()
      .eq('id', credentialId)
      .eq('user_id', targetEmployeeId);

    if (delErr) {
      throw new Error(`Failed to delete fingerprint: ${delErr.message}`);
    }

    // Send high-priority notification to the employee
    try {
      await supabase.from('notifications').insert({
        user_id: targetEmployeeId,
        title: '⚠️ Device Biometric Removed by Admin',
        message: 'A fingerprint/passkey registered to your account has been removed by management. If you wish to use fingerprint check-in, you must re-register your device.',
        type: 'warning',
      });
    } catch (err) {
      console.error('Notification insert failed:', err);
    }

    return NextResponse.json({
      success: true,
      message: `Fingerprint deleted for ${targetProfile.full_name}. Notification sent.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
