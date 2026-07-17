import { getAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy');

export interface DispatchNotificationOptions {
  userId: string;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'leave' | 'attendance' | 'attendance_approval' | 'attendance_decision' | 'system' | 'welcome' | 'correction' | 'payroll' | 'alert' | 'success';
  actionUrl?: string | null;
  sendEmail?: boolean;
  emailSubject?: string;
}

/**
 * Generates an ultra-modern, visually stunning HTML email template for Anchor Fashion
 */
export function getBeautifulEmailHtml(options: {
  title: string;
  message: string;
  type: string;
  actionUrl?: string | null;
  recipientName?: string;
}): string {
  const { title, message, type, actionUrl, recipientName } = options;
  const name = recipientName || 'Staff Member';

  let accentColor = '#1dbf73'; // Emerald (default/success)
  let badgeText = 'Notice';
  if (type === 'alert' || type === 'warning') {
    accentColor = '#f43f5e'; // Rose
    badgeText = 'Urgent Alert';
  } else if (type === 'attendance_approval' || type === 'attendance' || type === 'attendance_decision') {
    accentColor = '#f59e0b'; // Amber
    badgeText = 'Attendance Update';
  } else if (type === 'welcome') {
    accentColor = '#3b82f6'; // Blue
    badgeText = 'Account Activated';
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://accountstoreone.com';
  const fullLink = actionUrl
    ? actionUrl.startsWith('http')
      ? actionUrl
      : `${appUrl.replace(/\/$/, '')}/${actionUrl.replace(/^\//, '')}`
    : appUrl;

  const timestamp = new Date().toLocaleString('en-BD', {
    timeZone: 'Asia/Dhaka',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 35px 15px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
              
              <!-- Header -->
              <tr>
                <td style="background-color: #0C2B6A; padding: 28px 32px; text-align: left; border-bottom: 4px solid ${accentColor};">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td>
                        <h1 style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 2px; margin: 0; text-transform: uppercase;">
                          ANCHOR <span style="color: ${accentColor};">FASHION</span>
                        </h1>
                        <p style="color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; margin: 4px 0 0 0;">
                          HQ &amp; Store Operations Portal
                        </p>
                      </td>
                      <td align="right" valign="middle">
                        <span style="background-color: rgba(255, 255, 255, 0.12); color: #ffffff; font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
                          ${badgeText}
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Content Body -->
              <tr>
                <td style="padding: 36px 32px 28px 32px;">
                  <p style="color: #475569; font-size: 14px; margin: 0 0 16px 0;">
                    Hello <strong style="color: #0f172a;">${name}</strong>,
                  </p>
                  
                  <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin: 0 0 16px 0; line-height: 1.3;">
                    ${title}
                  </h2>

                  <div style="background-color: #f8fafc; border-left: 4px solid ${accentColor}; padding: 18px 20px; border-radius: 0 10px 10px 0; margin: 0 0 28px 0;">
                    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0;">
                      ${message.replace(/\n/g, '<br/>')}
                    </p>
                  </div>

                  <!-- Action Button Removed per User Request -->

                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #f1f5f9; margin-top: 28px; padding-top: 18px;">
                    <tr>
                      <td style="color: #94a3b8; font-size: 12px;">
                        <strong>Timestamp:</strong> ${timestamp}
                      </td>
                      <td align="right" style="color: #94a3b8; font-size: 12px;">
                        <strong>System ID:</strong> ${options.type.toUpperCase()}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f1f5f9; padding: 22px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="color: #64748b; font-size: 12px; margin: 0 0 6px 0;">
                    This is an automated system notification from the <strong>Anchor Fashion Operations Server</strong>.
                  </p>
                  <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                    &copy; ${new Date().getFullYear()} Anchor Fashion Ltd. All rights reserved. &bull; <a href="${appUrl}" style="color: #64748b; text-decoration: underline;">Portal Dashboard</a>
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
}

/**
 * Dispatches a notification to a single user in database AND sends email via Resend
 */
export async function dispatchNotification(options: DispatchNotificationOptions): Promise<boolean> {
  const { userId, title, message, type = 'info', actionUrl = null, sendEmail = true, emailSubject } = options;

  try {
    // Always use the service-role admin client so RLS never blocks the insert.
    // getAdminClient() returns a service-role client when SUPABASE_SERVICE_ROLE_KEY is set.
    // Without that env var the notification will silently fail — check your .env.local!
    const adminClient = getAdminClient();
    if (!adminClient) {
      console.error('[DispatchNotification] SUPABASE_SERVICE_ROLE_KEY is not set. Notification insert skipped.');
      return false;
    }

    // 1. Insert into public.notifications table
    const { error: dbError } = await adminClient.from('notifications').insert({
      user_id: userId,
      title: title.trim(),
      message: message.trim(),
      type,
      action_url: actionUrl || null,
      is_read: false,
    });

    if (dbError) {
      console.error(`[DispatchNotification] DB Insert Error for ${userId}:`, dbError);
    }

    // 2. Send email via Resend if requested
    if (sendEmail) {
      try {
        const { data: profile } = await adminClient
          .from('profiles')
          .select('email, full_name, is_active')
          .eq('id', userId)
          .maybeSingle();

        let targetEmail = profile?.email;
        if (!targetEmail) {
          const { data: authUser } = await adminClient.auth.admin.getUserById(userId);
          targetEmail = authUser?.user?.email;
        }

        if (targetEmail && process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('dummy')) {
          const htmlContent = getBeautifulEmailHtml({
            title,
            message,
            type,
            actionUrl,
            recipientName: profile?.full_name || 'Staff Member',
          });

          const fromAddress = process.env.RESEND_FROM_EMAIL || 'Anchor Fashion <noreply@accountstoreone.com>';
          let result = await resend.emails.send({
            from: fromAddress,
            to: targetEmail.trim().toLowerCase(),
            subject: emailSubject || `[Notice] ${title} — Anchor Fashion`,
            html: htmlContent,
          });

          // If Resend returns a domain verification error, automatically retry with onboarding@resend.dev
          if (result.error && (result.error.message?.toLowerCase().includes('domain') || result.error.message?.toLowerCase().includes('verify') || result.error.name === 'validation_error')) {
            console.warn(`[Email Delivery] Domain check note (${result.error.message}). Retrying via verified onboarding@resend.dev...`);
            result = await resend.emails.send({
              from: 'Anchor Fashion <onboarding@resend.dev>',
              to: targetEmail.trim().toLowerCase(),
              subject: emailSubject || `[Notice] ${title} — Anchor Fashion`,
              html: htmlContent,
            });
          }

          if (result.error) {
            console.error(`[DispatchNotification] Resend API returned error for ${targetEmail}:`, result.error);
          } else {
            console.log(`✉️ Email dispatched successfully to ${targetEmail} (Message ID: ${result.data?.id})`);
          }
        } else if (!targetEmail) {
          console.warn(`[DispatchNotification] No valid email found for user ID ${userId}`);
        }
      } catch (emailErr) {
        console.error(`[DispatchNotification] Email Send Error for ${userId}:`, emailErr);
      }
    }

    return true;
  } catch (err) {
    console.error('[DispatchNotification] Unexpected Error:', err);
    return false;
  }
}

/**
 * Dispatches notification + email to all active Admins
 */
export async function dispatchToAdmins(options: {
  title: string;
  message: string;
  type?: DispatchNotificationOptions['type'];
  actionUrl?: string | null;
  sendEmail?: boolean;
}): Promise<number> {
  try {
    const adminClient = getAdminClient();
    if (!adminClient) return 0;

    const { data: admins, error } = await adminClient
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('is_active', true);

    if (error || !admins || admins.length === 0) return 0;

    let count = 0;
    for (const admin of admins) {
      const success = await dispatchNotification({
        userId: admin.id,
        title: options.title,
        message: options.message,
        type: options.type || 'info',
        actionUrl: options.actionUrl || '/admin/attendance',
        sendEmail: options.sendEmail ?? true,
      });
      if (success) count++;
    }
    return count;
  } catch (err) {
    console.error('[DispatchToAdmins] Error:', err);
    return 0;
  }
}

export async function dispatchToBranchManagers(options: {
  branchId?: string | null;
  title: string;
  message: string;
  type?: DispatchNotificationOptions['type'];
  actionUrl?: string | null;
  sendEmail?: boolean;
}): Promise<number> {
  try {
    const adminClient = getAdminClient();
    if (!adminClient) return 0;

    let query = adminClient
      .from('profiles')
      .select('id')
      .eq('role', 'branch_manager')
      .eq('is_active', true);

    if (options.branchId && options.branchId !== 'all') {
      query = query.eq('branch_id', options.branchId);
    }

    const { data: managers, error } = await query;
    if (error || !managers || managers.length === 0) return 0;

    let count = 0;
    for (const mgr of managers) {
      const success = await dispatchNotification({
        userId: mgr.id,
        title: options.title,
        message: options.message,
        type: options.type || 'system',
        actionUrl: options.actionUrl || '/branch-manager/attendance',
        sendEmail: options.sendEmail ?? true,
      });
      if (success) count++;
    }
    return count;
  } catch (err) {
    console.error('[DispatchToBranchManagers] Error:', err);
    return 0;
  }
}

/**
 * Dispatches notification + email to all staff members of a specific branch (or all branches if 'all')
 */
export async function dispatchToBranchStaff(options: {
  branchId?: string | null;
  title: string;
  message: string;
  type?: DispatchNotificationOptions['type'];
  actionUrl?: string | null;
  sendEmail?: boolean;
  includeManagers?: boolean;
}): Promise<number> {
  try {
    const adminClient = getAdminClient();
    if (!adminClient) return 0;

    let query = adminClient
      .from('profiles')
      .select('id')
      .eq('is_active', true);

    if (!options.includeManagers) {
      query = query.eq('role', 'employee');
    }

    if (options.branchId && options.branchId !== 'all') {
      query = query.eq('branch_id', options.branchId);
    }

    const { data: staff, error } = await query;
    if (error || !staff || staff.length === 0) return 0;

    let count = 0;
    for (const emp of staff) {
      const success = await dispatchNotification({
        userId: emp.id,
        title: options.title,
        message: options.message,
        type: options.type || 'system',
        actionUrl: options.actionUrl || '/employee/history',
        sendEmail: options.sendEmail ?? true,
      });
      if (success) count++;
    }
    return count;
  } catch (err) {
    console.error('[DispatchToBranchStaff] Error:', err);
    return 0;
  }
}
