
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
  const { data: breaks, error } = await supabase.from('attendance_breaks').select('*').order('created_at', { ascending: false });
  console.log('Total breaks in database:', breaks?.length);
  console.log('Error if any:', error);
  if (breaks && breaks.length > 0) {
    console.log('Recent 5 breaks:', JSON.stringify(breaks.slice(0, 5), null, 2));
  }
}

test();
