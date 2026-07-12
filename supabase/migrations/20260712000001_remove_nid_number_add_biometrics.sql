-- ==============================================================================
-- ANCHOR FASHION — COMPLETE ONBOARDING & BIOMETRICS SQL MIGRATION
-- Migration File: 20260712000001_remove_nid_number_add_biometrics.sql
-- ==============================================================================
-- Run this script in your Supabase SQL Editor to apply all recent schema updates:
-- 1. Makes NID number completely optional (removes UNIQUE and NOT NULL constraints).
-- 2. Adds fingerprint_enrolled flag and WebAuthn challenge tracking columns.
-- 3. Creates the webauthn_credentials table for hardware passkey storage with RLS policies.
-- ==============================================================================

-- 1. MAKE NID NUMBER OPTIONAL & DROP CONSTRAINTS
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_nid_key;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_nid_unique;
ALTER TABLE public.profiles ALTER COLUMN nid DROP NOT NULL;

-- 2. ADD BIOMETRIC FLAGS & WEBAUTHN CHALLENGE COLUMNS TO PROFILES
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS fingerprint_enrolled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS webauthn_challenge TEXT,
ADD COLUMN IF NOT EXISTS webauthn_current_challenge TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_fingerprint_enrolled ON public.profiles(fingerprint_enrolled);

-- 3. CREATE WEBAUTHN PASSKEY CREDENTIALS TABLE
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

-- 4. ENABLE ROW LEVEL SECURITY & POLICIES FOR PASSKEYS
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own webauthn credentials" ON public.webauthn_credentials;
CREATE POLICY "Users can view their own webauthn credentials"
ON public.webauthn_credentials FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.user_role() = 'admin');

DROP POLICY IF EXISTS "Users can insert their own webauthn credentials" ON public.webauthn_credentials;
CREATE POLICY "Users can insert their own webauthn credentials"
ON public.webauthn_credentials FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR public.user_role() = 'admin');

DROP POLICY IF EXISTS "Users can update their own webauthn credentials" ON public.webauthn_credentials;
CREATE POLICY "Users can update their own webauthn credentials"
ON public.webauthn_credentials FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.user_role() = 'admin')
WITH CHECK (auth.uid() = user_id OR public.user_role() = 'admin');

DROP POLICY IF EXISTS "Users can delete their own webauthn credentials" ON public.webauthn_credentials;
CREATE POLICY "Users can delete their own webauthn credentials"
ON public.webauthn_credentials FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR public.user_role() = 'admin');

-- 5. STORAGE POLICIES UPDATE FOR ONBOARDING (Allow authenticated uploads to avatars bucket for KYC)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
        DROP POLICY IF EXISTS "Authenticated users can upload KYC avatars" ON storage.objects;
        CREATE POLICY "Authenticated users can upload KYC avatars"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'avatars');
    END IF;
END $$;
