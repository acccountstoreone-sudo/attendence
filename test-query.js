/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function test() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, branch_id, branches(name)')
    .eq('role', 'admin')
    .limit(1)
    .single();
    
  console.log('Data:', data);
  console.log('Error:', error);
}

test();
