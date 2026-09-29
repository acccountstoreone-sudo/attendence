import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfillLeaveBalances() {
  console.log('\n=== BACKFILLING LEAVE BALANCES FOR ALL ACTIVE EMPLOYEES ===\n');

  // Get all leave types
  const { data: leaveTypes, error: ltErr } = await supabase
    .from('leave_types')
    .select('id, code, name, default_days_per_year');
  
  if (ltErr || !leaveTypes?.length) {
    console.error('Failed to fetch leave types:', ltErr);
    return;
  }
  console.log(`Found ${leaveTypes.length} leave types:`, leaveTypes.map(t => t.code));

  // Get all active employees
  const { data: employees, error: empErr } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('is_active', true)
    .eq('role', 'employee');
  
  if (empErr || !employees?.length) {
    console.error('No active employees found:', empErr);
    return;
  }
  console.log(`Found ${employees.length} active employees`);

  const currentYear = new Date().getFullYear();
  let totalCreated = 0;

  for (const emp of employees) {
    const balances = leaveTypes.map(lt => ({
      user_id: emp.id,
      leave_type_id: lt.id,
      year: currentYear,
      allocated_days: lt.default_days_per_year ?? 10,
      used_days: 0,
    }));

    const { data, error } = await supabase
      .from('leave_balances')
      .upsert(balances, { onConflict: 'user_id,leave_type_id,year', ignoreDuplicates: true })
      .select();

    if (error) {
      console.error(`Error for ${emp.full_name}:`, error);
    } else {
      console.log(`✅ ${emp.full_name}: ${data?.length || 0} balance records created`);
      totalCreated += data?.length || 0;
    }
  }

  console.log(`\n✅ Done! Created ${totalCreated} total leave balance records.`);

  // Verify
  const { data: final } = await supabase.from('leave_balances').select('*, profiles(full_name), leave_types(code)');
  console.log('\nFinal balances:', final?.map(b => ({
    employee: b.profiles?.full_name,
    type: b.leave_types?.code,
    allocated: b.allocated_days,
    used: b.used_days
  })));
}

backfillLeaveBalances();
