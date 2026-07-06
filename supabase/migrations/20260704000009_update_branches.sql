-- ==============================================================================
-- ADD MISSING BRANCHES COLUMNS (MIGRATION 0009)
-- ==============================================================================

-- 1. Rename radius_meters to geofence_radius_meters
ALTER TABLE public.branches
RENAME COLUMN radius_meters TO geofence_radius_meters;

-- 2. Add new columns
ALTER TABLE public.branches
ADD COLUMN IF NOT EXISTS code VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Make coordinates nullable (matches API schema)
ALTER TABLE public.branches
ALTER COLUMN latitude DROP NOT NULL,
ALTER COLUMN longitude DROP NOT NULL;

-- 4. Align check constraint for geofence radius (up to 5000m)
ALTER TABLE public.branches
DROP CONSTRAINT IF EXISTS branches_radius_meters_check,
ADD CONSTRAINT branches_geofence_radius_check CHECK (geofence_radius_meters >= 10 AND geofence_radius_meters <= 5000);
