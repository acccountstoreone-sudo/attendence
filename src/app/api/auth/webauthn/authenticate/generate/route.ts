import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { createClient } from '@/lib/supabase/server';
import { getRPID } from '@/lib/webauthn';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's registered credentials
    const { data: credentials } = await supabase
        .from('webauthn_credentials')
        .select('credential_id, transports')
        .eq('user_id', user.id);

    if (!credentials || credentials.length === 0) {
        return NextResponse.json({ error: 'No fingerprint registered' }, { status: 400 });
    }

    const options = await generateAuthenticationOptions({
      rpID: getRPID(),
      allowCredentials: credentials.map(cred => ({
        id: cred.credential_id,
        type: 'public-key',
        transports: cred.transports || ['internal'],
      })),
      userVerification: 'required',
    });

    // Save the challenge in the user's profile
    await supabase.from('profiles').update({ webauthn_challenge: options.challenge }).eq('id', user.id);

    return NextResponse.json(options);
  } catch (err: unknown) {
    console.error('Authentication generation error:', err);
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

