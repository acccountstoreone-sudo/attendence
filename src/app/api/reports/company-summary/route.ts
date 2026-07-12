import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'branch_manager')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get all branches
    const { count: branchCount } = await supabase
      .from('branches')
      .select('*', { count: 'exact', head: true });

    // APP-04 fix: Count both employees AND branch managers as "staff"
    let empQuery = supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .in('role', ['employee', 'branch_manager']);

    if (user.role === 'branch_manager') {
      empQuery = empQuery.eq('branch_id', user.branch_id);
    }
    const { count: employeeCount } = await empQuery;

    // Get today's attendance stats (Asia/Dhaka Timezone)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [month, day, year] = formatter.format(now).split('/');
    const startOfDay = new Date(`${year}-${month}-${day}T00:00:00+06:00`);
    const endOfDay = new Date(`${year}-${month}-${day}T23:59:59+06:00`);

    let attQuery = supabase
      .from('attendance_records')
      .select('status');
      
    if (user.role === 'branch_manager') {
       attQuery = attQuery.eq('branch_id', user.branch_id);
    }
    
    attQuery = attQuery.gte('check_in_time', startOfDay.toISOString())
      .lte('check_in_time', endOfDay.toISOString());

    const { data: attData } = await attQuery;

    let present = 0;
    let late = 0;
    let explicitAbsent = 0;

    if (attData) {
      present = attData.filter(a => a.status === 'present').length;
      late = attData.filter(a => a.status === 'late').length;
      explicitAbsent = attData.filter(a => a.status === 'absent').length;
    }

    // Get leaves today
    const leaveQuery = supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .lte('start_date', endOfDay.toISOString())
      .gte('end_date', startOfDay.toISOString());

    const { count: leaveCount } = await leaveQuery;
    const leaves = leaveCount || 0;

    // Calculate actual absent count (total staff minus present, late, and on leave)
    const totalStaff = employeeCount || 0;
    const absent = Math.max(0, totalStaff - present - late - leaves);

    // Bug 21 fix: Compute system_health dynamically based on attendance data
    const absenceRate = totalStaff > 0 ? absent / totalStaff : 0;
    let systemHealth = '99.9% Operational';
    if (absenceRate > 0.5) systemHealth = 'Degraded — High Absenteeism';
    else if (absenceRate > 0.3) systemHealth = 'Caution — Elevated Absences';

    return NextResponse.json({
      success: true,
      data: {
        total_branches: branchCount || 0,
        total_employees: totalStaff,
        present_today: present,
        late_today: late,
        absent_today: absent,
        on_leave_today: leaves,
        system_health: systemHealth,
      }
    });

  } catch (error) {
    return handleApiError(error);
  }
}

