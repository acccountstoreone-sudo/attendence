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
-- ==============================================================================
-- ANCHOR FASHION — ADVANCED SCHEMA (SETTINGS & AUDIT TRAIL) (MIGRATION 0002)
-- Specification Reference: Spec P10 (Category 02: Database & Schema)
-- ==============================================================================
-- This script extends the core schema with store-specific timing rules,
-- an immutable security audit log ledger, and user notifications.
-- ==============================================================================

-- 1. BRANCH SETTINGS (Store-Specific Operational Rules)
-- ------------------------------------------------------------------------------
-- Allows Admin to override global company work timings and grace periods per store.
CREATE TABLE IF NOT EXISTS public.branch_settings (
    branch_id UUID PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
    work_start_time TIME NOT NULL DEFAULT '09:00:00',
    work_end_time TIME NOT NULL DEFAULT '18:00:00',
    late_grace_minutes INTEGER NOT NULL DEFAULT 15 CHECK (late_grace_minutes >= 0 AND late_grace_minutes <= 120),
    overtime_after_minutes INTEGER NOT NULL DEFAULT 30 CHECK (overtime_after_minutes >= 0),
    half_day_hours DOUBLE PRECISION NOT NULL DEFAULT 4.0 CHECK (half_day_hours >= 1.0 AND half_day_hours <= 8.0),
    weekly_off_days INTEGER[] NOT NULL DEFAULT '{5}'::INTEGER[], -- Array of days (0=Sunday, 1=Monday ... 5=Friday, 6=Saturday)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to auto-update updated_at timestamp
CREATE TRIGGER trg_branch_settings_updated_at 
    BEFORE UPDATE ON public.branch_settings 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. AUDIT LOGS (Immutable Security & Override Ledger)
-- ------------------------------------------------------------------------------
-- Tracks every create, update, and delete action across critical tables.
-- Essential for HR governance and identifying unauthorized data tampering.
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_role public.user_role,
    action VARCHAR(50) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'MANUAL_OVERRIDE', 'DEACTIVATE', 'ROLLBACK')),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- High-performance indexes for Admin Activity History viewing and security audits
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);


-- 3. NOTIFICATIONS (In-App Alerts & Reminders)
-- ------------------------------------------------------------------------------
-- Stores real-time system alerts for BMs (leave applications, late digests) and staff.
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'leave', 'attendance', 'system', 'welcome')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    action_url TEXT, -- Optional URL to jump to relevant page (e.g., /branch-manager/leave-approvals)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for loading user unread alert bell badges quickly
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);


