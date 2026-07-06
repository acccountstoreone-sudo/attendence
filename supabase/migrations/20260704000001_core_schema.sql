-- ==============================================================================
-- ANCHOR FASHION — CORE DATABASE SCHEMA (MIGRATION 0001)
-- Specification Reference: Spec P09 (Category 02: Database & Schema)
-- ==============================================================================
-- This script initializes the foundational relational tables for Anchor Fashion's
-- single-company, multi-branch Attendance Management System.
-- ==============================================================================

-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- 2. CUSTOM ENUM TYPES
-- ------------------------------------------------------------------------------
-- Role hierarchy: Admin (HQ/Owner), Branch Manager (Store Supervisor), Employee
DO $$ BEGIN CREATE TYPE public.user_role AS ENUM ('admin', 'branch_manager', 'employee'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Attendance status evaluated during check-in/out and daily cron
DO $$ BEGIN CREATE TYPE public.attendance_status AS ENUM ('present', 'late', 'absent', 'half_day'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Leave request workflow types
DO $$ BEGIN CREATE TYPE public.leave_type AS ENUM ('casual', 'sick', 'earned'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Leave request approval workflow status
DO $$ BEGIN CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;


-- 3. COMPANY PROFILE (Singleton Table)
-- ------------------------------------------------------------------------------
-- Holds Anchor Fashion brand identity, global working hours, and timezone.
-- There is strictly ONE row ever in this table.
CREATE TABLE IF NOT EXISTS public.company_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL DEFAULT 'Anchor Fashion',
    logo_url TEXT,
    address TEXT NOT NULL DEFAULT 'Headquarters, Dhaka, Bangladesh',
    default_work_start_time TIME NOT NULL DEFAULT '09:00:00',
    default_work_end_time TIME NOT NULL DEFAULT '18:00:00',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Dhaka',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure singleton behavior: only 1 row allowed
CREATE UNIQUE INDEX idx_company_profile_singleton ON public.company_profile ((true));

-- Insert default company row immediately
INSERT INTO public.company_profile (name, address, timezone)
VALUES ('Anchor Fashion', 'Headquarters, Dhaka, Bangladesh', 'Asia/Dhaka')
ON CONFLICT DO NOTHING;


-- 4. BRANCHES (Retail Store Locations)
-- ------------------------------------------------------------------------------
-- Unlimited retail store branches created by Admin. Holds geofence coordinates.
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 100 CHECK (radius_meters >= 10 AND radius_meters <= 1000),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for frequent branch lookup and active filtering
CREATE INDEX idx_branches_is_active ON public.branches(is_active);
CREATE INDEX idx_branches_name ON public.branches(name);


-- 5. PROFILES (Staff Accounts & Identity)
-- ------------------------------------------------------------------------------
-- Extends Supabase auth.users. Links staff to roles and specific retail branches.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    role public.user_role NOT NULL DEFAULT 'employee',
    branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT,
    phone VARCHAR(50),
    photo_url TEXT,
    facial_id TEXT UNIQUE, -- Encrypted vector string returned by FaceIO SDK
    face_enrolled BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Admin role does not require a branch_id; BM and Employee must belong to a branch
    CONSTRAINT chk_role_branch CHECK (
        (role = 'admin') OR (branch_id IS NOT NULL)
    )
);

-- Indexes for frequent staff filtering by branch, role, and active status
CREATE INDEX idx_profiles_branch_id ON public.profiles(branch_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX idx_profiles_branch_role ON public.profiles(branch_id, role) WHERE is_active = true;


-- 6. ATTENDANCE RECORDS (Daily Ledger)
-- ------------------------------------------------------------------------------
-- Captures shop-floor check-in/out timestamps, coordinates, and evaluated status.
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    check_in_time TIMESTAMPTZ NOT NULL,
    check_out_time TIMESTAMPTZ,
    check_in_lat DOUBLE PRECISION NOT NULL,
    check_in_lng DOUBLE PRECISION NOT NULL,
    check_out_lat DOUBLE PRECISION,
    check_out_lng DOUBLE PRECISION,
    face_match_score DOUBLE PRECISION, -- Confidence score returned by FaceIO (0.0 to 1.0)
    status public.attendance_status NOT NULL DEFAULT 'present',
    overtime_minutes INTEGER NOT NULL DEFAULT 0 CHECK (overtime_minutes >= 0),
    is_manual_override BOOLEAN NOT NULL DEFAULT false,
    override_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Ensure check_out is later than check_in
    CONSTRAINT chk_checkout_after_checkin CHECK (
        check_out_time IS NULL OR check_out_time >= check_in_time
    )
);

-- High-performance composite indexes for daily dashboard feeds and monthly reporting
CREATE INDEX idx_attendance_employee_id ON public.attendance_records(employee_id);
CREATE INDEX idx_attendance_branch_id ON public.attendance_records(branch_id);
CREATE INDEX idx_attendance_check_in_time ON public.attendance_records(check_in_time DESC);
CREATE INDEX idx_attendance_branch_date ON public.attendance_records(branch_id, check_in_time DESC);
CREATE INDEX idx_attendance_employee_date ON public.attendance_records(employee_id, check_in_time DESC);
CREATE INDEX idx_attendance_status ON public.attendance_records(status);


-- 7. LEAVE REQUESTS (Paperless Workflow)
-- ------------------------------------------------------------------------------
-- Tracks employee leave applications and BM/Admin approval sign-offs.
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    type public.leave_type NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status public.leave_status NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    reviewer_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Ensure end_date is on or after start_date
    CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

-- Indexes for BM pending approval queues and employee history
CREATE INDEX idx_leave_branch_status ON public.leave_requests(branch_id, status);
CREATE INDEX idx_leave_employee_id ON public.leave_requests(employee_id);
CREATE INDEX idx_leave_start_date ON public.leave_requests(start_date DESC);


-- 8. AUTOMATED TIMESTAMPTZ UPDATER TRIGGER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_company_profile_updated_at BEFORE UPDATE ON public.company_profile FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_leave_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- End of Migration 0001
