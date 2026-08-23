import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const query = supabase
      .from('profiles')
      .select('id, full_name, role, branch_id, branches!profiles_branch_id_fkey(name, code)')
      .not('branch_id', 'is', null)
      .limit(3);

    const { data, error } = await query;
    return NextResponse.json({ success: true, data: data, error: error });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
