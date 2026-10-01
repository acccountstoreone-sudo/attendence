import { NextRequest, NextResponse } from 'next/server';
import { generateAnchorFashionPDF, PDFExportOptions } from '@/lib/pdf-generator';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload: PDFExportOptions & { filename?: string } = await req.json();

    const pdfBuffer = generateAnchorFashionPDF(payload);

    const filename = payload.filename || 'export.pdf';

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error('PDF generation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
