-- Add employee_id column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);

-- Create index on employee_id for quick lookups
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON public.profiles(employee_id);
