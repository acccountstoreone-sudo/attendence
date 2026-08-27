-- ==============================================================================
-- ANCHOR FASHION — DYNAMIC BRANCH TASKS
-- Migration: 20260827000001_branch_custom_tasks.sql
--
-- Changes:
--   1. Creates `branch_tasks` table.
--   2. Seeds default tasks for all existing branches.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.branch_tasks (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id   UUID        NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  task_key    TEXT        NOT NULL,
  label       TEXT        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, task_key)
);

COMMENT ON TABLE public.branch_tasks IS 'Stores custom daily tasks for each branch.';

CREATE INDEX IF NOT EXISTS idx_branch_tasks_branch_id ON public.branch_tasks(branch_id);

-- RLS
ALTER TABLE public.branch_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can do all on branch tasks"
  ON public.branch_tasks
  FOR ALL TO authenticated
  USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );

CREATE POLICY "Branch manager can read own branch tasks"
  ON public.branch_tasks
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'branch_manager'
    AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Employee can read own branch tasks"
  ON public.branch_tasks
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'employee'
    AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
  );

-- Seed default tasks into all existing branches
DO $$
DECLARE
  v_branch_id UUID;
  v_defaults JSONB := '[
    {"key": "showroom_clean", "label": "শোরুম পরিষ্কার করা ও ঝাড়ু দেওয়া"},
    {"key": "generator_oil", "label": "জেনারেটরের তেল চেক করা"},
    {"key": "products_organized", "label": "শোরুমের সব পণ্য/কাপড় সুন্দরভাবে গোছানো"},
    {"key": "cash_office_table", "label": "ক্যাশ/অফিস টেবিল পরিষ্কার ও গোছানো"},
    {"key": "display_rack", "label": "ডিসপ্লে র‍্যাক ও হ্যাঙ্গার ঠিকভাবে সাজানো"},
    {"key": "mirror_glass_door", "label": "আয়না, গ্লাস ও দরজা পরিষ্কার করা"},
    {"key": "light_fan_ac", "label": "লাইট, ফ্যান ও AC চেক করা"},
    {"key": "cash_counter", "label": "ক্যাশ কাউন্টার পরিষ্কার ও গোছানো"},
    {"key": "dustbin", "label": "ডাস্টবিন পরিষ্কার করা"},
    {"key": "entrance_clean", "label": "শোরুমের বাইরে প্রবেশপথ পরিষ্কার রাখা"}
  ]'::JSONB;
  v_task JSONB;
BEGIN
  FOR v_branch_id IN SELECT id FROM public.branches LOOP
    FOR v_task IN SELECT * FROM jsonb_array_elements(v_defaults) LOOP
      INSERT INTO public.branch_tasks (branch_id, task_key, label)
      VALUES (v_branch_id, v_task->>'key', v_task->>'label')
      ON CONFLICT (branch_id, task_key) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;
