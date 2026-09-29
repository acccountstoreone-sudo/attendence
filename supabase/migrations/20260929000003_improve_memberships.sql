-- Improve Memberships Table
ALTER TABLE memberships
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS total_spent NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS reward_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS membership_tier VARCHAR(50) DEFAULT 'Silver';

-- Optional: Create an index on tier for reporting
CREATE INDEX IF NOT EXISTS idx_memberships_tier ON memberships(membership_tier);
