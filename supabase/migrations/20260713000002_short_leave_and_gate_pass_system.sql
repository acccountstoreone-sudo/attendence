-- ==============================================================================
-- ANCHOR FASHION — SHORT LEAVE & GATE PASS TRACKING SYSTEM
-- Migration: 20260713000002_short_leave_and_gate_pass_system.sql
-- ==============================================================================
-- Tracks short breaks, prayer leave (Namaz), lunch/tea breaks, emergency store
-- exits, and bank/official duty gate passes during working hours.
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.attendance_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    attendance_id UUID REFERENCES public.attendance_records(id) ON DELETE SET NULL,
    break_type VARCHAR(50) NOT NULL CHECK (break_type IN ('namaz_prayer', 'tea_lunch', 'official_bank', 'short_emergency', 'personal')),
    out_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (expected_duration_minutes >= 5 AND expected_duration_minutes <= 480),
    return_time TIMESTAMPTZ,
    actual_duration_minutes INTEGER,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'overstayed', 'rejected')),
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_breaks_employee_id ON public.attendance_breaks(employee_id);
CREATE INDEX IF NOT EXISTS idx_breaks_branch_status ON public.attendance_breaks(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_breaks_out_time ON public.attendance_breaks(out_time DESC);
CREATE INDEX IF NOT EXISTS idx_breaks_active_check ON public.attendance_breaks(employee_id, status) WHERE status = 'active';

-- Trigger for updated_at
CREATE TRIGGER trg_attendance_breaks_updated_at
    BEFORE UPDATE ON public.attendance_breaks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.attendance_breaks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Employees can view their own break history"
    ON public.attendance_breaks
    FOR SELECT
    USING (auth.uid() = employee_id);

CREATE POLICY "Employees can start breaks for themselves"
    ON public.attendance_breaks
    FOR INSERT
    WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Employees can update return time for their own active breaks"
    ON public.attendance_breaks
    FOR UPDATE
    USING (auth.uid() = employee_id AND status = 'active')
    WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Branch managers can manage breaks for their store"
    ON public.attendance_breaks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role = 'branch_manager'
              AND branch_id = attendance_breaks.branch_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role = 'branch_manager'
              AND branch_id = attendance_breaks.branch_id
        )
    );

CREATE POLICY "Admins can view and manage all breaks across all branches"
    ON public.attendance_breaks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Add to Supabase Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'attendance_breaks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_breaks;
  END IF;
END;
$$;

COMMIT;
