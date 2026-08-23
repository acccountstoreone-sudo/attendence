import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const assignSchema = z.object({
  user_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  effective_from: z.string().date(),
  effective_to: z.string().date().optional().nullable(),
}).refine(
  (data) => !data.effective_to || data.effective_to >= data.effective_from,
  {
    message: 'effective_to must be on or after effective_from.',
    path: ['effective_to'],
  }
);

/** GET /api/employee-shifts?branch_id=xxx  — List all shift assignments for a branch */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id') ?? user.branch_id;

    let userIds: string[] = [];
    if (branchId) {
      const { data: profs } = await supabase.from('profiles').select('id').eq('branch_id', branchId);
      userIds = (profs || []).map((p: { id: string }) => p.id);
    }

    let query = supabase
      .from('employee_shifts')
      .select(`
        id,
        effective_from,
        effective_to,
        shifts ( id, name, start_time, end_time, grace_period_minutes ),
        profiles!user_id ( id, full_name, employee_id, avatar_url )
      `);

    if (branchId && userIds.length > 0) {
      query = query.in('user_id', userIds);
    } else if (branchId && userIds.length === 0) {
      return NextResponse.json({ success: true, data: [], timestamp: new Date().toISOString() });
    }

    const { data, error } = await query.order('effective_from', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/employee-shifts — Assign a shift to an employee */
export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin', 'branch_manager']);
    const body = await request.json();
    const input = assignSchema.parse(body);

    const supabase = await createClient();

    // Close any open (null effective_to) assignment for this user first,
    // ending it the day BEFORE the new shift begins to avoid overlap.
    const dayBefore = new Date(input.effective_from);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const closingDate = dayBefore.toISOString().slice(0, 10);

    await supabase
      .from('employee_shifts')
      .update({ effective_to: closingDate })
      .eq('user_id', input.user_id)
      .is('effective_to', null);

    const { data, error } = await supabase
      .from('employee_shifts')
      .insert(input)
      .select('*, shifts(name, start_time, end_time)')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/employee-shifts?id=xxx */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, data: null, error: { code: 'MISSING_ID', message: 'Assignment ID required.' }, timestamp: new Date().toISOString() }, { status: 400 });

    const supabase = await createClient();

    // Branch managers can only delete assignments for their own branch employees
    if (user.role === 'branch_manager' && user.branch_id) {
      const { data: existing } = await supabase
        .from('employee_shifts')
        .select('user_id, profiles!user_id(branch_id)')
        .eq('id', id)
        .single();
      const assignedBranch = (existing?.profiles as { branch_id?: string } | null)?.branch_id;
      if (!existing || assignedBranch !== user.branch_id) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'FORBIDDEN', message: 'You can only remove shift assignments for your own branch.' },
            timestamp: new Date().toISOString(),
          },
          { status: 403 }
        );
      }
    }

    const { error } = await supabase.from('employee_shifts').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true, data: { deleted: id }, timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}

