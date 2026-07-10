'use client';

import React from 'react';
import { LeaveManagementPanel } from '@/components/attendance/LeaveManagementPanel';

export default function AdminLeavesPage() {
  return (
    <div className="min-h-screen p-4 md:p-8 text-white space-y-6 max-w-7xl mx-auto">
      <LeaveManagementPanel role="admin" />
    </div>
  );
}

