import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getRPID } from '@/lib/webauthn';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in first.' }, { status: 401 });
    }

    const adminClient = getAdminClient(supabase);

    // Get the user's registered passkey/fingerprint credentials
    const { data: credentials } = await adminClient
      .from('webauthn_credentials')
      .select('*')
      .eq('user_id', user.id);

    if (!credentials || credentials.length === 0) {
      return NextResponse.json({ error: 'No fingerprint or passkey device registered for this account.' }, { status: 400 });
    }

    const options = await generateAuthenticationOptions({
      rpID: getRPID(req),
      allowCredentials: credentials.map((cred: { credential_id: string; transports?: any[] }) => ({
        id: cred.credential_id as any,
        type: 'public-key' as const,
        transports: (cred.transports || ['internal']) as any,
      })),
      userVerification: 'required' as const,
    });

    // Save challenge using adminClient to ensure bypass of RLS restrictions during check-in flow
    const { error: dbError } = await adminClient
      .from('profiles')
      .update({ webauthn_challenge: options.challenge })
      .eq('id', user.id);
      
    if (dbError) {
      throw new Error(dbError.message || 'Failed to save authentication challenge');
    }

    return NextResponse.json(options);
  } catch (err: unknown) {
    console.error('Authentication Options Generation Error:', err);
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    if (typeof err === 'object' && err !== null && 'message' in err) {
      return NextResponse.json({ error: String((err as any).message) }, { status: 500 });
    }
    return NextResponse.json({ error: 'An unexpected error occurred during biometric check-in setup.' }, { status: 500 });
  }
}
