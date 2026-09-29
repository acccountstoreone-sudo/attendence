import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: users, error } = await supabase.from('profiles').select('id, full_name, role, branch_id, is_active').limit(10);
  console.log("Users:", users);
  if (error) console.error("Error:", error);
}
run();
