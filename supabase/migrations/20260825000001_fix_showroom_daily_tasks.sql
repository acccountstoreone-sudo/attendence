-- ==============================================================================
-- ANCHOR FASHION -- FIX: SHOWROOM DAILY TASKS (PATCH MIGRATION)
-- Fixes bugs found in 20260719000001_add_showroom_daily_tasks.sql:
--   1. Admin FOR ALL policy missing WITH CHECK clause
--   2. Employee SELECT policy had no role guard (any role could match)
--   3. updated_at column never auto-updated (missing trigger)
-- ==============================================================================

-- 1. Fix: updated_at auto-update trigger
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  EXECUTE FUNCTION public.set_updated_at();


-- 2. Fix: Admin policy -- add WITH CHECK clause
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


-- 3. Fix: Employee SELECT policy -- add role guard
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Employee can view and update own branch daily tasks" ON public.showroom_daily_tasks;
CREATE POLICY "Employee can view own branch daily tasks"
  ON public.showroom_daily_tasks
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'employee'
    AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
  );

-- End of Patch Migration