import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let user;
    let userId;
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser(token);
      user = data.user;
      userId = user?.id;
    } else {
      const currentUser = await getCurrentUser();
      user = currentUser;
      userId = currentUser?.id;
    }

    if (!user || !userId) {
      return NextResponse.json({ success: false, error: { message: 'UNAUTHENTICATED' } }, { status: 401 });
    }

    const body = await request.json();
    const { faceDescriptor, selfieUrl, latitude, longitude } = body;

    if (!Array.isArray(faceDescriptor) || faceDescriptor.length === 0) {
      return NextResponse.json({ success: false, error: { message: 'Invalid biometric face descriptor array provided.' } }, { status: 400 });
    }

    const supabase = await createClient();

    const updatePayloadWithCol: Record<string, unknown> = {
      face_enrolled: true,
      face_descriptor: faceDescriptor,
      requires_face_reverification: false,
      ...(selfieUrl ? { selfie_url: selfieUrl, photo_url: selfieUrl } : {}),
      ...(typeof latitude === 'number' && typeof longitude === 'number' ? {
        first_verified_latitude: latitude,
        first_verified_longitude: longitude,
        first_verified_at: new Date().toISOString(),
        last_known_latitude: latitude,
        last_known_longitude: longitude,
        last_location_updated_at: new Date().toISOString(),
      } : {})
    };

    let { error } = await supabase
      .from('profiles')
      .update(updatePayloadWithCol)
      .eq('id', userId);

    if (error && (error.message?.includes('requires_face_reverification') || error.message?.includes('first_verified_latitude') || error.code === '42703')) {
      const fallbackPayload: Record<string, unknown> = {
        face_enrolled: true,
        face_descriptor: faceDescriptor,
        ...(selfieUrl ? { selfie_url: selfieUrl, photo_url: selfieUrl } : {})
      };
      const fallbackRes = await supabase
        .from('profiles')
        .update(fallbackPayload)
        .eq('id', userId);
      error = fallbackRes.error;
    }

    if (error) {
      throw new Error(`Failed to save biometric enrollment: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Biometric face verification enrolled/reverified successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

