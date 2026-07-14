-- ==============================================================================
-- ANCHOR FASHION — ADVANCED OVERTIME & HOLIDAY PAYROLL ENGINE UPGRADES
-- Migration: 20260713000004_overtime_upgrades_and_approval.sql
-- ==============================================================================
-- Adds Overtime Verification Workflow, Slot-Based Rounding, & Holiday Multipliers.
-- ==============================================================================

BEGIN;

-- 1. Add settings columns to branch_settings
ALTER TABLE public.branch_settings 
    ADD COLUMN IF NOT EXISTS overtime_slot_minutes INTEGER DEFAULT 15,
    ADD COLUMN IF NOT EXISTS holiday_overtime_multiplier NUMERIC(4,2) DEFAULT 2.00,
    ADD COLUMN IF NOT EXISTS require_overtime_approval BOOLEAN DEFAULT false;

-- 2. Add settings columns to branch_duty_hours_history for audit trail
ALTER TABLE public.branch_duty_hours_history 
    ADD COLUMN IF NOT EXISTS overtime_slot_minutes INTEGER DEFAULT 15,
    ADD COLUMN IF NOT EXISTS holiday_overtime_multiplier NUMERIC(4,2) DEFAULT 2.00,
    ADD COLUMN IF NOT EXISTS require_overtime_approval BOOLEAN DEFAULT false;

-- 3. Add employee-specific override column to salary_settings
ALTER TABLE public.salary_settings 
    ADD COLUMN IF NOT EXISTS holiday_overtime_multiplier NUMERIC(4,2) DEFAULT NULL;

-- 4. Extend attendance_records table for overtime verification workflow & holiday tagging
ALTER TABLE public.attendance_records 
    ADD COLUMN IF NOT EXISTS approved_overtime_minutes INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS overtime_approval_status VARCHAR(20) DEFAULT 'auto',
    ADD COLUMN IF NOT EXISTS overtime_approval_note TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS is_holiday_duty BOOLEAN DEFAULT false;

-- 5. Upgrade calculate_attendance_status trigger function to incorporate slot rounding & pending status
CREATE OR REPLACE FUNCTION public.calculate_attendance_status()
RETURNS TRIGGER AS $$
DECLARE
    v_work_start TIME := '09:00:00';
    v_work_end TIME := '18:00:00';
    v_grace_mins INTEGER := 15;
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

    -- 2. Evaluate check-in punctuality ONLY IF not manually overridden
    IF (NEW.is_manual_override = false OR OLD.is_manual_override IS NULL) THEN
        v_checkin_time := (NEW.check_in_time AT TIME ZONE 'Asia/Dhaka')::time;
        v_late_cutoff := v_work_start + (v_grace_mins || ' minutes')::interval;

        IF (v_checkin_time > v_late_cutoff) THEN
            NEW.status := 'late'::public.attendance_status;
        ELSE
            NEW.status := 'present'::public.attendance_status;
        END IF;
    END IF;

    -- 3. If check_out_time is present, evaluate worked hours and overtime
    IF (NEW.check_out_time IS NOT NULL) THEN
        -- Compute total worked hours
        v_worked_hours := EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 3600.0;
        
        -- Check for half-day status if worked hours are below threshold AND status not manually locked
        IF (NEW.is_manual_override = false AND v_worked_hours < v_half_day_hrs) THEN
            NEW.status := 'half_day'::public.attendance_status;
        END IF;

        -- Compute expected work end as TIMESTAMPTZ on the check-in date to handle overnight shifts
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
