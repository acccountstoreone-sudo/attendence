/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';
import path from 'path';

function drawLogo(doc: jsPDF, logoBase64: string, x: number, y: number, targetHeight: number = 24) {
  try {
    const props = doc.getImageProperties(logoBase64);
    let imgWidth = (props.width * targetHeight) / props.height;
    if (imgWidth > 110) {
      imgWidth = 110;
      targetHeight = (props.height * imgWidth) / props.width;
    }
    doc.addImage(logoBase64, 'PNG', x, y, imgWidth, targetHeight);
  } catch (e) {
    doc.addImage(logoBase64, 'PNG', x, y, 50, 15);
  }
}

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

export interface DetailedCompanyPDFOptions {
  reportTitle: string;
  reportSubtitle?: string;
  metaRef: string;
  metaPeriod: string;
  metaPreparedBy: string;
  metaRecordsCount: number;
  companySummaryColumns: string[];
  companySummaryRows: any[][];
  branches: Array<{
    branchName: string;
    branchMetrics: string;
    branchSummaryColumns: string[];
    branchSummaryRows: any[][];
    employees: Array<{
      employeeName: string;
      employeeId: string;
      role: string;
      summaryData: {
        working: number;
        present: number;
        late: number;
        dutyHrs: number;
        otHrs: number;
        punctuality: number;
        payable: number;
        otPay: number;
      };
      dailyColumns: string[];
      dailyRows: any[][];
    }>;
  }>;
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
    drawLogo(doc, logoBase64, 14, 8, 42); // Increased logo size from 35 to 42
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
  let currentY = 52;
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
  currentY = 52;
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
  currentY = 52;
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
  let tableY = 86;
  if (options.tableTitle) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(options.tableTitle, 14, tableY);
    tableY += 5;
  }

  // Draw Table
  let finalY = tableY;
  autoTable(doc, {
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
    didParseCell: (data: any) => {
      if (data.section === 'body') {
        const colName = options.columns[data.column.index];
        const isOvertime = colName.includes('OT') || colName.includes('Overtime');
        const isDuty = colName.includes('Duty');

        if (isOvertime) {
          if (String(data.cell.raw) !== '0h' && String(data.cell.raw) !== '0') {
            data.cell.styles.textColor = [16, 185, 129]; // Green
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 10;
            data.cell.styles.fillColor = [236, 253, 245];
          }
        } else if (isDuty) {
          data.cell.styles.textColor = [16, 185, 129]; // Green
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 10;
          data.cell.styles.fillColor = [236, 253, 245];
        } else if (colName === 'Status') {
          const val = String(data.cell.raw).toUpperCase();
          if (val.includes('APPROVED')) {
            data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = 'bold';
          } else if (val.includes('REJECTED')) {
            data.cell.styles.textColor = [225, 29, 72];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    },
    willDrawPage: (data: any) => {
      // Draw watermark before autotable cells are drawn on new pages
      if (data.pageNumber > 1) {
        drawWatermark();
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
  if (finalY > pageHeight - 85) {
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

export function generateDetailedCompanyPDF(options: DetailedCompanyPDFOptions): Buffer {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth(); // 297
  const pageHeight = doc.internal.pageSize.getHeight(); // 210
  
  const primaryColor: [number, number, number] = [26, 54, 93]; // Dark Blue #1a365d
  const headerBgColor: [number, number, number] = [238, 242, 246]; // Light Blue-Gray #eef2f6
  const textColor: [number, number, number] = [51, 65, 85]; // Slate #334155
  const labelColor: [number, number, number] = [100, 116, 139]; // Gray #64748b

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
    drawLogo(doc, logoBase64, 14, 8, 42);
  } else {
    doc.setTextColor(...primaryColor);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('ANCHOR FASHION', 14, 22);
  }

  // Top Right Text
  doc.setTextColor(112, 128, 144);
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

  let currentY = 52;
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

  currentY = 52;
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

  currentY = 52;
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

  let tableY = 86;

  const renderTable = (title: string, columns: string[], rows: any[][], titleColor: [number, number, number] = primaryColor) => {
    if (tableY > pageHeight - 30) {
      doc.addPage();
      drawWatermark();
      tableY = 20;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...titleColor);
    doc.text(title, 14, tableY);
    tableY += 5;

    autoTable(doc, {
      head: [columns],
      body: rows,
      startY: tableY,
      theme: 'plain',
      headStyles: { fillColor: headerBgColor, textColor: primaryColor, fontStyle: 'bold', fontSize: 9, cellPadding: 4 },
      bodyStyles: { fontSize: 8, textColor: textColor, cellPadding: 3 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      willDrawPage: (data: any) => { if (data.pageNumber > 1) { drawWatermark(); } },
      didParseCell: (data: any) => {
        const colName = columns[data.column.index] || '';
        const isOvertime = colName.includes('OT') || colName.includes('Overtime');
        const isDuty = colName.includes('Duty');

        // Highlight OT column if OT is > 0
        if (data.section === 'body' && isOvertime) {
          if (Number(data.cell.raw) > 0 || (String(data.cell.raw) !== '0h' && String(data.cell.raw) !== '0')) {
            data.cell.styles.textColor = [16, 185, 129]; // Green for OT
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 10;
            data.cell.styles.fillColor = [236, 253, 245];
          }
        }
        // Highlight Duty/Normal Time
        if (data.section === 'body' && isDuty) {
          data.cell.styles.textColor = [16, 185, 129]; // Green instead of blue
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 10;
          data.cell.styles.fillColor = [236, 253, 245];
        }
        // Highlight Mismatch status
        if (data.section === 'body' && columns[data.column.index] === 'Status') {
          if (String(data.cell.raw).includes('Mismatch')) {
            data.cell.styles.textColor = [225, 29, 72]; // Rose for mismatch
            data.cell.styles.fontStyle = 'bold';
          }
        }
        // Highlight Biometrics status
        if (data.section === 'body' && columns[data.column.index] === 'Biometrics') {
          if (String(data.cell.raw) === 'No') {
            data.cell.styles.textColor = [225, 29, 72]; // Rose
          } else if (String(data.cell.raw) === 'Yes') {
            data.cell.styles.textColor = [16, 185, 129]; // Emerald
          }
        }
      }
    });
    // @ts-expect-error autotable adds finalY
    tableY = doc.lastAutoTable.finalY + 15;
  };

  // Render top-level company summary
  renderTable('Company-Wide Attendance Summary', options.companySummaryColumns, options.companySummaryRows);

  // Render branches
  for (const branch of options.branches) {
    if (tableY > pageHeight - 40) {
      doc.addPage();
      drawWatermark();
      tableY = 20;
    }

    // Elegant Branch Header
    doc.setFillColor(...primaryColor);
    doc.rect(14, tableY, pageWidth - 28, 12, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(branch.branchName.toUpperCase(), 18, tableY + 8);
    
    // Branch Metrics aligned right
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(branch.branchMetrics, pageWidth - 18, tableY + 8, { align: 'right' });
    
    tableY += 18;

    renderTable(`Branch Summary`, branch.branchSummaryColumns, branch.branchSummaryRows);

    for (const emp of branch.employees) {
      if (tableY > pageHeight - 60) {
        doc.addPage();
        drawWatermark();
        tableY = 20;
      }
      
      // Sleek Employee Banner
      doc.setFillColor(241, 245, 249); // slate-100
      doc.rect(14, tableY, pageWidth - 28, 14, 'F');
      
      // Left side: Name, ID, Role
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(emp.employeeName, 18, tableY + 6);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`${emp.employeeId} | ${emp.role}`, 18, tableY + 11);

      // Right side: Summary Metrics
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const metricsText = `Punctuality: ${emp.summaryData.punctuality}% | Working: ${emp.summaryData.working} | Present: ${emp.summaryData.present} | Late: ${emp.summaryData.late} | OT: ${emp.summaryData.otHrs}h`;
      doc.text(metricsText, pageWidth - 18, tableY + 6, { align: 'right' });
      
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const payText = `Est. Base Payable: ${emp.summaryData.payable} BDT | OT Pay: ${emp.summaryData.otPay} BDT`;
      doc.text(payText, pageWidth - 18, tableY + 11, { align: 'right' });
      
      tableY += 18;

      // Ensure daily table stays close
      renderTable(`Daily Attendance Log`, emp.dailyColumns, emp.dailyRows, [51, 65, 85]);
    }
  }

  // Ensure there's space for Signatures, else add a new page
  if (tableY > pageHeight - 60) {
    doc.addPage();
    drawWatermark();
    tableY = 20;
  }
  
  tableY += 30;
  const signatureWidth = 50;
  const col1X = 30;
  const col2X = (pageWidth / 2) - (signatureWidth / 2);
  const col3X = pageWidth - 30 - signatureWidth;

  doc.setDrawColor(203, 213, 225); // slate-300
  
  // Prepared By (HR)
  doc.line(col1X, tableY, col1X + signatureWidth, tableY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Prepared By (HR Dept.)', col1X + (signatureWidth / 2), tableY + 5, { align: 'center' });

  // Verified By (Finance)
  doc.line(col2X, tableY, col2X + signatureWidth, tableY);
  doc.text('Checked By (Finance Controller)', col2X + (signatureWidth / 2), tableY + 5, { align: 'center' });

  // Approved By (MD)
  doc.line(col3X, tableY, col3X + signatureWidth, tableY);
  doc.text('Approved By (Managing Director)', col3X + (signatureWidth / 2), tableY + 5, { align: 'center' });

  tableY += 18;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('This document is system-generated and includes highly confidential payroll metadata. Unauthorized distribution is prohibited.', pageWidth / 2, tableY, { align: 'center' });

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

export interface EmployeeFullDutyPDFOptions {
  reportTitle: string;
  reportSubtitle?: string;
  employee: {
    full_name: string;
    employee_id?: string;
    role?: string;
    branch_name: string;
    email?: string;
    phone?: string;
    joining_date?: string;
    status?: string;
  };
  periodText: string;
  preparedBy: string;
  summary: {
    total_duty_hours: number;
    total_overtime_hours: number;
    total_overtime_minutes: number;
    total_present_days: number;
    total_missed_days: number;
    total_late_minutes: number;
    total_late_hours?: number;
    total_late_days: number;
    total_working_days?: number;
    total_on_leave_days?: number;
  };
  columns: string[];
  rows: any[][];
  breaksData?: {
    columns: string[];
    rows: any[][];
  };
}

export function generateEmployeeFullDutyPDF(options: EmployeeFullDutyPDFOptions): Buffer {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const primaryColor: [number, number, number] = [26, 54, 93];
  const headerBgColor: [number, number, number] = [238, 242, 246];
  const textColor: [number, number, number] = [51, 65, 85];
  const labelColor: [number, number, number] = [100, 116, 139];

  const printDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const drawWatermark = () => {
    doc.setTextColor(240, 244, 248);
    doc.setFontSize(40);
    doc.setFont('helvetica', 'bold');
    for (let x = -100; x < pageWidth + 100; x += 120) {
      for (let y = -50; y < pageHeight + 100; y += 80) {
        doc.text('ANCHOR FASHION', x, y, { angle: -30 });
      }
    }
  };

  drawWatermark();

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

  if (logoBase64) {
    drawLogo(doc, logoBase64, 14, 10, 26);
  } else {
    doc.setTextColor(...primaryColor);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('ANCHOR FASHION', 14, 22);
  }

  doc.setTextColor(112, 128, 144);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'normal');
  doc.text(options.reportSubtitle || 'Official Statement', pageWidth - 14, 21, { align: 'right' });

  doc.setFillColor(...primaryColor);
  doc.rect(pageWidth - 95, 25, 81, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(options.reportTitle.toUpperCase(), pageWidth - 54.5, 30.5, { align: 'center' });

  // 1. Employee Profile & Full Details Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.rect(14, 38, pageWidth - 28, 32, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('EMPLOYEE PROFILE & FULL DETAILS', 18, 44.5);

  doc.setFontSize(8.5);
  // Column 1
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...labelColor);
  doc.text('Employee Name:', 18, 52);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text(options.employee.full_name, 50, 52);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...labelColor);
  doc.text('Staff ID / Code:', 18, 58);
  doc.setTextColor(...textColor);
  doc.text(options.employee.employee_id || 'N/A', 50, 58);

  doc.setTextColor(...labelColor);
  doc.text('Designation / Role:', 18, 64);
  doc.setTextColor(...textColor);
  doc.text((options.employee.role || 'Employee').replace(/_/g, ' ').toUpperCase(), 50, 64);

  // Column 2
  doc.setTextColor(...labelColor);
  doc.text('Assigned Branch:', 110, 52);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text(options.employee.branch_name || 'N/A', 142, 52);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...labelColor);
  doc.text('Phone Number:', 110, 58);
  doc.setTextColor(...textColor);
  doc.text(options.employee.phone || 'N/A', 142, 58);

  doc.setTextColor(...labelColor);
  doc.text('Email Address:', 110, 64);
  doc.setTextColor(...textColor);
  doc.text(options.employee.email || 'N/A', 142, 64);

  // Column 3
  doc.setTextColor(...labelColor);
  doc.text('Joining Date:', 200, 52);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text(options.employee.joining_date || 'N/A', 230, 52);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...labelColor);
  doc.text('Account Status:', 200, 58);
  doc.setTextColor(...textColor);
  doc.text(options.employee.status || 'Active', 230, 58);

  doc.setTextColor(...labelColor);
  doc.text('Report Period:', 200, 64);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text(options.periodText, 230, 64);

  // 2. Overall Duty & Attendance Summary Box
  doc.setFillColor(...headerBgColor);
  doc.setDrawColor(...primaryColor);
  doc.rect(14, 74, pageWidth - 28, 33, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...primaryColor);
  doc.text(`TOTAL ATTENDANCE & DUTY SUMMARY (${options.periodText.toUpperCase()})`, 18, 81);

  const colW = (pageWidth - 36) / 6;
  const boxY = 85.5;

  // Box 1: Present
  doc.setFillColor(255, 255, 255);
  doc.rect(18, boxY, colW - 3, 17, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...labelColor);
  doc.text('TOTAL PRESENT', 21, boxY + 5);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(`${options.summary.total_present_days} Days`, 21, boxY + 12.5);

  // Box 2: Absent
  const m2X = 18 + colW;
  doc.setFillColor(255, 255, 255);
  doc.rect(m2X, boxY, colW - 3, 17, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...labelColor);
  doc.text('TOTAL ABSENT', m2X + 3, boxY + 5);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(239, 68, 68);
  doc.text(`${options.summary.total_missed_days} Days`, m2X + 3, boxY + 12.5);

  // Box 3: Late
  const m3X = 18 + colW * 2;
  doc.setFillColor(255, 255, 255);
  doc.rect(m3X, boxY, colW - 3, 17, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...labelColor);
  doc.text('TOTAL LATE DAYS', m3X + 3, boxY + 5);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(217, 119, 6);
  doc.text(`${options.summary.total_late_days} Days (${options.summary.total_late_hours || Math.round(options.summary.total_late_minutes/60)}h)`, m3X + 3, boxY + 12.5);

  // Box 4: Leave / Off
  const m4X = 18 + colW * 3;
  doc.setFillColor(255, 255, 255);
  doc.rect(m4X, boxY, colW - 3, 17, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...labelColor);
  doc.text('LEAVE / OFF DAYS', m4X + 3, boxY + 5);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text(`${options.summary.total_on_leave_days || 0} Days`, m4X + 3, boxY + 12.5);

  // Box 5: Duty Hours
  const m5X = 18 + colW * 4;
  doc.setFillColor(236, 253, 245);
  doc.rect(m5X, boxY, colW - 3, 17, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...labelColor);
  doc.text('TOTAL DUTY HOURS', m5X + 3, boxY + 5);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(`${options.summary.total_duty_hours} Hrs`, m5X + 3, boxY + 12.5);

  // Box 6: Overtime
  const m6X = 18 + colW * 5;
  doc.setFillColor(236, 253, 245);
  doc.rect(m6X, boxY, colW - 3, 17, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...labelColor);
  doc.text('TOTAL OVERTIME', m6X + 3, boxY + 5);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(`${options.summary.total_overtime_hours}h (${options.summary.total_overtime_minutes}m)`, m6X + 3, boxY + 12.5);

  // 3. Table Section
  let tableY = 114;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(`All Check-in & Duty Roster Records (${options.rows.length} entries)`, 14, tableY);
  tableY += 5;

  autoTable(doc, {
    head: [options.columns],
    body: options.rows,
    startY: tableY,
    theme: 'plain',
    headStyles: { 
      fillColor: headerBgColor, 
      textColor: primaryColor,
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 3.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: textColor,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    didParseCell: (data: any) => {
      if (data.section === 'body') {
        const colName = options.columns[data.column.index];
        if (colName === 'Overtime') {
          if (String(data.cell.raw) !== '0h' && !String(data.cell.raw).startsWith('0h (0m)')) {
            data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 9.5;
            data.cell.styles.fillColor = [236, 253, 245];
          }
        } else if (colName === 'Duty') {
          data.cell.styles.textColor = [16, 185, 129];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 9.5;
          data.cell.styles.fillColor = [236, 253, 245];
        } else if (colName === 'Status') {
          const val = String(data.cell.raw).toUpperCase();
          if (val === 'PRESENT') {
            data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'ABSENT' || val === 'MISSED') {
            data.cell.styles.textColor = [225, 29, 72];
          }
        }
      }
    },
    willDrawPage: (data: any) => {
      if (data.pageNumber > 1) {
        drawWatermark();
      }
    },
  });

  let finalY = (doc as any).lastAutoTable.finalY || tableY;

  if (options.breaksData && options.breaksData.rows.length > 0) {
    finalY += 15;
    if (finalY > pageHeight - 40) {
      doc.addPage();
      drawWatermark();
      finalY = 25;
    }
    
    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('GATE PASS & SHORT BREAKS HISTORY', 14, finalY);
    
    finalY += 5;
    
    (doc as any).autoTable({
      head: [options.breaksData.columns],
      body: options.breaksData.rows,
      startY: finalY,
      theme: 'plain',
      headStyles: { 
        fillColor: [241, 245, 249], 
        textColor: primaryColor,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: textColor,
        cellPadding: 2.5,
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      willDrawPage: (data: any) => {
        if (data.pageNumber > 1) {
          drawWatermark();
        }
      },
    });
    
    finalY = (doc as any).lastAutoTable.finalY || finalY;
  }

  finalY += 25;

  if (finalY > pageHeight - 55) {
    doc.addPage();
    drawWatermark();
    finalY = 25;
  }

  // Signatures
  const signatureWidth = 55;
  const col1X = 30;
  const col2X = (pageWidth / 2) - (signatureWidth / 2);
  const col3X = pageWidth - 30 - signatureWidth;

  doc.setDrawColor(203, 213, 225);
  doc.line(col1X, finalY, col1X + signatureWidth, finalY);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text(`Prepared By: ${options.preparedBy}`, col1X + (signatureWidth / 2), finalY + 5, { align: 'center' });

  doc.line(col2X, finalY, col2X + signatureWidth, finalY);
  doc.text('Checked By (Branch Manager)', col2X + (signatureWidth / 2), finalY + 5, { align: 'center' });

  doc.line(col3X, finalY, col3X + signatureWidth, finalY);
  doc.text('Approved By (HR & Operations)', col3X + (signatureWidth / 2), finalY + 5, { align: 'center' });

  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc, i, printDate);
  }

  return Buffer.from(doc.output('arraybuffer'));
}
