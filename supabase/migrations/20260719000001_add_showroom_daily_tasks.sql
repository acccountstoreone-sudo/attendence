-- ==============================================================================
-- ANCHOR FASHION — SHOWROOM DAILY TASKS CHECKLIST (MIGRATION)
-- Creates a shared daily task checklist per branch.
-- All employees in the same branch see & share the same checklist for the day.
-- ==============================================================================

-- 1. Create the showroom_daily_tasks table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.showroom_daily_tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id       UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  tasks_state     JSONB NOT NULL DEFAULT '{}'::JSONB,
  completed_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One record per branch per day
  CONSTRAINT uq_daily_tasks_branch_date UNIQUE (branch_id, date)
);

COMMENT ON TABLE public.showroom_daily_tasks IS
  'Tracks the completion state of each showroom daily operational task per branch per day.';

COMMENT ON COLUMN public.showroom_daily_tasks.tasks_state IS
  'JSONB map of task_key -> boolean. e.g. {"showroom_clean": true, "generator_oil": false}';

-- Index for fast per-branch daily lookup
CREATE INDEX IF NOT EXISTS idx_daily_tasks_branch_date
  ON public.showroom_daily_tasks(branch_id, date DESC);

-- 2. Enable Row Level Security
-- ------------------------------------------------------------------------------
ALTER TABLE public.showroom_daily_tasks ENABLE ROW LEVEL SECURITY;

-- Admin: full access to all branches
DO $$ BEGIN
  CREATE POLICY "Admin can manage all showroom daily tasks"
    ON public.showroom_daily_tasks
    FOR ALL TO authenticated
    USING (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- Branch Manager: can view & manage their own branch tasks
DO $$ BEGIN
  CREATE POLICY "Branch manager can manage own branch daily tasks"
    ON public.showroom_daily_tasks
    FOR ALL TO authenticated
    USING (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'branch_manager'
      AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'branch_manager'
      AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- Employee: can read and update (not delete/insert) their own branch tasks
DO $$ BEGIN
  CREATE POLICY "Employee can view and update own branch daily tasks"
    ON public.showroom_daily_tasks
    FOR SELECT TO authenticated
    USING (
      branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  CREATE POLICY "Employee can update own branch daily tasks"
    ON public.showroom_daily_tasks
    FOR UPDATE TO authenticated
    USING (
      branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
      branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- Allow employees to INSERT a new row for today if none exists yet
DO $$ BEGIN
  CREATE POLICY "Employee can insert today branch daily tasks"
    ON public.showroom_daily_tasks
    FOR INSERT TO authenticated
    WITH CHECK (
      branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- End of Migration
