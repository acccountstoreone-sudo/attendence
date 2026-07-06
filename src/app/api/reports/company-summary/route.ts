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

    // Get all employees
    let empQuery = supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'employee');
      
    if (user.role === 'branch_manager') {
      empQuery = empQuery.eq('branch_id', user.branch_id);
    }
    const { count: employeeCount } = await empQuery;

    // Get today's attendance stats
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

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
    let absent = 0;

    if (attData) {
      present = attData.filter(a => a.status === 'present').length;
      late = attData.filter(a => a.status === 'late').length;
      absent = attData.filter(a => a.status === 'absent').length;
    }

    // Get leaves today
    const leaveQuery = supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .lte('start_date', endOfDay.toISOString())
      .gte('end_date', startOfDay.toISOString());

    const { count: leaveCount } = await leaveQuery;

    // Bug 21 fix: Compute system_health dynamically based on attendance data
    const totalStaff = employeeCount || 0;
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
        on_leave_today: leaveCount || 0,
        system_health: systemHealth,
      }
    });

  } catch (error) {
    return handleApiError(error);
  }
}
