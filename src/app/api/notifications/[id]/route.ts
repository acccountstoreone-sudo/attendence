import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: notificationId } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', user.id); // Users can only delete their own notifications

    if (error) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Notification not found or access denied.' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { id: notificationId },
      message: 'Notification dismissed.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
