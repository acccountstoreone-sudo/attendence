const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: branches } = await supabase.from('branches').select('id, name');
  console.log('Branches:', branches);

  const { data: settings } = await supabase.from('branch_settings').select('*');
  console.log('Branch Settings:', settings);
}
run();
