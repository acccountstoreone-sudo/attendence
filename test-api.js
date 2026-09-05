
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)="?([^"\r\n]*)"?$/);
  if (match) env[match[1]] = match[2];
});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function test() {
  // Test the return query with foreign key hint
  const { data: breakRecord, error: findErr } = await supabase
    .from('attendance_breaks')
    .select('*, profiles!attendance_breaks_employee_id_fkey(full_name, branch_id)')
    .eq('status', 'active')
    .order('out_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log('Return query check with FK hint:', breakRecord?.id, 'Error:', findErr);
}

test();
