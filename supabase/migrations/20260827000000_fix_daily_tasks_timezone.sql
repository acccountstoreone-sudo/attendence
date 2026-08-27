-- ==============================================================================
-- Migration: 20260827000000_fix_daily_tasks_timezone.sql
-- Fixes the toggle_showroom_task RPC to accept a p_date parameter from the client.
-- This ensures that toggling a task after midnight (UTC) doesn't accidentally
-- update the previous day's tasks if the client is already viewing the new day.
-- ==============================================================================

DROP FUNCTION IF EXISTS public.toggle_showroom_task(UUID, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.toggle_showroom_task(
  p_branch_id    UUID,
  p_task_key     TEXT,
  p_employee_id  UUID,
  p_employee_name TEXT,
  p_date         DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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

  -- 2. Lock the row for the specified date (or create it if it doesn't exist)
  SELECT id, tasks_state
    INTO v_record_id, v_tasks_state
    FROM public.showroom_daily_tasks
   WHERE branch_id = p_branch_id
     AND date = p_date
  FOR UPDATE;  -- row-level lock prevents race conditions

  IF v_record_id IS NULL THEN
    -- No row for today yet: create one with empty state
    INSERT INTO public.showroom_daily_tasks (branch_id, date, tasks_state)
    VALUES (p_branch_id, p_date, '{}'::JSONB)
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
    (p_branch_id, p_date, p_task_key, p_employee_id, p_employee_name, v_new_status);

  -- 6. Return the updated full tasks_state
  RETURN v_final_state;
END;
$$;

COMMENT ON FUNCTION public.toggle_showroom_task IS
  'Atomically toggles a task key in showroom_daily_tasks for a specific date and writes an audit log. SECURITY DEFINER.';
