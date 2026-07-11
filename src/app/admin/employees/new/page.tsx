import React from 'react';
import { EmployeeForm } from '@/components/admin/EmployeeForm';
import { Users } from 'lucide-react';
import Link from 'next/link';

export default function NewEmployeePage() {
  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center space-x-2 text-[#1dbf73] text-xs font-bold uppercase tracking-widest mb-1">
          <Users className="w-4 h-4" />
          <span>HR — Staff Registry</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Register New Employee
        </h1>
        <p className="text-sm text-slate-600">
          Create an account for a new staff member and assign them to a branch.
        </p>
      </div>

      <EmployeeForm />
    </div>
  );
}

