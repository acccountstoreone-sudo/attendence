-- ==============================================================================
-- ANCHOR FASHION — DAILY TASKS PER-EMPLOYEE ACCOUNTABILITY UPGRADE
-- Migration: 20260826000001_daily_tasks_per_employee_tracking.sql
--
-- Changes:
--   1. Creates `showroom_task_logs` audit table (immutable task event log).
--   2. Creates `toggle_showroom_task` RPC (atomic, race-condition-safe toggle).
--
-- tasks_state JSONB structure is now:
-- {
--   "showroom_clean": {
--     "status": "completed",
--     "completed_by_id": "uuid",
--     "completed_by_name": "Rahim",
--     "completed_at": "2026-08-26T10:15:00Z"
--   },
--   "generator_oil": {
--     "status": "pending"
--   }
-- }
-- ==============================================================================


-- ==============================================================================
-- 1. AUDIT LOG TABLE: showroom_task_logs
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.showroom_task_logs (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id       UUID        NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  date            DATE        NOT NULL DEFAULT CURRENT_DATE,
  task_key        TEXT        NOT NULL,
  employee_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_name   TEXT        NOT NULL,
  action          TEXT        NOT NULL CHECK (action IN ('completed', 'uncompleted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.showroom_task_logs IS
  'Immutable audit log for every task toggle action. Enables per-employee reporting.';

CREATE INDEX IF NOT EXISTS idx_task_logs_branch_date
  ON public.showroom_task_logs(branch_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_task_logs_employee
  ON public.showroom_task_logs(employee_id, date DESC);

-- RLS
ALTER TABLE public.showroom_task_logs ENABLE ROW LEVEL SECURITY;

-- Admin: read all logs
CREATE POLICY "Admin can view all task logs"
  ON public.showroom_task_logs
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Branch manager: read their own branch logs
CREATE POLICY "Branch manager can view own branch task logs"
  ON public.showroom_task_logs
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'branch_manager'
    AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
  );

-- Employees: read their own branch logs (so they can see who did what)
CREATE POLICY "Employee can view own branch task logs"
  ON public.showroom_task_logs
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('employee', 'branch_manager', 'admin')
    AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
  );

-- Inserts are only done via the RPC (SECURITY DEFINER), so no direct INSERT policy needed.
-- We grant it via the function below.


-- ==============================================================================
-- 2. RPC FUNCTION: toggle_showroom_task
--    Atomically toggles a single task key inside tasks_state JSONB,
--    and writes an audit log. Runs as SECURITY DEFINER so it can write
--    the log table and bypass the lock held by the calling transaction.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.toggle_showroom_task(
  p_branch_id    UUID,
  p_task_key     TEXT,
  p_employee_id  UUID,
  p_employee_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today         DATE := CURRENT_DATE;
  v_record_id     UUID;
  v_tasks_state   JSONB;
  v_task_entry    JSONB;
  v_new_status    TEXT;
  v_new_entry     JSONB;
  v_final_state   JSONB;
BEGIN
  -- 1. Verify caller is from the same branch (security check)
  IF (SELECT branch_id FROM public.profiles WHERE id = auth.uid()) != p_branch_id THEN
    RAISE EXCEPTION 'Unauthorized: caller does not belong to this branch.';
  END IF;

  -- 2. Lock the row for today (or create it if it doesn't exist)
  SELECT id, tasks_state
    INTO v_record_id, v_tasks_state
    FROM public.showroom_daily_tasks
   WHERE branch_id = p_branch_id
     AND date = v_today
  FOR UPDATE;  -- row-level lock prevents race conditions

  IF v_record_id IS NULL THEN
    -- No row for today yet: create one with empty state
    INSERT INTO public.showroom_daily_tasks (branch_id, date, tasks_state)
    VALUES (p_branch_id, v_today, '{}'::JSONB)
    RETURNING id, tasks_state INTO v_record_id, v_tasks_state;
  END IF;

  -- 3. Determine current task state
  v_task_entry := v_tasks_state -> p_task_key;

  IF v_task_entry IS NULL OR (v_task_entry ->> 'status') = 'pending' OR (v_task_entry ->> 'status') IS NULL THEN
    -- Task is currently pending → mark as completed
    v_new_status := 'completed';
    v_new_entry  := jsonb_build_object(
      'status',             'completed',
      'completed_by_id',    p_employee_id::TEXT,
      'completed_by_name',  p_employee_name,
      'completed_at',       NOW()::TEXT
    );
  ELSE
    -- Task is already completed → allow the same employee to uncheck it only
    IF (v_task_entry ->> 'completed_by_id') != p_employee_id::TEXT THEN
      RAISE EXCEPTION 'Unauthorized: only the employee who completed this task can uncheck it.';
    END IF;
    v_new_status := 'pending';
    v_new_entry  := jsonb_build_object('status', 'pending');
  END IF;

  -- 4. Apply update atomically
  v_final_state := v_tasks_state || jsonb_build_object(p_task_key, v_new_entry);

  UPDATE public.showroom_daily_tasks
     SET tasks_state  = v_final_state,
         updated_at   = NOW()
   WHERE id = v_record_id;

  -- 5. Write audit log
  INSERT INTO public.showroom_task_logs
    (branch_id, date, task_key, employee_id, employee_name, action)
  VALUES
    (p_branch_id, v_today, p_task_key, p_employee_id, p_employee_name, v_new_status);

  -- 6. Return the updated full tasks_state
  RETURN v_final_state;
END;
$$;

COMMENT ON FUNCTION public.toggle_showroom_task IS
  'Atomically toggles a task key in showroom_daily_tasks and writes an audit log. SECURITY DEFINER.';

-- ==============================================================================
-- End of Migration
-- ==============================================================================
