import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError, AuthUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import ExcelJS from 'exceljs';
import { generateAnchorFashionPDF } from '@/lib/pdf-generator';

export interface OvertimeHistoryRow {
  record_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  designation: string;
  branch_id: string;
  branch_name: string;
  date: string;
  day_name: string;
  check_in_time: string;
  check_out_time: string;
  duty_hours: number;
  logged_overtime_minutes: number;
  approved_overtime_minutes: number;
  overtime_approval_status: 'auto' | 'pending' | 'approved' | 'rejected';
  overtime_approval_note?: string;
  is_holiday_duty: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const { searchParams } = new URL(request.url);

    const startDateParam = searchParams.get('start_date');
    const endDateParam = searchParams.get('end_date');
    const branchIdParam = searchParams.get('branch_id');
    const employeeIdParam = searchParams.get('employee_id');
    const statusParam = searchParams.get('status');
    const exportFormat = searchParams.get('export'); // 'csv' | 'excel' | 'pdf' | null

    const supabase = await createClient();

    // Scope branch for branch_manager
    let targetBranchId = branchIdParam || undefined;
    if (user.role === 'branch_manager') {
      if (!user.branch_id) {
        throw new Error('FORBIDDEN: Branch Manager has no assigned branch.');
      }
      targetBranchId = user.branch_id;
    }

    // Default dates: current month if not provided
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    const startDate = startDateParam || firstDayOfMonth;
    const endDate = endDateParam || today;

    // Query attendance records where overtime_minutes > 0 or approved_overtime_minutes > 0
    let query = supabase
      .from('attendance_records')
      .select(`
        id,
        employee_id,
        branch_id,
        date,
        check_in,
        check_out,
        duty_hours,
        overtime_minutes,
        approved_overtime_minutes,
        overtime_approval_status,
        overtime_approval_note,
        is_holiday_duty,
        profiles:employee_id (
          full_name,
          employee_id,
          designation,
          branch_id
        ),
        branches:branch_id (
          name
        )
      `)
      .gte('date', startDate)
      .lte('date', endDate)
      .or('overtime_minutes.gt.0,approved_overtime_minutes.gt.0')
      .order('date', { ascending: false });

    if (targetBranchId && targetBranchId !== 'all') {
      query = query.eq('branch_id', targetBranchId);
    }

    if (employeeIdParam && employeeIdParam !== 'all') {
      query = query.eq('employee_id', employeeIdParam);
    }

    if (statusParam && statusParam !== 'all') {
      query = query.eq('overtime_approval_status', statusParam);
    }

