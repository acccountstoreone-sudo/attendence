import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  
  const { data: employees } = await supabase.from('profiles').select('*').limit(5);
  
  if (!employees || employees.length === 0) {
    return NextResponse.json({ error: 'No employees found' });
  }

  const target = employees.find(e => e.role === 'employee') || employees[0];
  
  const { data: records } = await supabase.from('attendance_records')
    .select('*')
    .eq('employee_id', target.id)
    .limit(10);
    
  return NextResponse.json({ target, records });
}
