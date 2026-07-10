import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function uploadDataUrl(supabase: import('@supabase/supabase-js').SupabaseClient, dataUrl: string, pathPrefix: string, userId: string) {
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

export async function POST(request: Request) {
  try {
    const { nid, nidFrontDataUrl, nidBackDataUrl, facePhotoDataUrl, faceDescriptor } = await request.json();

    if (!nidFrontDataUrl || !nidBackDataUrl || !facePhotoDataUrl || !faceDescriptor) {
      return NextResponse.json({ error: 'NID Front copy, NID Back copy, Face Photo, and Biometric Data are required.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 });
    }

    // Upload NID Front, NID Back, and Face Photo to Supabase Storage
    const frontUrl = await uploadDataUrl(supabase, nidFrontDataUrl, 'nid_front', user.id);
    const backUrl = await uploadDataUrl(supabase, nidBackDataUrl, 'nid_back', user.id);
    const photoUrl = await uploadDataUrl(supabase, facePhotoDataUrl, 'kyc_face', user.id);

    // Update the profile status with document URLs and face photo
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        nid: nid, // Now properly received from the frontend instead of generating a dummy doc_ ID
        nid_front_url: frontUrl,
        nid_back_url: backUrl,
        kyc_status: 'pending',
        registration_step: 'pending_approval',
        face_enrolled: true,
        face_descriptor: faceDescriptor,
        photo_url: photoUrl
      })
      .eq('id', user.id);

    if (profileError) {
       console.error('KYC Update Error:', profileError);
       return NextResponse.json({ error: 'Failed to save KYC documents. Please try again.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'KYC Documents & Biometric Face Verification Submitted. Waiting for approval.' });

  } catch (error: unknown) {
    console.error('KYC Submit Error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg || 'Internal server error during document upload.' }, { status: 500 });
  }
}

