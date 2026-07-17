-- ==============================================================================
-- ANCHOR FASHION — ADD WEEKLY OFF DAYS TO DUTY HOURS HISTORY
-- Migration: 20260717000002_add_weekly_off_days_to_history.sql
-- ==============================================================================
-- Adds the missing weekly_off_days tracking to the branch_duty_hours_history table.
-- ==============================================================================

BEGIN;

-- Add settings columns to branch_duty_hours_history for audit trail
ALTER TABLE public.branch_duty_hours_history 
    ADD COLUMN IF NOT EXISTS weekly_off_days INTEGER[] DEFAULT ARRAY[5];

COMMIT;
