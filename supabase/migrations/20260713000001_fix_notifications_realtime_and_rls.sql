-- ==============================================================================
-- FIX: Notifications — Realtime Publication + RLS INSERT policy
-- ==============================================================================
-- Problem 1: The notifications table may not be in the supabase_realtime
--            publication, so INSERT events never reach the WebSocket channel.
-- Problem 2: The existing RLS policy only covers SELECT/UPDATE (FOR ALL with
--            USING clause). Service-role bypasses RLS but a user-scoped client
--            (fallback) cannot INSERT notifications for other users.
-- ==============================================================================

-- 1. Ensure notifications table is in the realtime publication
--    (safe to run again even if already added — DO NOTHING on conflict)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    RAISE NOTICE 'notifications table added to supabase_realtime publication.';
  ELSE
    RAISE NOTICE 'notifications table already in supabase_realtime publication — skipping.';
  END IF;
END;
$$;

-- 2. Ensure the existing all-in-one policy is dropped and recreated properly
--    so users can only read/update their own rows.
DROP POLICY IF EXISTS "Notifications SELECT and UPDATE policy" ON public.notifications;

DROP POLICY IF EXISTS "Notifications user read update" ON public.notifications;
CREATE POLICY "Notifications user read update"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Notifications user mark read" ON public.notifications;
CREATE POLICY "Notifications user mark read"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Allow service-role (SECURITY DEFINER functions / server-side) to insert.
--    The service role key bypasses RLS, but this explicit INSERT policy ensures
--    correctness if RLS is tightened in future and removes ambiguity.
DROP POLICY IF EXISTS "Notifications service insert" ON public.notifications;

CREATE POLICY "Notifications service insert"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);  -- service_role bypasses this anyway; here for clarity

-- 4. Allow users to delete (dismiss) their own notifications
DROP POLICY IF EXISTS "Notifications user dismiss" ON public.notifications;

CREATE POLICY "Notifications user dismiss"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);
