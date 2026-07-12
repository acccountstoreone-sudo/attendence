import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getRPID, getExpectedOrigin } from '@/lib/webauthn';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const adminClient = getAdminClient(supabase);

    const { data: profile } = await adminClient.from('profiles').select('webauthn_challenge').eq('id', user.id).single();
    const expectedChallenge = profile?.webauthn_challenge;

    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Verification challenge not found or session has expired.' }, { status: 400 });
    }

    // Find the credential that the user used
    const { data: credential } = await adminClient
      .from('webauthn_credentials')
      .select('*')
      .eq('credential_id', body.id)
      .eq('user_id', user.id)
      .single();

    if (!credential) {
      return NextResponse.json({ error: 'Authenticator device not registered to this user account.' }, { status: 400 });
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
        expectedOrigin: getExpectedOrigin(req),
        expectedRPID: getRPID(req),
        credential: {
          id: credential.credential_id,
          publicKey: new Uint8Array(pubKeyBuffer),
          counter: Number(credential.counter),
          transports: credential.transports,
        }
      });
    } catch (error: unknown) {
      console.error('Biometric Check-in Verification Error:', error);
      if (error instanceof Error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: 'An unexpected error occurred during fingerprint verification.' }, { status: 400 });
    }

    const { verified, authenticationInfo } = verification;

    if (verified && authenticationInfo) {
      // Update the counter
      await adminClient.from('webauthn_credentials')
        .update({ counter: authenticationInfo.newCounter })
        .eq('id', credential.id);

      // Clear the challenge
      await adminClient.from('profiles').update({ webauthn_challenge: null }).eq('id', user.id);

      return NextResponse.json({ verified: true });
    }

    // Clear the challenge even on failure to prevent stale challenges
    await adminClient.from('profiles').update({ webauthn_challenge: null }).eq('id', user.id);

    return NextResponse.json({ verified: false }, { status: 400 });
  } catch (err: unknown) {
    console.error('Authentication Verification Route Error:', err);
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    if (typeof err === 'object' && err !== null && 'message' in err) {
      return NextResponse.json({ error: String((err as any).message) }, { status: 500 });
    }
    return NextResponse.json({ error: 'An unexpected error occurred during verification.' }, { status: 500 });
  }
}
