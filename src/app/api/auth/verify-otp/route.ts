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
       await supabase
        .from('profiles')
        .update({ registration_step: 'kyc' })
        .eq('id', user.id);
    }

    return NextResponse.json({ success: true, message: 'OTP verified successfully' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
