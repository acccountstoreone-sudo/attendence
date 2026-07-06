-- ==============================================================================
-- ANCHOR FASHION — ADD NID DOCUMENT URLS (MIGRATION 20260706000001)
-- ==============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS nid_front_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS nid_back_url VARCHAR(500);
