-- ==============================================================================
-- ANCHOR FASHION — EMPLOYEE PROFILE & LOCATION UPGRADES (MIGRATION 20260709000001)
-- ==============================================================================
-- Adds columns to support:
-- 1. Admin/Branch Manager Face Verification Reset / Cancellation (`requires_face_reverification`)
-- 2. Live/Now Location Tracking (`last_known_latitude`, `last_known_longitude`, etc.)
-- 3. First Verification Location & Timestamp (`first_verified_latitude`, etc.)
-- ==============================================================================

DO $$ 
BEGIN 
    -- 1. Face verification reset fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'requires_face_reverification') THEN
        ALTER TABLE public.profiles ADD COLUMN requires_face_reverification BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'face_reset_at') THEN
        ALTER TABLE public.profiles ADD COLUMN face_reset_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'face_reset_by') THEN
        ALTER TABLE public.profiles ADD COLUMN face_reset_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    -- 2. Live Location / Now Location fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_known_latitude') THEN
        ALTER TABLE public.profiles ADD COLUMN last_known_latitude DOUBLE PRECISION;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_known_longitude') THEN
        ALTER TABLE public.profiles ADD COLUMN last_known_longitude DOUBLE PRECISION;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_location_updated_at') THEN
        ALTER TABLE public.profiles ADD COLUMN last_location_updated_at TIMESTAMPTZ;
    END IF;

    -- 3. First verified location and date fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'first_verified_latitude') THEN
        ALTER TABLE public.profiles ADD COLUMN first_verified_latitude DOUBLE PRECISION;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'first_verified_longitude') THEN
        ALTER TABLE public.profiles ADD COLUMN first_verified_longitude DOUBLE PRECISION;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'first_verified_at') THEN
        ALTER TABLE public.profiles ADD COLUMN first_verified_at TIMESTAMPTZ;
    END IF;

    -- Ensure face_descriptor exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'face_descriptor') THEN
        ALTER TABLE public.profiles ADD COLUMN face_descriptor jsonb;
    END IF;
END $$;

-- Create indexes for performance on location and verification queries
CREATE INDEX IF NOT EXISTS idx_profiles_requires_face_reverification ON public.profiles(requires_face_reverification);
CREATE INDEX IF NOT EXISTS idx_profiles_last_location_updated_at ON public.profiles(last_location_updated_at DESC);
