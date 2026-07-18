import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await supabase
    .from('attendance_records')
    .select('id, employee_id, overtime_minutes, overtime_approval_status, approval_status, check_in_time, override_reason')
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({ data, error });
}
