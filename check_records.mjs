import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  // get an employee
  const { data: users } = await supabase.from('profiles').select('*').eq('role', 'employee').limit(1);
  const employee = users[0];
  console.log("Checking for employee:", employee.full_name, employee.id);

  // fetch notifications
  const { data: notifs, error: notifErr } = await supabase.from('notifications')
    .select('*')
    .eq('user_id', employee.id)
    .eq('type', 'system');
  console.log("Notifications type=system:", notifs);

  // fetch breaks
  const { data: breaks, error: breakErr } = await supabase.from('attendance_breaks')
    .select('*')
    .eq('employee_id', employee.id);
  console.log("Breaks:", breaks);
}
run();
