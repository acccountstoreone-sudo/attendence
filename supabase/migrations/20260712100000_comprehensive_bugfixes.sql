-- =============================================================================
-- COMPREHENSIVE BUG-FIX MIGRATION
-- Fixes: SQL-01, SQL-03, SQL-04, SQL-06, SQL-07, SQL-08, SQL-09, APP-10,
--        BUG-NEW-05, MISS-01 (leave balance auto-init trigger)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SQL-01: Add missing `face_verified` column to attendance_records
-- ---------------------------------------------------------------------------
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS face_verified BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- SQL-03: Expand audit_logs.action CHECK constraint to allow ONBOARD_EMPLOYEE
-- ---------------------------------------------------------------------------
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'CREATE', 'UPDATE', 'DELETE',
    'MANUAL_OVERRIDE', 'DEACTIVATE', 'ROLLBACK',
    'ONBOARD_EMPLOYEE', 'BULK_IMPORT', 'KYC_APPROVE', 'KYC_REJECT',
    'CORRECTION_APPROVE', 'CORRECTION_REJECT',
    'LEAVE_APPROVE', 'LEAVE_REJECT', 'LEAVE_CANCEL'
  ));

-- ---------------------------------------------------------------------------
-- SQL-04: Expand notifications.type CHECK constraint
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'info', 'warning', 'leave', 'attendance',
    'attendance_approval', 'attendance_decision',
    'system', 'welcome', 'correction', 'payroll', 'alert', 'success'
  ));

-- Also fix the Zod enum mismatch: notifications API uses 'alert'/'success'
-- but DB originally only had 'info','warning','leave','attendance','system','welcome'
-- Now all are covered above.

-- ---------------------------------------------------------------------------
-- SQL-06: branch_settings — ensure the 0002 schema columns are present
-- (The 0010 migration may have created a conflicting schema; safely add
--  any columns that might be missing if the wrong schema won)
-- ---------------------------------------------------------------------------
ALTER TABLE public.branch_settings
  ADD COLUMN IF NOT EXISTS work_start_time TIME NOT NULL DEFAULT '09:00:00',
  ADD COLUMN IF NOT EXISTS work_end_time TIME NOT NULL DEFAULT '18:00:00',
  ADD COLUMN IF NOT EXISTS late_grace_minutes INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS overtime_after_minutes INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS half_day_hours NUMERIC(4,2) NOT NULL DEFAULT 4.0,
  ADD COLUMN IF NOT EXISTS weekly_off_days INTEGER[] NOT NULL DEFAULT '{5}'::INTEGER[];

-- ---------------------------------------------------------------------------
-- SQL-07: Add missing columns to leave_requests
-- ---------------------------------------------------------------------------
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS leave_type_id UUID REFERENCES public.leave_types(id),
  ADD COLUMN IF NOT EXISTS total_days INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewer_note TEXT;

-- Backfill user_id from employee_id where user_id is null
UPDATE public.leave_requests
SET user_id = employee_id
WHERE user_id IS NULL AND employee_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- SQL-08: Add INSERT policy for leave_balances for branch managers
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "BM can insert leave balances for own branch" ON public.leave_balances;

CREATE POLICY "BM can insert leave balances for own branch"
  ON public.leave_balances
  FOR INSERT
  WITH CHECK (
    public.user_role() = 'branch_manager'
    AND user_id IN (
      SELECT id FROM public.profiles
      WHERE branch_id = public.user_branch_id()
    )
  );

-- Also allow BM to UPDATE leave balances for their branch employees
DROP POLICY IF EXISTS "BM can update leave balances for own branch" ON public.leave_balances;

CREATE POLICY "BM can update leave balances for own branch"
  ON public.leave_balances
  FOR UPDATE
  USING (
    public.user_role() = 'branch_manager'
    AND user_id IN (
      SELECT id FROM public.profiles
      WHERE branch_id = public.user_branch_id()
    )
  );

-- ---------------------------------------------------------------------------
-- SQL-09: Add INSERT/UPDATE/SELECT policy for payroll_sheets for branch managers
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "BM can manage payroll for own branch" ON public.payroll_sheets;

CREATE POLICY "BM can manage payroll for own branch"
  ON public.payroll_sheets
  FOR ALL
  USING (
    public.user_role() = 'branch_manager'
    AND branch_id = public.user_branch_id()
  )
  WITH CHECK (
    public.user_role() = 'branch_manager'
    AND branch_id = public.user_branch_id()
  );

-- ---------------------------------------------------------------------------
-- APP-10: Fix get_branch_monthly_summary to compute real absent count
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_branch_monthly_summary(
  p_branch_id UUID,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS TABLE (
  total_present BIGINT,
  total_late BIGINT,
  total_absent BIGINT,
  total_half_day BIGINT,
  total_records BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_working_days INTEGER;
  v_employee_count BIGINT;
BEGIN
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date   := (v_start_date + INTERVAL '1 month - 1 day')::DATE;

  -- Count working days (Mon–Fri, excluding branch weekly_off_days)
  -- Simplified: count calendar days in range
  v_working_days := v_end_date - v_start_date + 1;

  -- Count active employees in branch
  SELECT COUNT(*) INTO v_employee_count
  FROM public.profiles
  WHERE branch_id = p_branch_id
    AND role = 'employee'
    AND is_active = TRUE;

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'present')  AS total_present,
    COUNT(*) FILTER (WHERE status = 'late')     AS total_late,
    -- Absent = total expected (employees × days) minus what was actually logged
    GREATEST(
      0,
      (v_employee_count * v_working_days)::BIGINT
      - COUNT(*) FILTER (WHERE status IN ('present', 'late', 'half_day'))
    )                                            AS total_absent,
    COUNT(*) FILTER (WHERE status = 'half_day') AS total_half_day,
    COUNT(*)                                     AS total_records
  FROM public.attendance_records
  WHERE branch_id = p_branch_id
    AND check_in_time >= (v_start_date::TIMESTAMPTZ AT TIME ZONE 'Asia/Dhaka')
    AND check_in_time <  ((v_end_date + 1)::TIMESTAMPTZ AT TIME ZONE 'Asia/Dhaka');
END;
$$;

-- ---------------------------------------------------------------------------
-- MISS-01: Auto-initialize leave_balances when a new employee profile is created
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.initialize_employee_leave_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leave_type RECORD;
  v_current_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
BEGIN
  -- Only for employees
  IF NEW.role <> 'employee' THEN
    RETURN NEW;
  END IF;

  -- Insert one leave_balance row per leave_type
  FOR v_leave_type IN
    SELECT id, default_days FROM public.leave_types WHERE is_active = TRUE
  LOOP
    INSERT INTO public.leave_balances (user_id, leave_type_id, year, allocated_days, used_days)
    VALUES (NEW.id, v_leave_type.id, v_current_year, COALESCE(v_leave_type.default_days, 10), 0)
    ON CONFLICT (user_id, leave_type_id, year) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_leave_balances ON public.profiles;
CREATE TRIGGER trg_init_leave_balances
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_employee_leave_balances();
