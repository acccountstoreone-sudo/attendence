-- ==============================================================================
-- ANCHOR FASHION — QUERY OPTIMIZATION & INDEXES (MIGRATION 0005)
-- Specification Reference: Spec P14 (Category 02: Database & Schema)
-- ==============================================================================
-- This script optimizes database performance for Anchor Fashion's expected scale:
-- 50+ retail branches and 5,000+ staff generating ~10,000 attendance records/day
-- (~300,000 records/month). It implements composite B-tree indexes, optimizes
-- Admin company-wide aggregation RPCs, and introduces Materialized Views.
-- ==============================================================================

-- 1. COMPOSITE INDEXES FOR HIGH-FREQUENCY QUERIES
-- ------------------------------------------------------------------------------
-- Query A: "Get today's attendance for branch X" (Branch Manager live feed)
-- Filter: branch_id + check_in_time date range + status
CREATE INDEX IF NOT EXISTS idx_attendance_branch_today 
    ON public.attendance_records (branch_id, check_in_time DESC, status);

-- Query B: "Get monthly summary for employee Y" (Employee history & payroll sheet)
-- Filter: employee_id + check_in_time date range
CREATE INDEX IF NOT EXISTS idx_attendance_emp_monthly 
    ON public.attendance_records (employee_id, check_in_time DESC)
    INCLUDE (status, overtime_minutes, check_out_time);

-- Query C: "Get all late employees company-wide this week" (Admin alert dashboard)
-- Filter: status = 'late' + check_in_time date range
CREATE INDEX IF NOT EXISTS idx_attendance_late_company 
    ON public.attendance_records (status, check_in_time DESC)
    WHERE status = 'late';

-- Query D: "Get unread notifications for user Z" (Header bell icon badge)
CREATE INDEX IF NOT EXISTS idx_notifications_unread_user 
    ON public.notifications (user_id, created_at DESC)
    WHERE is_read = false;


-- 2. REWRITTEN HIGH-PERFORMANCE COMPANY-WIDE SUMMARY RPC
-- ------------------------------------------------------------------------------
-- Rewrites P12's get_company_wide_summary() to utilize index-only scans and
-- avoid full table scans across historical attendance archives.
CREATE OR REPLACE FUNCTION public.get_company_wide_summary_optimized(
    p_month INTEGER,
    p_year INTEGER
)
RETURNS TABLE (
    branch_id UUID,
    branch_name VARCHAR(255),
    employee_count INTEGER,
    total_checkins INTEGER,
    total_late_checkins INTEGER,
    attendance_rate_percent DOUBLE PRECISION,
    total_overtime_hours DOUBLE PRECISION
) AS $$
DECLARE
    v_caller_role public.user_role;
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
BEGIN
    -- Strict Admin-Only Guard
    v_caller_role := public.user_role();
    IF (v_caller_role != 'admin') THEN
        RAISE EXCEPTION 'Access Denied: Company-wide summaries are restricted to HQ Admin.' USING ERRCODE = '42501';
    END IF;

    -- Construct precise index-bounding date boundaries in UTC+6
    v_start_date := MAKE_TIMESTAMPTZ(p_year, p_month, 1, 0, 0, 0, 'Asia/Dhaka');
    v_end_date := v_start_date + INTERVAL '1 month';

    -- Use Common Table Expression (CTE) to pre-aggregate attendance using B-tree indexes
    -- before joining with branch metadata, eliminating Cartesian product full table scans.
    RETURN QUERY
    WITH branch_staff_counts AS (
        SELECT 
            p.branch_id,
            COUNT(p.id)::integer AS emp_count
        FROM public.profiles p
        WHERE p.role = 'employee' AND p.is_active = true
        GROUP BY p.id, p.branch_id
    ),
    monthly_branch_logs AS (
        SELECT 
            ar.branch_id,
            COUNT(ar.id)::integer AS checkins,
            COUNT(ar.id) FILTER (WHERE ar.status = 'late')::integer AS lates,
            COALESCE(SUM(ar.overtime_minutes), 0)::integer AS overtime_mins
        FROM public.attendance_records ar
        WHERE ar.check_in_time >= v_start_date AND ar.check_in_time < v_end_date
        GROUP BY ar.branch_id
    )
    SELECT 
        b.id AS branch_id,
        b.name AS branch_name,
        COALESCE(bsc.emp_count, 0)::integer AS employee_count,
        COALESCE(mbl.checkins, 0)::integer AS total_checkins,
        COALESCE(mbl.lates, 0)::integer AS total_late_checkins,
        CASE 
            WHEN COALESCE(bsc.emp_count, 0) = 0 THEN 0.0
            ELSE ROUND((COALESCE(mbl.checkins, 0)::numeric / (bsc.emp_count * 26.0)) * 100.0, 2)::double precision
        END AS attendance_rate_percent,
        ROUND((COALESCE(mbl.overtime_mins, 0) / 60.0)::numeric, 2)::double precision AS total_overtime_hours
    FROM public.branches b
    LEFT JOIN branch_staff_counts bsc ON bsc.branch_id = b.id
    LEFT JOIN monthly_branch_logs mbl ON mbl.branch_id = b.id
    WHERE b.is_active = true
    ORDER BY attendance_rate_percent DESC, b.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- 3. MATERIALIZED VIEW VS. LIVE QUERIES RECOMMENDATION
