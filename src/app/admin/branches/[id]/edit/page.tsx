import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { BranchForm } from '@/components/admin/BranchForm';
import { Store, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function EditBranchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data: branch, error } = await supabase
    .from('branches')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !branch) {
    notFound();
  }

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Link href="/admin/branches" className="flex items-center text-slate-600 hover:text-slate-900 transition-colors text-sm mb-2 w-fit">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Branches
        </Link>
        <div className="flex items-center space-x-2 text-[#1dbf73] text-xs font-bold uppercase tracking-widest mb-1">
          <Store className="w-4 h-4" />
          <span>Edit Branch</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          {branch.name}
        </h1>
        <p className="text-sm text-slate-600">
          Update store details and configure GPS geofencing.
        </p>
      </div>

      <BranchForm initialData={branch} />
    </div>
  );
}
