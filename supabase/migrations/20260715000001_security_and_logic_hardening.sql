-- ==============================================================================
-- ANCHOR FASHION — SECURITY HARDENING & OVERTIME AUDIT FIXES (MIGRATION 20260715000001)
-- ==============================================================================
-- Fixes:
-- 1. [CRITICAL-01] RLS Column-Level Security Bypass on attendance_records
-- 2. [CRITICAL-03] Overnight Shift Overtime Dropped to Zero by Time Extraction
-- 3. [CRITICAL-04] Overtime Calculation Skipped When is_manual_override is True
-- 4. [MEDIUM-01] Anonymous Enumerable Branch Metadata (Add RLS policy for onboarding)
-- ==============================================================================

BEGIN;

-- 1. PROTECT ATTENDANCE IMMUTABLE FIELDS AGAINST EMPLOYEE DIRECT MODIFICATION
CREATE OR REPLACE FUNCTION public.protect_attendance_immutable_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF public.user_role() = 'employee' THEN
        -- Employees are allowed to update their active attendance record ONLY to check out (`check_out_time`, `check_out_lat`, `check_out_lng`)
        IF NEW.check_in_time <> OLD.check_in_time OR
           NEW.status <> OLD.status OR
           NEW.overtime_minutes <> OLD.overtime_minutes OR
           NEW.is_manual_override <> OLD.is_manual_override OR
           NEW.employee_id <> OLD.employee_id OR
           NEW.branch_id <> OLD.branch_id THEN
            RAISE EXCEPTION 'FORBIDDEN: Employees cannot modify check-in timestamps, status, or overtime fields directly.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_a_protect_attendance_immutable_fields ON public.attendance_records;
CREATE TRIGGER trg_a_protect_attendance_immutable_fields
    BEFORE UPDATE ON public.attendance_records
    FOR EACH ROW EXECUTE FUNCTION public.protect_attendance_immutable_fields();


-- 2. ADD RLS POLICY FOR ANON BRANCH ONBOARDING DROPDOWN
DROP POLICY IF EXISTS "Anon can view active branches for onboarding" ON public.branches;
CREATE POLICY "Anon can view active branches for onboarding" ON public.branches FOR SELECT
    TO anon
    USING (is_active = true);


-- 3. UPGRADE calculate_attendance_status TO SUPPORT OVERNIGHT SHIFTS & MANUAL OVERRIDE OVERTIME
CREATE OR REPLACE FUNCTION public.calculate_attendance_status()
RETURNS TRIGGER AS $$
DECLARE
    v_work_start TIME;
    v_work_end TIME;
    v_grace_mins INTEGER;
    v_overtime_after INTEGER := 30;
    v_half_day_hrs DOUBLE PRECISION := 4.0;
    v_slot_mins INTEGER := 15;
    v_require_approval BOOLEAN := false;
    v_worked_hours DOUBLE PRECISION := 0.0;
    v_checkin_time TIME;
    v_late_cutoff TIME;
    v_work_end_tstz TIMESTAMPTZ;
    v_overtime_start_tstz TIMESTAMPTZ;
BEGIN
    -- 1. Fetch store-specific timing rules from branch_settings (fallback to defaults)
    SELECT 
        COALESCE(bs.work_start_time, cp.default_work_start_time, '09:00:00'::time),
        COALESCE(bs.work_end_time, cp.default_work_end_time, '18:00:00'::time),
        COALESCE(bs.late_grace_minutes, 15),
        COALESCE(bs.overtime_after_minutes, 30),
        COALESCE(bs.half_day_hours, 4.0),
        COALESCE(bs.overtime_slot_minutes, 15),
        COALESCE(bs.require_overtime_approval, false)
    INTO 
        v_work_start, v_work_end, v_grace_mins, v_overtime_after, v_half_day_hrs, v_slot_mins, v_require_approval
    FROM public.company_profile cp
    LEFT JOIN public.branch_settings bs ON bs.branch_id = NEW.branch_id
    LIMIT 1;

    -- 2. Evaluate check-in punctuality and status ONLY IF not manually overridden
    IF (NEW.is_manual_override = false OR OLD.is_manual_override IS NULL) THEN
        v_checkin_time := (NEW.check_in_time AT TIME ZONE 'Asia/Dhaka')::time;
        v_late_cutoff := v_work_start + (v_grace_mins || ' minutes')::interval;

        IF (v_checkin_time > v_late_cutoff) THEN
            NEW.status := 'late'::public.attendance_status;
        ELSE
            NEW.status := 'present'::public.attendance_status;
        END IF;
    END IF;

    -- 3. If check_out_time is present, evaluate worked hours and overtime (even when check-in status was manual override)
    IF (NEW.check_out_time IS NOT NULL) THEN
        -- Compute total worked hours
        v_worked_hours := EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 3600.0;
        
        -- Check for half-day status if worked hours are below threshold AND status not manually locked
        IF (NEW.is_manual_override = false AND v_worked_hours < v_half_day_hrs) THEN
            NEW.status := 'half_day'::public.attendance_status;
        END IF;

        -- Compute expected work end as TIMESTAMPTZ on the check-in date to handle overnight shifts cleanly
        v_work_end_tstz := ((NEW.check_in_time AT TIME ZONE 'Asia/Dhaka')::date + v_work_end) AT TIME ZONE 'Asia/Dhaka';
        v_overtime_start_tstz := v_work_end_tstz + (v_overtime_after || ' minutes')::interval;
        
        IF (NEW.check_out_time > v_overtime_start_tstz) THEN
            NEW.overtime_minutes := FLOOR(EXTRACT(EPOCH FROM (NEW.check_out_time - v_work_end_tstz)) / 60.0)::integer;
            
            -- Apply Slot Rounding Rule (if slot_mins > 0)
            IF (v_slot_mins > 0 AND NEW.overtime_minutes > 0) THEN
                NEW.overtime_minutes := FLOOR(NEW.overtime_minutes / v_slot_mins) * v_slot_mins;
            END IF;

            -- Set approval status based on branch settings
            IF (NEW.overtime_minutes > 0 AND v_require_approval = true) THEN
                NEW.overtime_approval_status := 'pending';
            ELSIF (NEW.overtime_minutes > 0) THEN
                NEW.overtime_approval_status := 'approved';
            ELSE
                NEW.overtime_approval_status := 'auto';
            END IF;
        ELSE
            NEW.overtime_minutes := 0;
            NEW.overtime_approval_status := 'auto';
        END IF;
    ELSE
        NEW.overtime_minutes := 0;
        NEW.overtime_approval_status := 'auto';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
