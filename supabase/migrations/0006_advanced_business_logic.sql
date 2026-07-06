-- Migration: 0006_advanced_business_logic.sql
-- Covers Specs P61, P63, P64, P65 (Holidays, Leaves, Shifts, Payroll)

BEGIN;

-- 1. Public Holidays (Spec P61)
CREATE TABLE IF NOT EXISTS public.public_holidays (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  holiday_date date NOT NULL UNIQUE,
  is_recurring boolean DEFAULT false, -- If true, applies every year on this MM-DD
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Leave Management & Balances (Spec P63)
CREATE TABLE IF NOT EXISTS public.leave_types (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE, -- e.g., 'CASUAL', 'SICK', 'EARNED'
  name text NOT NULL,
  default_days_per_year integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Insert standard leave types for Bangladesh
INSERT INTO public.leave_types (code, name, default_days_per_year) 
VALUES 
  ('CASUAL', 'Casual Leave', 10),
  ('SICK', 'Sick Leave', 14),
  ('EARNED', 'Earned Leave', 15)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.leave_balances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type_id uuid REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year integer NOT NULL,
  allocated_days integer NOT NULL,
  used_days numeric(5,1) DEFAULT 0, -- Supports half-days (0.5)
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, leave_type_id, year)
);

-- 3. Multi-Shift Support (Spec P64)
CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL, -- e.g., 'Morning Shift', 'Evening Shift'
  start_time time NOT NULL,
  end_time time NOT NULL,
  grace_period_minutes integer DEFAULT 15,
  created_at timestamp with time zone DEFAULT now()
);

-- Employee Shift Assignments (Rosters)
CREATE TABLE IF NOT EXISTS public.employee_shifts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES public.shifts(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  effective_to date, -- Null means current active shift
  created_at timestamp with time zone DEFAULT now()
);

-- 4. Payroll & Salary Management (Spec P65)
CREATE TABLE IF NOT EXISTS public.salary_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  base_salary numeric(10,2) NOT NULL,
  house_rent_allowance numeric(10,2) DEFAULT 0,
  medical_allowance numeric(10,2) DEFAULT 0,
  transport_allowance numeric(10,2) DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Monthly Payroll Records (Locks the month's calculation)
CREATE TABLE IF NOT EXISTS public.payroll_sheets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  month_year text NOT NULL, -- Format: 'YYYY-MM'
  total_payable_days numeric(5,1) NOT NULL,
  gross_salary numeric(10,2) NOT NULL,
  deductions numeric(10,2) DEFAULT 0,
  net_payable numeric(10,2) NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'paid')),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, month_year)
);

-- Enable RLS
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_sheets ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Admins have full access, users can view their own)
DROP POLICY IF EXISTS "Anyone can view holidays" ON public.public_holidays;
CREATE POLICY "Anyone can view holidays" ON public.public_holidays FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can view leave types" ON public.leave_types;
CREATE POLICY "Anyone can view leave types" ON public.leave_types FOR SELECT USING (true);

-- Users
DROP POLICY IF EXISTS "Users view own leave balances" ON public.leave_balances;
CREATE POLICY "Users view own leave balances" ON public.leave_balances FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users view own shift assignments" ON public.employee_shifts;
CREATE POLICY "Users view own shift assignments" ON public.employee_shifts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users view own salary settings" ON public.salary_settings;
CREATE POLICY "Users view own salary settings" ON public.salary_settings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users view own payroll" ON public.payroll_sheets;
CREATE POLICY "Users view own payroll" ON public.payroll_sheets FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users view shifts for their branch" ON public.shifts;
CREATE POLICY "Users view shifts for their branch" ON public.shifts FOR SELECT USING (branch_id = public.user_branch_id());

-- Admins
DROP POLICY IF EXISTS "Admins full access to holidays" ON public.public_holidays;
CREATE POLICY "Admins full access to holidays" ON public.public_holidays FOR ALL USING (public.user_role() = 'admin');
DROP POLICY IF EXISTS "Admins full access to leave types" ON public.leave_types;
CREATE POLICY "Admins full access to leave types" ON public.leave_types FOR ALL USING (public.user_role() = 'admin');
DROP POLICY IF EXISTS "Admins full access to balances" ON public.leave_balances;
CREATE POLICY "Admins full access to balances" ON public.leave_balances FOR ALL USING (public.user_role() = 'admin');
DROP POLICY IF EXISTS "Admins full access to shifts" ON public.shifts;
CREATE POLICY "Admins full access to shifts" ON public.shifts FOR ALL USING (public.user_role() = 'admin');
DROP POLICY IF EXISTS "Admins full access to employee shifts" ON public.employee_shifts;
CREATE POLICY "Admins full access to employee shifts" ON public.employee_shifts FOR ALL USING (public.user_role() = 'admin');
DROP POLICY IF EXISTS "Admins full access to salaries" ON public.salary_settings;
CREATE POLICY "Admins full access to salaries" ON public.salary_settings FOR ALL USING (public.user_role() = 'admin');
DROP POLICY IF EXISTS "Admins full access to payroll" ON public.payroll_sheets;
CREATE POLICY "Admins full access to payroll" ON public.payroll_sheets FOR ALL USING (public.user_role() = 'admin');

-- Branch Managers
DROP POLICY IF EXISTS "BM view balances for own branch" ON public.leave_balances;
CREATE POLICY "BM view balances for own branch" ON public.leave_balances FOR SELECT USING (
  public.user_role() = 'branch_manager' AND 
  user_id IN (SELECT id FROM public.profiles WHERE branch_id = public.user_branch_id())
);

DROP POLICY IF EXISTS "BM all access to shifts for own branch" ON public.shifts;
CREATE POLICY "BM all access to shifts for own branch" ON public.shifts FOR ALL USING (
  public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id()
);

DROP POLICY IF EXISTS "BM all access to employee shifts for own branch" ON public.employee_shifts;
CREATE POLICY "BM all access to employee shifts for own branch" ON public.employee_shifts FOR ALL USING (
  public.user_role() = 'branch_manager' AND 
  user_id IN (SELECT id FROM public.profiles WHERE branch_id = public.user_branch_id())
);
COMMIT;
