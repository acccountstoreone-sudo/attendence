import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    const today = new Date();
    
    // For weekly trend (last 10 days)
    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    
    // For monthly trend (current year)
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);

    // Fetch all attendance logs for the current year to calculate both trends
    const { data: logs, error } = await supabase
      .from('attendance_records')
      .select('check_in_time, status')
      .gte('check_in_time', firstDayOfYear.toISOString())
      .in('status', ['present', 'late']);

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
      const dayStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); // e.g. "10 Jul"
      weeklyTrendData.push({ day: dayStr, val: 0 });
    }

    // We can also calculate some "expected" attendance for the monthly chart
    // For a real app, we'd multiply total employees by working days. Here we'll do a simple estimate.
    const { count: totalEmployees } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'employee');

    const expectedPerMonth = (totalEmployees || 0) * 22; // approx 22 working days

    logs?.forEach(log => {
      if (!log.check_in_time) return;
      const logDate = new Date(log.check_in_time);
      
      // Add to monthly
      const monthIndex = logDate.getMonth();
      monthlyCounts[monthIndex]++;

      // Add to weekly if within last 10 days
      if (logDate >= tenDaysAgo) {
        const dayStr = logDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        const existing = weeklyTrendData.find(w => w.day === dayStr);
        if (existing) {
          existing.val++;
        }
      }
    });

    const monthlyData = months.map((name, index) => {
      // Only show expected up to the current month to make the chart look realistic
      const isPastOrCurrentMonth = index <= today.getMonth();
      return {
        name,
        attendance: monthlyCounts[index],
        expected: isPastOrCurrentMonth ? expectedPerMonth : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        monthlyData,
        weeklyTrendData
      }
    });

  } catch (err: any) {
    console.error('Trend API exception:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
