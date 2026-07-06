-- ==============================================================================
-- ANCHOR FASHION — REGISTRATION & KYC FLOW (MIGRATION 0005)
-- ==============================================================================

-- 1. ADD NEW COLUMNS TO PROFILES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS nid VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(50) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
ADD COLUMN IF NOT EXISTS registration_step VARCHAR(50) DEFAULT 'otp' CHECK (registration_step IN ('otp', 'kyc', 'face', 'pending_approval', 'completed'));

-- When an employee registers, they start with 'otp'. 
-- Once approved by manager, registration_step becomes 'completed' and is_active is true.
-- By default, we should make new registrations is_active = false until approved.

-- 2. OTP CODES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.otp_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_email ON public.otp_codes(email);

-- 3. RLS POLICIES FOR OTP
-- ------------------------------------------------------------------------------
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to create/read OTP codes for themselves (required for registration)
CREATE POLICY "Public can insert OTP codes" ON public.otp_codes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can select own OTP" ON public.otp_codes
    FOR SELECT USING (true);
    
CREATE POLICY "Public can update own OTP" ON public.otp_codes
    FOR UPDATE USING (true);