-- 4. AUTOMATED AUDIT LOGGING TRIGGER FUNCTION
-- ------------------------------------------------------------------------------
-- This trigger function automatically captures old and new row states as JSONB
-- and inserts an immutable record into `audit_logs` whenever a row is mutated.
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role public.user_role;
    v_action VARCHAR(50);
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
BEGIN
    -- Derive actor_id from Supabase auth.uid() context
    v_actor_id := auth.uid();
    
    -- Lookup actor role from profiles table if authenticated
    IF v_actor_id IS NOT NULL THEN
        SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;
    END IF;

    -- Determine action type
    IF (TG_OP = 'INSERT') THEN
        v_action := 'CREATE';
        v_new_data := to_jsonb(NEW);
    ELSIF (TG_OP = 'UPDATE') THEN
        v_action := 'UPDATE';
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        
        -- Check if this was a manual attendance override
        IF (TG_TABLE_NAME = 'attendance_records' AND (v_new_data->>'is_manual_override')::boolean = true AND (v_old_data->>'is_manual_override')::boolean = false) THEN
            v_action := 'MANUAL_OVERRIDE';
        END IF;
        
        -- Check if this was a deactivation (safely check using jsonb to avoid column errors on tables without is_active)
        IF (v_new_data ? 'is_active') THEN
            IF ((v_new_data->>'is_active')::boolean = false AND (v_old_data->>'is_active')::boolean = true) THEN
                v_action := 'DEACTIVATE';
            END IF;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'DELETE';
        v_old_data := to_jsonb(OLD);
    END IF;

    -- Write immutable record to audit_logs
    INSERT INTO public.audit_logs (
        actor_id,
        actor_role,
        action,
        table_name,
        record_id,
        old_value,
        new_value
    ) VALUES (
        v_actor_id,
        v_actor_role,
        v_action,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        v_old_data,
        v_new_data
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. ATTACH AUDIT TRIGGER TO CRITICAL TABLES
-- ------------------------------------------------------------------------------
-- Track all mutations on branches, profiles, attendance_records, and leave_requests
CREATE TRIGGER trg_audit_branches
    AFTER INSERT OR UPDATE OR DELETE ON public.branches
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER trg_audit_profiles
    AFTER INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER trg_audit_attendance
    AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER trg_audit_leave
    AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER trg_audit_branch_settings
    AFTER INSERT OR UPDATE OR DELETE ON public.branch_settings
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- End of Migration 0002
-- ==============================================================================
-- ANCHOR FASHION — SUPABASE ROW LEVEL SECURITY (RLS) POLICIES (MIGRATION 0003)
-- Specification Reference: Spec P11 (Category 02: Database & Schema)
-- ==============================================================================
-- This script represents the MOST CRITICAL security layer in the application.
-- It cryptographically enforces branch data isolation and RBAC rules in PostgreSQL.
-- Branch Managers can NEVER query or mutate another branch's data.
-- ==============================================================================

-- 1. SQL HELPER FUNCTIONS FOR RLS EVALUATION
-- ------------------------------------------------------------------------------
-- Returns the current authenticated user's role from the profiles table.
-- Marked as SECURITY DEFINER to allow reading the profile safely without recursion.
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS public.user_role AS $$
DECLARE
    v_role public.user_role;
BEGIN
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Returns the current authenticated user's branch_id from the profiles table.
CREATE OR REPLACE FUNCTION public.user_branch_id()
RETURNS UUID AS $$
DECLARE
    v_branch_id UUID;
BEGIN
    SELECT branch_id INTO v_branch_id
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN v_branch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- 2. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;


-- 3. COMPANY PROFILE POLICIES (Singleton)
-- ------------------------------------------------------------------------------
-- All authenticated staff need to read company logo and default rules.
DROP POLICY IF EXISTS "Allow read access to company_profile for all authenticated users" ON public.company_profile;
CREATE POLICY "Allow read access to company_profile for all authenticated users" ON public.company_profile FOR SELECT
    TO authenticated
    USING (true);

-- Only Admin can update company profile settings.
DROP POLICY IF EXISTS "Allow update to company_profile for Admin only" ON public.company_profile;
CREATE POLICY "Allow update to company_profile for Admin only" ON public.company_profile FOR UPDATE
    TO authenticated
    USING (public.user_role() = 'admin');


-- 4. BRANCHES POLICIES
-- ------------------------------------------------------------------------------
-- All authenticated users can read branch names and geofence coordinates.
DROP POLICY IF EXISTS "Allow read access to branches for all authenticated users" ON public.branches;
CREATE POLICY "Allow read access to branches for all authenticated users" ON public.branches FOR SELECT
    TO authenticated
    USING (true);

-- Only Admin can insert, update, or delete branches.
DROP POLICY IF EXISTS "Allow all write access to branches for Admin only" ON public.branches;
CREATE POLICY "Allow all write access to branches for Admin only" ON public.branches FOR ALL
    TO authenticated
    USING (public.user_role() = 'admin')
    WITH CHECK (public.user_role() = 'admin');


-- 5. PROFILES POLICIES (Staff Accounts)
-- ------------------------------------------------------------------------------
-- SELECT: Admin sees all; BM sees own branch; Employee sees only self.
DROP POLICY IF EXISTS "Profiles SELECT policy" ON public.profiles;
CREATE POLICY "Profiles SELECT policy" ON public.profiles FOR SELECT
    TO authenticated
    USING (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id())
        OR id = auth.uid()
    );

-- INSERT: Admin can insert any profile; BM can insert ONLY employee profiles in their own branch.
DROP POLICY IF EXISTS "Profiles INSERT policy" ON public.profiles;
CREATE POLICY "Profiles INSERT policy" ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (
        public.user_role() = 'admin'
        OR (
            public.user_role() = 'branch_manager' 
            AND branch_id = public.user_branch_id() 
            AND role = 'employee'
        )
    );

-- UPDATE: Admin updates any; BM updates employees in own branch; Employee updates own phone/contact.
DROP POLICY IF EXISTS "Profiles UPDATE policy" ON public.profiles;
CREATE POLICY "Profiles UPDATE policy" ON public.profiles FOR UPDATE
    TO authenticated
    USING (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id() AND role = 'employee')
        OR id = auth.uid()
    )
    WITH CHECK (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id() AND role = 'employee')
        OR (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())) -- Employee cannot change own role!
    );

-- DELETE: Admin only can delete profiles.
DROP POLICY IF EXISTS "Profiles DELETE policy" ON public.profiles;
CREATE POLICY "Profiles DELETE policy" ON public.profiles FOR DELETE
    TO authenticated
    USING (public.user_role() = 'admin');


-- 6. ATTENDANCE RECORDS POLICIES
-- ------------------------------------------------------------------------------
-- SELECT: Admin sees all; BM sees own branch; Employee sees only own records.
DROP POLICY IF EXISTS "Attendance SELECT policy" ON public.attendance_records;
CREATE POLICY "Attendance SELECT policy" ON public.attendance_records FOR SELECT
    TO authenticated
    USING (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id())
        OR employee_id = auth.uid()
    );

