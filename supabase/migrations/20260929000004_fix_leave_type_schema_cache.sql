-- Ensure the column exists
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS leave_type_id UUID REFERENCES public.leave_types(id);

-- Reload the PostgREST schema cache
NOTIFY pgrst, 'reload schema';
