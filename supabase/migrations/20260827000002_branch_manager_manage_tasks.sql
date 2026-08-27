-- ==============================================================================
-- Migration: 20260827000002_branch_manager_manage_tasks.sql
-- Fixes an issue where branch managers could not add, update, or delete
-- daily tasks for their own branch, causing a "Failed to add task" error.
-- ==============================================================================

-- Drop the old select-only policy for branch managers
DROP POLICY IF EXISTS "Branch manager can read own branch tasks" ON public.branch_tasks;

-- Create a new policy that allows branch managers ALL operations (SELECT, INSERT, UPDATE, DELETE)
-- on tasks belonging to their branch.
CREATE POLICY "Branch manager can manage own branch tasks"
  ON public.branch_tasks
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'branch_manager'
    AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'branch_manager'
    AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
  );
