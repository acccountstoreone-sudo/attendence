import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy');

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save to DB
    const { error: dbError } = await supabase
      .from('otp_codes')
      .insert([
        {
          email,
          code: otpCode,
          expires_at: expiresAt.toISOString(),
        }
      ]);

    if (dbError) {
      console.error('OTP DB Error:', dbError);
      return NextResponse.json({ error: 'Failed to generate OTP' }, { status: 500 });
    }

    // Always log the OTP to the server console for easy testing during development
    console.log(`\n========================================`);
    console.log(`🔑 OTP CODE FOR ${email}: ${otpCode}`);
    console.log(`========================================\n`);

    try {
      if (process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('dummy')) {
        const { data, error } = await resend.emails.send({
          from: 'Anchor Fashion <noreply@accountstoreone.com>',
          to: email,
          subject: 'Your Registration Verification Code',
          html: `
            <div style="font-family: sans-serif; max-w-md; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #0C2B6A;">Verify Your Identity</h2>
              <p>Hello,</p>
              <p>Please use the following 6-digit code to complete your Anchor Fashion registration:</p>
              <h1 style="color: #004417; letter-spacing: 5px;">${otpCode}</h1>
              <p>This code will expire in 10 minutes.</p>
              <br/>
              <p style="font-size: 12px; color: #666;">If you didn't request this, please ignore this email.</p>
            </div>
          `,
        });

        if (error) {
          console.error('❌ Resend API Error:', error);
        } else {
          console.log('✅ Email sent via Resend:', data);
        }
      }
    } catch (emailError) {
      console.error('❌ Unexpected Resend Error:', emailError);
    }

    return NextResponse.json({ success: true, message: 'OTP sent successfully' });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg || 'Internal server error' }, { status: 500 });
  }
}

