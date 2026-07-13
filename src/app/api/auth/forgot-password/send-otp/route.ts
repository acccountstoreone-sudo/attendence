import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body.email ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return NextResponse.json({ error: 'Email address is required.' }, { status: 400 });
    }

    const supabase = await createClient();
    const adminClient = getAdminClient(supabase);

    // 1. Check if user exists by email in profiles
    const { data: profileRow } = await adminClient
      .from('profiles')
      .select('id, full_name, email, is_active')
      .eq('email', email)
      .maybeSingle();

    let targetName = profileRow?.full_name || 'Valued Staff Member';
    let targetEmail = profileRow?.email || email;

    // If not found in profiles, check auth users list
    if (!profileRow) {
      const { data: usersList } = await adminClient.auth.admin.listUsers();
      const existingAuthUser = usersList?.users?.find(
        (u: { email?: string }) => u.email?.toLowerCase() === email
      );
      if (!existingAuthUser) {
        return NextResponse.json(
          { error: 'No account found with this email address. Please check your spelling or contact HR.' },
          { status: 404 }
        );
      }
      targetName = existingAuthUser.user_metadata?.full_name || 'Valued Staff Member';
      targetEmail = existingAuthUser.email || email;
    }

    // 2. Generate a 6-digit OTP code and 10-minute expiry
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // 3. Save code to public.otp_codes using adminClient
    const { error: dbError } = await adminClient.from('otp_codes').insert([
      {
        email: targetEmail.toLowerCase(),
        code: otpCode,
        expires_at: expiresAt.toISOString(),
        is_used: false,
      },
    ]);

    if (dbError) {
      console.error('Database Error storing OTP:', dbError);
      return NextResponse.json({ error: 'Failed to generate password reset code. Please try again.' }, { status: 500 });
    }

    console.log(`\n======================================================`);
    console.log(`🔑 FORGOT-PASSWORD OTP FOR ${targetEmail}: ${otpCode}`);
    console.log(`======================================================\n`);

    // 4. Send email via Resend
    if (process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('dummy')) {
      try {
        const fromAddress = process.env.RESEND_FROM_EMAIL || 'Anchor Fashion <noreply@accountstoreone.com>';
        const subject = 'Anchor Fashion — Password Reset Code';
        const htmlContent = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
            <title>Password Reset Code</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 15px;">
              <tr>
                <td align="center">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
                    
                    <!-- Header -->
                    <tr>
                      <td style="background-color: #0C2B6A; padding: 26px 32px; text-align: left; border-bottom: 4px solid #1dbf73;">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td>
                              <h1 style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 2px; margin: 0; text-transform: uppercase;">
                                ANCHOR <span style="color: #1dbf73;">FASHION</span>
                              </h1>
                              <p style="color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; margin: 4px 0 0 0;">
                                Security Verification Portal
                              </p>
                            </td>
                            <td align="right" valign="middle">
                              <span style="background-color: rgba(29, 191, 115, 0.2); color: #1dbf73; font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
                                Password Reset
                              </span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                      <td style="padding: 36px 32px 30px 32px;">
                        <p style="color: #475569; font-size: 15px; margin: 0 0 16px 0;">
                          Hello <strong style="color: #0f172a;">${targetName}</strong>,
                        </p>
                        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                          We received a request to reset your account password. Please enter the 6-digit verification code below into the password recovery portal:
                        </p>

                        <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f0fdf4; border: 2px dashed #86efac; border-radius: 12px;">
                          <div style="font-size: 11px; font-weight: 700; color: #15803d; text-transform: uppercase; tracking: 2px; margin-bottom: 8px;">
                            Verification Code
                          </div>
                          <div style="color: #16a34a; font-size: 38px; font-weight: 800; letter-spacing: 8px; font-family: monospace;">
                            ${otpCode}
                          </div>
                        </div>

                        <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0 0 16px 0;">
                          <strong>Note:</strong> This verification code will expire in <strong>10 minutes</strong>. If you did not request a password reset, you can safely ignore this email and your password will remain unchanged.
                        </p>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f1f5f9; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
                        <p style="color: #64748b; font-size: 12px; margin: 0;">
                          &copy; ${new Date().getFullYear()} Anchor Fashion Ltd. All rights reserved. &bull; Enterprise Security
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;

        let result = await resend.emails.send({
          from: fromAddress,
          to: targetEmail,
          subject,
          html: htmlContent,
        });

        // If domain verification is pending or fails, automatic retry via onboarding@resend.dev
        if (result.error && (result.error.message?.toLowerCase().includes('domain') || result.error.message?.toLowerCase().includes('verify') || result.error.name === 'validation_error')) {
          console.warn(`[Forgot Password Resend] Domain note (${result.error.message}). Retrying via verified onboarding@resend.dev...`);
          result = await resend.emails.send({
            from: 'Anchor Fashion <onboarding@resend.dev>',
            to: targetEmail,
            subject,
            html: htmlContent,
          });
        }

        if (result.error) {
          console.error(`[Forgot Password Resend Error] for ${targetEmail}:`, result.error);
        } else {
          console.log(`✉️ Forgot password OTP emailed to ${targetEmail} (Message ID: ${result.data?.id})`);
        }
      } catch (emailErr) {
        console.error('Error sending forgot password email via Resend:', emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email inbox.',
    });
  } catch (error: unknown) {
    console.error('Send Forgot Password OTP Endpoint Error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg || 'Internal server error' }, { status: 500 });
  }
}
