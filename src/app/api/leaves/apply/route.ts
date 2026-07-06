import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError, getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const applyLeaveSchema = z.object({
  leave_type_code: z.string(), // e.g., 'SICK', 'CASUAL'
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  reason: z.string().min(5).max(500),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['employee', 'branch_manager', 'admin']);
    const body = await request.json();
    const input = applyLeaveSchema.parse(body);

    const supabase = await createClient();

    // 1. Fetch leave type ID
    const { data: leaveType, error: typeErr } = await supabase
      .from('leave_types')
      .select('id, code')
      .eq('code', input.leave_type_code)
      .single();

    if (typeErr || !leaveType) {
      return NextResponse.json({ success: false, error: 'Invalid leave type' }, { status: 400 });
    }

    const currentYear = new Date().getFullYear();

    // 2. Fetch user's leave balance for this year
    const { data: balance, error: balErr } = await supabase
      .from('leave_balances')
      .select('id, allocated_days, used_days')
      .eq('user_id', user.id)
      .eq('leave_type_id', leaveType.id)
      .eq('year', currentYear)
      .single();

    if (balErr || !balance) {
      return NextResponse.json({ 
        success: false, 
        error: `No leave balance allocated for ${input.leave_type_code} in ${currentYear}.` 
      }, { status: 403 });
    }

    // 3. Calculate requested days
    const start = new Date(input.start_date);
    const end = new Date(input.end_date);

    // B17 fix: Validate date ordering and no past-date leaves
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
      return NextResponse.json({
        success: false,
        error: 'Leave start date cannot be in the past.',
      }, { status: 422 });
    }
    if (end < start) {
      return NextResponse.json({
        success: false,
        error: 'End date must be on or after the start date.',
      }, { status: 422 });
    }

    const diffTime = end.getTime() - start.getTime();
    const requestedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const remaining = balance.allocated_days - balance.used_days;

    if (requestedDays > remaining) {
      return NextResponse.json({
        success: false,
        error: `Insufficient balance. Requested: ${requestedDays}, Remaining: ${remaining}`,
      }, { status: 422 });
    }

    // 4. Insert Leave Request
    const { data: requestRecord, error: reqErr } = await supabase
      .from('leave_requests')
      .insert({
        user_id: user.id,
        branch_id: user.branch_id,
        leave_type_id: leaveType.id,
        start_date: input.start_date,
        end_date: input.end_date,
        total_days: requestedDays,
        reason: input.reason,
        status: 'pending'
      })
      .select()
      .single();

    if (reqErr) throw new Error(reqErr.message);

    return NextResponse.json({
      success: true,
      data: requestRecord,
      message: 'Leave application submitted successfully.',
    });

  } catch (error) {
    return handleApiError(error);
  }
}
