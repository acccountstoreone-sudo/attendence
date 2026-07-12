import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createNotificationSchema = z.object({
  user_id: z.string().uuid(),
  title: z.string().min(2),
  message: z.string().min(2),
  // SQL-04 fix: expanded type enum to match DB CHECK constraint
  type: z.enum([
    'info', 'warning', 'leave', 'attendance',
    'attendance_approval', 'attendance_decision',
    'system', 'welcome', 'correction', 'payroll', 'alert', 'success',
  ]).default('info'),
  action_url: z.string().optional(), // SQL-05 fix: was link_url, DB column is action_url
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = Number(searchParams.get('limit')) || 30;

    const supabase = await createClient();
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;
    if (error) throw new Error(`Failed to fetch notifications: ${error.message}`);

    // Count unread badge total
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    return NextResponse.json({
      success: true,
      data: notifications || [],
      meta: { unread_count: unreadCount || 0 },
      message: 'Notifications retrieved successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Admin or system trigger can send notifications
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'branch_manager')) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'FORBIDDEN', message: 'Not authorized to send notifications' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const payload = createNotificationSchema.parse(body);

    const supabase = await createClient();
    const { data: newNotif, error } = await supabase
      .from('notifications')
      .insert({
        user_id: payload.user_id,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        action_url: payload.action_url || null, // SQL-05 fix: was link_url
        is_read: false,
      })
      .select()
      .single();

    if (error || !newNotif) throw new Error(`Failed to create notification: ${error?.message}`);

    return NextResponse.json(
      { success: true, data: newNotif, message: 'Notification dispatched.', timestamp: new Date().toISOString() },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}


