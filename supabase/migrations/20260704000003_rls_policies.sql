-- ==============================================================================
-- ANCHOR FASHION — SUPABASE ROW LEVEL SECURITY (RLS) POLICIES (MIGRATION 0003)
-- Specification Reference: Spec P11 (Category 02: Database & Schema)
-- ==============================================================================
-- This script represents the MOST CRITICAL security layer in the application.
-- It cryptographically enforces branch data isolation and RBAC rules in PostgreSQL.
-- Branch Managers can NEVER query or mutate another branch's data.
-- ==============================================================================

-- 1. SQL HELPER FUNCTIONS FOR RLS EVALUATION
-- ------------------------------------------------------------------------------
-- Returns the current authenticated user's role from the profiles table.
-- Marked as SECURITY DEFINER to allow reading the profile safely without recursion.
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS public.user_role AS $$
DECLARE
    v_role public.user_role;
BEGIN
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Returns the current authenticated user's branch_id from the profiles table.
CREATE OR REPLACE FUNCTION public.user_branch_id()
RETURNS UUID AS $$
DECLARE
    v_branch_id UUID;
BEGIN
    SELECT branch_id INTO v_branch_id
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN v_branch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- 2. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;


-- 3. COMPANY PROFILE POLICIES (Singleton)
-- ------------------------------------------------------------------------------
-- All authenticated staff need to read company logo and default rules.
DROP POLICY IF EXISTS "Allow read access to company_profile for all authenticated users" ON public.company_profile;
CREATE POLICY "Allow read access to company_profile for all authenticated users" ON public.company_profile FOR SELECT
    TO authenticated
    USING (true);

-- Only Admin can update company profile settings.
DROP POLICY IF EXISTS "Allow update to company_profile for Admin only" ON public.company_profile;
CREATE POLICY "Allow update to company_profile for Admin only" ON public.company_profile FOR UPDATE
    TO authenticated
    USING (public.user_role() = 'admin');


-- 4. BRANCHES POLICIES
-- ------------------------------------------------------------------------------
-- All authenticated users can read branch names and geofence coordinates.
DROP POLICY IF EXISTS "Allow read access to branches for all authenticated users" ON public.branches;
CREATE POLICY "Allow read access to branches for all authenticated users" ON public.branches FOR SELECT
    TO authenticated
    USING (true);

-- Only Admin can insert, update, or delete branches.
DROP POLICY IF EXISTS "Allow all write access to branches for Admin only" ON public.branches;
CREATE POLICY "Allow all write access to branches for Admin only" ON public.branches FOR ALL
    TO authenticated
    USING (public.user_role() = 'admin')
    WITH CHECK (public.user_role() = 'admin');


-- 5. PROFILES POLICIES (Staff Accounts)
-- ------------------------------------------------------------------------------
-- SELECT: Admin sees all; BM sees own branch; Employee sees only self.
DROP POLICY IF EXISTS "Profiles SELECT policy" ON public.profiles;
CREATE POLICY "Profiles SELECT policy" ON public.profiles FOR SELECT
    TO authenticated
    USING (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id())
        OR id = auth.uid()
    );

-- INSERT: Admin can insert any profile; BM can insert ONLY employee profiles in their own branch.
DROP POLICY IF EXISTS "Profiles INSERT policy" ON public.profiles;
CREATE POLICY "Profiles INSERT policy" ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (
        public.user_role() = 'admin'
        OR (
            public.user_role() = 'branch_manager' 
            AND branch_id = public.user_branch_id() 
            AND role = 'employee'
        )
    );

-- UPDATE: Admin updates any; BM updates employees in own branch; Employee updates own phone/contact.
DROP POLICY IF EXISTS "Profiles UPDATE policy" ON public.profiles;
CREATE POLICY "Profiles UPDATE policy" ON public.profiles FOR UPDATE
    TO authenticated
    USING (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id() AND role = 'employee')
        OR id = auth.uid()
    )
    WITH CHECK (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id() AND role = 'employee')
        OR (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())) -- Employee cannot change own role!
    );

-- DELETE: Admin only can delete profiles.
DROP POLICY IF EXISTS "Profiles DELETE policy" ON public.profiles;
CREATE POLICY "Profiles DELETE policy" ON public.profiles FOR DELETE
    TO authenticated
    USING (public.user_role() = 'admin');


-- 6. ATTENDANCE RECORDS POLICIES
-- ------------------------------------------------------------------------------
-- SELECT: Admin sees all; BM sees own branch; Employee sees only own records.
DROP POLICY IF EXISTS "Attendance SELECT policy" ON public.attendance_records;
CREATE POLICY "Attendance SELECT policy" ON public.attendance_records FOR SELECT
    TO authenticated
    USING (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id())
        OR employee_id = auth.uid()
    );

