-- Migration to align company_profile with the frontend Admin Settings schema
-- Renames columns and adds missing ones for grace periods and overtime multipliers

ALTER TABLE public.company_profile
  RENAME COLUMN address TO hq_address;

ALTER TABLE public.company_profile
  RENAME COLUMN default_work_start_time TO working_hours_start;

ALTER TABLE public.company_profile
  RENAME COLUMN default_work_end_time TO working_hours_end;

ALTER TABLE public.company_profile
  ADD COLUMN IF NOT EXISTS grace_period_minutes integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS overtime_multiplier numeric(3,2) DEFAULT 1.50;

-- Refresh the postgrest schema cache
NOTIFY pgrst, 'reload schema';
