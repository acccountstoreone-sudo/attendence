-- Fix log_audit function to support tables with branch_id primary keys (like branch_settings)
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role public.user_role;
    v_action VARCHAR(50);
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
    v_record_id UUID;
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
        v_record_id := COALESCE((v_new_data->>'id'), (v_new_data->>'branch_id'))::UUID;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_action := 'UPDATE';
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_record_id := COALESCE((v_new_data->>'id'), (v_new_data->>'branch_id'))::UUID;
        
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
        v_record_id := COALESCE((v_old_data->>'id'), (v_old_data->>'branch_id'))::UUID;
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
        v_record_id,
        v_old_data,
        v_new_data
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Allow authenticated users (and triggers) to insert into audit_logs without RLS violation
DROP POLICY IF EXISTS "Audit Logs INSERT policy" ON public.audit_logs;
CREATE POLICY "Audit Logs INSERT policy" ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);
