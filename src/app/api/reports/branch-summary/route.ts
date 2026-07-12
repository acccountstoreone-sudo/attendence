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
    
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');
    const filterBranchId = searchParams.get('branch_id');

    let branchQuery = supabase.from('branches').select('*');
    if (user.role === 'branch_manager') {
      branchQuery = branchQuery.eq('id', user.branch_id);
    } else if (filterBranchId) {
      branchQuery = branchQuery.eq('id', filterBranchId);
    }
    
    const { data: branches, error: branchError } = await branchQuery;
    if (branchError) throw branchError;

    // Use provided month/year or default to current local month
    const now = new Date();
    const targetMonth = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;
    const targetYear = yearParam ? parseInt(yearParam, 10) : now.getFullYear();

    // Create start and end dates for the entire month
    const startDate = new Date(targetYear, targetMonth - 1, 1).toISOString();
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999).toISOString();

    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

    const summary = await Promise.all(branches.map(async (branch) => {
       const { count: staffCount } = await supabase
         .from('profiles')
         .select('*', { count: 'exact', head: true })
         .eq('branch_id', branch.id)
         .eq('role', 'employee');

       const { data: attData } = await supabase
         .from('attendance_records')
         .select('status')
         .eq('branch_id', branch.id)
         .gte('check_in_time', startDate)
         .lte('check_in_time', endDate);

       let present = 0;
       let late = 0;
       let absent = 0;
       let halfDay = 0;

       if (attData) {
         present = attData.filter(a => a.status === 'present').length;
         late = attData.filter(a => a.status === 'late').length;
         absent = attData.filter(a => a.status === 'absent').length;
         halfDay = attData.filter(a => a.status === 'half-day' || a.status === 'half_day').length;
       }

       const totalStaff = staffCount || 0;
       const totalWorkingDays = totalStaff * daysInMonth; // Or approximate based on actual working days

       // If 'absent' wasn't explicitly logged for some days, we can deduce it 
       // but typically we'll just sum what is explicitly recorded, plus inferred unlogged days.
       const totalLogged = present + late + absent + halfDay;
       const unloggedAbsences = Math.max(0, totalWorkingDays - totalLogged);
       const totalAbsences = absent + unloggedAbsences;

       const totalPresent = present + late + halfDay; // half-day counts as partial present, but let's group it
       const totalDays = totalWorkingDays > 0 ? totalWorkingDays : 1; // avoid div/0

       const attendanceRate = Math.min(100, Math.max(0, (totalPresent / totalDays) * 100));
       const punctualityRate = totalPresent > 0 ? (present / totalPresent) * 100 : 0;

       // NEW-01 fix: use Dhaka timezone (UTC+6) for today's boundary
       const now2 = new Date();
       const dhakaFmt = new Intl.DateTimeFormat('en-US', {
         timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit',
       });
       const [mo2, da2, yr2] = dhakaFmt.format(now2).split('/');
       const todayStartDhaka = new Date(`${yr2}-${mo2}-${da2}T00:00:00+06:00`);
       const todayEndDhaka = new Date(`${yr2}-${mo2}-${da2}T23:59:59+06:00`);

       const { data: todayRecords } = await supabase
         .from('attendance_records')
         .select('status')
         .eq('branch_id', branch.id)
         .gte('check_in_time', todayStartDhaka.toISOString())
         .lte('check_in_time', todayEndDhaka.toISOString());

       let presentTodayCount = 0;
       let lateTodayCount = 0;
       let halfDayTodayCount = 0;
       if (todayRecords) {
         presentTodayCount = todayRecords.filter(r => r.status === 'present').length;
         lateTodayCount = todayRecords.filter(r => r.status === 'late').length;
         halfDayTodayCount = todayRecords.filter(r => r.status === 'half-day' || r.status === 'half_day').length;
       }
       const totalPresentToday = presentTodayCount + lateTodayCount + halfDayTodayCount;
       const absentTodayCount = Math.max(0, totalStaff - totalPresentToday);
       const alertCount = lateTodayCount + (attendanceRate < 75 && totalStaff > 0 ? 1 : 0);

       return {
         branch_id: branch.id,
         name: branch.name,
         branch_name: branch.name,
         code: branch.code || branch.id.split('-')[0].toUpperCase(),
         branch_code: branch.code || branch.id.split('-')[0].toUpperCase(),
         address: branch.address || 'Headquarters / Main Store',
         total_days: totalWorkingDays,
         present_days: present,
         late_days: late,
         absent_days: totalAbsences,
         attendance_rate: attendanceRate,
         punctuality_rate: punctualityRate,
         total_staff: totalStaff,
         present_today: totalPresentToday,
         late_today: lateTodayCount,
         absent_today: absentTodayCount,
         alert_count: alertCount
       };
    }));

    return NextResponse.json({
      success: true,
      data: summary
    });

  } catch (error) {
    return handleApiError(error);
  }
}

