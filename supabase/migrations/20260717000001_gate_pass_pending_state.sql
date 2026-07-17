-- Migration: 20260717000001_gate_pass_pending_state.sql
-- Description: Adds 'pending' status to attendance_breaks to support Manager Approvals.

BEGIN;

-- Drop the old constraint
ALTER TABLE public.attendance_breaks DROP CONSTRAINT IF EXISTS attendance_breaks_status_check;

-- Add the new constraint with 'pending'
ALTER TABLE public.attendance_breaks 
ADD CONSTRAINT attendance_breaks_status_check 
CHECK (status IN ('pending', 'active', 'completed', 'overstayed', 'rejected'));

-- Update the default value to 'pending'
ALTER TABLE public.attendance_breaks ALTER COLUMN status SET DEFAULT 'pending';

-- Make out_time nullable because a pending break hasn't started yet
ALTER TABLE public.attendance_breaks ALTER COLUMN out_time DROP NOT NULL;
ALTER TABLE public.attendance_breaks ALTER COLUMN out_time DROP DEFAULT;

COMMIT;
