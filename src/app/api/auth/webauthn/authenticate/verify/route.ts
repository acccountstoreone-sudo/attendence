import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
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

    // Find the credential that the user used
    const { data: credential } = await supabase
        .from('webauthn_credentials')
        .select('*')
        .eq('credential_id', body.id)
        .eq('user_id', user.id)
        .single();

    if (!credential) {
        return NextResponse.json({ error: 'Authenticator not registered for this user' }, { status: 400 });
    }

    let pubKeyBuffer: Buffer;
    if (typeof credential.public_key === 'string') {
      if (credential.public_key.startsWith('\\x')) {
        pubKeyBuffer = Buffer.from(credential.public_key.slice(2), 'hex');
      } else {
        pubKeyBuffer = Buffer.from(credential.public_key, 'base64');
      }
    } else {
      pubKeyBuffer = Buffer.from(credential.public_key);
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: getExpectedOrigin(),
        expectedRPID: getRPID(),
        authenticator: {
            credentialID: credential.credential_id,
            credentialPublicKey: pubKeyBuffer,
            counter: Number(credential.counter),
            transports: credential.transports,
        }
      });
    } catch (error: any) {
      console.error('Verification error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { verified, authenticationInfo } = verification;

    if (verified) {
      // Update the counter
      await supabase.from('webauthn_credentials')
        .update({ counter: authenticationInfo.newCounter })
        .eq('id', credential.id);

      // Clear the challenge
      await supabase.from('profiles').update({ webauthn_challenge: null }).eq('id', user.id);

      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ verified: false }, { status: 400 });
  } catch (err: any) {
    console.error('Authentication verification error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
