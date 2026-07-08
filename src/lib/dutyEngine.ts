import { SupabaseClient } from '@supabase/supabase-js';

export interface DutySummaryResult {
  employee: {
    id: string;
    full_name: string;
    email?: string;
    phone?: string;
    photo_url?: string;
    role?: string;
    branch_id?: string;
    employee_id?: string;
    branch_name: string;
    branch_code: string;
  };
  period: {
    month: number;
    year: number;
    work_start_time: string;
    work_end_time: string;
    late_grace_minutes: number;
  };
  summary: {
    total_working_days: number;
    total_present_days: number;
    total_late_days: number;
    total_half_days: number;
    total_missed_days: number;
    total_on_leave_days: number;
    total_off_days: number;
    total_holiday_days: number;
    total_duty_hours: number;
    total_overtime_minutes: number;
    total_overtime_hours: number;
    total_late_minutes: number;
    total_late_hours: number;
  };
  daily_breakdown: Array<{
    date: string;
    day_name: string;
    status: string;
    check_in_time: string;
    check_out_time: string;
    duty_hours: number;
    late_minutes: number;
    overtime_minutes: number;
    overtime_hours: number;
    notes: string;
  }>;
}

/**
 * Core engine to compute exact duty summary, overtime, late arrival, and attendance stats
 * for an employee across any given month and year.
 */
