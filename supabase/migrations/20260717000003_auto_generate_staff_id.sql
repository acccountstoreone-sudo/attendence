-- ==============================================================================
-- ANCHOR FASHION — AUTO GENERATE STAFF ID
-- Migration: 20260717000003_auto_generate_staff_id.sql
-- ==============================================================================
-- Ensures that every profile gets a unique auto-generated employee_id (e.g. EMP-1001)
-- ==============================================================================

BEGIN;

-- Create sequence for staff IDs starting at 1001
CREATE SEQUENCE IF NOT EXISTS public.staff_id_seq START 1001;

-- Create trigger function
CREATE OR REPLACE FUNCTION public.generate_staff_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Only generate if it's missing
    IF NEW.employee_id IS NULL OR NEW.employee_id = '' OR NEW.employee_id = 'PENDING' THEN
        NEW.employee_id := 'EMP-' || nextval('public.staff_id_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger before insert or update on profiles
DROP TRIGGER IF EXISTS trg_generate_staff_id ON public.profiles;
CREATE TRIGGER trg_generate_staff_id
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_staff_id();

-- Backfill any existing profiles missing a staff ID
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT id FROM public.profiles WHERE employee_id IS NULL OR employee_id = '' OR employee_id = 'PENDING' LOOP
        UPDATE public.profiles SET employee_id = 'EMP-' || nextval('public.staff_id_seq') WHERE id = rec.id;
    END LOOP;
END;
$$;

COMMIT;
