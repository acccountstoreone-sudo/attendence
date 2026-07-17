-- Add composite index for frequent lookups by user and month
CREATE INDEX IF NOT EXISTS idx_payroll_sheets_user_month 
ON public.payroll_sheets (user_id, month_year);

-- Add index for filtering/grouping by month_year
CREATE INDEX IF NOT EXISTS idx_payroll_sheets_month 
ON public.payroll_sheets (month_year);

-- Add index for status lookups (e.g., getting all 'draft' or 'paid' payrolls)
CREATE INDEX IF NOT EXISTS idx_payroll_sheets_status 
ON public.payroll_sheets (status);