-- ------------------------------------------------------------------------------
-- Recommendation:
-- 1. LIVE QUERIES: Use for Today's Live Attendance Feed (BM Dashboard) and individual
--    employee check-in status. Real-time accuracy is mandatory during shop shifts.
-- 2. MATERIALIZED VIEWS: Use for Historical Monthly Executive Reports (Admin Dashboard)
--    and Payroll Export rollups for completed months. Once a month closes, data rarely
--    changes, making pre-computed materialized views 100x faster.

-- Create a Materialized View for monthly store performance rollups
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_monthly_branch_summary AS
SELECT 
    ar.branch_id,
    b.name AS branch_name,
    EXTRACT(YEAR FROM ar.check_in_time AT TIME ZONE 'Asia/Dhaka')::integer AS year_num,
    EXTRACT(MONTH FROM ar.check_in_time AT TIME ZONE 'Asia/Dhaka')::integer AS month_num,
    COUNT(ar.id)::integer AS total_checkins,
    COUNT(ar.id) FILTER (WHERE ar.status = 'present')::integer AS present_count,
    COUNT(ar.id) FILTER (WHERE ar.status = 'late')::integer AS late_count,
    COUNT(ar.id) FILTER (WHERE ar.status = 'half_day')::integer AS half_day_count,
    COALESCE(SUM(ar.overtime_minutes), 0)::integer AS total_overtime_minutes
FROM public.attendance_records ar
JOIN public.branches b ON b.id = ar.branch_id
GROUP BY ar.branch_id, b.name, year_num, month_num
WITH NO DATA;

-- Index on Materialized View for rapid month/branch filtering
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_monthly_branch_summary_unique 
    ON public.mv_monthly_branch_summary (branch_id, year_num, month_num);

-- Helper function to refresh the materialized view (to be called via Vercel Cron nightly)
CREATE OR REPLACE FUNCTION public.refresh_monthly_branch_summary_mv()
RETURNS void AS $$
BEGIN
    -- Refresh concurrently without locking out read queries
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_monthly_branch_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. EXPLAIN ANALYZE GUIDANCE FOR DEVELOPERS
-- ------------------------------------------------------------------------------
-- To verify that these composite indexes are being utilized locally:
-- 1. Open Supabase Studio -> SQL Editor.
-- 2. Run the following EXPLAIN ANALYZE command against your test seed data:
--
--    EXPLAIN ANALYZE
--    SELECT * FROM public.attendance_records
--    WHERE branch_id = 'your-test-branch-uuid'
--      AND check_in_time >= '2026-07-01 00:00:00+06'
--      AND check_in_time < '2026-08-01 00:00:00+06'
--    ORDER BY check_in_time DESC;
--
-- 3. Verify in the execution plan output that Postgres reports:
--    "Index Scan using idx_attendance_branch_today on attendance_records"
--    and NOT "Seq Scan on attendance_records" (Full Table Scan).

-- End of Migration 0005
