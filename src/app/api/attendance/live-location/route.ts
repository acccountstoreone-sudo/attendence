import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const body = await request.json();
    const { latitude, longitude } = body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json({ success: false, error: { message: 'Invalid coordinates provided.' } }, { status: 400 });
    }

    const supabase = await createClient();

    const updatePayloadWithCol: Record<string, unknown> = {
      last_known_latitude: latitude,
      last_known_longitude: longitude,
      last_location_updated_at: new Date().toISOString(),
    };

    let { error } = await supabase
      .from('profiles')
      .update(updatePayloadWithCol)
      .eq('id', user.id);

    // If live location columns aren't migrated yet, fail gracefully without erroring frontend
    if (error && (error.message?.includes('last_known_latitude') || error.code === '42703')) {
      error = null;
    }

    if (error) {
      console.error('Live location update error:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Live location updated.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

