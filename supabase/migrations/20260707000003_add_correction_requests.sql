-- ==============================================================================
-- ANCHOR FASHION — ADD CORRECTION REQUESTS
-- ==============================================================================

-- Create correction_requests table
CREATE TABLE IF NOT EXISTS public.correction_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    record_id UUID REFERENCES public.attendance_records(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('check_in', 'check_out')),
    original_time TIMESTAMPTZ,
    requested_time TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewer_note TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.correction_requests ENABLE ROW LEVEL SECURITY;

-- Employee Policy: Read own requests
CREATE POLICY "Employees can view own correction requests"
    ON public.correction_requests
    FOR SELECT
    USING (auth.uid() = employee_id);

-- Employee Policy: Insert own requests
CREATE POLICY "Employees can insert own correction requests"
    ON public.correction_requests
    FOR INSERT
    WITH CHECK (auth.uid() = employee_id);

-- Branch Manager / Admin Policy: Read requests in their branch (admin can see all)
CREATE POLICY "Managers can view branch correction requests"
    ON public.correction_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND (p.role = 'admin' OR (p.role = 'branch_manager' AND p.branch_id = correction_requests.branch_id))
        )
    );

-- Branch Manager / Admin Policy: Update requests in their branch
CREATE POLICY "Managers can update branch correction requests"
    ON public.correction_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND (p.role = 'admin' OR (p.role = 'branch_manager' AND p.branch_id = correction_requests.branch_id))
        )
    );

-- Indexes for performance
CREATE INDEX idx_correction_requests_employee_id ON public.correction_requests(employee_id);
CREATE INDEX idx_correction_requests_branch_id_status ON public.correction_requests(branch_id, status);

-- Trigger for updated_at
CREATE TRIGGER trg_correction_requests_updated_at BEFORE UPDATE ON public.correction_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for audit logs
CREATE TRIGGER trg_audit_correction_requests
    AFTER INSERT OR UPDATE OR DELETE ON public.correction_requests
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();
