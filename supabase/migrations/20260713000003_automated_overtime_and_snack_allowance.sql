-- ==============================================================================
-- ANCHOR FASHION — AUTOMATED OVERTIME & SNACK ALLOWANCE PAYROLL ENGINE
-- Migration: 20260713000003_automated_overtime_and_snack_allowance.sql
-- ==============================================================================
-- Automatically calculates exact overtime pay based on branch/employee rates
-- and daily refreshment/snack allowance for present working days.
-- ==============================================================================

BEGIN;

-- 1. Add branch-level default rates for overtime (per hour) and snack allowance (per present day)
ALTER TABLE public.branch_settings 
    ADD COLUMN IF NOT EXISTS overtime_rate_per_hour NUMERIC(10,2) DEFAULT 100.00,
    ADD COLUMN IF NOT EXISTS daily_snack_allowance NUMERIC(10,2) DEFAULT 50.00;

-- 2. Add employee-specific override rates to salary_settings (NULL falls back to branch default)
ALTER TABLE public.salary_settings 
    ADD COLUMN IF NOT EXISTS overtime_rate_per_hour NUMERIC(10,2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS daily_snack_allowance NUMERIC(10,2) DEFAULT NULL;

-- 3. Extend payroll_sheets table to store exact calculated overtime pay and snack bills
ALTER TABLE public.payroll_sheets 
    ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(6,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS overtime_rate_used NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS overtime_pay NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS present_days INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS snack_allowance_used NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS snack_allowance_pay NUMERIC(10,2) DEFAULT 0;

COMMIT;
