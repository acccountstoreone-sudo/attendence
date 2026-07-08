import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const shiftSchema = z.object({
  branch_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Format: HH:MM'),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Format: HH:MM'),
  grace_period_minutes: z.number().int().min(0).max(120).default(15),
});

/** GET /api/shifts?branch_id=xxx  — List shifts for a branch */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');

    let query = supabase
      .from('shifts')
      .select('*, branches(name)')
      .order('start_time');

    if (branchId) {
      query = query.eq('branch_id', branchId);
    } else if (user.role === 'branch_manager' && user.branch_id) {
      query = query.eq('branch_id', user.branch_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/shifts — Create a new shift */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const body = await request.json();
    const input = shiftSchema.parse(body);

    // Branch managers can only create shifts for their own branch
    if (user.role === 'branch_manager' && user.branch_id !== input.branch_id) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'FORBIDDEN', message: 'You can only manage shifts for your own branch.' }, timestamp: new Date().toISOString() },
        { status: 403 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.from('shifts').insert(input).select().single();
    if (error) throw error;

    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH /api/shifts — Update a shift */
export async function PATCH(request: NextRequest) {
  try {
    await requireRole(['admin', 'branch_manager']);
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ success: false, data: null, error: { code: 'MISSING_ID', message: 'Shift ID is required.' }, timestamp: new Date().toISOString() }, { status: 400 });

    const supabase = await createClient();
    const { data, error } = await supabase.from('shifts').update(updates).eq('id', id).select().single();
    if (error) throw error;

    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/shifts?id=xxx — Delete a shift */
export async function DELETE(request: NextRequest) {
  try {
    await requireRole(['admin', 'branch_manager']);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, data: null, error: { code: 'MISSING_ID', message: 'Shift ID is required.' }, timestamp: new Date().toISOString() }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase.from('shifts').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true, data: { deleted: id }, timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}
