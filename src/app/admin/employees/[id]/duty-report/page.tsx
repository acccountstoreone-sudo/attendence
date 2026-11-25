'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { EmployeeDutyReportView } from '@/components/attendance/EmployeeDutyReportView';

export default function AdminEmployeeDutyReportPage() {
  const params = useParams();
  const employeeId = params?.id as string;

  if (!employeeId) return null;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <EmployeeDutyReportView
        employeeId={employeeId}
        backUrl="/admin/employees"
        canEditAttendance={true}
        allowDelete={true}
      />
    </div>
  );
}
