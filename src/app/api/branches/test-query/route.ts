import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // TEST 1: The exact query used in /api/employees
    const { data: test1, error: err1 } = await supabase
      .from('profiles')
      .select('id, full_name, role, branch_id, branch:branches!profiles_branch_id_fkey(name, code)')
      .neq('role', 'admin')
      .limit(2);

    // TEST 2: Alternative join syntax without constraint name
    const { data: test2, error: err2 } = await supabase
      .from('profiles')
      .select('id, full_name, role, branch_id, branches(name, code)')
      .neq('role', 'admin')
      .limit(2);

    return NextResponse.json({
      test1: { data: test1, error: err1 },
      test2: { data: test2, error: err2 }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
