import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, phone, branchId } = await req.json();

    if (!email || !password || !fullName || !branchId) {
      return NextResponse.json({ error: 'Full name, email, password, and branch selection are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const supabase = await createClient();
    const adminClient = getAdminClient(supabase);

    // 1. Check if user already exists in auth.users by attempting listUsers or checking profile/email
    // Note: To find existing users by email via admin API or check profile if email was stored:
    // Let's create user via adminClient.auth.admin.createUser
    let userId: string | null = null;

    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone || '',
        branch_id: branchId,
      },
    });

    if (createError) {
      // If user already registered, check if their profile is still pending onboarding
      if (createError.message.toLowerCase().includes('already') || createError.status === 400 || createError.status === 422) {
        // Look up user using admin client listUsers
        const { data: usersList } = await adminClient.auth.admin.listUsers();
        const existingUser = usersList?.users?.find((u: { email?: string }) => u.email?.toLowerCase() === cleanEmail);

        if (existingUser) {
          userId = existingUser.id;
          // Check profile status
          const { data: existingProfile } = await adminClient.from('profiles').select('is_active, registration_step, role').eq('id', userId).single();
          if (existingProfile && existingProfile.is_active && existingProfile.registration_step === 'completed') {
            return NextResponse.json({ error: 'An active employee account with this email already exists. Please sign in.' }, { status: 409 });
          }

          // Update password for pending account
          await adminClient.auth.admin.updateUserById(userId, { password });
        } else {
          return NextResponse.json({ error: createError.message }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: createError.message }, { status: 400 });
      }
    } else if (createData.user) {
      userId = createData.user.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Failed to create user account.' }, { status: 500 });
    }

    // 2. Ensure profile is updated with onboarding details and status = 'otp'
    await adminClient.from('profiles').upsert({
      id: userId,
      full_name: fullName,
      phone: phone || null,
      branch_id: branchId,
      role: 'employee',
      is_active: false,
      registration_step: 'otp',
    }, { onConflict: 'id' });

    // 3. Generate 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Mark previous unused OTP codes for this email as used
    await adminClient.from('otp_codes').update({ is_used: true }).eq('email', cleanEmail).eq('is_used', false);

    // Save new OTP to database
    const { error: otpDbError } = await adminClient.from('otp_codes').insert({
      email: cleanEmail,
      code: otpCode,
      expires_at: expiresAt.toISOString(),
    });

    if (otpDbError) {
      console.error('OTP DB Error:', otpDbError);
      return NextResponse.json({ error: 'Failed to generate verification code.' }, { status: 500 });
    }

    // Console log for local testing
    console.log(`\n========================================`);
    console.log(`🔑 REGISTRATION OTP FOR ${cleanEmail}: ${otpCode}`);
    console.log(`========================================\n`);

    // 4. Send email via Resend
    try {
      if (process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('dummy')) {
        await resend.emails.send({
          from: 'Anchor Fashion <noreply@accountstoreone.com>',
          to: cleanEmail,
          subject: 'Anchor Fashion — Verification Code',
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #0C2B6A; margin-top: 0;">Welcome to Anchor Fashion!</h2>
              <p style="color: #475569; font-size: 15px;">Hello <strong>${fullName}</strong>,</p>
              <p style="color: #475569; font-size: 15px;">Please use the 6-digit verification code below to complete your employee registration:</p>
              <div style="text-align: center; margin: 25px 0;">
                <h1 style="color: #1dbf73; font-size: 36px; letter-spacing: 6px; margin: 0; padding: 15px; background: #f0fdf4; border-radius: 8px; display: inline-block;">${otpCode}</h1>
              </div>
              <p style="color: #64748b; font-size: 13px;">This code will expire in 10 minutes. If you did not request this registration, please ignore this email.</p>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      console.error('Resend Email Error:', emailErr);
    }

    return NextResponse.json({ success: true, message: 'Verification code sent successfully.', userId });
  } catch (err: unknown) {
    console.error('Registration Endpoint Error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg || 'Internal server error during registration.' }, { status: 500 });
  }
}