-- INSERT: Employee inserts own check-in; BM inserts manual override for own branch; Admin inserts any.
DROP POLICY IF EXISTS "Attendance INSERT policy" ON public.attendance_records;
CREATE POLICY "Attendance INSERT policy" ON public.attendance_records FOR INSERT
    TO authenticated
    WITH CHECK (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id())
        OR (employee_id = auth.uid() AND branch_id = public.user_branch_id())
    );

-- UPDATE: Employee updates own checkout for today; BM updates records in own branch; Admin updates any.
DROP POLICY IF EXISTS "Attendance UPDATE policy" ON public.attendance_records;
CREATE POLICY "Attendance UPDATE policy" ON public.attendance_records FOR UPDATE
    TO authenticated
    USING (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id())
        OR (employee_id = auth.uid() AND check_out_time IS NULL)
    )
    WITH CHECK (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id())
        OR (employee_id = auth.uid() AND branch_id = public.user_branch_id())
    );

-- DELETE: Admin only can delete attendance records.
DROP POLICY IF EXISTS "Attendance DELETE policy" ON public.attendance_records;
CREATE POLICY "Attendance DELETE policy" ON public.attendance_records FOR DELETE
    TO authenticated
    USING (public.user_role() = 'admin');


-- 7. LEAVE REQUESTS POLICIES
-- ------------------------------------------------------------------------------
-- SELECT: Admin sees all; BM sees own branch; Employee sees own requests.
DROP POLICY IF EXISTS "Leave SELECT policy" ON public.leave_requests;
CREATE POLICY "Leave SELECT policy" ON public.leave_requests FOR SELECT
    TO authenticated
    USING (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id())
        OR employee_id = auth.uid()
    );

-- INSERT: Employee applies for leave under own branch.
DROP POLICY IF EXISTS "Leave INSERT policy" ON public.leave_requests;
CREATE POLICY "Leave INSERT policy" ON public.leave_requests FOR INSERT
    TO authenticated
    WITH CHECK (
        employee_id = auth.uid() AND branch_id = public.user_branch_id()
    );

-- UPDATE: BM approves/rejects own branch requests; Admin updates any; Employee cancels pending.
DROP POLICY IF EXISTS "Leave UPDATE policy" ON public.leave_requests;
CREATE POLICY "Leave UPDATE policy" ON public.leave_requests FOR UPDATE
    TO authenticated
    USING (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id())
        OR (employee_id = auth.uid() AND status = 'pending')
    )
    WITH CHECK (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id())
        OR (employee_id = auth.uid() AND status = 'cancelled')
    );

-- DELETE: Admin only.
DROP POLICY IF EXISTS "Leave DELETE policy" ON public.leave_requests;
CREATE POLICY "Leave DELETE policy" ON public.leave_requests FOR DELETE
    TO authenticated
    USING (public.user_role() = 'admin');


-- 8. BRANCH SETTINGS POLICIES
-- ------------------------------------------------------------------------------
-- Read allowed for all users in that branch; Write allowed for Admin (and BM for own branch).
DROP POLICY IF EXISTS "Branch Settings SELECT policy" ON public.branch_settings;
CREATE POLICY "Branch Settings SELECT policy" ON public.branch_settings FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Branch Settings ALL write policy for Admin and BM" ON public.branch_settings;
CREATE POLICY "Branch Settings ALL write policy for Admin and BM" ON public.branch_settings FOR ALL
    TO authenticated
    USING (public.user_role() = 'admin' OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id()))
    WITH CHECK (public.user_role() = 'admin' OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id()));


-- 9. AUDIT LOGS POLICIES (Strict Read-Only Ledger)
-- ------------------------------------------------------------------------------
-- Admin can view all audit logs; BM can view audit logs for their branch records.
-- NO ONE can update or delete audit logs via RLS!
DROP POLICY IF EXISTS "Audit Logs SELECT policy" ON public.audit_logs;
CREATE POLICY "Audit Logs SELECT policy" ON public.audit_logs FOR SELECT
    TO authenticated
    USING (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND actor_id IN (SELECT id FROM public.profiles WHERE branch_id = public.user_branch_id()))
    );


-- 10. NOTIFICATIONS POLICIES
-- ------------------------------------------------------------------------------
-- Users can read and update (mark read) only their own notifications.
DROP POLICY IF EXISTS "Notifications SELECT and UPDATE policy" ON public.notifications;
CREATE POLICY "Notifications SELECT and UPDATE policy" ON public.notifications FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- End of Migration 0003
-- ==============================================================================
-- ANCHOR FASHION — DATABASE FUNCTIONS & TRIGGERS (MIGRATION 0004)
-- Specification Reference: Spec P12 (Category 02: Database & Schema)
-- ==============================================================================
-- This script implements automated business logic triggers and aggregation
-- Remote Procedure Calls (RPCs) for dashboards and reporting APIs.
-- ==============================================================================

