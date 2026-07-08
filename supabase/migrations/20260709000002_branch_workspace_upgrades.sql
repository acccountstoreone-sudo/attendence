-- Upgrades for Branch Workspace features (Announcements and Branch Settings)

-- 1. Add Branch Settings and Manager columns to branches table
ALTER TABLE public.branches 
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS office_start_time TIME WITHOUT TIME ZONE DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS office_end_time TIME WITHOUT TIME ZONE DEFAULT '18:00:00',
ADD COLUMN IF NOT EXISTS grace_time_minutes INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS late_rules TEXT,
ADD COLUMN IF NOT EXISTS overtime_rules TEXT;

-- 2. Create Announcements table for branch-specific notifications
CREATE TABLE IF NOT EXISTS public.branch_announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('text', 'sound')),
    message TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for announcements
CREATE INDEX idx_branch_announcements_branch_id ON public.branch_announcements(branch_id);
CREATE INDEX idx_branch_announcements_created_at ON public.branch_announcements(created_at DESC);

-- RLS for Announcements
ALTER TABLE public.branch_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage all announcements"
ON public.branch_announcements
FOR ALL TO authenticated
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

CREATE POLICY "Users can read announcements for their branch"
ON public.branch_announcements
FOR SELECT TO authenticated
USING ( branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()) );
