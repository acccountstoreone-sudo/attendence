-- ==============================================================================
-- ANCHOR FASHION — OFF-DAY OVERTIME WORKFLOW & EXACT OVERTIME
-- Migration: 20260718000001_offday_requests_and_exact_overtime.sql
-- ==============================================================================
-- Adds a new table for pre-approved off-day requests and removes 15-min rounding
-- ==============================================================================

BEGIN;

-- 1. Create table for off-day overtime requests (Pre-approval workflow)
CREATE TABLE IF NOT EXISTS public.off_day_overtime_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    requested_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    reviewer_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for quick lookup
CREATE INDEX IF NOT EXISTS idx_off_day_requests_employee_date ON public.off_day_overtime_requests(employee_id, requested_date);
CREATE INDEX IF NOT EXISTS idx_off_day_requests_branch_status ON public.off_day_overtime_requests(branch_id, status);

-- Trigger for updated_at
CREATE TRIGGER trg_off_day_requests_updated_at 
BEFORE UPDATE ON public.off_day_overtime_requests 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.off_day_overtime_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view their own off day requests"
    ON public.off_day_overtime_requests FOR SELECT
    USING (auth.uid() = employee_id);

CREATE POLICY "Employees can insert their own off day requests"
    ON public.off_day_overtime_requests FOR INSERT
    WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Admins can view all off day requests"
    ON public.off_day_overtime_requests FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update all off day requests"
    ON public.off_day_overtime_requests FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Branch managers can view branch off day requests"
    ON public.off_day_overtime_requests FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'branch_manager' AND branch_id = off_day_overtime_requests.branch_id));

CREATE POLICY "Branch managers can update branch off day requests"
    ON public.off_day_overtime_requests FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'branch_manager' AND branch_id = off_day_overtime_requests.branch_id));


-- 2. Upgrade calculate_attendance_status trigger function to REMOVE 15-minute slot rounding
CREATE OR REPLACE FUNCTION public.calculate_attendance_status()
RETURNS TRIGGER AS $$
DECLARE
    v_work_start TIME := '09:00:00';
    v_work_end TIME := '18:00:00';
    v_grace_mins INTEGER := 15;
    v_overtime_after INTEGER := 30;
    v_half_day_hrs DOUBLE PRECISION := 4.0;
    v_slot_mins INTEGER := 15; -- Kept variable so we don't break queries but we won't use it for rounding
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
        
        -- Check if it is a holiday duty (which overrides standard overtime thresholds)
        IF (NEW.is_holiday_duty = true) THEN
            NEW.overtime_minutes := FLOOR(EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 60.0)::integer;
        ELSIF (NEW.check_out_time > v_overtime_start_tstz) THEN
            NEW.overtime_minutes := FLOOR(EXTRACT(EPOCH FROM (NEW.check_out_time - v_work_end_tstz)) / 60.0)::integer;
        ELSE
            NEW.overtime_minutes := 0;
        END IF;

        -- Exact Minute calculation is used! We have removed the Slot Rounding logic below:
        -- IF (v_slot_mins > 0 AND NEW.overtime_minutes > 0) THEN
        --     NEW.overtime_minutes := FLOOR(NEW.overtime_minutes / v_slot_mins) * v_slot_mins;
        -- END IF;

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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