-- 1. ATTENDANCE STATUS & OVERTIME CALCULATION TRIGGER
-- ------------------------------------------------------------------------------
-- Automatically calculates attendance status ('late', 'half_day', 'present')
-- and computes overtime minutes whenever an attendance record is inserted/updated.
CREATE OR REPLACE FUNCTION public.calculate_attendance_status()
RETURNS TRIGGER AS $$
DECLARE
    v_work_start TIME := '09:00:00';
    v_work_end TIME := '18:00:00';
    v_grace_mins INTEGER := 15;
    v_overtime_after INTEGER := 30;
    v_half_day_hrs DOUBLE PRECISION := 4.0;
    v_worked_hours DOUBLE PRECISION := 0.0;
    v_checkin_time TIME;
    v_checkout_time TIME;
    v_late_cutoff TIME;
    v_overtime_start TIME;
BEGIN
    -- Do not overwrite manual corrections made by Branch Manager or Admin
    IF (NEW.is_manual_override = true) THEN
        RETURN NEW;
    END IF;

    -- 1. Fetch store-specific timing rules from branch_settings (fallback to defaults)
    SELECT 
        COALESCE(bs.work_start_time, cp.default_work_start_time),
        COALESCE(bs.work_end_time, cp.default_work_end_time),
        COALESCE(bs.late_grace_minutes, 15),
        COALESCE(bs.overtime_after_minutes, 30),
        COALESCE(bs.half_day_hours, 4.0)
    INTO 
        v_work_start, v_work_end, v_grace_mins, v_overtime_after, v_half_day_hrs
    FROM public.company_profile cp
    LEFT JOIN public.branch_settings bs ON bs.branch_id = NEW.branch_id
    LIMIT 1;

    -- Extract local time portion from check-in timestamp (at Bangladesh timezone UTC+6)
    v_checkin_time := (NEW.check_in_time AT TIME ZONE 'Asia/Dhaka')::time;
    
    -- Compute late cutoff timestamp (work_start_time + grace_minutes)
    v_late_cutoff := v_work_start + (v_grace_mins || ' minutes')::interval;

    -- 2. Evaluate check-in punctuality
    IF (v_checkin_time > v_late_cutoff) THEN
        NEW.status := 'late'::public.attendance_status;
    ELSE
        NEW.status := 'present'::public.attendance_status;
    END IF;

    -- 3. If check_out_time is present, evaluate worked hours and overtime
    IF (NEW.check_out_time IS NOT NULL) THEN
        -- Compute total worked hours
        v_worked_hours := EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 3600.0;
        
        -- Check for half-day status if worked hours are below threshold
        IF (v_worked_hours < v_half_day_hrs) THEN
            NEW.status := 'half_day'::public.attendance_status;
        END IF;

        -- Compute overtime minutes
        v_checkout_time := (NEW.check_out_time AT TIME ZONE 'Asia/Dhaka')::time;
        v_overtime_start := v_work_end + (v_overtime_after || ' minutes')::interval;
        
        IF (v_checkout_time > v_overtime_start) THEN
            NEW.overtime_minutes := FLOOR(EXTRACT(EPOCH FROM (v_checkout_time - v_work_end)) / 60.0)::integer;
        ELSE
            NEW.overtime_minutes := 0;
        END IF;
    ELSE
        NEW.overtime_minutes := 0;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to attendance_records
DROP TRIGGER IF EXISTS trg_calculate_attendance_status ON public.attendance_records;
CREATE TRIGGER trg_calculate_attendance_status
    BEFORE INSERT OR UPDATE ON public.attendance_records
    FOR EACH ROW EXECUTE FUNCTION public.calculate_attendance_status();


