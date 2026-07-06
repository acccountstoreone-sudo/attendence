-- ==============================================================================
-- ANCHOR FASHION — FIX REGISTRATION CONSTRAINTS (MIGRATION 0007)
-- ==============================================================================

-- 1. FIX BRANCH CONSTRAINT FOR NEW REGISTRATIONS
-- Previously, chk_role_branch required a branch_id for all employees. 
-- But during signup, the branch_id is unknown until the manager approves them.
-- We now allow branch_id to be NULL if the user is inactive (pending approval).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS chk_role_branch;
ALTER TABLE public.profiles ADD CONSTRAINT chk_role_branch CHECK (
    (role = 'admin') OR (branch_id IS NOT NULL) OR (is_active = false)
);

-- 2. MAKE NEW PROFILES INACTIVE BY DEFAULT
-- This ensures that new signups are not instantly granted employee dashboard access
-- before KYC, OTP, and Manager Approval are completed.
ALTER TABLE public.profiles ALTER COLUMN is_active SET DEFAULT false;

-- 3. ENSURE NOTIFICATIONS TABLE EXISTS
-- Ensure the welcome trigger does not fail.
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'leave', 'attendance', 'system', 'welcome')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
