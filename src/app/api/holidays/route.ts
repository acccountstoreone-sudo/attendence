import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const holidaySchema = z.object({
  name: z.string().min(1).max(100),
  holiday_date: z.string().date(),
  is_recurring: z.boolean().default(false),
});

/** GET /api/holidays?year=2026 — List public holidays */
export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin', 'branch_manager', 'employee']);
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') ?? new Date().getFullYear().toString();

    const { data, error } = await supabase
      .from('public_holidays')
      .select('*')
      .or(`holiday_date.gte.${year}-01-01,is_recurring.eq.true`)
      .lte('holiday_date', `${year}-12-31`)
      .order('holiday_date');

    if (error) throw error;

    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/holidays — Create a holiday (Admin only) */
export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin']);
    const body = await request.json();
    const input = holidaySchema.parse(body);

    const supabase = await createClient();
    const { data, error } = await supabase.from('public_holidays').insert(input).select().single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, data: null, error: { code: 'DUPLICATE_HOLIDAY', message: 'A holiday already exists on this date.' }, timestamp: new Date().toISOString() },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/holidays?id=xxx — Delete a holiday (Admin only) */
export async function DELETE(request: NextRequest) {
  try {
    await requireRole(['admin']);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, data: null, error: { code: 'MISSING_ID', message: 'Holiday ID required.' }, timestamp: new Date().toISOString() }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase.from('public_holidays').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true, data: { deleted: id }, timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}

