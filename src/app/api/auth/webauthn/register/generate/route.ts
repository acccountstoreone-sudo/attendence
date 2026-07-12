import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getRPID, getRPName } from '@/lib/webauthn';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = getAdminClient(supabase);

    const { data: profile } = await adminClient.from('profiles').select('employee_id, full_name').eq('id', user.id).single();
    if (!profile) {
       return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get any existing credentials so we can exclude them
    const { data: existingCredentials } = await adminClient
        .from('webauthn_credentials')
        .select('credential_id')
        .eq('user_id', user.id);

    const options = await generateRegistrationOptions({
      rpName: getRPName(),
      rpID: getRPID(req),
      userID: new Uint8Array(Buffer.from(user.id)),
      userName: profile.employee_id || user.email || 'employee',
      // Don't prompt users for their authenticator if they've already registered it
      excludeCredentials: existingCredentials?.map((cred: { credential_id: string }) => ({
        id: cred.credential_id,
        type: 'public-key',
        transports: ['internal'],
      })),
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'required'
      }
    });

    // Save the challenge in the user's profile using admin client to bypass RLS restrictions during onboarding
    await adminClient
      .from('profiles')
      .update({ webauthn_current_challenge: options.challenge })
      .eq('id', user.id);

    return NextResponse.json(options);
  } catch (err: unknown) {
    console.error('Registration generation error:', err);
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
