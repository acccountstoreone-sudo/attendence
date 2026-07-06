-- ==============================================================================
-- ANCHOR FASHION — ADVANCED SCHEMA (SETTINGS & AUDIT TRAIL) (MIGRATION 0002)
-- Specification Reference: Spec P10 (Category 02: Database & Schema)
-- ==============================================================================
-- This script extends the core schema with store-specific timing rules,
-- an immutable security audit log ledger, and user notifications.
-- ==============================================================================

-- 1. BRANCH SETTINGS (Store-Specific Operational Rules)
-- ------------------------------------------------------------------------------
-- Allows Admin to override global company work timings and grace periods per store.
CREATE TABLE IF NOT EXISTS public.branch_settings (
    branch_id UUID PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
    work_start_time TIME NOT NULL DEFAULT '09:00:00',
    work_end_time TIME NOT NULL DEFAULT '18:00:00',
    late_grace_minutes INTEGER NOT NULL DEFAULT 15 CHECK (late_grace_minutes >= 0 AND late_grace_minutes <= 120),
    overtime_after_minutes INTEGER NOT NULL DEFAULT 30 CHECK (overtime_after_minutes >= 0),
    half_day_hours DOUBLE PRECISION NOT NULL DEFAULT 4.0 CHECK (half_day_hours >= 1.0 AND half_day_hours <= 8.0),
    weekly_off_days INTEGER[] NOT NULL DEFAULT '{5}'::INTEGER[], -- Array of days (0=Sunday, 1=Monday ... 5=Friday, 6=Saturday)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to auto-update updated_at timestamp
CREATE TRIGGER trg_branch_settings_updated_at 
    BEFORE UPDATE ON public.branch_settings 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. AUDIT LOGS (Immutable Security & Override Ledger)
-- ------------------------------------------------------------------------------
-- Tracks every create, update, and delete action across critical tables.
-- Essential for HR governance and identifying unauthorized data tampering.
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_role public.user_role,
    action VARCHAR(50) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'MANUAL_OVERRIDE', 'DEACTIVATE', 'ROLLBACK')),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- High-performance indexes for Admin Activity History viewing and security audits
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);


-- 3. NOTIFICATIONS (In-App Alerts & Reminders)
-- ------------------------------------------------------------------------------
-- Stores real-time system alerts for BMs (leave applications, late digests) and staff.
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'leave', 'attendance', 'system', 'welcome')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    action_url TEXT, -- Optional URL to jump to relevant page (e.g., /branch-manager/leave-approvals)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for loading user unread alert bell badges quickly
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);


-- 4. AUTOMATED AUDIT LOGGING TRIGGER FUNCTION
-- ------------------------------------------------------------------------------
-- This trigger function automatically captures old and new row states as JSONB
-- and inserts an immutable record into `audit_logs` whenever a row is mutated.
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role public.user_role;
    v_action VARCHAR(50);
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
BEGIN
    -- Derive actor_id from Supabase auth.uid() context
    v_actor_id := auth.uid();
    
    -- Lookup actor role from profiles table if authenticated
    IF v_actor_id IS NOT NULL THEN
        SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;
    END IF;

    -- Determine action type
    IF (TG_OP = 'INSERT') THEN
        v_action := 'CREATE';
        v_new_data := to_jsonb(NEW);
    ELSIF (TG_OP = 'UPDATE') THEN
        v_action := 'UPDATE';
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        
        -- Check if this was a manual attendance override
        IF (TG_TABLE_NAME = 'attendance_records' AND (v_new_data->>'is_manual_override')::boolean = true AND (v_old_data->>'is_manual_override')::boolean = false) THEN
            v_action := 'MANUAL_OVERRIDE';
        END IF;
        
        -- Check if this was a deactivation (safely check using jsonb to avoid column errors on tables without is_active)
        IF (v_new_data ? 'is_active') THEN
            IF ((v_new_data->>'is_active')::boolean = false AND (v_old_data->>'is_active')::boolean = true) THEN
                v_action := 'DEACTIVATE';
            END IF;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'DELETE';
        v_old_data := to_jsonb(OLD);
    END IF;

    -- Write immutable record to audit_logs
    INSERT INTO public.audit_logs (
        actor_id,
        actor_role,
        action,
        table_name,
        record_id,
        old_value,
        new_value
    ) VALUES (
        v_actor_id,
        v_actor_role,
        v_action,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        v_old_data,
        v_new_data
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. ATTACH AUDIT TRIGGER TO CRITICAL TABLES
-- ------------------------------------------------------------------------------
-- Track all mutations on branches, profiles, attendance_records, and leave_requests
CREATE TRIGGER trg_audit_branches
    AFTER INSERT OR UPDATE OR DELETE ON public.branches
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER trg_audit_profiles
    AFTER INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER trg_audit_attendance
    AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER trg_audit_leave
    AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER trg_audit_branch_settings
    AFTER INSERT OR UPDATE OR DELETE ON public.branch_settings
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- End of Migration 0002
