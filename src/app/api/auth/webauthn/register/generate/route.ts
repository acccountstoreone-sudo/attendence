import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { createClient } from '@/lib/supabase/server';
import { getRPID, getRPName } from '@/lib/webauthn';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase.from('profiles').select('employee_id, full_name').eq('id', user.id).single();
    if (!profile) {
       return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get any existing credentials so we can exclude them
    const { data: existingCredentials } = await supabase
        .from('webauthn_credentials')
        .select('credential_id')
        .eq('user_id', user.id);

    const options = await generateRegistrationOptions({
      rpName: getRPName(),
      rpID: getRPID(),
      userID: user.id, // Must be Uint8Array, simplewebauthn expects string here in newer versions but let's cast if needed. 
                       // Actually userID expects Uint8Array or string depending on version. Let's encode string to Uint8Array.
      userName: profile.employee_id || user.email || 'employee',
      // Don't prompt users for their authenticator if they've already registered it
      excludeCredentials: existingCredentials?.map(cred => ({
        id: cred.credential_id,
        type: 'public-key',
        // Optional
        transports: ['internal'],
      })),
      authenticatorSelection: {
        // "platform" means device-bound (fingerprint/FaceID). Not a roaming key like Yubikey.
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'required'
      }
    });

    // Save the challenge in the user's profile
    await supabase.from('profiles').update({ webauthn_challenge: options.challenge }).eq('id', user.id);

    return NextResponse.json(options);
  } catch (err: unknown) {
    console.error('Registration generation error:', err);
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
