import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email address is required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const supabase = await createClient();
    const adminClient = getAdminClient(supabase);

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save to DB using admin client to guarantee bypass of RLS on otp_codes
    const { error: dbError } = await adminClient
      .from('otp_codes')
      .insert([
        {
          email: cleanEmail,
          code: otpCode,
          expires_at: expiresAt.toISOString(),
        }
      ]);

    if (dbError) {
      console.error('OTP DB Error:', dbError);
      return NextResponse.json({ error: 'Failed to generate verification code.' }, { status: 500 });
    }

    console.log(`\n========================================`);
    console.log(`🔑 SEND-OTP FOR ${cleanEmail}: ${otpCode}`);
    console.log(`========================================\n`);

    try {
      if (process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('dummy')) {
        await resend.emails.send({
          from: 'Anchor Fashion <noreply@accountstoreone.com>',
          to: cleanEmail,
          subject: 'Anchor Fashion — Verification Code',
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #0C2B6A; margin-top: 0;">Verify Your Identity</h2>
              <p style="color: #475569; font-size: 15px;">Please use the 6-digit verification code below to continue:</p>
              <div style="text-align: center; margin: 25px 0;">
                <h1 style="color: #1dbf73; font-size: 36px; letter-spacing: 6px; margin: 0; padding: 15px; background: #f0fdf4; border-radius: 8px; display: inline-block;">${otpCode}</h1>
              </div>
              <p style="color: #64748b; font-size: 13px;">This code will expire in 10 minutes.</p>
            </div>
          `,
        });
      }
    } catch (emailError) {
      console.error('Resend Email Error:', emailError);
    }

    return NextResponse.json({ success: true, message: 'Verification code sent successfully.' });
  } catch (error: unknown) {
    console.error('Send OTP Endpoint Error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg || 'Internal server error' }, { status: 500 });
  }
}
