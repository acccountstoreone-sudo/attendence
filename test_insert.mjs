import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: users, error: userError } = await supabase.from('profiles').select('id, full_name, branch_id').limit(1);
  if (userError || !users.length) {
    console.error("User fetch error:", userError);
    return;
  }
  const user = users[0];
  console.log("Using user:", user.id);

  console.log("Testing notification insert...");
  const { data: notif, error: notifErr } = await supabase.from('notifications').insert({
    user_id: user.id,
    title: 'Test',
    message: 'Test message',
    type: 'system',
    action_url: null,
    is_read: false
  }).select();
  console.log("Notification result:", notif, "Error:", notifErr);

  console.log("Testing gate pass insert...");
  const { data: gp, error: gpErr } = await supabase.from('attendance_breaks').insert({
    employee_id: user.id,
    branch_id: user.branch_id,
    break_type: 'tea_lunch',
    expected_duration_minutes: 30,
    reason: 'Testing',
    status: 'pending'
  }).select();
  console.log("Gate pass result:", gp, "Error:", gpErr);
}
run();
