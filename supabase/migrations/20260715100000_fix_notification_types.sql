-- ==============================================================================
-- FIX: Notifications Type Constraint
-- ==============================================================================
-- The previous check constraint restricted types to 'info', 'warning', 'leave',
-- 'attendance', 'system', 'welcome'. This caused inserts to fail silently for
-- types like 'alert', 'attendance_approval', 'correction', etc.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
        'info', 
        'warning', 
        'leave', 
        'attendance', 
        'attendance_approval', 
        'attendance_decision', 
        'system', 
        'welcome', 
        'correction', 
        'payroll', 
        'alert', 
        'success'
    )
);
