import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // Check columns in leave_types
  const { data: types } = await supabase.from('leave_types').select('*');
  console.log('Leave types columns:', Object.keys(types?.[0] || {}));
  console.log('Leave types:', types);
}
run();
