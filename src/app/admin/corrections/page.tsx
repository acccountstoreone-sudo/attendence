'use client';

import React from 'react';
import { CorrectionsManagementPanel } from '@/components/attendance/CorrectionsManagementPanel';

export default function AdminCorrectionsPage() {
  return (
    <div className="min-h-screen p-4 md:p-8 text-slate-900 space-y-6 max-w-7xl mx-auto">
      <CorrectionsManagementPanel role="admin" />
    </div>
  );
}

