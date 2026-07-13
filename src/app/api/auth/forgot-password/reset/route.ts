import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { dispatchNotification } from '@/lib/notification-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body.email ? body.email.trim().toLowerCase() : '';
    const code = body.code || body.otp;
    const newPassword = body.newPassword;

    if (!email || !code || !newPassword) {
      return NextResponse.json(
        { error: 'Email, verification code, and new password are required.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const adminClient = getAdminClient(supabase);

    // 1. Find the latest valid OTP for this email
    const { data: otpRow, error: otpError } = await adminClient
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('is_used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpRow) {
      return NextResponse.json(
        { error: 'Verification code is invalid or has expired. Please check your code or request a new one.' },
        { status: 400 }
      );
    }

    if (otpRow.code !== code.trim()) {
      return NextResponse.json(
        { error: 'Incorrect verification code. Please double-check and try again.' },
        { status: 400 }
      );
    }

    // 2. Mark OTP as used
    await adminClient
      .from('otp_codes')
      .update({ is_used: true })
      .eq('id', otpRow.id);

    // 3. Find user account ID by email
    let userId: string | null = null;
    const { data: profileRow } = await adminClient
      .from('profiles')
      .select('id, full_name, email')
      .eq('email', email)
      .maybeSingle();

    if (profileRow?.id) {
      userId = profileRow.id;
    } else {
      const { data: usersList } = await adminClient.auth.admin.listUsers();
      const existingUser = usersList?.users?.find(
        (u: { email?: string }) => u.email?.toLowerCase() === email
      );
      if (existingUser) {
        userId = existingUser.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Associated user account could not be found.' },
        { status: 404 }
      );
    }

    // 4. Update the user password in Supabase Auth
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateError) {
      console.error('UpdateUserById error:', updateError);
      return NextResponse.json(
        { error: `Failed to update password: ${updateError.message}` },
        { status: 500 }
      );
    }

    // 5. Dispatch security confirmation email/notification
    await dispatchNotification({
      userId,
      title: 'Security Alert: Password Changed',
      message: 'Your account password was just reset and updated successfully via the Forget Password portal. If you did not perform this action, contact IT Support immediately.',
      type: 'alert',
      actionUrl: '/login',
      sendEmail: true,
      emailSubject: 'Anchor Fashion — Password Changed Successfully',
    });

    return NextResponse.json({
      success: true,
      message: 'Your password has been updated successfully. You can now log in with your new password.',
    });
  } catch (error: unknown) {
    console.error('Reset Password Endpoint Error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg || 'Internal server error during password reset.' }, { status: 500 });
  }
}
