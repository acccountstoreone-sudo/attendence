-- ==============================================================================
-- ANCHOR FASHION -- FINAL FIX: SHOWROOM DAILY TASKS (PATCH MIGRATION v2)
-- Replaces 20260825000001 — run this AFTER the original migration.
-- Fixes ALL policy and trigger bugs completely.
-- ==============================================================================

-- 1. updated_at auto-update trigger (no SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_daily_tasks_updated_at ON public.showroom_daily_tasks;
CREATE TRIGGER trg_daily_tasks_updated_at
  BEFORE UPDATE ON public.showroom_daily_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_updated_at();


-- 2. Admin policy -- explicit WITH CHECK
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin can manage all showroom daily tasks" ON public.showroom_daily_tasks;
CREATE POLICY "Admin can manage all showroom daily tasks"
  ON public.showroom_daily_tasks
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );


-- 3. Employee SELECT -- with role guard
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Employee can view and update own branch daily tasks" ON public.showroom_daily_tasks;
DROP POLICY IF EXISTS "Employee can view own branch daily tasks" ON public.showroom_daily_tasks;
CREATE POLICY "Employee can view own branch daily tasks"
  ON public.showroom_daily_tasks
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'employee'
    AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
  );


-- 4. Employee UPDATE -- with role guard (was missing role check)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Employee can update own branch daily tasks" ON public.showroom_daily_tasks;
CREATE POLICY "Employee can update own branch daily tasks"
  ON public.showroom_daily_tasks
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'employee'
    AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'employee'
    AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
  );


-- 5. Employee INSERT -- with role guard (was missing role check)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Employee can insert today branch daily tasks" ON public.showroom_daily_tasks;
CREATE POLICY "Employee can insert own branch daily tasks"
  ON public.showroom_daily_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'employee'
    AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
  );

-- End of Final Patch Migration