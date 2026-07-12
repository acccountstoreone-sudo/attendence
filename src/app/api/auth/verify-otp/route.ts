import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body.email ? body.email.trim().toLowerCase() : '';
    const code = body.code || body.otp;

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and verification code are required.' }, { status: 400 });
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
      return NextResponse.json({ error: 'Verification code is invalid or has expired.' }, { status: 400 });
    }

    if (otpRow.code !== code) {
      return NextResponse.json({ error: 'Incorrect verification code.' }, { status: 400 });
    }

    // 2. Mark OTP as used
    await adminClient
      .from('otp_codes')
      .update({ is_used: true })
      .eq('id', otpRow.id);

    // 3. Find user account by email or current session
    let userId: string | null = null;
    const { data: sessionData } = await supabase.auth.getUser();
    if (sessionData?.user) {
      userId = sessionData.user.id;
    } else {
      const { data: usersList } = await adminClient.auth.admin.listUsers();
      const existingUser = usersList?.users?.find((u: { email?: string }) => u.email?.toLowerCase() === email);
      if (existingUser) {
        userId = existingUser.id;
      }
    }

    // 4. Update registration step on profile to 'kyc'
    if (userId) {
      await adminClient
        .from('profiles')
        .update({ registration_step: 'kyc' })
        .eq('id', userId);
    }

    return NextResponse.json({ success: true, message: 'Email verified successfully.', userId });
  } catch (err: unknown) {
    console.error('Verify OTP Error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg || 'Internal server error during OTP verification.' }, { status: 500 });
  }
}
