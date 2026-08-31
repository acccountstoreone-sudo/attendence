import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/reports/analytics
 *
 * Returns zero-cost analytics computed purely via SQL:
 * 1. Chronic latecomers (employees late 3+ times this month)
 * 2. Branch leaderboard (ranked by punctuality %)
 * 3. Month-over-month attendance trend (last 6 months)
 * 4. Absent today (employees with no check-in today)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const targetBranchId = searchParams.get('branch_id') || (user.role === 'branch_manager' ? user.branch_id : null);

    // ── 1. Chronic Latecomers (this month) ──────────────────────────
    const now = new Date();
    const dhakaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
    const dYear = dhakaTime.getFullYear();
    const dMonth = dhakaTime.getMonth() + 1;
    const dDay = dhakaTime.getDate();
    const dLastDay = new Date(dYear, dMonth, 0).getDate();

    const monthStart = `${dYear}-${String(dMonth).padStart(2, '0')}-01T00:00:00.000+06:00`;
    const monthEnd = `${dYear}-${String(dMonth).padStart(2, '0')}-${String(dLastDay).padStart(2, '0')}T23:59:59.999+06:00`;

    let lateQuery = supabase
      .from('attendance_records')
      .select('employee_id, profiles!employee_id(full_name, employee_id, branch_id, branches!branch_id(name))')
      .eq('status', 'late')
      .gte('check_in_time', monthStart)
      .lte('check_in_time', monthEnd);

    if (targetBranchId) {
      lateQuery = lateQuery.eq('branch_id', targetBranchId);
    }

    const { data: lateRecords } = await lateQuery;

    // Count per employee
    const lateCountMap: Record<string, { name: string; employee_id?: string; branch: string; count: number }> = {};
    for (const rec of lateRecords ?? []) {
      const emp = rec.employee_id as string;
      const profile = rec.profiles as unknown as { full_name: string; employee_id?: string; branches?: { name?: string } };
      if (!lateCountMap[emp]) {
        lateCountMap[emp] = {
          name: profile?.full_name ?? 'Unknown',
          employee_id: profile?.employee_id,
          branch: profile?.branches?.name ?? '—',
          count: 0,
        };
      }
      lateCountMap[emp].count += 1;
    }

    const chronicLate = Object.entries(lateCountMap)
      .map(([id, v]) => ({ employee_id: id, ...v }))
      .filter((e) => e.count >= 3)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // ── 2. Branch Leaderboard ─────────────────────────────────────
    let branchStatsQuery = supabase
      .from('attendance_records')
      .select('branch_id, status, branches!branch_id(name, code)')
      .gte('check_in_time', monthStart)
      .lte('check_in_time', monthEnd);
      
    if (targetBranchId) {
      branchStatsQuery = branchStatsQuery.eq('branch_id', targetBranchId);
    }
    
    const { data: branchStats } = await branchStatsQuery;

    const branchMap: Record<string, { name: string; code: string; total: number; late: number; absent: number }> = {};
    for (const rec of branchStats ?? []) {
      const bid = rec.branch_id as string;
      const b = rec.branches as unknown as { name?: string; code?: string };
      if (!branchMap[bid]) branchMap[bid] = { name: b?.name ?? bid, code: b?.code ?? '', total: 0, late: 0, absent: 0 };
      branchMap[bid].total += 1;
      if (rec.status === 'late') branchMap[bid].late += 1;
      if (rec.status === 'absent') branchMap[bid].absent += 1;
    }

    const leaderboard = Object.entries(branchMap)
      .map(([id, v]) => ({
        branch_id: id,
        branch_name: v.name,
        branch_code: v.code,
        total: v.total,
        late: v.late,
        absent: v.absent,
        punctuality_rate: v.total > 0 ? Math.round(((v.total - v.late - v.absent) / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.punctuality_rate - a.punctuality_rate);

    // ── 3. Month-over-Month Trend (last 6 months) ─────────────────
    const trend: { month: string; present: number; late: number; absent: number }[] = [];
    
    // Calculate the start year/month for the past 6 months
    const sixMonthsAgo = new Date(Date.UTC(dYear, dhakaTime.getMonth() - 5, 1));
    
    let mvQuery = supabase
      .from('mv_monthly_branch_summary')
      .select('year_num, month_num, total_checkins, present_count, late_count, half_day_count');
      
    if (targetBranchId) mvQuery = mvQuery.eq('branch_id', targetBranchId);
    
    // We fetch a bit wider range just to be safe, filtering in memory
    mvQuery = mvQuery.gte('year_num', sixMonthsAgo.getUTCFullYear());

    const { data: mvData } = await mvQuery;
    const historicalMap = new Map<string, { present: number; late: number; absent: number }>();
    
    for (const row of mvData ?? []) {
      const key = `${row.year_num}-${row.month_num}`;
      const prev = historicalMap.get(key) || { present: 0, late: 0, absent: 0 };
      
      const present = row.present_count || 0;
      const late = row.late_count || 0;
      const total = row.total_checkins || 0;
      const halfDay = row.half_day_count || 0;
      const absent = Math.max(0, total - present - late - halfDay);
      
      historicalMap.set(key, {
        present: prev.present + present,
        late: prev.late + late,
        absent: prev.absent + absent
      });
    }

    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(dYear, dhakaTime.getMonth() - i, 1));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
      const key = `${y}-${m}`;
      
      const stats = historicalMap.get(key) || { present: 0, late: 0, absent: 0 };
      trend.push({ month: label, ...stats });
    }

    // ── 4. Absent Today ───────────────────────────────────────────
    const todayStart = `${dYear}-${String(dMonth).padStart(2, '0')}-${String(dDay).padStart(2, '0')}T00:00:00.000+06:00`;
    const todayEnd = `${dYear}-${String(dMonth).padStart(2, '0')}-${String(dDay).padStart(2, '0')}T23:59:59.999+06:00`;

    let activeEmpsQ = supabase.from('profiles').select('id, full_name, employee_id, branch_id, branches!branch_id(name)').eq('role', 'employee').eq('is_active', true);
    if (targetBranchId) activeEmpsQ = activeEmpsQ.eq('branch_id', targetBranchId);
    const { data: allEmps } = await activeEmpsQ;

    let checkedInQ = supabase.from('attendance_records').select('employee_id').gte('check_in_time', todayStart).lte('check_in_time', todayEnd);
    if (targetBranchId) checkedInQ = checkedInQ.eq('branch_id', targetBranchId);
    const { data: checkedIn } = await checkedInQ;

    const checkedInSet = new Set((checkedIn ?? []).map((r) => r.employee_id));
    const absentToday = (allEmps ?? [])
      .filter((e) => !checkedInSet.has(e.id))
      .map((e) => {
        const b: any = (e as any).branches;
        const bName = Array.isArray(b) ? b[0]?.name : b?.name;
        return {
          id: e.id,
          full_name: e.full_name,
          employee_id: e.employee_id,
          branch: bName ?? '—',
        };
      });

    return NextResponse.json({
      success: true,
      data: {
        chronic_late: chronicLate,
        branch_leaderboard: leaderboard,
        monthly_trend: trend,
        absent_today: absentToday,
        month_label: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka', month: 'long', year: 'numeric' }),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

