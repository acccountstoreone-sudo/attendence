-- Add branch_id to memberships
ALTER TABLE memberships
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- Drop old policies to replace them
DROP POLICY IF EXISTS "Branch Manager can view memberships" ON memberships;

CREATE POLICY "Branch Manager can view memberships" ON memberships
FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'branch_manager')
);

CREATE POLICY "Branch Manager can insert memberships" ON memberships
FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'branch_manager' AND branch_id = memberships.branch_id)
);

CREATE POLICY "Branch Manager can update memberships" ON memberships
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'branch_manager' AND branch_id = memberships.branch_id)
);
