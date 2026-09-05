import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { dispatchToAdmins } from '@/lib/notification-service';


async function uploadDataUrl(supabase: any, dataUrl: string, pathPrefix: string, userId: string) {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    // Fallback if regex doesn't match standard data url prefix
    const base64Data = dataUrl.replace(/^data:.*;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = `${userId}/${pathPrefix}_${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('avatars').upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    return supabase.storage.from('avatars').getPublicUrl(fileName).data.publicUrl;
  }

  const contentType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');
  
  const ext = contentType === 'application/pdf' ? 'pdf' : contentType.split('/')[1] || 'jpg';
  const fileName = `${userId}/${pathPrefix}_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase
    .storage
    .from('avatars')
    .upload(fileName, buffer, {
      contentType: contentType,
      upsert: true
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
  return publicUrlData.publicUrl;
}

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { nid, nidFrontDataUrl, nidBackDataUrl, facePhotoDataUrl, faceDescriptor, fingerprintEnrolled } = await request.json();

    if (!nidFrontDataUrl || !nidBackDataUrl) {
      return NextResponse.json({ error: 'NID Front Side and NID Back Side copies are required.' }, { status: 400 });
    }

    if (!faceDescriptor && !fingerprintEnrolled) {
      return NextResponse.json({ error: 'At least one biometric verification method (Face Scan OR Fingerprint) is required.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 });
    }

    const adminClient = getAdminClient(supabase);

    // Upload NID Front, NID Back, and Face Photo (if provided) to Supabase Storage using adminClient
    const frontUrl = await uploadDataUrl(adminClient, nidFrontDataUrl, 'nid_front', user.id);
    const backUrl = await uploadDataUrl(adminClient, nidBackDataUrl, 'nid_back', user.id);
    const photoUrl = facePhotoDataUrl ? await uploadDataUrl(adminClient, facePhotoDataUrl, 'kyc_face', user.id) : null;

    const updatePayload: Record<string, unknown> = {
      nid_front_url: frontUrl,
      nid_back_url: backUrl,
      kyc_status: 'pending',
      registration_step: 'pending_approval',
      face_enrolled: Boolean(faceDescriptor && Array.isArray(faceDescriptor) && faceDescriptor.length > 0),
      face_descriptor: faceDescriptor || null,
      fingerprint_enrolled: Boolean(fingerprintEnrolled),
    };

    if (photoUrl) {
      updatePayload.photo_url = photoUrl;
    }
    if (nid !== undefined && nid !== null && nid !== '') {
      updatePayload.nid = nid;
    }

    let { error: profileError } = await adminClient
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id);

    // If column fingerprint_enrolled is missing in schema cache before migration, retry without it
    if (profileError && (profileError.code === '42703' || profileError.message?.includes('fingerprint_enrolled') || profileError.message?.includes('schema cache'))) {
      delete updatePayload.fingerprint_enrolled;
      const fallbackRes = await adminClient.from('profiles').update(updatePayload).eq('id', user.id);
      profileError = fallbackRes.error;
    }

    if (profileError) {
       console.error('KYC Update Error Detailed:', profileError);
       const errMsg = profileError.message || profileError.details || profileError.hint || JSON.stringify(profileError);
       if (errMsg.includes('profiles_nid_key') || errMsg.includes('duplicate key') || errMsg.includes('unique constraint')) {
          return NextResponse.json({ error: 'This NID number is already registered to another account. Please verify your NID or use a unique NID.' }, { status: 400 });
       }
       return NextResponse.json({ error: `Database error during profile update: ${errMsg}` }, { status: 400 });
    }

    // Notify all Admins about new KYC application requiring review (with email)
    await dispatchToAdmins({
      title: '📋 New KYC Application & Biometrics Submitted',
      message: `${user.email} has submitted their NID and biometric enrollment data for management review.`,
      type: 'info',
      actionUrl: '/admin/employees',
      sendEmail: true,
    });

    return NextResponse.json({ success: true, message: 'KYC Documents & Biometric Verification Submitted. Waiting for approval.' });

  } catch (error: unknown) {
    console.error('KYC Submit Error:', error);
    const msg = error instanceof Error 
      ? error.message 
      : (typeof error === 'object' && error !== null && 'message' in error ? String((error as { message: unknown }).message) : JSON.stringify(error));
    return NextResponse.json({ error: msg || 'Internal server error during document upload.' }, { status: 500 });
  }
}

