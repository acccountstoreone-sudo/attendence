import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError, AuthUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { computeEmployeeDutySummary } from '@/lib/dutyEngine';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { generateAnchorFashionPDF, generateDetailedCompanyPDF } from '@/lib/pdf-generator';

const exportSchema = z.object({
  format: z.enum(['pdf', 'excel', 'csv']).default('excel'),
  type: z.string().optional(),
  branch_id: z.string().uuid().optional(),
  employee_id: z.string().uuid().optional(),
  month: z.number().min(1).max(12).optional().default(() => new Date().getMonth() + 1),
  year: z.number().min(2020).max(2100).optional().default(() => new Date().getFullYear()),
  direct_download: z.boolean().optional(),
});

function formatMins(totalMins: number): string {
  if (!totalMins) return '0m';
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatDecimalHours(decimalHours: unknown): string {
  if (!decimalHours) return '0h';
  const val = Number(decimalHours);
  if (isNaN(val) || val === 0) return '0h';
  const totalMins = Math.round(val * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

async function processExport(payload: z.infer<typeof exportSchema>, user: AuthUser) {
  const targetBranchId = user.role === 'branch_manager' ? user.branch_id : payload.branch_id;
  if (user.role === 'branch_manager' && !targetBranchId && !payload.employee_id) {
    throw new Error('FORBIDDEN: Branch Manager has no assigned store.');
  }

  const supabase = await createClient();

  let exportData: Array<Record<string, unknown>> = [];
  let reportTitle = 'Attendance_Report';
  let branchDisplayName = 'All Branches';

  // Option A: Specific Employee Detailed Daily Duty Breakdown Export
  if (payload.employee_id) {
    if (user.role === 'branch_manager') {
      const { data: targetProf } = await supabase.from('profiles').select('branch_id').eq('id', payload.employee_id).single();
      if (!targetProf || targetProf.branch_id !== user.branch_id) {
        throw new Error('FORBIDDEN: Employee does not belong to your assigned branch.');
      }
    } else if (user.role === 'employee' && user.id !== payload.employee_id) {
      throw new Error('FORBIDDEN: You can only export your own attendance report.');
    }

    const dutySummary = await computeEmployeeDutySummary(supabase, payload.employee_id, payload.month, payload.year);
    const empName = dutySummary.employee.full_name.replace(/\s+/g, '_');
    branchDisplayName = dutySummary.employee.branch_name || 'Assigned Branch';
    reportTitle = `${empName}_Duty_Report_${payload.year}_${payload.month}`;

    exportData = dutySummary.daily_breakdown.map((row) => ({
      Date: row.date,
      Day: row.day_name,
      Status: row.status.toUpperCase(),
      'Check In': row.check_in_time,
      'Check Out': row.check_out_time,
      'Duty Hours': formatDecimalHours(row.duty_hours),
      'Late': formatMins(row.late_minutes),
      'Overtime': formatMins(row.overtime_minutes),
      Notes: row.notes,
    }));
  } 
  // Option B: Branch-Wide Employees Monthly Summary Export
  else if (targetBranchId) {
    const { data: branch } = await supabase.from('branches').select('name').eq('id', targetBranchId).single();
    const bName = (branch?.name || 'Store').replace(/\s+/g, '_');
    branchDisplayName = branch?.name || 'Store';
    reportTitle = `${bName}_Attendance_Summary_${payload.year}_${payload.month}`;

    // Use dutyEngine to accurately calculate each employee's summary for the branch export
    const { data: branchEmployees } = await supabase.from('profiles').select('id, full_name, employee_id, role, is_active').eq('branch_id', targetBranchId).eq('is_active', true);
    if (branchEmployees && branchEmployees.length > 0) {
        for (const emp of branchEmployees) {
          try {
            const ds = await computeEmployeeDutySummary(supabase, emp.id, payload.month, payload.year);
            exportData.push({
              'Employee ID': emp.employee_id || emp.id.slice(0, 8),
              'Full Name': emp.full_name,
              'Working Days': ds.summary.total_working_days,
              'Present Days': ds.summary.total_present_days,
              'Late Days': ds.summary.total_late_days,
              'Half Days': ds.summary.total_half_days,
              'Missed Days': ds.summary.total_missed_days,
              'Leave Days': ds.summary.total_on_leave_days,
              'Duty Hours': formatDecimalHours(ds.summary.total_duty_hours),
              'Overtime': formatMins(ds.summary.total_overtime_minutes),
              '_rawLateDays': ds.summary.total_late_days,
              '_rawOTMins': ds.summary.total_overtime_minutes,
            });
          } catch {
            // skip employee error
          }
        }
    }

    if (payload.type === 'late_arrivals') {
      reportTitle = `${bName}_Late_Arrivals_Summary_${payload.year}_${payload.month}`;
      exportData = exportData.filter(row => Number(row['_rawLateDays'] || 0) > 0);
    } else if (payload.type === 'overtime') {
      reportTitle = `${bName}_Overtime_Summary_${payload.year}_${payload.month}`;
      exportData = exportData.filter(row => Number(row['_rawOTMins'] || 0) > 0);
    }
    
    // Clean up internal keys
    exportData.forEach(row => {
      delete row['_rawLateDays'];
      delete row['_rawOTMins'];
    });
  } 
  // Option C: Company-Wide All Branches Summary Export (Admin Only)
  else {
    reportTitle = `Company_Wide_Attendance_Summary_${payload.year}_${payload.month}`;
    const { data: summary, error: rpcErr } = await supabase.rpc('get_company_wide_summary', {
      p_month: payload.month,
      p_year: payload.year,
    });

    if (!rpcErr && summary && summary.length > 0) {
      exportData = summary.map((row: Record<string, unknown>) => ({
        'Branch ID': row.branch_id,
        'Store Name': row.branch_name,
        'Staff Count': row.employee_count,
        'Total Check-ins': row.total_checkins,
        'Late Check-ins': row.total_late_checkins,
        'Attendance Rate (%)': row.attendance_rate_percent,
        'Total Overtime': formatMins(Math.round(Number(row.total_overtime_hours || 0) * 60)),
      }));
    } else {
      // Fallback across branches
      const { data: allBranches } = await supabase.from('branches').select('id, name, code');
      if (allBranches) {
        for (const b of allBranches) {
          const { data: branchEmps } = await supabase.from('profiles').select('id').eq('branch_id', b.id);
          exportData.push({
            'Store Code': b.code || 'BR',
            'Store Name': b.name,
            'Staff Count': branchEmps?.length || 0,
            'Month/Year': `${payload.month}/${payload.year}`,
            'Status': 'Summary Compiled',
          });
        }
      }
    }
  }

  // Allow exporting empty reports so the user gets a valid document (e.g., 0 overtimes) instead of an error.
  // if (exportData.length === 0) {
  //   return NextResponse.json(
  //     { success: false, data: null, error: { code: 'NO_DATA', message: 'No attendance records found for this period.' } },
  //     { status: 404 }
  //   );
  // }

  // Generate File Buffer based on format
  let fileBuffer: Buffer;
  let fileName: string;
  let contentType: string;

  if (payload.format === 'csv') {
    const columnsSet = new Set<string>();
    exportData.forEach(row => Object.keys(row || {}).forEach(k => columnsSet.add(k)));
    const columns = Array.from(columnsSet);
    const csvHeader = columns.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
    const csvRows = exportData.map(row => columns.map(c => {
      let val = String(row[c] ?? '');
      if (/^[=+\-@]/.test(val)) val = "'" + val;
      return `"${val.replace(/"/g, '""')}"`;
    }).join(','));
    const csvContent = [csvHeader, ...csvRows].join('\r\n');
    fileBuffer = Buffer.from('\uFEFF' + csvContent, 'utf-8');
    fileName = `${reportTitle}.csv`;
    contentType = 'text/csv; charset=utf-8';
  } else if (payload.format === 'excel') {
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Report');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    fileBuffer = Buffer.from(excelBuffer);
    fileName = `${reportTitle}.xlsx`;
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else {
    // PDF Format using new generator
    const columnsSet = new Set<string>();
    exportData.forEach(row => Object.keys(row || {}).forEach(k => columnsSet.add(k)));
    let columns = Array.from(columnsSet);
    
    // If no records, provide default columns to avoid autoTable crash
    if (columns.length === 0) {
      columns = ['Employee ID', 'Full Name', 'Working Days', 'Present Days', 'Late Days', 'Half Days', 'Missed Days', 'Leave Days', 'Duty Hours', 'Overtime (Mins)', 'Overtime (Hrs)'];
    }
    const rows = exportData.map(row => columns.map(col => String(row[col] ?? '')));

    if (!targetBranchId && !payload.employee_id) {
      // It's the admin detailed export for the whole company
      const companyColumns = Array.from(columnsSet);
      const companyRows = exportData.map(row => companyColumns.map(col => String(row[col] ?? '')));
      
      const { data: allBranches } = await supabase.from('branches').select('id, name').order('name');
      const branchesData = [];
      let totalRecords = companyRows.length;
      
      if (allBranches) {
        for (const b of allBranches) {
          const { data: bSummary } = await supabase.rpc('get_branch_monthly_summary', {
            p_branch_id: b.id,
            p_month: payload.month,
            p_year: payload.year,
          });

          const branchSummaryCols = ['Employee ID', 'Name', 'Working Days', 'Present', 'Late', 'Missed', 'Duty Hrs', 'Overtime'];
          let branchSummaryRows = [];
          if (bSummary && bSummary.length > 0) {
            branchSummaryRows = bSummary.map((r: any) => [
              r.employee_id || 'ID',
              r.full_name || 'Name',
              String(r.total_working_days || 0),
              String(r.total_present || 0),
              String(r.total_late || 0),
              String(r.total_absent || 0),
              formatDecimalHours(r.total_duty_hours || 0),
              formatMins(r.total_overtime_minutes || 0)
            ]);
          }

          const employeesData = [];
          const { data: branchEmployees } = await supabase.from('profiles').select('id, full_name, employee_id, role').eq('branch_id', b.id);
          if (branchEmployees) {
            for (const emp of branchEmployees) {
              try {
                const ds = await computeEmployeeDutySummary(supabase, emp.id, payload.month, payload.year);
                const dailyCols = ['Date', 'Day', 'Status', 'Check In', 'Check Out', 'Duty Hrs', 'Late', 'Overtime', 'Biometrics'];
                const dailyRows = ds.daily_breakdown.map(d => [
                  d.date,
                  d.day_name.substring(0,3),
                  d.status.toUpperCase() + (!d.is_right_time ? ' (Mismatch)' : ''),
                  d.check_in_time,
                  d.check_out_time,
                  formatDecimalHours(d.duty_hours),
                  formatMins(d.late_minutes),
                  formatMins(d.overtime_minutes),
                  d.face_verified ? 'Yes' : (d.status === 'absent' || d.status === 'on_leave' ? '-' : 'No')
                ]);

                const punctuality = ds.summary.total_working_days > 0 
                  ? Math.round(((ds.summary.total_working_days - ds.summary.total_late_days - ds.summary.total_missed_days) / ds.summary.total_working_days) * 100)
                  : 0;

                employeesData.push({
                  employeeName: emp.full_name,
                  employeeId: emp.employee_id || `ID-${emp.id.substring(0,4).toUpperCase()}`,
                  role: emp.role || 'Staff',
                  summaryData: {
                    working: ds.summary.total_working_days,
                    present: ds.summary.total_present_days,
                    late: ds.summary.total_late_days,
                    dutyHrs: ds.summary.total_duty_hours,
                    otHrs: ds.summary.total_overtime_hours,
                    punctuality: punctuality,
                    payable: ds.summary.estimated_payable_salary || 0,
                    otPay: ds.summary.total_overtime_pay || 0
                  },
                  dailyColumns: dailyCols,
                  dailyRows: dailyRows
                });
                totalRecords += 1 + dailyRows.length;
              } catch (e) {
                // skip
              }
            }
          }

            let branchTotalOT = 0;
            let branchTotalPresent = 0;
            let branchTotalWorking = 0;
            employeesData.forEach(e => {
              branchTotalOT += e.summaryData.otHrs;
              branchTotalPresent += e.summaryData.present;
              branchTotalWorking += e.summaryData.working;
            });
            const branchAttRate = branchTotalWorking > 0 ? Math.round((branchTotalPresent / branchTotalWorking) * 100) : 0;

            branchesData.push({
              branchName: b.name,
              branchMetrics: `Staff: ${employeesData.length} | Attendance: ${branchAttRate}% | Total OT: ${branchTotalOT.toFixed(1)}h`,
              branchSummaryColumns: branchSummaryCols,
              branchSummaryRows: branchSummaryRows,
              employees: employeesData
            });
          }
        }

      fileBuffer = generateDetailedCompanyPDF({
        reportTitle: 'DETAILED COMPANY-WIDE SUMMARY',
        reportSubtitle: 'Statement',
        metaRef: `REP-${Math.floor(Math.random() * 100000000)}`,
        metaPeriod: `${payload.month}/${payload.year}`,
        metaPreparedBy: user.full_name,
        metaRecordsCount: totalRecords,
        companySummaryColumns: companyColumns,
        companySummaryRows: companyRows,
        branches: branchesData
      });
    } else {
      let cleanTitle = 'ATTENDANCE REPORT';
      if (reportTitle.includes('Late_Arrivals_Summary')) cleanTitle = 'LATE ARRIVALS REPORT';
      else if (reportTitle.includes('Overtime_Summary')) cleanTitle = 'OVERTIME ANALYTICS REPORT';
      else if (reportTitle.includes('Summary')) cleanTitle = 'MONTHLY ATTENDANCE REPORT';
      else if (reportTitle.includes('Duty_Report')) cleanTitle = 'DUTY REPORT';

      fileBuffer = generateAnchorFashionPDF({
        reportTitle: cleanTitle,
        reportSubtitle: 'Statement',
        metaRef: `REP-${Math.floor(Math.random() * 100000000)}`,
        metaBranch: branchDisplayName,
        metaPeriod: `${payload.month}/${payload.year}`,
        metaPreparedBy: user.full_name,
        metaRecordsCount: rows.length,
        tableTitle: 'Attendance Records & Summary',
        columns,
        rows
      });
    }

    fileName = `${reportTitle}.pdf`;
    contentType = 'application/pdf';
  }

  // If direct_download is requested (e.g. GET /api/reports/export from UI), return raw binary directly
  if (payload.direct_download) {
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache',
      },
    });
  }

  // Otherwise, upload to Storage and return JSON metadata / signed URL
  const uploadName = `exports/${fileName}`;
  const { error: uploadErr } = await supabase.storage
    .from('reports')
    .upload(uploadName, fileBuffer, {
      contentType,
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json({
      success: true,
      data: {
        file_name: fileName,
        format: payload.format,
        content_base64: fileBuffer.toString('base64'),
        message: 'Report generated successfully (returned inline due to storage bucket).',
      },
      timestamp: new Date().toISOString(),
    });
  }

  const { data: signedUrlData, error: signErr } = await supabase.storage
    .from('reports')
    .createSignedUrl(uploadName, 3600);

  if (signErr || !signedUrlData) {
    throw new Error(`Failed to generate signed URL: ${signErr?.message}`);
  }

  return NextResponse.json({
    success: true,
    data: {
      signed_url: signedUrlData.signedUrl,
      expires_in_seconds: 3600,
      file_name: fileName,
      format: payload.format,
    },
    message: `Report exported successfully as ${payload.format.toUpperCase()}. Signed URL valid for 60 minutes.`,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager', 'employee']);
    const body = await request.json();
    const payload = exportSchema.parse(body);
    return await processExport(payload, user);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager', 'employee']);
    const { searchParams } = new URL(request.url);
    
    const monthParam = parseInt(searchParams.get('month') || '0', 10);
    const yearParam = parseInt(searchParams.get('year') || '0', 10);

    const payload = exportSchema.parse({
      format: (searchParams.get('format') as any) || 'excel',
      type: searchParams.get('type') || undefined,
      branch_id: searchParams.get('branch_id') || undefined,
      employee_id: searchParams.get('employee_id') || undefined,
      month: monthParam >= 1 && monthParam <= 12 ? monthParam : new Date().getMonth() + 1,
      year: yearParam >= 2020 ? yearParam : new Date().getFullYear(),
      direct_download: true, // GET requests return raw binary blob for clean browser downloads
    });

    return await processExport(payload, user);
  } catch (error) {
    return handleApiError(error);
  }
}

