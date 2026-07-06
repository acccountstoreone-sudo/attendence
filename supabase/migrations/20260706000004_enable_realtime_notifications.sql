-- Enable Realtime on the notifications table
begin;
  -- Add the table to the supabase_realtime publication
  alter publication supabase_realtime add table public.notifications;
commit;
