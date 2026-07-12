import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// APP-05 fix: Added proper auth guard and use server Supabase client (not service role)
export async function GET(request: NextRequest) {
  try {
    // Previously this had no auth check and used the service role key directly
    await requireRole(['admin', 'branch_manager']);

    const supabase = await createClient();
    const today = new Date();

    // For weekly trend (last 10 days)
    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    tenDaysAgo.setHours(0, 0, 0, 0);

    // For monthly trend (current year)
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);

    // Fetch all attendance logs for the current year
    const { data: logs, error } = await supabase
      .from('attendance_records')
      .select('check_in_time, status')
      .gte('check_in_time', firstDayOfYear.toISOString())
      .in('status', ['present', 'late', 'half-day', 'half_day']);

    if (error) {
      console.error('Error fetching trends:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Process Monthly Data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyCounts = new Array(12).fill(0);

    // Process Weekly Data (last 10 days)
    const weeklyTrendData: { day: string; val: number }[] = [];
    for (let i = 9; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      weeklyTrendData.push({ day: dayStr, val: 0 });
    }

    const { count: totalEmployees } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .in('role', ['employee', 'branch_manager']); // APP-04 fix: include branch_managers

    const expectedPerMonth = (totalEmployees || 0) * 22;

    logs?.forEach(log => {
      if (!log.check_in_time) return;
      const logDate = new Date(log.check_in_time);

      const monthIndex = logDate.getMonth();
      monthlyCounts[monthIndex]++;

      if (logDate >= tenDaysAgo) {
        const dayStr = logDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        const existing = weeklyTrendData.find(w => w.day === dayStr);
        if (existing) existing.val++;
      }
    });

    const monthlyData = months.map((name, index) => {
      const isPastOrCurrentMonth = index <= today.getMonth();
      return {
        name,
        attendance: monthlyCounts[index],
        expected: isPastOrCurrentMonth ? expectedPerMonth : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: { monthlyData, weeklyTrendData },
    });
  } catch (err: unknown) {
    console.error('Trend API exception:', err);
    return handleApiError(err);
  }
}
