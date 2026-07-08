import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const salarySchema = z.object({
  user_id: z.string().uuid(),
  base_salary: z.number().min(0),
  house_rent_allowance: z.number().min(0).default(0),
  medical_allowance: z.number().min(0).default(0),
  transport_allowance: z.number().min(0).default(0),
});

/** GET /api/salary-settings?branch_id=xxx  — List salary settings for employees */
export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin', 'branch_manager']);
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');
    const userId = searchParams.get('user_id');

    let query = supabase
      .from('salary_settings')
      .select('*, profiles!user_id(id, full_name, employee_id, branch_id, role, branches!branch_id(name))')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (branchId) {
      query = query.in(
        'user_id',
        supabase.from('profiles').select('id').eq('branch_id', branchId)
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/salary-settings — Create or update salary settings (upsert) */
export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin']);
    const body = await request.json();
    const input = salarySchema.parse(body);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('salary_settings')
      .upsert(
        { ...input, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/salary-settings?user_id=xxx */
export async function DELETE(request: NextRequest) {
  try {
    await requireRole(['admin']);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ success: false, data: null, error: { code: 'MISSING_ID', message: 'user_id is required.' }, timestamp: new Date().toISOString() }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase.from('salary_settings').delete().eq('user_id', userId);
    if (error) throw error;

    return NextResponse.json({ success: true, data: { deleted: userId }, timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}
