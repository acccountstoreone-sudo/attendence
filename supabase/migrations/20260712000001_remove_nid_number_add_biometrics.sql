-- ==============================================================================
-- ANCHOR FASHION — REMOVE NID NUMBER & ADD BIOMETRIC CHOICE (MIGRATION 20260712000001)
-- ==============================================================================

-- 1. DROP UNIQUE CONSTRAINT AND NOT NULL FROM NID
-- The user no longer needs to manually enter a separate NID number during registration.
-- They only upload NID Front and NID Back photos.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_nid_key;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_nid_unique;
ALTER TABLE public.profiles ALTER COLUMN nid DROP NOT NULL;

-- 2. ADD FINGERPRINT ENROLLED FLAG & WEBAUTHN CHALLENGE COLUMN
-- Allows tracking whether an employee has registered via fingerprint/device sensor,
-- alongside or instead of facial recognition.
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS fingerprint_enrolled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS webauthn_challenge TEXT;

-- Index for fast filtering of staff with biometrics enrolled
CREATE INDEX IF NOT EXISTS idx_profiles_fingerprint_enrolled ON public.profiles(fingerprint_enrolled);
