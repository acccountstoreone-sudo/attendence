import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
  };
  daily_breakdown: Array<Record<string, unknown>>;
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
      .select('id, full_name, email, phone, role, branch_id, employee_id, branches!profiles_branch_id_fkey(name, code)')
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
    const now = new Date();
    const month = Number(searchParams.get('month')) || (now.getMonth() + 1);
    const year = Number(searchParams.get('year')) || now.getFullYear();
    const format = (searchParams.get('format') || 'pdf').toLowerCase() as 'csv' | 'excel' | 'pdf';
    const directDownload = searchParams.get('download') === 'true';

    // 2. Fetch full duty summary internal endpoint or logic
    const summaryRes = await fetch(new URL(`/api/reports/employee/${targetEmployeeId}/duty-summary?month=${month}&year=${year}`, request.url), {
      headers: { cookie: request.headers.get('cookie') || '' },
    }).catch(() => null);

    let dutyData: DutyDataPayload | null = null;
    if (summaryRes && summaryRes.ok) {
      const json = await summaryRes.json();
      if (json.success) dutyData = json.data as DutyDataPayload;
    }

    // If fetch failed or inside same process, re-run internal computation or use dutyData
    if (!dutyData) {
      // Re-query needed internally if absolute fetch failed in local serverless
      const startOfMonthISO = new Date(year, month - 1, 1, 0, 0, 0).toISOString();
      const endOfMonthISO = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      const { data: records } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', targetEmployeeId)
        .gte('check_in_time', startOfMonthISO)
        .lte('check_in_time', endOfMonthISO)
        .order('check_in_time', { ascending: true });

      dutyData = {
        employee: {
          full_name: targetProfile.full_name,
          employee_id: targetProfile.employee_id || 'PENDING',
          branch_name: (targetProfile as Record<string, unknown> & { branches?: { name?: string } }).branches?.name || 'Global HQ',
        },
        period: { month, year },
        summary: {
          total_duty_hours: 0,
          total_overtime_hours: 0,
          total_overtime_minutes: 0,
          total_missed_days: 0,
          total_late_minutes: 0,
          total_late_days: 0,
          total_present_days: records?.filter(r => r.status === 'present').length || 0,
        },
        daily_breakdown: (records || []).map(r => ({
          date: r.check_in_time.split('T')[0],
          day_name: new Date(r.check_in_time).toLocaleDateString('en-US', { weekday: 'long' }),
          status: r.status,
          check_in_time: new Date(r.check_in_time).toLocaleTimeString(),
          check_out_time: r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString() : '--:--',
          duty_hours: r.check_out_time ? Number(((new Date(r.check_out_time).getTime() - new Date(r.check_in_time).getTime()) / 3600000).toFixed(2)) : 0,
          late_minutes: 0,
          overtime_minutes: r.overtime_minutes || 0,
          notes: r.status,
        }))
      };
    }

    if (!dutyData) throw new Error('Failed to obtain duty summary data');
    const { employee, summary, daily_breakdown } = dutyData;
    const reportTitle = `${employee.full_name.replace(/\s+/g, '_')}_Duty_Report_${month}_${year}`;

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
      const doc = new jsPDF('landscape');
      const primaryColor: [number, number, number] = [10, 16, 28]; // #0A101C
      const accentColor: [number, number, number] = [210, 160, 42]; // #004417
      const whiteColor: [number, number, number] = [255, 255, 255];

      // Header Banner
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 297, 36, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(...whiteColor);
      doc.text('ANCHOR FASHION MANAGEMENT — MONTHLY DUTY & OVERTIME REPORT', 14, 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...accentColor);
      doc.text(`Employee: ${employee.full_name} (${employee.employee_id || 'N/A'}) | Store: ${employee.branch_name} | Period: ${month}/${year}`, 14, 25);
      doc.setFontSize(9);
      doc.setTextColor(180, 195, 220);
      doc.text(`Generated on: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}`, 14, 32);

      // KPI Boxes Block
      const kpis = [
        { label: 'Total Duty Hours', val: `${summary.total_duty_hours} hrs` },
        { label: 'Total Overtime', val: `${summary.total_overtime_hours}h (${summary.total_overtime_minutes}m)` },
        { label: 'Missed / Absent Days', val: `${summary.total_missed_days} days` },
        { label: 'Late Arrival', val: `${summary.total_late_minutes}m (${summary.total_late_days}d)` },
        { label: 'Present Days', val: `${summary.total_present_days} days` },
      ];

      kpis.forEach((kpi, idx) => {
        const x = 14 + idx * 54;
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(x, 42, 51, 18, 2, 2, 'F');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.label, x + 4, 48);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(kpi.val, x + 4, 56);
      });

      // Table Data
      const head = [['Date', 'Day', 'Status', 'In / Out', 'Duty', 'Late/Right', 'Overtime', 'Face/Loc', 'Notes']];
      const body = (daily_breakdown || []).map((d: Record<string, unknown>) => [
        d.date,
        String(d.day_name || '').slice(0, 3),
        d.status ? String(d.status).toUpperCase() : '',
        `${d.check_in_time || '--:--'} to ${d.check_out_time || '--:--'}`,
        `${d.duty_hours || 0}h`,
        d.is_right_time ? 'Right Time' : `${d.late_minutes || 0}m late`,
        d.overtime_minutes ? `${d.overtime_hours}h (${d.overtime_minutes}m)` : '0m',
        `${d.face_verified ? '✓ Face' : '✗ Face'} | ${d.check_in_lat && d.check_in_lng ? `${Number(d.check_in_lat).toFixed(2)}, ${Number(d.check_in_lng).toFixed(2)}` : 'No GPS'}`,
        d.notes || '',
      ]);

      // @ts-expect-error autotable method on jsPDF
      doc.autoTable({
        head,
        body,
        startY: 65,
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: accentColor, fontStyle: 'bold' },
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 14 },
          2: { cellWidth: 22 },
          3: { cellWidth: 36 },
          4: { cellWidth: 16, halign: 'center' },
          5: { cellWidth: 24, halign: 'center' },
          6: { cellWidth: 24, halign: 'center' },
          7: { cellWidth: 38 },
          8: { cellWidth: 'auto' },
        },
        didParseCell: function (data: Record<string, unknown> & { section?: string; column?: { index?: number }; cell?: { raw?: unknown; styles: { textColor?: number[] } } }) {
          if (data.section === 'body' && data.column?.index === 2) {
            const st = data.cell?.raw;
            if (st === 'MISSED' || st === 'ABSENT') { if (data.cell) data.cell.styles.textColor = [225, 29, 72]; }
            else if (st === 'LATE') { if (data.cell) data.cell.styles.textColor = [217, 119, 6]; }
            else if (st === 'PRESENT') { if (data.cell) data.cell.styles.textColor = [16, 185, 129]; }
          }
        }
      });

      fileBuffer = Buffer.from(doc.output('arraybuffer'));
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
