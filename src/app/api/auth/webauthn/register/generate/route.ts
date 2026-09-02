import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getRPID, getRPName } from '@/lib/webauthn';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check Authorization header first (useful immediately after OTP sign-in before cookies are reliable)
    const authHeader = req.headers.get('Authorization');
    let user;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data } = await supabase.auth.getUser(token);
      user = data.user;
    } else {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }

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
      userID: new TextEncoder().encode(user.id),
      userName: profile.employee_id || user.email || 'employee',
      // Don't prompt users for their authenticator if they've already registered it
      excludeCredentials: existingCredentials?.map((cred: { credential_id: string }) => ({
        id: cred.credential_id as any,
        type: 'public-key' as const,
        transports: ['internal'] as any,
      })),
      authenticatorSelection: {
        authenticatorAttachment: 'platform' as const,
        userVerification: 'preferred' as const,
        residentKey: 'required' as const
      }
    });

    // Save the challenge in the user's profile using admin client to bypass RLS restrictions during onboarding
    const { error: dbError } = await adminClient
      .from('profiles')
      .update({ webauthn_current_challenge: options.challenge })
      .eq('id', user.id);
      
    if (dbError) {
      throw new Error(dbError.message || 'Failed to update challenge in database');
    }

    return NextResponse.json(options);
  } catch (err: unknown) {
    console.error('Registration generation error:', err);
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    if (typeof err === 'object' && err !== null && 'message' in err) {
      return NextResponse.json({ error: String((err as any).message) }, { status: 500 });
    }
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
