import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { generateAnchorFashionPDF } from '@/lib/pdf-generator';

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const body = await request.json();
    
    const { 
      activeTab, 
      selectedDate, 
      columns, 
      rows, 
      reportTitle = 'LIVE ATTENDANCE REPORT' 
    } = body;

    const periodText = selectedDate && selectedDate !== 'all' ? selectedDate : 'Recent / All Dates';
    const tabName = activeTab ? String(activeTab).toUpperCase() : 'RECORDS';

    const pdfBuffer = generateAnchorFashionPDF({
      reportTitle: reportTitle,
      reportSubtitle: `${tabName} RECORDS`,
      metaRef: `ATT-${new Date().getTime().toString().slice(-6)}`,
      metaBranch: user.role === 'branch_manager' ? 'Assigned Branch' : 'HQ Master Grid',
      metaPeriod: periodText,
      metaPreparedBy: user.full_name || 'System Administrator',
      metaRecordsCount: rows.length,
      columns: columns || ['Employee', 'Branch / Store', 'Check-In', 'Check-Out', 'Status', 'Approval', 'Overtime'],
      rows: rows || []
    });

    const fileName = `Attendance_Export_${activeTab || 'export'}_${selectedDate || 'Recent'}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
