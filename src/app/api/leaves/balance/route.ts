import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/leaves/balance
 * Returns leave balance for the authenticated user (MISS-07 fix)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['employee', 'branch_manager', 'admin']);
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get('year')) || new Date().getFullYear();
    const targetUserId = searchParams.get('user_id');

    // Admins and BMs can view balances for other users
    let queryUserId = user.id;
    if (targetUserId && (user.role === 'admin' || user.role === 'branch_manager')) {
      queryUserId = targetUserId;
    }

    const { data: balances, error } = await supabase
      .from('leave_balances')
      .select('*, leave_types(id, name, code, default_days)')
      .eq('user_id', queryUserId)
      .eq('year', year);

    if (error) throw new Error(`Failed to fetch leave balances: ${error.message}`);

    const enriched = (balances || []).map(b => ({
      id: b.id,
      leave_type_id: b.leave_type_id,
      leave_type_name: (b.leave_types as { name?: string })?.name ?? 'Unknown',
      leave_type_code: (b.leave_types as { code?: string })?.code ?? '',
      year: b.year,
      allocated_days: b.allocated_days,
      used_days: b.used_days,
      remaining_days: b.allocated_days - b.used_days,
    }));

    return NextResponse.json({
      success: true,
      data: enriched,
      message: 'Leave balances retrieved successfully.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