export async function computeEmployeeDutySummary(
  supabase: SupabaseClient<any, 'public', any>,
  targetEmployeeId: string,
  month: number,
  year: number
): Promise<DutySummaryResult> {
  // 1. Fetch Target Profile
  const { data: targetProfile, error: profErr } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, photo_url, role, branch_id, employee_id, created_at, branches(name, code)')
    .eq('id', targetEmployeeId)
    .single();

  if (profErr || !targetProfile) {
    throw new Error(`Target employee profile (${targetEmployeeId}) not found.`);
  }

  const now = new Date();

  // 2. Fetch Branch & Company Settings for Work Hours & Grace Periods
  let workStartTime = '09:00:00';
  let workEndTime = '18:00:00';
  let lateGraceMinutes = 15;
  let overtimeAfterMinutes = 30;
  let halfDayHours = 4.0;
  let weeklyOffDays: number[] = [5]; // Default: Friday (5)

  const { data: cp } = await supabase.from('company_profile').select('*').single();
  if (cp) {
    if (cp.default_work_start_time) workStartTime = cp.default_work_start_time;
    if (cp.default_work_end_time) workEndTime = cp.default_work_end_time;
  }

  if (targetProfile.branch_id) {
    const { data: bs } = await supabase.from('branch_settings').select('*').eq('branch_id', targetProfile.branch_id).single();
    if (bs) {
      if (bs.work_start_time) workStartTime = bs.work_start_time;
      if (bs.work_end_time) workEndTime = bs.work_end_time;
      if (bs.late_grace_minutes !== undefined && bs.late_grace_minutes !== null) lateGraceMinutes = bs.late_grace_minutes;
      if (bs.overtime_after_minutes !== undefined && bs.overtime_after_minutes !== null) overtimeAfterMinutes = bs.overtime_after_minutes;
      if (bs.half_day_hours) halfDayHours = bs.half_day_hours;
      if (bs.weekly_off_days && Array.isArray(bs.weekly_off_days)) weeklyOffDays = bs.weekly_off_days;
    }
  }

  const parseTimeToMinutes = (timeStr: string) => {
    const parts = timeStr.split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };
  const startMinutesOfDay = parseTimeToMinutes(workStartTime);
  const endMinutesOfDay = parseTimeToMinutes(workEndTime);

  // 3. Fetch Public Holidays
  const startOfMonthStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const daysInMonthCount = new Date(year, month, 0).getDate();
  const endOfMonthStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonthCount).padStart(2, '0')}`;

  const { data: holidays } = await supabase
    .from('public_holidays')
    .select('*')
    .or(`and(holiday_date.gte.${startOfMonthStr},holiday_date.lte.${endOfMonthStr}),is_recurring.eq.true`);

  // 4. Fetch Approved Leave Requests
  const { data: leaves } = await supabase
    .from('leave_requests')
    .select('*')
    .or(`employee_id.eq.${targetEmployeeId},user_id.eq.${targetEmployeeId}`)
    .eq('status', 'approved')
    .lte('start_date', endOfMonthStr)
    .gte('end_date', startOfMonthStr);

  // 5. Fetch Attendance Records
  const startOfMonthISO = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000+06:00`;
  const endOfMonthISO = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonthCount).padStart(2, '0')}T23:59:59.999+06:00`;

  const { data: records, error: recErr } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('employee_id', targetEmployeeId)
    .gte('check_in_time', startOfMonthISO)
    .lte('check_in_time', endOfMonthISO)
    .order('check_in_time', { ascending: true });

  if (recErr) throw new Error(`Database Query Failed: ${recErr.message}`);

  const getDhakaDateStr = (isoString: string) => {
    const d = new Date(isoString);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  };

  const getDhakaTimeStr = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Dhaka',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getDhakaMinutesOfDay = (isoString: string) => {
    const d = new Date(isoString);
    const parts = d.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Dhaka',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    }).split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };

  const recordsByDate: Record<string, typeof records> = {};
  (records || []).forEach((r) => {
    const dateKey = getDhakaDateStr(r.check_in_time);
    if (!recordsByDate[dateKey]) recordsByDate[dateKey] = [];
    recordsByDate[dateKey].push(r);
  });

  const currentDhakaDateStr = getDhakaDateStr(now.toISOString());
  const targetCreatedAt = (targetProfile as { created_at?: string })?.created_at;
  const joinDateDhaka = targetCreatedAt ? getDhakaDateStr(targetCreatedAt) : startOfMonthStr;

  const dailyBreakdown = [];
  let totalWorkingDays = 0;
  let totalPresentDays = 0;
  let totalLateDays = 0;
  let totalHalfDays = 0;
  let totalMissedDays = 0;
  let totalOnLeaveDays = 0;
  let totalOffDays = 0;
  let totalHolidayDays = 0;
  let totalDutyHours = 0;
  let totalOvertimeMinutes = 0;
  let totalLateMinutes = 0;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (let day = 1; day <= daysInMonthCount; day++) {
    const dateObj = new Date(year, month - 1, day);
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeekNum = dateObj.getDay();
    const dayName = dayNames[dayOfWeekNum];

    const isFutureDay = dateStr > currentDhakaDateStr;
    const dayRecords = recordsByDate[dateStr] || [];

    const holidayMatch = (holidays || []).find((h) => {
      if (h.holiday_date === dateStr) return true;
      if (h.is_recurring) {
        const recurringSuffix = dateStr.slice(5);
        return h.holiday_date.endsWith(recurringSuffix);
      }
      return false;
    });

    const leaveMatch = (leaves || []).find((l) => {
      return dateStr >= l.start_date && dateStr <= l.end_date;
    });

    const isOffDay = weeklyOffDays.includes(dayOfWeekNum);

    if (dayRecords.length > 0) {
      const firstLog = dayRecords[0];
      const lastLog = dayRecords[dayRecords.length - 1];
      const checkOutLog = (dayRecords.length > 1 && lastLog.check_out_time) ? lastLog : firstLog;

      const checkInFormatted = getDhakaTimeStr(firstLog.check_in_time);
      const checkOutFormatted = checkOutLog.check_out_time
        ? getDhakaTimeStr(checkOutLog.check_out_time)
        : null;

      let dutyHours = 0;
      const checkInMs = new Date(firstLog.check_in_time).getTime();
      const checkOutMs = checkOutLog.check_out_time
        ? new Date(checkOutLog.check_out_time).getTime()
        : null;

      if (checkOutMs && checkOutMs > checkInMs) {
        dutyHours = Math.max(0, Number(((checkOutMs - checkInMs) / 3600000).toFixed(2)));
      } else if (dateStr === currentDhakaDateStr) {
        const nowMs = now.getTime();
        if (nowMs > checkInMs) {
          dutyHours = Math.max(0, Number(((nowMs - checkInMs) / 3600000).toFixed(2)));
        }
      }

      const checkInMinutes = getDhakaMinutesOfDay(firstLog.check_in_time);
      let lateMins = 0;
      if (checkInMinutes > startMinutesOfDay) {
        lateMins = checkInMinutes - startMinutesOfDay;
      }

      let evaluatedStatus = firstLog.status || 'present';
      if (lateMins > lateGraceMinutes) {
        evaluatedStatus = 'late';
      } else if (dutyHours > 0 && dutyHours < halfDayHours && checkOutMs) {
        evaluatedStatus = 'half_day';
      }

      let otMins = checkOutLog.overtime_minutes || firstLog.overtime_minutes || 0;
      if (checkOutMs) {
        const checkOutMinutes = getDhakaMinutesOfDay(checkOutLog.check_out_time!);
        if (checkOutMinutes > endMinutesOfDay + overtimeAfterMinutes) {
          const computedOt = checkOutMinutes - endMinutesOfDay;
          otMins = Math.max(otMins, computedOt);
        }
      }

      if (!isOffDay && !holidayMatch) totalWorkingDays++;
      if (evaluatedStatus === 'present') totalPresentDays++;
      if (evaluatedStatus === 'late') {
        totalLateDays++;
        totalLateMinutes += lateMins;
      } else if (lateMins > 0) {
        totalLateMinutes += lateMins;
      }
      if (evaluatedStatus === 'half_day') totalHalfDays++;

      totalDutyHours += dutyHours;
      totalOvertimeMinutes += otMins;

      dailyBreakdown.push({
        date: dateStr,
        day_name: dayName,
        status: evaluatedStatus,
        check_in_time: checkInFormatted,
        check_out_time: checkOutFormatted || (dateStr === currentDhakaDateStr ? 'Working...' : '--:--'),
        duty_hours: Number(dutyHours.toFixed(2)),
        late_minutes: lateMins,
        overtime_minutes: otMins,
        overtime_hours: Number((otMins / 60).toFixed(2)),
        notes: evaluatedStatus === 'late' ? `${lateMins} mins late` : otMins > 0 ? `${otMins} mins overtime` : 'Checked In',
      });
    } else {
      if (isFutureDay) {
        dailyBreakdown.push({
          date: dateStr,
          day_name: dayName,
          status: 'upcoming',
          check_in_time: '--:--',
          check_out_time: '--:--',
          duty_hours: 0,
          late_minutes: 0,
          overtime_minutes: 0,
          overtime_hours: 0,
          notes: 'Upcoming Day',
        });
      } else if (holidayMatch) {
        totalHolidayDays++;
        dailyBreakdown.push({
          date: dateStr,
          day_name: dayName,
          status: 'holiday',
          check_in_time: '--:--',
          check_out_time: '--:--',
          duty_hours: 0,
          late_minutes: 0,
          overtime_minutes: 0,
          overtime_hours: 0,
          notes: `Holiday: ${holidayMatch.name}`,
        });
      } else if (isOffDay) {
        totalOffDays++;
        dailyBreakdown.push({
          date: dateStr,
          day_name: dayName,
          status: 'off_day',
          check_in_time: '--:--',
          check_out_time: '--:--',
          duty_hours: 0,
          late_minutes: 0,
          overtime_minutes: 0,
          overtime_hours: 0,
          notes: 'Weekly Off Day',
        });
      } else if (leaveMatch) {
        totalOnLeaveDays++;
        totalWorkingDays++;
        dailyBreakdown.push({
          date: dateStr,
          day_name: dayName,
          status: 'on_leave',
          check_in_time: '--:--',
          check_out_time: '--:--',
          duty_hours: 0,
          late_minutes: 0,
          overtime_minutes: 0,
          overtime_hours: 0,
          notes: `Approved Leave (${(leaveMatch.type || 'Leave').toUpperCase()})`,
        });
      } else if (dateStr < joinDateDhaka) {
        dailyBreakdown.push({
          date: dateStr,
          day_name: dayName,
          status: 'upcoming',
          check_in_time: '--:--',
          check_out_time: '--:--',
          duty_hours: 0,
          late_minutes: 0,
          overtime_minutes: 0,
          overtime_hours: 0,
          notes: 'Before Joining Date',
        });
      } else {
        totalWorkingDays++;
        totalMissedDays++;
        dailyBreakdown.push({
          date: dateStr,
          day_name: dayName,
          status: 'missed',
          check_in_time: '--:--',
          check_out_time: '--:--',
          duty_hours: 0,
          late_minutes: 0,
          overtime_minutes: 0,
          overtime_hours: 0,
          notes: 'Absent / Missed Duty',
        });
      }
    }
  }

  return {
    employee: {
      id: targetProfile.id,
      full_name: targetProfile.full_name,
      email: targetProfile.email,
      phone: targetProfile.phone,
      photo_url: targetProfile.photo_url,
      role: targetProfile.role,
      branch_id: targetProfile.branch_id,
      employee_id: targetProfile.employee_id,
      branch_name: (targetProfile as unknown as { branches?: { name?: string; code?: string } }).branches?.name || 'Global HQ',
      branch_code: (targetProfile as unknown as { branches?: { code?: string } }).branches?.code || 'HQ',
    },
    period: { month, year, work_start_time: workStartTime, work_end_time: workEndTime, late_grace_minutes: lateGraceMinutes },
    summary: {
      total_working_days: totalWorkingDays,
      total_present_days: totalPresentDays,
      total_late_days: totalLateDays,
      total_half_days: totalHalfDays,
      total_missed_days: totalMissedDays,
      total_on_leave_days: totalOnLeaveDays,
      total_off_days: totalOffDays,
      total_holiday_days: totalHolidayDays,
      total_duty_hours: Number(totalDutyHours.toFixed(2)),
      total_overtime_minutes: totalOvertimeMinutes,
      total_overtime_hours: Number((totalOvertimeMinutes / 60).toFixed(2)),
      total_late_minutes: totalLateMinutes,
      total_late_hours: Number((totalLateMinutes / 60).toFixed(2)),
    },
    daily_breakdown: dailyBreakdown,
  };
}
