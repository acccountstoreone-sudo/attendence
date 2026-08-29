-- Create ticket_status ENUM
DO $$ BEGIN 
    CREATE TYPE public.ticket_status AS ENUM ('pending', 'in_review', 'success'); 
EXCEPTION 
    WHEN duplicate_object THEN null; 
END $$;

-- Create tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    phone_number VARCHAR(20),
    ticket_date DATE NOT NULL,
    product_price DECIMAL(12, 2) NOT NULL,
    status public.ticket_status NOT NULL DEFAULT 'pending',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for tickets
CREATE INDEX idx_tickets_branch_id ON public.tickets(branch_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_created_at ON public.tickets(created_at DESC);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Admins can do anything
CREATE POLICY "Admins have full access to tickets" ON public.tickets
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Branch Managers can only read tickets for their branch
CREATE POLICY "Branch Managers can view their branch tickets" ON public.tickets
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'branch_manager' 
            AND profiles.branch_id = tickets.branch_id
        )
    );

-- Attach update timestamp trigger
CREATE TRIGGER trg_tickets_updated_at 
    BEFORE UPDATE ON public.tickets 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Attach audit log trigger
CREATE TRIGGER trg_audit_tickets
    AFTER INSERT OR UPDATE OR DELETE ON public.tickets
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- Create function to notify branch manager on new ticket
CREATE OR REPLACE FUNCTION public.notify_manager_on_new_ticket()
RETURNS TRIGGER AS $$
DECLARE
    manager_id UUID;
    branch_name_val VARCHAR;
BEGIN
    -- Get branch name
    SELECT name INTO branch_name_val FROM public.branches WHERE id = NEW.branch_id;

    -- Find all managers for this branch and insert notification
    FOR manager_id IN
        SELECT id FROM public.profiles 
        WHERE branch_id = NEW.branch_id AND role = 'branch_manager' AND is_active = true
    LOOP
        INSERT INTO public.notifications (user_id, title, message, type, action_url)
        VALUES (
            manager_id, 
            'New Customer Ticket', 
            'A new ticket for customer ' || NEW.customer_name || ' has been created by Admin.',
            'info', 
            '/branch-manager/tickets'
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to notify on insert
CREATE TRIGGER trg_notify_manager_new_ticket
    AFTER INSERT ON public.tickets
    FOR EACH ROW EXECUTE FUNCTION public.notify_manager_on_new_ticket();
