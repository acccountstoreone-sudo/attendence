import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data, error } = await adminSupabase.from('branches').select('*');
    if (error) return NextResponse.json({ error });
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
