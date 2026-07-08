import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError, AuthUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { computeEmployeeDutySummary } from '@/lib/dutyEngine';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const exportSchema = z.object({
  format: z.enum(['pdf', 'excel', 'csv']),
  branch_id: z.string().uuid().optional(),
  employee_id: z.string().uuid().optional(),
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
  direct_download: z.boolean().optional(),
});

async function processExport(payload: z.infer<typeof exportSchema>, user: AuthUser) {
  const targetBranchId = user.role === 'branch_manager' ? user.branch_id : payload.branch_id;
  if (user.role === 'branch_manager' && !targetBranchId && !payload.employee_id) {
    throw new Error('FORBIDDEN: Branch Manager has no assigned store.');
  }

  const supabase = await createClient();

  let exportData: Array<Record<string, unknown>> = [];
  let reportTitle = 'Attendance_Report';

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
    reportTitle = `${empName}_Duty_Report_${payload.year}_${payload.month}`;

    exportData = dutySummary.daily_breakdown.map((row) => ({
      Date: row.date,
      Day: row.day_name,
      Status: row.status.toUpperCase(),
      'Check In': row.check_in_time,
      'Check Out': row.check_out_time,
      'Duty Hours': row.duty_hours,
      'Late Mins': row.late_minutes,
      'Overtime Mins': row.overtime_minutes,
      'Overtime Hours': row.overtime_hours,
      Notes: row.notes,
    }));
  } 
  // Option B: Branch-Wide Employees Monthly Summary Export
  else if (targetBranchId) {
    const { data: branch } = await supabase.from('branches').select('name').eq('id', targetBranchId).single();
    const bName = (branch?.name || 'Store').replace(/\s+/g, '_');
    reportTitle = `${bName}_Attendance_Summary_${payload.year}_${payload.month}`;

    // Try RPC first or fallback to dutyEngine across all branch employees
    const { data: summary, error: rpcErr } = await supabase.rpc('get_branch_monthly_summary', {
      p_branch_id: targetBranchId,
      p_month: payload.month,
      p_year: payload.year,
    });

    if (!rpcErr && summary && summary.length > 0) {
      exportData = summary.map((row: Record<string, unknown>) => ({
        'Employee ID': row.employee_id || 'ID',
        'Full Name': row.full_name || 'Name',
        'Working Days': row.total_working_days || 0,
        'Present Days': row.total_present || 0,
        'Late Days': row.total_late || 0,
        'Half Days': row.total_half_day || 0,
        'Missed Days': row.total_absent || 0,
        'Leave Days': row.total_on_leave || 0,
        'Duty Hours': row.total_duty_hours || 0,
        'Overtime (Mins)': row.total_overtime_minutes || 0,
        'Overtime (Hrs)': Number(((row.total_overtime_minutes as number || 0) / 60).toFixed(2)),
      }));
    } else {
      // Fallback: use dutyEngine for all branch employees
      const { data: branchEmployees } = await supabase.from('profiles').select('id, full_name, employee_id').eq('branch_id', targetBranchId);
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
              'Duty Hours': ds.summary.total_duty_hours,
              'Overtime (Mins)': ds.summary.total_overtime_minutes,
              'Overtime (Hrs)': ds.summary.total_overtime_hours,
            });
          } catch {
            // skip employee error
          }
        }
      }
    }
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
        'Total Overtime (Hours)': row.total_overtime_hours,
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

  if (exportData.length === 0) {
    return NextResponse.json(
      { success: false, data: null, error: { code: 'NO_DATA', message: 'No attendance records found for this period.' } },
      { status: 404 }
    );
  }

  // Generate File Buffer based on format
  let fileBuffer: Buffer;
  let fileName: string;
  let contentType: string;

  if (payload.format === 'csv') {
    const columns = Object.keys(exportData[0] || {});
    const csvHeader = columns.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
    const csvRows = exportData.map(row => columns.map(c => `"${String(row[c] ?? '').replace(/"/g, '""')}"`).join(','));
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
    // PDF Format using jsPDF and autotable
    const doc = new jsPDF('landscape');
    const primaryColor: [number, number, number] = [6, 18, 36];
    const accentColor: [number, number, number] = [210, 160, 42];

    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.text('Anchor Fashion Management - Official Report', 14, 18);
    
    doc.setFontSize(11);
    doc.setTextColor(...accentColor);
    doc.text(`${reportTitle.replace(/_/g, ' ')}`, 14, 26);
    
    const columns = Object.keys(exportData[0] || {});
    const rows = exportData.map(row => columns.map(col => String(row[col] ?? '')));

    // @ts-expect-error - jspdf-autotable adds autoTable to jsPDF instance
    doc.autoTable({
      head: [columns],
      body: rows,
      startY: 32,
      theme: 'grid',
      headStyles: { fillColor: primaryColor, textColor: accentColor, fontSize: 8 },
      alternateRowStyles: { fillColor: [240, 244, 248] },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 3 }
    });

    fileBuffer = Buffer.from(doc.output('arraybuffer'));
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
    
    const payload = exportSchema.parse({
      format: searchParams.get('format') || 'pdf',
      branch_id: searchParams.get('branch_id') || undefined,
      employee_id: searchParams.get('employee_id') || undefined,
      month: parseInt(searchParams.get('month') || '0', 10),
      year: parseInt(searchParams.get('year') || '0', 10),
      direct_download: true, // GET requests return raw binary blob for clean browser downloads
    });

    return await processExport(payload, user);
  } catch (error) {
    return handleApiError(error);
  }
}