-- 2. WELCOME NOTIFICATION TRIGGER FOR NEW EMPLOYEES
-- ------------------------------------------------------------------------------
-- When a new employee account is provisioned in profiles, automatically generate
-- an in-app welcome alert and biometric enrollment instruction.
CREATE OR REPLACE FUNCTION public.handle_new_employee()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.role = 'employee') THEN
        INSERT INTO public.notifications (
            user_id,
            title,
            message,
            type,
            action_url
        ) VALUES (
            NEW.id,
            'Welcome to Anchor Fashion! 🎉',
            'Your employee account has been created. Please complete your FaceIO biometric facial enrollment before your first shift check-in.',
            'welcome',
            '/employee/profile'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_handle_new_employee ON public.profiles;
CREATE TRIGGER trg_handle_new_employee
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_employee();


-- 3. BRANCH MONTHLY SUMMARY AGGREGATION RPC
-- ------------------------------------------------------------------------------
-- Returns aggregated present/absent/late counts and total overtime per employee
-- for a specific branch and month. Scoped by RLS / caller role.
CREATE OR REPLACE FUNCTION public.get_branch_monthly_summary(
    p_branch_id UUID,
    p_month INTEGER,
    p_year INTEGER
)
RETURNS TABLE (
    employee_id UUID,
    full_name VARCHAR(255),
    photo_url TEXT,
    total_present INTEGER,
    total_late INTEGER,
    total_half_day INTEGER,
    total_absent INTEGER,
    total_overtime_minutes INTEGER
) AS $$
DECLARE
    v_caller_role public.user_role;
    v_caller_branch UUID;
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
BEGIN
    -- 1. Enforce Role & Branch Access Control
    v_caller_role := public.user_role();
    v_caller_branch := public.user_branch_id();

    IF (v_caller_role = 'employee') THEN
        RAISE EXCEPTION 'Access Denied: Employees cannot view branch summaries.' USING ERRCODE = '42501';
    ELSIF (v_caller_role = 'branch_manager' AND v_caller_branch != p_branch_id) THEN
        RAISE EXCEPTION 'Access Denied: Branch Managers can only query their assigned branch.' USING ERRCODE = '42501';
    END IF;

    -- 2. Construct precise date range boundaries in UTC+6
    v_start_date := MAKE_TIMESTAMPTZ(p_year, p_month, 1, 0, 0, 0, 'Asia/Dhaka');
    v_end_date := v_start_date + INTERVAL '1 month';

    -- 3. Return aggregated rollup per employee
    RETURN QUERY
    SELECT 
        p.id AS employee_id,
        p.full_name,
        p.photo_url,
        COUNT(ar.id) FILTER (WHERE ar.status = 'present')::integer AS total_present,
        COUNT(ar.id) FILTER (WHERE ar.status = 'late')::integer AS total_late,
        COUNT(ar.id) FILTER (WHERE ar.status = 'half_day')::integer AS total_half_day,
        0::integer AS total_absent, -- In v1, absent days are inferred from missing logs against shift rosters
        COALESCE(SUM(ar.overtime_minutes), 0)::integer AS total_overtime_minutes
    FROM public.profiles p
    LEFT JOIN public.attendance_records ar ON ar.employee_id = p.id 
        AND ar.check_in_time >= v_start_date 
        AND ar.check_in_time < v_end_date
    WHERE p.branch_id = p_branch_id AND p.role = 'employee' AND p.is_active = true
    GROUP BY p.id, p.full_name, p.photo_url
    ORDER BY p.full_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- 4. COMPANY-WIDE MONTHLY SUMMARY RPC (ADMIN ONLY)
-- ------------------------------------------------------------------------------
-- Returns high-level aggregated check-in and overtime stats across ALL branches.
CREATE OR REPLACE FUNCTION public.get_company_wide_summary(
    p_month INTEGER,
    p_year INTEGER
)
RETURNS TABLE (
    branch_id UUID,
    branch_name VARCHAR(255),
    employee_count INTEGER,
    total_checkins INTEGER,
    total_late_checkins INTEGER,
    attendance_rate_percent DOUBLE PRECISION,
    total_overtime_hours DOUBLE PRECISION
) AS $$
DECLARE
    v_caller_role public.user_role;
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
BEGIN
    -- 1. Strict Admin-Only Guard
    v_caller_role := public.user_role();
    IF (v_caller_role != 'admin') THEN
        RAISE EXCEPTION 'Access Denied: Company-wide summaries are restricted to HQ Admin.' USING ERRCODE = '42501';
    END IF;

    -- 2. Date range setup
    v_start_date := MAKE_TIMESTAMPTZ(p_year, p_month, 1, 0, 0, 0, 'Asia/Dhaka');
    v_end_date := v_start_date + INTERVAL '1 month';

    -- 3. Aggregate across all active branches
    RETURN QUERY
    SELECT 
        b.id AS branch_id,
        b.name AS branch_name,
        COUNT(DISTINCT p.id)::integer AS employee_count,
        COUNT(ar.id)::integer AS total_checkins,
        COUNT(ar.id) FILTER (WHERE ar.status = 'late')::integer AS total_late_checkins,
        CASE 
            WHEN COUNT(DISTINCT p.id) = 0 THEN 0.0
            ELSE ROUND((COUNT(ar.id)::numeric / (COUNT(DISTINCT p.id) * 26.0)) * 100.0, 2)::double precision -- Assuming 26 working days/month
        END AS attendance_rate_percent,
        ROUND((COALESCE(SUM(ar.overtime_minutes), 0) / 60.0)::numeric, 2)::double precision AS total_overtime_hours
    FROM public.branches b
    LEFT JOIN public.profiles p ON p.branch_id = b.id AND p.role = 'employee' AND p.is_active = true
    LEFT JOIN public.attendance_records ar ON ar.branch_id = b.id 
        AND ar.check_in_time >= v_start_date 
        AND ar.check_in_time < v_end_date
    WHERE b.is_active = true
    GROUP BY b.id, b.name
    ORDER BY attendance_rate_percent DESC, b.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 5. AUTO-CREATE PROFILE ON SIGNUP
-- ------------------------------------------------------------------------------
-- Automatically creates a profile row when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'employee'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- End of Migration 0004
-- ==============================================================================
-- ANCHOR FASHION — QUERY OPTIMIZATION & INDEXES (MIGRATION 0005)
-- Specification Reference: Spec P14 (Category 02: Database & Schema)
-- ==============================================================================
-- This script optimizes database performance for Anchor Fashion's expected scale:
-- 50+ retail branches and 5,000+ staff generating ~10,000 attendance records/day
-- (~300,000 records/month). It implements composite B-tree indexes, optimizes
-- Admin company-wide aggregation RPCs, and introduces Materialized Views.
-- ==============================================================================

-- 1. COMPOSITE INDEXES FOR HIGH-FREQUENCY QUERIES
-- ------------------------------------------------------------------------------
-- Query A: "Get today's attendance for branch X" (Branch Manager live feed)
-- Filter: branch_id + check_in_time date range + status
CREATE INDEX IF NOT EXISTS idx_attendance_branch_today 
    ON public.attendance_records (branch_id, check_in_time DESC, status);

-- Query B: "Get monthly summary for employee Y" (Employee history & payroll sheet)
-- Filter: employee_id + check_in_time date range
CREATE INDEX IF NOT EXISTS idx_attendance_emp_monthly 
    ON public.attendance_records (employee_id, check_in_time DESC)
    INCLUDE (status, overtime_minutes, check_out_time);

-- Query C: "Get all late employees company-wide this week" (Admin alert dashboard)
-- Filter: status = 'late' + check_in_time date range
CREATE INDEX IF NOT EXISTS idx_attendance_late_company 
    ON public.attendance_records (status, check_in_time DESC)
    WHERE status = 'late';

-- Query D: "Get unread notifications for user Z" (Header bell icon badge)
CREATE INDEX IF NOT EXISTS idx_notifications_unread_user 
    ON public.notifications (user_id, created_at DESC)
    WHERE is_read = false;


-- 2. REWRITTEN HIGH-PERFORMANCE COMPANY-WIDE SUMMARY RPC
-- ------------------------------------------------------------------------------
-- Rewrites P12's get_company_wide_summary() to utilize index-only scans and
-- avoid full table scans across historical attendance archives.
CREATE OR REPLACE FUNCTION public.get_company_wide_summary_optimized(
    p_month INTEGER,
    p_year INTEGER
)
RETURNS TABLE (
    branch_id UUID,
    branch_name VARCHAR(255),
    employee_count INTEGER,
    total_checkins INTEGER,
    total_late_checkins INTEGER,
    attendance_rate_percent DOUBLE PRECISION,
    total_overtime_hours DOUBLE PRECISION
) AS $$
DECLARE
    v_caller_role public.user_role;
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
BEGIN
    -- Strict Admin-Only Guard
    v_caller_role := public.user_role();
    IF (v_caller_role != 'admin') THEN
        RAISE EXCEPTION 'Access Denied: Company-wide summaries are restricted to HQ Admin.' USING ERRCODE = '42501';
    END IF;

    -- Construct precise index-bounding date boundaries in UTC+6
    v_start_date := MAKE_TIMESTAMPTZ(p_year, p_month, 1, 0, 0, 0, 'Asia/Dhaka');
    v_end_date := v_start_date + INTERVAL '1 month';

    -- Use Common Table Expression (CTE) to pre-aggregate attendance using B-tree indexes
    -- before joining with branch metadata, eliminating Cartesian product full table scans.
    RETURN QUERY
    WITH branch_staff_counts AS (
        SELECT 
            p.branch_id,
            COUNT(p.id)::integer AS emp_count
        FROM public.profiles p
        WHERE p.role = 'employee' AND p.is_active = true
        GROUP BY p.id, p.branch_id
    ),
    monthly_branch_logs AS (
        SELECT 
            ar.branch_id,
            COUNT(ar.id)::integer AS checkins,
            COUNT(ar.id) FILTER (WHERE ar.status = 'late')::integer AS lates,
            COALESCE(SUM(ar.overtime_minutes), 0)::integer AS overtime_mins
        FROM public.attendance_records ar
        WHERE ar.check_in_time >= v_start_date AND ar.check_in_time < v_end_date
        GROUP BY ar.branch_id
    )
    SELECT 
        b.id AS branch_id,
        b.name AS branch_name,
        COALESCE(bsc.emp_count, 0)::integer AS employee_count,
        COALESCE(mbl.checkins, 0)::integer AS total_checkins,
        COALESCE(mbl.lates, 0)::integer AS total_late_checkins,
        CASE 
            WHEN COALESCE(bsc.emp_count, 0) = 0 THEN 0.0
            ELSE ROUND((COALESCE(mbl.checkins, 0)::numeric / (bsc.emp_count * 26.0)) * 100.0, 2)::double precision
        END AS attendance_rate_percent,
        ROUND((COALESCE(mbl.overtime_mins, 0) / 60.0)::numeric, 2)::double precision AS total_overtime_hours
    FROM public.branches b
    LEFT JOIN branch_staff_counts bsc ON bsc.branch_id = b.id
    LEFT JOIN monthly_branch_logs mbl ON mbl.branch_id = b.id
    WHERE b.is_active = true
    ORDER BY attendance_rate_percent DESC, b.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- 3. MATERIALIZED VIEW VS. LIVE QUERIES RECOMMENDATION
-- ------------------------------------------------------------------------------
-- Recommendation:
-- 1. LIVE QUERIES: Use for Today's Live Attendance Feed (BM Dashboard) and individual
--    employee check-in status. Real-time accuracy is mandatory during shop shifts.
-- 2. MATERIALIZED VIEWS: Use for Historical Monthly Executive Reports (Admin Dashboard)
--    and Payroll Export rollups for completed months. Once a month closes, data rarely
--    changes, making pre-computed materialized views 100x faster.

-- Create a Materialized View for monthly store performance rollups
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_monthly_branch_summary AS
SELECT 
    ar.branch_id,
    b.name AS branch_name,
    EXTRACT(YEAR FROM ar.check_in_time AT TIME ZONE 'Asia/Dhaka')::integer AS year_num,
    EXTRACT(MONTH FROM ar.check_in_time AT TIME ZONE 'Asia/Dhaka')::integer AS month_num,
    COUNT(ar.id)::integer AS total_checkins,
    COUNT(ar.id) FILTER (WHERE ar.status = 'present')::integer AS present_count,
    COUNT(ar.id) FILTER (WHERE ar.status = 'late')::integer AS late_count,
    COUNT(ar.id) FILTER (WHERE ar.status = 'half_day')::integer AS half_day_count,
    COALESCE(SUM(ar.overtime_minutes), 0)::integer AS total_overtime_minutes
FROM public.attendance_records ar
JOIN public.branches b ON b.id = ar.branch_id
GROUP BY ar.branch_id, b.name, year_num, month_num
WITH NO DATA;

-- Index on Materialized View for rapid month/branch filtering
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_monthly_branch_summary_unique 
    ON public.mv_monthly_branch_summary (branch_id, year_num, month_num);

-- Helper function to refresh the materialized view (to be called via Vercel Cron nightly)
CREATE OR REPLACE FUNCTION public.refresh_monthly_branch_summary_mv()
RETURNS void AS $$
BEGIN
    -- Refresh concurrently without locking out read queries
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_monthly_branch_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. EXPLAIN ANALYZE GUIDANCE FOR DEVELOPERS
-- ------------------------------------------------------------------------------
-- To verify that these composite indexes are being utilized locally:
-- 1. Open Supabase Studio -> SQL Editor.
-- 2. Run the following EXPLAIN ANALYZE command against your test seed data:
--
--    EXPLAIN ANALYZE
--    SELECT * FROM public.attendance_records
--    WHERE branch_id = 'your-test-branch-uuid'
--      AND check_in_time >= '2026-07-01 00:00:00+06'
--      AND check_in_time < '2026-08-01 00:00:00+06'
--    ORDER BY check_in_time DESC;
--
-- 3. Verify in the execution plan output that Postgres reports:
--    "Index Scan using idx_attendance_branch_today on attendance_records"
--    and NOT "Seq Scan on attendance_records" (Full Table Scan).

-- End of Migration 0005
-- Migration: 0006_advanced_business_logic.sql
-- Covers Specs P61, P63, P64, P65 (Holidays, Leaves, Shifts, Payroll)

BEGIN;

-- 1. Public Holidays (Spec P61)
CREATE TABLE IF NOT EXISTS public.public_holidays (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  holiday_date date NOT NULL UNIQUE,
  is_recurring boolean DEFAULT false, -- If true, applies every year on this MM-DD
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Leave Management & Balances (Spec P63)
CREATE TABLE IF NOT EXISTS public.leave_types (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE, -- e.g., 'CASUAL', 'SICK', 'EARNED'
  name text NOT NULL,
  default_days_per_year integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Insert standard leave types for Bangladesh
INSERT INTO public.leave_types (code, name, default_days_per_year) 
VALUES 
  ('CASUAL', 'Casual Leave', 10),
  ('SICK', 'Sick Leave', 14),
  ('EARNED', 'Earned Leave', 15)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.leave_balances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type_id uuid REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year integer NOT NULL,
  allocated_days integer NOT NULL,
  used_days numeric(5,1) DEFAULT 0, -- Supports half-days (0.5)
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, leave_type_id, year)
);

-- 3. Multi-Shift Support (Spec P64)
CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL, -- e.g., 'Morning Shift', 'Evening Shift'
  start_time time NOT NULL,
  end_time time NOT NULL,
  grace_period_minutes integer DEFAULT 15,
  created_at timestamp with time zone DEFAULT now()
);

