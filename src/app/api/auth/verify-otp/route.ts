import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and OTP code are required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Find the latest valid OTP for this email
    const { data, error } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('is_used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Invalid or expired OTP code' }, { status: 400 });
    }

    if (data.code !== code) {
      return NextResponse.json({ error: 'Incorrect OTP code' }, { status: 400 });
    }

    // Mark as used
    await supabase
      .from('otp_codes')
      .update({ is_used: true })
      .eq('id', data.id);

    // Update the profile registration_step to 'kyc'
    // First, find the user by email (we assume the user was created in auth.users)
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
    // (Note: Supabase requires service role key to search users by email easily,
    // or we can just update the profile by email if we stored email in profiles. 
    // Since 'email' is not in 'profiles' by default, the frontend should ideally pass the user ID. 
    // Wait, the user is already signed in via Supabase Auth when they registered.
    // So we can just get their session.)

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
       const { createClient: createAdminClient } = await import('@supabase/supabase-js');
       const adminClient = process.env.SUPABASE_SERVICE_ROLE_KEY
         ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
         : supabase;

       await adminClient
        .from('profiles')
        .update({ registration_step: 'kyc' })
        .eq('id', user.id);
    }

    return NextResponse.json({ success: true, message: 'OTP verified successfully' });

  } catch (error: unknown) {
    console.error('Verify OTP Error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg || 'Internal server error' }, { status: 500 });
  }
}

