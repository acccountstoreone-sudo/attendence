-- =============================================================================
-- Add address and whatsapp_number columns to profiles table
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(50);
