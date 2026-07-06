const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://izhjonigsculfmlhdmvr.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6aGpvbmlnc2N1bGZtbGhkbXZyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE3MDI4OSwiZXhwIjoyMDk4NzQ2Mjg5fQ.OqKOKocpZdQF1_uf91enDiIGnYc4o8DKV_jTKbi2KM0";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from('branches').select('id, name').eq('is_active', true);
  if (error) {
    console.error('Error fetching branches:', error);
  } else {
    console.log('Branches data length:', data.length);
    console.log('Branches:', JSON.stringify(data, null, 2));
  }
}

main();
