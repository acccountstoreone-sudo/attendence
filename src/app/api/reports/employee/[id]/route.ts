import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetEmployeeId } = await params;
    const user = await getCurrentUser();
    if (!user) throw new Error('UNAUTHENTICATED: Active session required.');

    const supabase = await createClient();

    // 1. Fetch Target Profile to verify branch and role
    const { data: targetProfile, error: profErr } = await supabase
      .from('profiles')
      .select('id, full_name, photo_url, role, branch_id, branches!profiles_branch_id_fkey(name)')
      .eq('id', targetEmployeeId)
      .single();

    if (profErr || !targetProfile) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Employee profile not found.' } },
        { status: 404 }
      );
    }

    // 2. Enforce Scoping: Employee sees self only; BM sees own branch only; Admin sees all
    if (user.role === 'employee' && user.id !== targetEmployeeId) {
      throw new Error('FORBIDDEN: You can only view your own monthly attendance breakdown.');
    } else if (user.role === 'branch_manager' && targetProfile.branch_id !== user.branch_id) {
      throw new Error('FORBIDDEN: You can only view attendance reports for staff in your assigned store.');
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month = Number(searchParams.get('month')) || (now.getMonth() + 1);
    const year = Number(searchParams.get('year')) || now.getFullYear();

    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    // 3. Query all attendance logs for the employee in that month
    const { data: records, error: recErr } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', targetEmployeeId)
      .gte('check_in_time', startOfMonth.toISOString())
      .lte('check_in_time', endOfMonth.toISOString())
      .order('check_in_time', { ascending: true });

    if (recErr) throw new Error(`Database Query Failed: ${recErr.message}`);

    // 4. Calculate Aggregate Metrics
    const totalDaysLogged = records?.length || 0;
    const presentDays = records?.filter((r) => r.status === 'present').length || 0;
    const lateDays = records?.filter((r) => r.status === 'late').length || 0;
    const halfDays = records?.filter((r) => r.status === 'half_day').length || 0;
    const totalOvertimeMinutes = records?.reduce((sum, r) => sum + (r.overtime_minutes || 0), 0) || 0;

    // Calculate total worked hours across all completed shifts
    let totalWorkedHours = 0;
    records?.forEach((r) => {
      if (r.check_in_time && r.check_out_time) {
        const diffHours = (new Date(r.check_out_time).getTime() - new Date(r.check_in_time).getTime()) / (1000 * 60 * 60);
        totalWorkedHours += Math.max(0, diffHours);
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        employee: {
          id: targetProfile.id,
          full_name: targetProfile.full_name,
          photo_url: targetProfile.photo_url,
          branch_name: (targetProfile as unknown as { branches?: { name?: string } }).branches?.name || 'Unknown',
        },
        period: { month, year },
        summary: {
          total_days_logged: totalDaysLogged,
          present_days: presentDays,
          late_days: lateDays,
          half_days: halfDays,
          total_worked_hours: Number(totalWorkedHours.toFixed(2)),
          total_overtime_minutes: totalOvertimeMinutes,
          total_overtime_hours: Number((totalOvertimeMinutes / 60).toFixed(2)),
        },
        daily_logs: records || [],
      },
      message: `Monthly attendance report compiled for ${targetProfile.full_name}.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
