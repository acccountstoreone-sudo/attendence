import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// GET /api/branch-settings/history?branch_id=xxx
// Returns the full duty hours history for a branch (admin/BM only)
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const { searchParams } = new URL(request.url);
    const supabase = await createClient();

    let branchId = searchParams.get('branch_id');

    if (user.role === 'branch_manager') {
      if (!user.branch_id) throw new Error('Branch Manager has no assigned branch.');
      branchId = user.branch_id;
    } else if (!branchId) {
      throw new Error('BAD_REQUEST: admin must provide branch_id');
    }

    const { data, error } = await supabase
      .from('branch_duty_hours_history')
      .select(`
        id,
        branch_id,
        work_start_time,
        work_end_time,
        late_grace_minutes,
        overtime_after_minutes,
        half_day_hours,
        overtime_slot_minutes,
        holiday_overtime_multiplier,
        holiday_overtime_multiplier,
        require_overtime_approval,
        weekly_off_days,
        change_reason,
        effective_from,
        effective_to,
        created_at,
        profiles!branch_duty_hours_history_changed_by_fkey (
          full_name,
          role
        )
      `)
      .eq('branch_id', branchId)
      .order('effective_from', { ascending: false });

    if (error) throw new Error(`Failed to fetch duty hours history: ${error.message}`);

    return NextResponse.json({
      success: true,
      data: data || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

