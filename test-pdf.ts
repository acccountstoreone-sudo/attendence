import { generateDetailedCompanyPDF } from './src/lib/pdf-generator';
import fs from 'fs';

try {
  const buffer = generateDetailedCompanyPDF({
    reportTitle: 'DETAILED COMPANY-WIDE SUMMARY',
    reportSubtitle: 'Statement',
    metaRef: 'REP-12345',
    metaPeriod: '7/2026',
    metaPreparedBy: 'Admin Test',
    metaRecordsCount: 1,
    companySummaryColumns: ['A'],
    companySummaryRows: [['B']],
    branches: [{
      branchName: 'Main Branch',
      branchMetrics: 'Staff: 1 | Attendance: 100% | Total OT: 0h',
      branchSummaryColumns: ['X'],
      branchSummaryRows: [['Y']],
      employees: [{
        employeeName: 'John Doe',
        employeeId: 'ID-JOHN',
        role: 'Manager',
        summaryData: {
          working: 20,
          present: 20,
          late: 0,
          dutyHrs: 160,
          otHrs: 0,
          punctuality: 100,
          payable: 50000,
          otPay: 0
        },
        dailyColumns: ['Date', 'Day', 'Status', 'Check In', 'Check Out', 'Duty Hrs', 'Late (M)', 'OT (M)', 'Biometrics'],
        dailyRows: [['2026-07-01', 'Mon', 'PRESENT', '09:00', '18:00', '9', '0', '0', 'Yes']]
      }]
    }]
  });
  fs.writeFileSync('test.pdf', buffer);
  console.log('PDF Generated Successfully!');
} catch (error) {
  console.error('ERROR:', error);
}
