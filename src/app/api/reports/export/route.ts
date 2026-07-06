import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
const exportSchema = z.object({
  format: z.enum(['pdf', 'excel']),
  branch_id: z.string().uuid().optional(),
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Enforce Role: Admin and Branch Managers can export payroll spreadsheets
    const user = await requireRole(['admin', 'branch_manager']);
    const body = await request.json();
    const payload = exportSchema.parse(body);

    // Branch Manager can ONLY export their own branch
    const targetBranchId = user.role === 'branch_manager' ? user.branch_id : payload.branch_id;
    if (user.role === 'branch_manager' && !targetBranchId) {
      throw new Error('FORBIDDEN: Branch Manager has no assigned store.');
    }

    const supabase = await createClient();

    // 2. Fetch Data to Export (from RPC or attendance records)
    let exportData: Array<Record<string, unknown>> = [];
    let reportTitle = 'Company_Wide_Attendance';

    if (targetBranchId) {
      const { data: branch } = await supabase.from('branches').select('name').eq('id', targetBranchId).single();
      reportTitle = `${branch?.name || 'Branch'}_Attendance_${payload.year}_${payload.month}`;

      const { data: summary } = await supabase.rpc('get_branch_monthly_summary', {
        p_branch_id: targetBranchId,
        p_month: payload.month,
        p_year: payload.year,
      });

      exportData = (summary || []).map((row: Record<string, unknown>) => ({
        'Employee ID': row.employee_id,
        'Full Name': row.full_name,
        'Total Present': row.total_present,
        'Total Late': row.total_late,
        'Half Days': row.total_half_day,
        'Overtime (Minutes)': row.total_overtime_minutes,
        'Overtime (Hours)': Number(((row.total_overtime_minutes as number || 0) / 60).toFixed(2)),
      }));
    } else {
      const { data: summary } = await supabase.rpc('get_company_wide_summary', {
        p_month: payload.month,
        p_year: payload.year,
      });

      exportData = (summary || []).map((row: Record<string, unknown>) => ({
        'Branch ID': row.branch_id,
        'Store Name': row.branch_name,
        'Staff Count': row.employee_count,
        'Total Check-ins': row.total_checkins,
        'Late Check-ins': row.total_late_checkins,
        'Attendance Rate (%)': row.attendance_rate_percent,
        'Total Overtime (Hours)': row.total_overtime_hours,
      }));
    }

    if (exportData.length === 0) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'NO_DATA', message: 'No attendance records found for this period.' } },
        { status: 404 }
      );
    }

    // 3. Generate Buffer based on requested format
    let fileBuffer: Buffer;
    let fileName: string;
    let contentType: string;

    if (payload.format === 'excel') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Report');
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      fileBuffer = Buffer.from(excelBuffer);
      fileName = `exports/${reportTitle}.xlsx`;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else {
      // PDF Format using jsPDF and autotable
      const doc = new jsPDF('landscape');
      
      // Theme colors
      const primaryColor: [number, number, number] = [6, 18, 36]; // #061224
      const accentColor: [number, number, number] = [210, 160, 42]; // #D2A02A

      doc.setFontSize(18);
      doc.setTextColor(...primaryColor);
      doc.text('Anchor Fashion Management', 14, 22);
      
      doc.setFontSize(12);
      doc.setTextColor(...accentColor);
      doc.text(`Monthly Attendance Report - ${payload.month}/${payload.year}`, 14, 30);
      
      const columns = Object.keys(exportData[0] || {});
      const rows = exportData.map(row => columns.map(col => String(row[col] ?? '')));

      // @ts-ignore - jspdf-autotable adds autoTable to jsPDF instance
      doc.autoTable({
        head: [columns],
        body: rows,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: accentColor },
        alternateRowStyles: { fillColor: [240, 244, 248] }, // Light slate
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 4 }
      });

      fileBuffer = Buffer.from(doc.output('arraybuffer'));
      fileName = `exports/${reportTitle}.pdf`;
      contentType = 'application/pdf';
    }

    // 4. Upload to Supabase Storage in 'reports' bucket (Spec P20)
    const { error: uploadErr } = await supabase.storage
      .from('reports')
      .upload(fileName, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadErr) {
      // If bucket doesn't exist or RLS fails, return base64 / data directly
      return NextResponse.json({
        success: true,
        data: {
          file_name: fileName.replace('exports/', ''),
          format: payload.format,
          content_base64: fileBuffer.toString('base64'),
          message: 'Report generated successfully (returned inline due to storage bucket setup).',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 5. Generate 1-hour Signed Download URL (Spec P20)
    const { data: signedUrlData, error: signErr } = await supabase.storage
      .from('reports')
      .createSignedUrl(fileName, 3600); // 1 hour validity

    if (signErr || !signedUrlData) {
      throw new Error(`Failed to generate signed URL: ${signErr?.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        signed_url: signedUrlData.signedUrl,
        expires_in_seconds: 3600,
        file_name: fileName.replace('exports/', ''),
        format: payload.format,
      },
      message: `Report exported successfully as ${payload.format.toUpperCase()}. Signed URL valid for 60 minutes.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
