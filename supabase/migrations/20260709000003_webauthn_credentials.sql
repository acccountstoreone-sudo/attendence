-- Migration: WebAuthn Credentials
-- Description: Stores public keys for fingerprint/device biometrics (Passkeys)

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS webauthn_challenge TEXT;

CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    public_key BYTEA NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0,
    device_type TEXT NOT NULL DEFAULT 'singleDevice',
    transports TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own webauthn credentials" ON public.webauthn_credentials;
CREATE POLICY "Users can view their own webauthn credentials"
ON public.webauthn_credentials FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own webauthn credentials" ON public.webauthn_credentials;
CREATE POLICY "Users can insert their own webauthn credentials"
ON public.webauthn_credentials FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own webauthn credentials" ON public.webauthn_credentials;
CREATE POLICY "Users can update their own webauthn credentials"
ON public.webauthn_credentials FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own webauthn credentials" ON public.webauthn_credentials;
CREATE POLICY "Users can delete their own webauthn credentials"
ON public.webauthn_credentials FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Optional: Also allow admin access
DROP POLICY IF EXISTS "Admins can view all webauthn credentials" ON public.webauthn_credentials;
CREATE POLICY "Admins can view all webauthn credentials"
ON public.webauthn_credentials FOR SELECT
TO authenticated
USING (public.user_role() = 'admin');
