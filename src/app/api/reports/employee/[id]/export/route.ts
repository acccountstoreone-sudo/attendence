import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';
import { generateAnchorFashionPDF, generateEmployeeFullDutyPDF } from '@/lib/pdf-generator';
import { computeEmployeeDutySummary } from '@/lib/dutyEngine';

interface DutyDataPayload {
  employee: {
    full_name: string;
    employee_id?: string;
    branch_name: string;
  };
  period: { month: number; year: number };
  summary: {
    total_duty_hours: number;
    total_overtime_hours: number;
    total_overtime_minutes: number;
    total_missed_days: number;
    total_late_minutes: number;
    total_late_hours?: number;
    total_late_days: number;
    total_present_days: number;
    total_on_leave_days?: number;
    total_off_days?: number;
    total_holiday_days?: number;
    total_working_days?: number;
  };
  daily_breakdown: Array<Record<string, unknown>>;
}

async function computeAllTimeDutySummary(supabase: any, targetProfile: any) {
  const { data: records } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('employee_id', targetProfile.id)
    .order('check_in_time', { ascending: false })
    .limit(2000);

  const list = records || [];
  let totalDutyHours = 0;
  let totalOvertimeMinutes = 0;
  let totalPresentDays = 0;
  let totalMissedDays = 0;
  let totalLateDays = 0;
  let totalLateMinutes = 0;
  let totalOnLeaveDays = 0;

  const breakdown = list.map((r: any) => {
    const d = new Date(r.check_in_time);
    const dateStr = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : (r.date || 'N/A');
    const dayName = !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { weekday: 'long' }) : 'Day';
    const status = r.status || 'present';
    const stLower = String(status).toLowerCase().replace('_', '-');
    const isToday = dateStr === new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
    
    const checkIn = r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--';
    const checkOut = r.check_out_time 
      ? new Date(r.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) 
      : isToday ? 'Working...' : '--:--';
    
    let dutyHrs = 0;
    if (r.check_in_time && r.check_out_time) {
      const diffMs = new Date(r.check_out_time).getTime() - new Date(r.check_in_time).getTime();
      if (diffMs > 0) dutyHrs = Number((diffMs / (3600 * 1000)).toFixed(1));
    } else if (r.check_in_time && !r.check_out_time) {
      if (isToday) {
        const diffMs = Date.now() - new Date(r.check_in_time).getTime();
        if (diffMs > 0) dutyHrs = Number((diffMs / (3600 * 1000)).toFixed(1));
      } else {
        if (r.working_minutes) dutyHrs = Number((r.working_minutes / 60).toFixed(1));
        else if (r.duty_hours) dutyHrs = Number(r.duty_hours);
        else if (stLower === 'half-day') dutyHrs = 4;
        else dutyHrs = 8;
      }
    } else if (r.duty_hours) {
      dutyHrs = Number(r.duty_hours);
    }
    totalDutyHours += dutyHrs;

    const otMins = r.overtime_minutes || 0;
    totalOvertimeMinutes += otMins;

    let lateMins = Number(r.late_minutes || 0);
    if (lateMins <= 0 && (stLower === 'late' || r.is_late)) {
      if (r.check_in_time && !isNaN(d.getTime())) {
        const dhakaTimeStr = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour12: false, hour: '2-digit', minute: '2-digit' });
        const [hh, mm] = dhakaTimeStr.split(':').map(Number);
        const checkInMins = hh * 60 + mm;
        
        let startMins = 9 * 60; // 09:00 AM default
        const officeStart = (targetProfile as any).branches?.office_start_time || '09:00:00';
        const [sh, sm] = String(officeStart).split(':').map(Number);
        if (!isNaN(sh)) startMins = sh * 60 + (sm || 0);
        
        if (checkInMins > startMins) {
          lateMins = checkInMins - startMins;
        } else {
          lateMins = 15;
        }
      }
    }
    if (lateMins > 0 || stLower === 'late') {
      totalLateDays += 1;
      totalLateMinutes += lateMins;
    }

    if (stLower === 'present' || stLower === 'late' || stLower === 'half-day') {
      totalPresentDays += 1;
    } else if (stLower === 'absent' || stLower === 'missed') {
      totalMissedDays += 1;
    } else if (stLower === 'leave' || stLower === 'on_leave') {
      totalOnLeaveDays += 1;
    }

    const otHrs = Math.floor(otMins / 60);
    const otRem = otMins % 60;

    return {
      date: dateStr,
      day_name: dayName,
      status: status,
      check_in_time: checkIn,
      check_out_time: checkOut,
      duty_hours: dutyHrs,
      late_minutes: lateMins,
      late_hours: Number((lateMins / 60).toFixed(1)),
      overtime_minutes: otRem,
      overtime_hours: otHrs,
      is_right_time: lateMins <= 0 && stLower !== 'late',
      face_verified: r.face_verified || false,
      check_in_lat: r.check_in_lat || r.latitude || null,
      check_in_lng: r.check_in_lng || r.longitude || null,
      notes: r.notes || '',
    };
  });

  totalDutyHours = Number(totalDutyHours.toFixed(1));
  const totalOvertimeHours = Math.floor(totalOvertimeMinutes / 60);
  const remainingOtMinutes = totalOvertimeMinutes % 60;

  return {
    employee: {
      full_name: targetProfile.full_name,
      employee_id: targetProfile.employee_id,
      branch_name: (targetProfile as any).branches?.name || 'Assigned Branch',
      role: targetProfile.role,
      email: targetProfile.email,
      phone: targetProfile.phone,
      created_at: targetProfile.created_at,
      is_active: targetProfile.is_active,
    },
    summary: {
      total_working_days: totalPresentDays + totalMissedDays + totalOnLeaveDays,
      total_duty_hours: totalDutyHours,
      total_overtime_hours: totalOvertimeHours,
      total_overtime_minutes: remainingOtMinutes,
      total_missed_days: totalMissedDays,
      total_late_minutes: totalLateMinutes,
      total_late_hours: Number((totalLateMinutes / 60).toFixed(1)),
      total_late_days: totalLateDays,
      total_present_days: totalPresentDays,
      total_on_leave_days: totalOnLeaveDays,
      total_off_days: 0,
      total_holiday_days: 0,
    },
    daily_breakdown: breakdown,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetEmployeeId } = await params;
    const user = await getCurrentUser();
    if (!user) throw new Error('UNAUTHENTICATED: Active session required.');

    const supabase = await createClient();

    // 1. Fetch Profile and check permissions
    const { data: targetProfile, error: profErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, branch_id, employee_id, created_at, is_active, branches!profiles_branch_id_fkey(name, code)')
      .eq('id', targetEmployeeId)
      .single();

    if (profErr || !targetProfile) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Employee profile not found.' } },
        { status: 404 }
      );
    }

    if (user.role === 'employee' && user.id !== targetEmployeeId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 403 });
    } else if (user.role === 'branch_manager' && targetProfile.branch_id !== user.branch_id) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized branch access' } }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const isAllTime = searchParams.get('all_time') === 'true' || searchParams.get('period') === 'all';
    const now = new Date();
    const month = Number(searchParams.get('month')) || (now.getMonth() + 1);
    const year = Number(searchParams.get('year')) || now.getFullYear();
    const format = (searchParams.get('format') || 'pdf').toLowerCase() as 'csv' | 'excel' | 'pdf';
    const directDownload = searchParams.get('download') === 'true';

    // 2. Fetch full duty summary internal endpoint or logic
    let dutyData: any;
    if (isAllTime) {
      dutyData = await computeAllTimeDutySummary(supabase, targetProfile);
    } else {
      dutyData = await computeEmployeeDutySummary(supabase, targetEmployeeId, month, year);
    }

    // 2.5 Fetch Gate Passes
    let breaksQuery = supabase
      .from('attendance_breaks')
      .select('*, profiles!attendance_breaks_approved_by_fkey(full_name)')
      .eq('employee_id', targetEmployeeId)
      .neq('status', 'rejected')
      .order('created_at', { ascending: false });

    if (!isAllTime) {
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      breaksQuery = breaksQuery.gte('created_at', startDate).lte('created_at', endDate);
    }
    
    const { data: gatePasses } = await breaksQuery;

    if (!dutyData) throw new Error('Failed to obtain duty summary data');
    const { employee, summary, daily_breakdown } = dutyData;
    const reportTitle = isAllTime
      ? `${employee.full_name.replace(/\s+/g, '_')}_Full_Profile_Tenure_Report`
      : `${employee.full_name.replace(/\s+/g, '_')}_Duty_Report_${month}_${year}`;

    let fileBuffer: Buffer;
    let fileName: string;
    let contentType: string;

    if (format === 'csv') {
      const headerRows = [
        ['Employee Name', employee.full_name],
        ['Staff ID', employee.employee_id || 'N/A'],
        ['Branch', employee.branch_name],
        ['Report Period', `${month}/${year}`],
        ['Total Duty Hours', `${summary.total_duty_hours} hrs`],
        ['Total Overtime', `${summary.total_overtime_hours} hrs (${summary.total_overtime_minutes} mins)`],
        ['Total Missed Days', `${summary.total_missed_days} days`],
        ['Total Late Minutes', `${summary.total_late_minutes} mins (${summary.total_late_days} days)`],
        ['Total Present Days', `${summary.total_present_days} days`],
        [],
        ['Date', 'Day of Week', 'Status', 'Check-in Time', 'Check-out Time', 'Duty Hours', 'Late (Mins)', 'Late (Hrs)', 'Overtime (Mins)', 'Overtime (Hrs)', 'Right Time?', 'Face Verified?', 'Location (Lat, Lng)', 'Notes'],
      ];

      const dataRows = (daily_breakdown || []).map((d: Record<string, unknown>) => [
        d.date,
        d.day_name,
        d.status ? String(d.status).toUpperCase() : '',
        d.check_in_time || '--:--',
        d.check_out_time || '--:--',
        d.duty_hours || 0,
        d.late_minutes || 0,
        d.late_hours || 0,
        d.overtime_minutes || 0,
        d.overtime_hours || 0,
        d.is_right_time ? 'YES' : 'NO',
        d.face_verified ? 'YES' : 'NO',
        d.check_in_lat && d.check_in_lng ? `"${d.check_in_lat}, ${d.check_in_lng}"` : 'N/A',
        `"${String(d.notes || '').replace(/"/g, '""')}"`,
      ]);

      const csvString = [...headerRows.map(r => r.join(',')), ...dataRows.map((r: unknown[]) => r.join(','))].join('\r\n');
      fileBuffer = Buffer.from('\uFEFF' + csvString, 'utf-8'); // BOM for Excel proper UTF-8 handling
      fileName = `${reportTitle}.csv`;
      contentType = 'text/csv; charset=utf-8';

    } else if (format === 'excel') {
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Monthly Summary
      const summaryData = [
        { Metric: 'Employee Name', Value: employee.full_name },
        { Metric: 'Staff ID', Value: employee.employee_id || 'N/A' },
        { Metric: 'Branch / Store', Value: employee.branch_name },
        { Metric: 'Report Period', Value: `${month}/${year}` },
        { Metric: 'Total Duty Hours', Value: summary.total_duty_hours },
        { Metric: 'Total Overtime (Hours)', Value: summary.total_overtime_hours },
        { Metric: 'Total Overtime (Minutes)', Value: summary.total_overtime_minutes },
        { Metric: 'Total Missed Days (Absent)', Value: summary.total_missed_days },
        { Metric: 'Total Late Minutes', Value: summary.total_late_minutes },
        { Metric: 'Total Late Hours', Value: summary.total_late_hours || 0 },
        { Metric: 'Total Late Days', Value: summary.total_late_days },
        { Metric: 'Total Present Days', Value: summary.total_present_days },
        { Metric: 'Total Leave Days', Value: summary.total_on_leave_days || 0 },
        { Metric: 'Total Off Days / Holidays', Value: (summary.total_off_days || 0) + (summary.total_holiday_days || 0) },
      ];
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Monthly Summary');

      // Sheet 2: Daily Breakdown
      const dailySheetData = (daily_breakdown || []).map((d: Record<string, unknown>) => ({
        Date: d.date,
        Day: d.day_name,
        Status: d.status ? String(d.status).toUpperCase() : '',
        'Check-In': d.check_in_time,
        'Check-Out': d.check_out_time,
        'Duty Hours': d.duty_hours,
        'Late (Mins)': d.late_minutes,
        'Late (Hrs)': d.late_hours || 0,
        'Overtime (Mins)': d.overtime_minutes,
        'Overtime (Hrs)': d.overtime_hours,
        'Right Time?': d.is_right_time ? 'YES' : 'NO',
        'Face Verified?': d.face_verified ? 'YES' : 'NO',
        'Location (Lat, Lng)': d.check_in_lat && d.check_in_lng ? `${d.check_in_lat}, ${d.check_in_lng}` : 'N/A',
        Notes: d.notes,
      }));
      const dailySheet = XLSX.utils.json_to_sheet(dailySheetData);
      XLSX.utils.book_append_sheet(workbook, dailySheet, 'Daily Roster');

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      fileBuffer = Buffer.from(excelBuffer);
      fileName = `${reportTitle}.xlsx`;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    } else {
      // PDF Format (`format === 'pdf'`)
      
      const head = ['Date', 'Day', 'Status', 'In / Out', 'Duty', 'Late/Right', 'Overtime', 'Face/Loc', 'Notes'];
      const body = (daily_breakdown || []).map((d: Record<string, unknown>) => [
        d.date,
        String(d.day_name || '').slice(0, 3),
        d.status ? String(d.status).toUpperCase() : '',
        `${d.check_in_time || '--:--'} to ${d.check_out_time || '--:--'}`,
        `${d.duty_hours || 0}h`,
        d.is_right_time ? 'Right Time' : Number(d.late_minutes) >= 60 ? `${Math.floor(Number(d.late_minutes)/60)}h ${Number(d.late_minutes)%60}m late` : `${d.late_minutes || 0}m late`,
        d.overtime_minutes ? `${d.overtime_hours}h (${d.overtime_minutes}m)` : `${d.overtime_hours || 0}h`,
        `${d.face_verified ? 'Yes (Face)' : 'No (Face)'} | ${d.check_in_lat && d.check_in_lng ? `${Number(d.check_in_lat).toFixed(2)}, ${Number(d.check_in_lng).toFixed(2)}` : 'No GPS'}`,
        d.notes || '',
      ]);

      const periodText = isAllTime ? 'Full Employment History (All Time)' : `${month}/${year}`;
      const joinDateStr = targetProfile.created_at ? new Date(targetProfile.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

      // Gate passes formatting
      const breaksColumns = ['Date', 'Type', 'Status', 'Out Time', 'In Time', 'Duration', 'Overstay', 'Approved By', 'Reason'];
      const breaksRows = (gatePasses || []).map((b: any) => {
        const outTime = b.out_time ? new Date(b.out_time) : null;
        const inTime = b.return_time ? new Date(b.return_time) : null;
        const dateStr = outTime ? outTime.toLocaleDateString('en-GB') : new Date(b.created_at).toLocaleDateString('en-GB');
        const outStr = outTime ? outTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
        const inStr = inTime ? inTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (b.status === 'active' || b.status === 'overstayed' ? 'Live (Outside)' : '--:--');
        
        const typeMap: Record<string, string> = {
          namaz_prayer: 'Prayer/Namaz',
          tea_lunch: 'Tea/Lunch',
          official_bank: 'Official/Bank',
          short_emergency: 'Emergency',
          personal: 'Personal'
        };

        const duration = b.actual_duration_minutes || (inTime && outTime ? Math.round((inTime.getTime() - outTime.getTime()) / 60000) : 0);
        const overstay = duration > b.expected_duration_minutes ? `+${duration - b.expected_duration_minutes}m` : 'No';
        const approverName = b.profiles ? b.profiles.full_name : (b.status === 'pending' ? 'Pending...' : 'Self/Auto');

        return [
          dateStr,
          typeMap[b.break_type] || b.break_type,
          String(b.status).toUpperCase(),
          outStr,
          inStr,
          `${duration}m / ${b.expected_duration_minutes}m`,
          overstay,
          approverName,
          String(b.reason || '').slice(0, 30)
        ];
      });

      fileBuffer = generateEmployeeFullDutyPDF({
        reportTitle: isAllTime ? 'EMPLOYEE FULL SUMMARY & TENURE REPORT' : 'EMPLOYEE DUTY SUMMARY REPORT',
        reportSubtitle: 'Official Statement & Profile Details',
        employee: {
          full_name: employee.full_name,
          employee_id: employee.employee_id || targetProfile.employee_id || 'N/A',
          role: targetProfile.role || 'Employee',
          branch_name: employee.branch_name || (targetProfile as any).branches?.name || 'All Branches',
          email: targetProfile.email || 'N/A',
          phone: targetProfile.phone || 'N/A',
          joining_date: joinDateStr,
          status: targetProfile.is_active !== false ? 'Active' : 'Inactive',
        },
        periodText,
        preparedBy: user?.full_name || 'HR Admin',
        summary: {
          total_duty_hours: summary.total_duty_hours || 0,
          total_overtime_hours: summary.total_overtime_hours || 0,
          total_overtime_minutes: summary.total_overtime_minutes || 0,
          total_present_days: summary.total_present_days || 0,
          total_missed_days: summary.total_missed_days || 0,
          total_late_minutes: summary.total_late_minutes || 0,
          total_late_hours: summary.total_late_hours || 0,
          total_late_days: summary.total_late_days || 0,
          total_working_days: summary.total_working_days || (summary.total_present_days + summary.total_missed_days),
          total_on_leave_days: summary.total_on_leave_days || 0,
        },
        columns: head,
        rows: body,
        breaksData: {
          columns: breaksColumns,
          rows: breaksRows
        }
      });

      fileName = `${reportTitle}.pdf`;
      contentType = 'application/pdf';
    }

    if (directDownload) {
      return new NextResponse(new Uint8Array(fileBuffer), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        file_name: fileName,
        format,
        content_type: contentType,
        content_base64: fileBuffer.toString('base64'),
        message: `${format.toUpperCase()} report generated successfully for ${employee.full_name}.`,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    return handleApiError(error);
  }
}
