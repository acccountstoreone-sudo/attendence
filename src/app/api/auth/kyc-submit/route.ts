import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { nid, facePhotoDataUrl } = await request.json();

    if (!nid || !facePhotoDataUrl) {
      return NextResponse.json({ error: 'NID and Face Photo are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 });
    }

    // Decode base64 image
    const base64Data = facePhotoDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = `${user.id}/kyc_face_${Date.now()}.jpg`;

    // Upload to Supabase Storage (avatars bucket)
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('avatars')
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('Storage Upload Error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload photo to Supabase Storage.' }, { status: 500 });
    }

    // Get the public URL for the uploaded photo
    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    const photoUrl = publicUrlData.publicUrl;

    // Update the profile status with the real photo_url
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        nid: nid,
        kyc_status: 'pending',
        registration_step: 'pending_approval',
        face_enrolled: true,
        photo_url: photoUrl
      })
      .eq('id', user.id);

    if (profileError) {
       console.error('KYC Update Error:', profileError);
       return NextResponse.json({ error: 'Failed to save KYC data. NID might already be in use.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'KYC & Face Verification Submitted. Waiting for approval.' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
