import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = getAdminClient(supabase);

    const { data: profile } = await adminClient.from('profiles').select('webauthn_current_challenge').eq('id', user.id).single();
    const expectedChallenge = profile?.webauthn_current_challenge;

    if (!expectedChallenge) {
       return NextResponse.json({ error: 'No verification challenge found or session expired.' }, { status: 400 });
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: getExpectedOrigin(req),
        expectedRPID: getRPID(req),
      });
    } catch (error: unknown) {
      console.error('Verification error:', error);
      if (error instanceof Error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: 'An unexpected error occurred during fingerprint verification' }, { status: 400 });
    }

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credential, credentialDeviceType } = registrationInfo;
      const { id: credentialID, publicKey: credentialPublicKey, counter } = credential;

      // Save to database. credentialPublicKey is Uint8Array
      // We must convert it to a hex string for PostgREST bytea column
      const publicKeyBuffer = Buffer.from(credentialPublicKey);
      const publicKeyHex = '\\x' + publicKeyBuffer.toString('hex');
      
      const { error } = await adminClient.from('webauthn_credentials').insert({
        user_id: user.id,
        credential_id: credentialID,
        public_key: publicKeyHex,
        counter,
        // Omitting device_type and transports to prevent Supabase schema cache errors
        // if these columns are out-of-sync. They have default values in the DB.
      });

      if (error) {
        console.error('DB Insert Error:', error);
        throw new Error(error.message || 'Failed to insert webauthn credential into database');
      }

      // Clear the challenge and set fingerprint_enrolled status
      await adminClient.from('profiles').update({ 
        webauthn_current_challenge: null,
      }).eq('id', user.id);

      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ verified: false }, { status: 400 });

  } catch (err: unknown) {
    console.error('Registration verification error:', err);
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    if (typeof err === 'object' && err !== null && 'message' in err) {
      return NextResponse.json({ error: String((err as any).message) }, { status: 500 });
    }
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