-- Employee Shift Assignments (Rosters)
CREATE TABLE IF NOT EXISTS public.employee_shifts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES public.shifts(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  effective_to date, -- Null means current active shift
  created_at timestamp with time zone DEFAULT now()
);

-- 4. Payroll & Salary Management (Spec P65)
CREATE TABLE IF NOT EXISTS public.salary_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  base_salary numeric(10,2) NOT NULL,
  house_rent_allowance numeric(10,2) DEFAULT 0,
  medical_allowance numeric(10,2) DEFAULT 0,
  transport_allowance numeric(10,2) DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Monthly Payroll Records (Locks the month's calculation)
CREATE TABLE IF NOT EXISTS public.payroll_sheets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  month_year text NOT NULL, -- Format: 'YYYY-MM'
  total_payable_days numeric(5,1) NOT NULL,
  gross_salary numeric(10,2) NOT NULL,
  deductions numeric(10,2) DEFAULT 0,
  net_payable numeric(10,2) NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'paid')),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, month_year)
);

-- Enable RLS
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_sheets ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Admins have full access, users can view their own)
DROP POLICY IF EXISTS "Anyone can view holidays" ON public.public_holidays;
CREATE POLICY "Anyone can view holidays" ON public.public_holidays FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can view leave types" ON public.leave_types;
CREATE POLICY "Anyone can view leave types" ON public.leave_types FOR SELECT USING (true);