    const { data: records, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch overtime records: ${error.message}`);
    }

    // Fetch branch settings for OT rates
    const { data: branchSettingsData } = await supabase
      .from('branch_settings')
      .select('branch_id, overtime_rate_per_hour');
      
    const branchRates = new Map<string, number>();
    if (branchSettingsData) {
      branchSettingsData.forEach(bs => {
        branchRates.set(bs.branch_id, Number(bs.overtime_rate_per_hour || 100));
      });
    }

    const rows: OvertimeHistoryRow[] = (records || []).map((rec: any) => {
      const prof = rec.profiles || {};
      const br = rec.branches || {};
      
      // Parse day name
      const dateObj = new Date(rec.date);
      const dayName = isNaN(dateObj.getTime()) 
        ? '' 
        : dateObj.toLocaleDateString('en-US', { weekday: 'long' });

      // Format times to 12-hr format if full timestamp
      const formatTime = (ts?: string) => {
        if (!ts) return '-';
        const d = new Date(ts);
        if (isNaN(d.getTime())) return ts;
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      };

      const loggedOt = rec.overtime_minutes || 0;
      const approvedOt = rec.approved_overtime_minutes !== null && rec.approved_overtime_minutes !== undefined
        ? rec.approved_overtime_minutes
        : (rec.overtime_approval_status === 'rejected' ? 0 : loggedOt);

      return {
        record_id: rec.id,
        employee_id: rec.employee_id,
        employee_name: prof.full_name || 'Unknown Staff',
        employee_code: prof.employee_id || rec.employee_id.slice(0, 8),
        designation: prof.designation || 'Staff',
        branch_id: rec.branch_id,
        branch_name: br.name || 'Branch',
        date: rec.date,
        day_name: dayName,
        check_in_time: formatTime(rec.check_in),
        check_out_time: formatTime(rec.check_out),
        duty_hours: Number(rec.duty_hours || 0),
        logged_overtime_minutes: loggedOt,
        approved_overtime_minutes: approvedOt,
        overtime_approval_status: rec.overtime_approval_status || 'auto',
        overtime_approval_note: rec.overtime_approval_note || undefined,
        is_holiday_duty: !!rec.is_holiday_duty,
      };
    });

    // If export is requested, generate file and return binary blob directly
    if (exportFormat === 'csv' || exportFormat === 'excel' || exportFormat === 'pdf') {
      const reportTitle = `Overtime_History_Report_${startDate}_to_${endDate}`;
      let fileBuffer: Buffer;
      let fileName: string;
      let contentType: string;

      const exportRows = rows.map((r) => {
        const rate = branchRates.get(r.branch_id) || 100;
        const hrs = r.approved_overtime_minutes / 60;
        const multiplier = r.is_holiday_duty ? 2.0 : 1.0;
        const estPay = Math.round(hrs * rate * multiplier);

        return {
          'Date': r.date,
          'Day': r.day_name,
          'Employee ID': r.employee_code,
          'Employee Name': r.employee_name,
          'Designation': r.designation,
          'Branch': r.branch_name,
          'Check In': r.check_in_time,
          'Check Out': r.check_out_time,
          'Duty Hours': r.duty_hours,
          'Logged OT (Mins)': r.logged_overtime_minutes,
          'Logged OT (Hrs)': Number((r.logged_overtime_minutes / 60).toFixed(2)),
          'Approved OT (Mins)': r.approved_overtime_minutes,
          'Approved OT (Hrs)': Number((r.approved_overtime_minutes / 60).toFixed(2)),
          'Holiday Duty': r.is_holiday_duty ? 'YES (2.0x)' : 'Standard',
          'Est. OT Pay (BDT)': estPay,
          'Status': r.overtime_approval_status.toUpperCase(),
          'Reviewer Note': r.overtime_approval_note || '',
        };
      });

      if (exportFormat === 'csv') {
        const columns = Object.keys(exportRows[0] || {});
        const csvHeader = columns.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
        const csvBody = exportRows.map(row => columns.map((c) => {
          let val = String((row as any)[c] ?? '');
          if (/^[=+\-@]/.test(val)) val = "'" + val;
          return `"${val.replace(/"/g, '""')}"`;
        }).join(','));
        const csvContent = [csvHeader, ...csvBody].join('\r\n');
        fileBuffer = Buffer.from('\uFEFF' + csvContent, 'utf-8');
        fileName = `${reportTitle}.csv`;
        contentType = 'text/csv; charset=utf-8';
      } else if (exportFormat === 'excel') {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Overtime History');
        if (exportRows.length > 0) {
          const keys = Object.keys(exportRows[0]);
          worksheet.columns = keys.map(key => ({ header: key, key, width: 18 }));
          exportRows.forEach(row => worksheet.addRow(row));
        }
        const excelBuffer = await workbook.xlsx.writeBuffer();
        fileBuffer = Buffer.from(excelBuffer);
        fileName = `${reportTitle}.xlsx`;
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else {
        // PDF format
        const columns = [
          'Date', 'Day', 'Emp ID', 'Employee Name', 'Branch',
          'In - Out', 'Duty Hrs', 'Logged OT', 'Approved OT', 'Holiday', 'Est. Pay', 'Status'
        ];
        
        let totalEstPay = 0;
        let totalLoggedMins = 0;
        let totalApprovedMins = 0;

        const pdfRows = rows.map(r => {
          const rate = branchRates.get(r.branch_id) || 100;
          const hrs = r.approved_overtime_minutes / 60;
          const multiplier = r.is_holiday_duty ? 2.0 : 1.0;
          const estPay = Math.round(hrs * rate * multiplier);

          totalEstPay += estPay;
          totalLoggedMins += r.logged_overtime_minutes;
          totalApprovedMins += r.approved_overtime_minutes;

          return [
            r.date,
            r.day_name.slice(0, 3),
            r.employee_code,
            r.employee_name,
            r.branch_name,
            `${r.check_in_time} - ${r.check_out_time}`,
            `${r.duty_hours}h`,
            `${Number((r.logged_overtime_minutes / 60).toFixed(2))}h`,
            `${Number((r.approved_overtime_minutes / 60).toFixed(2))}h`,
            r.is_holiday_duty ? '2.0x (Holiday)' : 'No',
            `BDT ${estPay.toLocaleString()}`,
            r.overtime_approval_status.toUpperCase(),
          ];
        });

        fileBuffer = generateAnchorFashionPDF({
          reportTitle: 'OVERTIME HISTORY',
          reportSubtitle: 'Statement',
          metaRef: `OTH-${Math.floor(Math.random() * 100000000)}`,
          metaBranch: targetBranchId ? (rows[0]?.branch_name || 'Specific Branch') : 'All Branches',
          metaPeriod: `${startDate} to ${endDate}`,
          metaPreparedBy: user.full_name,
          metaRecordsCount: rows.length,
          tableTitle: 'Overtime Analytics & Estimation',
          columns,
          rows: pdfRows,
          totalAmountText: `${totalEstPay.toLocaleString()} BDT`
        });

        fileName = `${reportTitle}.pdf`;
        contentType = 'application/pdf';
      }

      return new NextResponse(new Uint8Array(fileBuffer), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Cache-Control': 'no-cache',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
