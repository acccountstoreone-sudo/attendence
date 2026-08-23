import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://psabxbcfnzpehzxdbihc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzYWJ4YmNmbnpwZWh6eGRiaWhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI3ODM3MCwiZXhwIjoyMDk3ODU0MzcwfQ.CCAxz9v4FOP03-HzJmoMbz0MD1yXpLKvzPWlDYGS-hs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data: employees, error } = await supabase.from('profiles').select('*').limit(5);
  if (error) {
    console.error("Error fetching employees:", error);
    return;
  }
  
  if (!employees || employees.length === 0) {
    console.log("No employees found.");
    return;
  }

  console.log("Employees:", employees.map(e => ({ id: e.id, name: e.full_name, role: e.role })));

  const target = employees.find(e => e.role === 'employee') || employees[0];
  console.log("Checking for employee:", target.name, target.id);
  
  const { data: records, error: recError } = await supabase.from('attendance_records')
    .select('*')
    .eq('employee_id', target.id)
    .limit(10);
    
  if (recError) {
    console.error("Error fetching records:", recError);
    return;
  }
  console.log("Attendance records:", records);
}

check().catch(console.error);
