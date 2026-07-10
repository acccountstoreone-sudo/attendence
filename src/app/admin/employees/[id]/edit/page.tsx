import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { EmployeeForm } from '@/components/admin/EmployeeForm';
import { Users, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data: employee, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !employee) {
    notFound();
  }

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Link href="/admin/employees" className="flex items-center text-slate-400 hover:text-white transition-colors text-sm mb-2 w-fit">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Employees
        </Link>
        <div className="flex items-center space-x-2 text-[#004417] text-xs font-bold uppercase tracking-widest mb-1">
          <Users className="w-4 h-4" />
          <span>Edit Profile</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          {employee.full_name}
        </h1>
        <p className="text-sm text-slate-400">
          Update staff details, assign branches, or change system role.
        </p>
      </div>

      <EmployeeForm initialData={employee} />
    </div>
  );
}
