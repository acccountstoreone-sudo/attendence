import jsPDF from 'jspdf';
import 'jspdf-autotable';
import fs from 'fs';
import path from 'path';

export interface PDFExportOptions {
  reportTitle: string; // e.g., 'EXPENSE REPORT', 'MONTHLY ATTENDANCE'
  reportSubtitle?: string; // e.g., 'Statement'
  metaRef: string; // e.g., 'EXP-39735740' or 'ATT-2026'
  metaBranch: string; // e.g., 'All Branches'
  metaPeriod: string; // e.g., 'June 2026'
  metaPreparedBy: string; // e.g., 'Operations Manager'
  metaRecordsCount: number; // e.g., 7
  tableTitle?: string; // e.g., 'Transaction details'
  columns: string[];
  rows: any[][];
  totalAmountText?: string; // e.g., '300,000.00 BDT'
}

export function generateAnchorFashionPDF(options: PDFExportOptions): Buffer {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth(); // 297
  const pageHeight = doc.internal.pageSize.getHeight(); // 210
  
  const primaryColor: [number, number, number] = [26, 54, 93]; // Dark Blue #1a365d
  const headerBgColor: [number, number, number] = [238, 242, 246]; // Light Blue-Gray #eef2f6
  const textColor: [number, number, number] = [51, 65, 85]; // Slate #334155
  const labelColor: [number, number, number] = [100, 116, 139]; // Gray #64748b
  const warningColor: [number, number, number] = [217, 119, 6]; // Amber #d97706

  const printDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Add Watermark to all pages
  const drawWatermark = () => {
    doc.setTextColor(240, 244, 248); // Very light greyish-blue
    doc.setFontSize(40);
    doc.setFont('helvetica', 'bold');
    for (let x = -100; x < pageWidth + 100; x += 120) {
      for (let y = -50; y < pageHeight + 100; y += 80) {
        doc.text('ANCHOR FASHION', x, y, { angle: -30 });
      }
    }
  };

  drawWatermark();

  // Load Logo Image if available
  let logoBase64 = null;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
      const bitmap = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${bitmap.toString('base64')}`;
    }
  } catch (err) {
    console.error('Failed to load logo.png', err);
  }

  // Header Section
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', 14, 12, 50, 15); // Adjust width/height as needed for aspect ratio
  } else {
    // Fallback if no logo image is found
    doc.setTextColor(...primaryColor);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('ANCHOR FASHION', 14, 22);
  }

  // Top Right Text
  doc.setTextColor(112, 128, 144); // Slate Gray
  doc.setFontSize(28);
  doc.setFont('helvetica', 'normal');
  doc.text(options.reportSubtitle || 'Statement', pageWidth - 14, 22, { align: 'right' });

  // Dark Blue Box under top right text
  doc.setFillColor(...primaryColor);
  doc.rect(pageWidth - 75, 26, 61, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(options.reportTitle.toUpperCase(), pageWidth - 44.5, 31.5, { align: 'center' });

  // Reset text color for metadata
  doc.setTextColor(...textColor);

  // Left Meta Info (Company Address)
  let currentY = 42;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ANCHOR FASHION', 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  currentY += 5;
  doc.text('Operations & Finance Department', 14, currentY);
  currentY += 5;
  doc.text('Dhaka, Bangladesh', 14, currentY);
  currentY += 5;
  doc.text('erp@anchorfashion.com', 14, currentY);

  // Middle Meta Info
  currentY = 42;
  doc.setFontSize(7);
  doc.setTextColor(...labelColor);
  doc.text('STATEMENT REF.', 115, currentY);
  currentY += 4;
  doc.setFontSize(9);
  doc.setTextColor(...textColor);
  doc.text(options.metaRef, 115, currentY);
  
  currentY += 6;
  doc.setFontSize(7);
  doc.setTextColor(...labelColor);
  doc.text('PERIOD / DATES', 115, currentY);
  currentY += 4;
  doc.setFontSize(9);
  doc.setTextColor(...textColor);
  doc.text(options.metaPeriod, 115, currentY);
  
  currentY += 6;
  doc.setFontSize(7);
  doc.setTextColor(...labelColor);
  doc.text('PREPARED BY', 115, currentY);
  currentY += 4;
  doc.setFontSize(9);
  doc.setTextColor(...textColor);
  doc.text(options.metaPreparedBy, 115, currentY);

  // Right Meta Info
  currentY = 42;
  doc.setFontSize(7);
  doc.setTextColor(...labelColor);
  doc.text('BRANCH / SCOPE', 180, currentY);
  currentY += 4;
  doc.setFontSize(9);
  doc.setTextColor(...textColor);
  doc.text(options.metaBranch, 180, currentY);
  
  currentY += 6;
  doc.setFontSize(7);
  doc.setTextColor(...labelColor);
  doc.text('PRINT DATE', 180, currentY);
  currentY += 4;
  doc.setFontSize(9);
  doc.setTextColor(...textColor);
  doc.text(printDate, 180, currentY);
  
  currentY += 6;
  doc.setFontSize(7);
  doc.setTextColor(...labelColor);
  doc.text('TOTAL RECORDS', 180, currentY);
  currentY += 4;
  doc.setFontSize(9);
  doc.setTextColor(...textColor);
  doc.text(`${options.metaRecordsCount} entries`, 180, currentY);

  // Table Title
  let tableY = 74;
  if (options.tableTitle) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(options.tableTitle, 14, tableY);
    tableY += 5;
  }

  // Draw Table
  let finalY = tableY;
  // @ts-expect-error - autotable plugin
  doc.autoTable({
    head: [options.columns],
    body: options.rows,
    startY: tableY,
    theme: 'plain',
    headStyles: { 
      fillColor: headerBgColor, 
      textColor: primaryColor,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: textColor,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    didDrawPage: (data: any) => {
      // Re-draw watermark on new pages if the table breaks onto multiple pages
      if (data.pageNumber > 1) {
        // Unfortunately, drawing the watermark after the table is drawn will overlay it, 
        // so we need a hook before the page starts, but jspdf-autotable handles pages automatically.
        // We will just draw the footer here.
        drawFooter(doc, data.pageNumber, printDate);
      }
    },
  });

  // @ts-expect-error - autotable finalY
  finalY = doc.lastAutoTable.finalY || tableY;

  // Add Total Amount Block if provided
  if (options.totalAmountText) {
    doc.setFillColor(238, 246, 255); // very light blue
    doc.rect(14, finalY + 5, pageWidth - 28, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.text('TOTAL AMOUNT:', 18, finalY + 11.5);
    doc.text(options.totalAmountText, pageWidth - 18, finalY + 11.5, { align: 'right' });
    finalY += 20;
  } else {
    finalY += 15;
  }

  // Ensure there's space for Notes & Signatures, else add a new page
  if (finalY > pageHeight - 80) {
    doc.addPage();
    drawWatermark();
    finalY = 20;
  }

  // Notes Box
  doc.setDrawColor(...warningColor);
  doc.setLineWidth(0.5);
  doc.rect(14, finalY, pageWidth - 28, 26, 'D');
  
  let noteY = finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.text('NOTES:', 18, noteY);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textColor);
  noteY += 6;
  doc.text('This document is system-generated by Anchor Fashion ERP System.', 18, noteY);
  noteY += 5;
  doc.text('For official use only. Unauthorized reproduction or modification is strictly prohibited.', 18, noteY);
  noteY += 5;
  doc.text('Please retain this statement for your official records and audit compliance.', 18, noteY);

  finalY += 45;

  // Signatures Area
  const signatureWidth = 50;
  const col1X = 30;
  const col2X = (pageWidth / 2) - (signatureWidth / 2);
  const col3X = pageWidth - 30 - signatureWidth;

  doc.setDrawColor(203, 213, 225); // slate-300
  
  // Prepared By
  doc.line(col1X, finalY, col1X + signatureWidth, finalY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Prepared By', col1X + (signatureWidth / 2), finalY + 5, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...labelColor);
  doc.text('Name & Designation', col1X + (signatureWidth / 2), finalY + 9, { align: 'center' });

  // Verified By
  doc.line(col2X, finalY, col2X + signatureWidth, finalY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text('Verified By', col2X + (signatureWidth / 2), finalY + 5, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...labelColor);
  doc.text('Name & Designation', col2X + (signatureWidth / 2), finalY + 9, { align: 'center' });

  // Authorized By
  doc.line(col3X, finalY, col3X + signatureWidth, finalY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text('Authorized By', col3X + (signatureWidth / 2), finalY + 5, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...labelColor);
  doc.text('Name & Designation', col3X + (signatureWidth / 2), finalY + 9, { align: 'center' });

  // Bottom text below signatures
  finalY += 18;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text(`Generation Date: ${printDate}`, pageWidth / 2, finalY, { align: 'center' });
  finalY += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...labelColor);
  doc.text('This is a computer-generated electronic statement and does not require a signature.', pageWidth / 2, finalY, { align: 'center' });

  // Add Footers to all pages
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc, i, printDate);
  }

  return Buffer.from(doc.output('arraybuffer'));
}

function drawFooter(pdfDoc: jsPDF, pageNum: number, printDate: string) {
  const pW = pdfDoc.internal.pageSize.getWidth();
  const pH = pdfDoc.internal.pageSize.getHeight();
  const pageCount = (pdfDoc.internal as any).getNumberOfPages();
  pdfDoc.setFontSize(8);
  pdfDoc.setTextColor(148, 163, 184); // slate-400
  pdfDoc.setFont('helvetica', 'normal');
  pdfDoc.text(`ANCHOR FASHION ERP · Confidential & Proprietary · ${printDate}`, 14, pH - 10);
  pdfDoc.setFont('helvetica', 'bold');
  pdfDoc.setTextColor(15, 23, 42); // slate-900
  pdfDoc.text(`Page ${pageNum} of ${pageCount}`, pW - 14, pH - 10, { align: 'right' });
}
