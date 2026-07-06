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
