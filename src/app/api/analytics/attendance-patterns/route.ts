import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

/**
 * Attendance Pattern Analytics Engine (Spec P42).
 * Analyzes chronic lateness, absent patterns, and computes branch health scores.
 */

const analyticsQuerySchema = z.object({
  branch_id: z.string().uuid().optional(),
  period_days: z.coerce.number().min(7).max(90).default(30),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const { searchParams } = new URL(request.url);

    const input = analyticsQuerySchema.parse({
      branch_id: searchParams.get('branch_id') || undefined,
      period_days: searchParams.get('period_days') || 30,
    });

    const supabase = await createClient();

    // Determine which branch to analyze
    const branchId = user.role === 'admin' ? (input.branch_id || undefined) : (user.branch_id || undefined);

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - input.period_days);

    // 1. Fetch attendance data for analysis period
    let logsQuery = supabase
      .from('attendance_logs')
      .select('user_id, check_in_time, status, profiles(full_name, branch_id)')
      .gte('check_in_time', sinceDate.toISOString());

    if (branchId) {
      logsQuery = logsQuery.eq('branch_id', branchId);
    }

    const { data: logs, error } = await logsQuery;
    if (error) throw new Error(`Analytics query failed: ${error.message}`);

    if (!logs || logs.length === 0) {
      return NextResponse.json({
        success: true,
        data: { chronic_late_employees: [], branch_health_score: null, summary: {} },
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Group logs by employee
    const employeeStats: Record<string, { name: string; total: number; late: number; absent: number; present: number }> = {};

    for (const log of logs) {
      const uid = log.user_id;
      const profile = log.profiles as unknown as { full_name: string } | null;
      if (!employeeStats[uid]) {
        employeeStats[uid] = { name: profile?.full_name || uid, total: 0, late: 0, absent: 0, present: 0 };
      }
      employeeStats[uid].total += 1;
      if (log.status === 'late') employeeStats[uid].late += 1;
      else if (log.status === 'absent') employeeStats[uid].absent += 1;
      else employeeStats[uid].present += 1;
    }

    // 3. Identify Chronic Late Employees (>= 3 late arrivals in period)
    const chronicLateThreshold = 3;
    const chronicLateEmployees = Object.entries(employeeStats)
      .filter(([, s]) => s.late >= chronicLateThreshold)
      .sort((a, b) => b[1].late - a[1].late)
      .map(([uid, s]) => ({
        user_id: uid,
        name: s.name,
        late_count: s.late,
        total_days: s.total,
        late_rate_percent: Math.round((s.late / s.total) * 100),
        risk_level: s.late >= 5 ? 'HIGH' : 'MEDIUM',
      }));

    // 4. Compute Branch Health Score (0–100)
    const totalRecords = logs.length;
    const presentCount = logs.filter((l) => l.status === 'present').length;
    const lateCount = logs.filter((l) => l.status === 'late').length;
    const absentCount = logs.filter((l) => l.status === 'absent').length;

    const attendanceRate = totalRecords > 0 ? (presentCount + lateCount) / totalRecords : 0;
    const punctualityRate = presentCount + lateCount > 0 ? presentCount / (presentCount + lateCount) : 0;
    const chronicLatePenalty = chronicLateEmployees.filter((e) => e.risk_level === 'HIGH').length * 5;

    const healthScore = Math.max(0, Math.min(100,
      Math.round(attendanceRate * 60 + punctualityRate * 40 - chronicLatePenalty)
    ));

    const healthLabel = healthScore >= 90 ? 'EXCELLENT' : healthScore >= 75 ? 'GOOD' : healthScore >= 60 ? 'FAIR' : 'CRITICAL';

    return NextResponse.json({
      success: true,
      data: {
        period_days: input.period_days,
        branch_id: branchId,
        chronic_late_employees: chronicLateEmployees,
        branch_health_score: {
          score: healthScore,
          label: healthLabel,
          attendance_rate_percent: Math.round(attendanceRate * 100),
          punctuality_rate_percent: Math.round(punctualityRate * 100),
        },
        summary: {
          total_records: totalRecords,
          present_days: presentCount,
          late_days: lateCount,
          absent_days: absentCount,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