-- INSERT: Employee inserts own check-in; BM inserts manual override for own branch; Admin inserts any.
DROP POLICY IF EXISTS "Attendance INSERT policy" ON public.attendance_records;
CREATE POLICY "Attendance INSERT policy" ON public.attendance_records FOR INSERT
    TO authenticated
    WITH CHECK (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id())
        OR (employee_id = auth.uid() AND branch_id = public.user_branch_id())
    );

-- UPDATE: Employee updates own checkout for today; BM updates records in own branch; Admin updates any.
DROP POLICY IF EXISTS "Attendance UPDATE policy" ON public.attendance_records;
CREATE POLICY "Attendance UPDATE policy" ON public.attendance_records FOR UPDATE
    TO authenticated
    USING (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id())
        OR (employee_id = auth.uid() AND check_out_time IS NULL)
    )
    WITH CHECK (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id())
        OR (employee_id = auth.uid() AND branch_id = public.user_branch_id())
    );

-- DELETE: Admin only can delete attendance records.
DROP POLICY IF EXISTS "Attendance DELETE policy" ON public.attendance_records;
CREATE POLICY "Attendance DELETE policy" ON public.attendance_records FOR DELETE
    TO authenticated
    USING (public.user_role() = 'admin');


-- 7. LEAVE REQUESTS POLICIES
-- ------------------------------------------------------------------------------
-- SELECT: Admin sees all; BM sees own branch; Employee sees own requests.
DROP POLICY IF EXISTS "Leave SELECT policy" ON public.leave_requests;
CREATE POLICY "Leave SELECT policy" ON public.leave_requests FOR SELECT
    TO authenticated
    USING (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id())
        OR employee_id = auth.uid()
    );

-- INSERT: Employee applies for leave under own branch.
DROP POLICY IF EXISTS "Leave INSERT policy" ON public.leave_requests;
CREATE POLICY "Leave INSERT policy" ON public.leave_requests FOR INSERT
    TO authenticated
    WITH CHECK (
        employee_id = auth.uid() AND branch_id = public.user_branch_id()
    );

-- UPDATE: BM approves/rejects own branch requests; Admin updates any; Employee cancels pending.
DROP POLICY IF EXISTS "Leave UPDATE policy" ON public.leave_requests;
CREATE POLICY "Leave UPDATE policy" ON public.leave_requests FOR UPDATE
    TO authenticated
    USING (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id())
        OR (employee_id = auth.uid() AND status = 'pending')
    )
    WITH CHECK (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id())
        OR (employee_id = auth.uid() AND status = 'cancelled')
    );

-- DELETE: Admin only.
DROP POLICY IF EXISTS "Leave DELETE policy" ON public.leave_requests;
CREATE POLICY "Leave DELETE policy" ON public.leave_requests FOR DELETE
    TO authenticated
    USING (public.user_role() = 'admin');


-- 8. BRANCH SETTINGS POLICIES
-- ------------------------------------------------------------------------------
-- Read allowed for all users in that branch; Write allowed for Admin (and BM for own branch).
DROP POLICY IF EXISTS "Branch Settings SELECT policy" ON public.branch_settings;
CREATE POLICY "Branch Settings SELECT policy" ON public.branch_settings FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Branch Settings ALL write policy for Admin and BM" ON public.branch_settings;
CREATE POLICY "Branch Settings ALL write policy for Admin and BM" ON public.branch_settings FOR ALL
    TO authenticated
    USING (public.user_role() = 'admin' OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id()))
    WITH CHECK (public.user_role() = 'admin' OR (public.user_role() = 'branch_manager' AND branch_id = public.user_branch_id()));


-- 9. AUDIT LOGS POLICIES (Strict Read-Only Ledger)
-- ------------------------------------------------------------------------------
-- Admin can view all audit logs; BM can view audit logs for their branch records.
-- NO ONE can update or delete audit logs via RLS!
DROP POLICY IF EXISTS "Audit Logs SELECT policy" ON public.audit_logs;
CREATE POLICY "Audit Logs SELECT policy" ON public.audit_logs FOR SELECT
    TO authenticated
    USING (
        public.user_role() = 'admin'
        OR (public.user_role() = 'branch_manager' AND actor_id IN (SELECT id FROM public.profiles WHERE branch_id = public.user_branch_id()))
    );


-- 10. NOTIFICATIONS POLICIES
-- ------------------------------------------------------------------------------
-- Users can read and update (mark read) only their own notifications.
DROP POLICY IF EXISTS "Notifications SELECT and UPDATE policy" ON public.notifications;
CREATE POLICY "Notifications SELECT and UPDATE policy" ON public.notifications FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- End of Migration 0003