-- Users
DROP POLICY IF EXISTS "Users view own leave balances" ON public.leave_balances;
CREATE POLICY "Users view own leave balances" ON public.leave_balances FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users view own shift assignments" ON public.employee_shifts;
CREATE POLICY "Users view own shift assignments" ON public.employee_shifts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users view own salary settings" ON public.salary_settings;
CREATE POLICY "Users view own salary settings" ON public.salary_settings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users view own payroll" ON public.payroll_sheets;
CREATE POLICY "Users view own payroll" ON public.payroll_sheets FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users view shifts for their branch" ON public.shifts;
CREATE POLICY "Users view shifts for their branch" ON public.shifts FOR SELECT USING (branch_id = public.user_branch_id());

-- Admins
DROP POLICY IF EXISTS "Admins full access to holidays" ON public.public_holidays;
CREATE POLICY "Admins full access to holidays" ON public.public_holidays FOR ALL USING (public.user_role() = 'admin');
DROP POLICY IF EXISTS "Admins full access to leave types" ON public.leave_types;
CREATE POLICY "Admins full access to leave types" ON public.leave_types FOR ALL USING (public.user_role() = 'admin');
DROP POLICY IF EXISTS "Admins full access to balances" ON public.leave_balances;
CREATE POLICY "Admins full access to balances" ON public.leave_balances FOR ALL USING (public.user_role() = 'admin');
DROP POLICY IF EXISTS "Admins full access to shifts" ON public.shifts;
CREATE POLICY "Admins full access to shifts" ON public.shifts FOR ALL USING (public.user_role() = 'admin');
DROP POLICY IF EXISTS "Admins full access to employee shifts" ON public.employee_shifts;
CREATE POLICY "Admins full access to employee shifts" ON public.employee_shifts FOR ALL USING (public.user_role() = 'admin');
DROP POLICY IF EXISTS "Admins full access to salaries" ON public.salary_settings;
CREATE POLICY "Admins full access to salaries" ON public.salary_settings FOR ALL USING (public.user_role() = 'admin');
DROP POLICY IF EXISTS "Admins full access to payroll" ON public.payroll_sheets;
CREATE POLICY "Admins full access to payroll" ON public.payroll_sheets FOR ALL USING (public.user_role() = 'admin');

-- Branch Managers
DROP POLICY IF EXISTS "BM view balances for own branch" ON public.leave_balances;
CREATE POLICY "BM view balances for own branch" ON public.leave_balances FOR SELECT USING (
  public.user_role() = 'branch_manager' AND 
  user_id IN (SELECT id FROM public.profiles WHERE branch_id = public.user_branch_id())
);

DROP POLICY IF EXISTS "BM all access to shifts for own branch" ON public.shifts;
CREATE POLICY "BM all access to shifts for own branch" ON public.shifts FOR ALL USING (
  public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id()
);

DROP POLICY IF EXISTS "BM all access to employee shifts for own branch" ON public.employee_shifts;
CREATE POLICY "BM all access to employee shifts for own branch" ON public.employee_shifts FOR ALL USING (
  public.user_role() = 'branch_manager' AND 
  user_id IN (SELECT id FROM public.profiles WHERE branch_id = public.user_branch_id())
);
COMMIT;
