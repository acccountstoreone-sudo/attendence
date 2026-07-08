-- ==============================================================================
-- ANCHOR FASHION — BRANCH MANAGER STORE & DUTY UPDATE POLICY (MIGRATION)
-- ==============================================================================
-- Allows Branch Managers to update their assigned store profile, geofence, and
-- duty settings.
-- ==============================================================================

-- Update RLS policies on public.branches to allow branch_manager to UPDATE their own assigned branch
DROP POLICY IF EXISTS "Allow all write access to branches for Admin only" ON public.branches;
DROP POLICY IF EXISTS "Branches UPDATE policy for Admin and BM" ON public.branches;
DROP POLICY IF EXISTS "Branches INSERT policy for Admin only" ON public.branches;
DROP POLICY IF EXISTS "Branches DELETE policy for Admin only" ON public.branches;

-- INSERT: Admin only
CREATE POLICY "Branches INSERT policy for Admin only" ON public.branches FOR INSERT
    TO authenticated
    WITH CHECK (public.user_role() = 'admin');

-- UPDATE: Admin updates all; Branch Manager updates their assigned store (where id = user_branch_id())
CREATE POLICY "Branches UPDATE policy for Admin and BM" ON public.branches FOR UPDATE
    TO authenticated
    USING (public.user_role() = 'admin' OR (public.user_role() = 'branch_manager' AND id = public.user_branch_id()))
    WITH CHECK (public.user_role() = 'admin' OR (public.user_role() = 'branch_manager' AND id = public.user_branch_id()));

-- DELETE: Admin only
CREATE POLICY "Branches DELETE policy for Admin only" ON public.branches FOR DELETE
    TO authenticated
    USING (public.user_role() = 'admin');
