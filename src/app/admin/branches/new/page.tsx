import React from 'react';
import { BranchForm } from '@/components/admin/BranchForm';
import { Store } from 'lucide-react';
import Link from 'next/link';

export default function NewBranchPage() {
  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center space-x-2 text-[#1dbf73] text-xs font-bold uppercase tracking-widest mb-1">
          <Store className="w-4 h-4" />
          <span>Retail Network Management</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Register New Branch
        </h1>
        <p className="text-sm text-slate-600">
          Fill in the store details and configure GPS geofencing for biometric check-in.
        </p>
      </div>

      <BranchForm />
    </div>
  );
}

