-- Phase 1: Tickets Table Updates
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS compliment TEXT,
ADD COLUMN IF NOT EXISTS call_status VARCHAR(50) DEFAULT 'Not Called',
ADD COLUMN IF NOT EXISTS call_note TEXT;

-- Phase 2: Create Memberships Table
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) UNIQUE NOT NULL,
    discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    status BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin can full access memberships" ON memberships
FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Branch Manager can view memberships" ON memberships
FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('branch_manager', 'admin'))
);
