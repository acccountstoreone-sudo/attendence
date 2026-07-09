import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { createClient } from '@/lib/supabase/server';
import { getRPID, getExpectedOrigin } from '@/lib/webauthn';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase.from('profiles').select('webauthn_challenge').eq('id', user.id).single();
    const expectedChallenge = profile?.webauthn_challenge;

    if (!expectedChallenge) {
       return NextResponse.json({ error: 'No challenge found' }, { status: 400 });
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: getExpectedOrigin(),
        expectedRPID: getRPID(),
      });
    } catch (error: any) {
      console.error('Verification error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credentialID, credentialPublicKey, counter, credentialDeviceType } = registrationInfo;

      // Save to database. credentialPublicKey is Uint8Array, we need to convert to Buffer for bytea postgres column
      const publicKeyBuffer = Buffer.from(credentialPublicKey);
      
      const { error } = await supabase.from('webauthn_credentials').insert({
        user_id: user.id,
        credential_id: credentialID,
        public_key: publicKeyBuffer,
        counter,
        device_type: credentialDeviceType,
        transports: body.response.transports || [],
      });

      if (error) throw error;

      // Clear the challenge
      await supabase.from('profiles').update({ webauthn_challenge: null }).eq('id', user.id);

      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ verified: false }, { status: 400 });
  } catch (err: any) {
    console.error('Registration verification error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
