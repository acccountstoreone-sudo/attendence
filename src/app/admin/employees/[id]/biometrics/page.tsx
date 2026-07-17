import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { Fingerprint, ChevronLeft, ScanFace } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BiometricsManager } from '@/components/admin/BiometricsManager';

export default async function EmployeeBiometricsPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: webauthnCredentials } = await supabase
    .from('webauthn_credentials')
    .select('id, credential_id, device_type, created_at, counter')
    .eq('user_id', id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Link href="/admin/employees" className="flex items-center text-slate-900 hover:text-slate-900 transition-colors text-sm mb-2 w-fit">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Employees
        </Link>
        <div className="flex items-center space-x-2 text-blue-500 text-xs font-bold uppercase tracking-widest mb-1">
          <Fingerprint className="w-4 h-4" />
          <span>Manage Biometrics</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          {employee.full_name}
        </h1>
        <p className="text-sm text-slate-900">
          View and manage enrolled biometric data (Face ID and Fingerprints).
        </p>
      </div>

      <BiometricsManager 
        employee={employee} 
        webauthnCredentials={webauthnCredentials || []} 
      />
    </div>
  );
}
