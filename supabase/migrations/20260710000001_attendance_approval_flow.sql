-- ==============================================================================
-- ANCHOR FASHION — ATTENDANCE APPROVAL FLOW + DUTY HOURS HISTORY (MIGRATION)
-- Adds BM approval workflow to attendance check-ins
-- Adds duty hours history tracking per branch
-- ==============================================================================

-- 1. Add approval columns to attendance_records
-- ------------------------------------------------------------------------------
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_note TEXT;

-- Index for fast pending approval queries per branch
CREATE INDEX IF NOT EXISTS idx_attendance_approval_status
  ON public.attendance_records(approval_status, branch_id);

-- 2. Create Branch Duty Hours History Table
-- ------------------------------------------------------------------------------
-- Tracks every change to branch duty hours so admins can see historical records
CREATE TABLE IF NOT EXISTS public.branch_duty_hours_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id       UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  work_start_time TIME WITHOUT TIME ZONE NOT NULL DEFAULT '09:00:00',
  work_end_time   TIME WITHOUT TIME ZONE NOT NULL DEFAULT '17:00:00',
  late_grace_minutes    INTEGER NOT NULL DEFAULT 15,
  overtime_after_minutes INTEGER NOT NULL DEFAULT 0,
  half_day_hours  DOUBLE PRECISION NOT NULL DEFAULT 4.0,
  changed_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  change_reason   TEXT,
  effective_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to    TIMESTAMPTZ,   -- NULL = still current (most recent row)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_duty_hours_history_branch
  ON public.branch_duty_hours_history(branch_id, effective_from DESC);

-- RLS for duty hours history
ALTER TABLE public.branch_duty_hours_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage all duty hours history"
  ON public.branch_duty_hours_history
  FOR ALL TO authenticated
  USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );

CREATE POLICY "Branch manager can view their branch duty hours history"
  ON public.branch_duty_hours_history
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'branch_manager')
    AND
    branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
  );

-- 3. Ensure branch_settings table has proper columns
-- (branch_settings may already exist from prior migrations; safely add if missing)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- Ensure branch_settings table exists (may already exist)
  CREATE TABLE IF NOT EXISTS public.branch_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL UNIQUE REFERENCES public.branches(id) ON DELETE CASCADE,
    work_start_time TIME WITHOUT TIME ZONE DEFAULT '09:00:00',
    work_end_time   TIME WITHOUT TIME ZONE DEFAULT '17:00:00',
    late_grace_minutes    INTEGER DEFAULT 15,
    overtime_after_minutes INTEGER DEFAULT 0,
    half_day_hours  DOUBLE PRECISION DEFAULT 4.0,
    weekly_off_days INTEGER[] DEFAULT ARRAY[0],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
EXCEPTION WHEN duplicate_table THEN
  NULL;
END;
$$;

-- Ensure RLS is enabled on branch_settings
ALTER TABLE public.branch_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Admin can manage branch settings"
    ON public.branch_settings
    FOR ALL TO authenticated
    USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE POLICY "Branch manager can view and update own branch settings"
    ON public.branch_settings
    FOR ALL TO authenticated
    USING (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'branch_manager')
      AND
      branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

-- 4. RLS policy for attendance_records approval columns
-- Allow branch managers to update approval_status for their branch
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  CREATE POLICY "Branch manager can approve attendance in their branch"
    ON public.attendance_records
    FOR UPDATE TO authenticated
    USING (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'branch_manager')
      AND
      (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        OR
        branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
      )
    )
    WITH CHECK (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'branch_manager')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

-- End of Migration
