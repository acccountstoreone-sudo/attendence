'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { User, Mail, Phone, Building2, Shield, Lock, Unlock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface EmployeeFormProps {
  initialData?: {
    id: string;
    full_name: string;
    email: string;
    phone?: string | null;
    role: 'employee' | 'branch_manager' | 'admin';
    branch_id?: string | null;
    employee_id?: string | null;
    is_active: boolean;
  };
}

export function EmployeeForm({ initialData }: EmployeeFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  
  const [form, setForm] = useState({
    full_name: initialData?.full_name || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    role: initialData?.role || 'employee',
    branch_id: initialData?.branch_id || '',
    employee_id: initialData?.employee_id || '',
    password: '',
    is_active: initialData ? initialData.is_active : true,
  });

  useEffect(() => {
    const loadBranches = async () => {
      const { data } = await supabase.from('branches').select('id, name, code').eq('is_active', true).order('name');
      if (data) setBranches(data);
    };
    loadBranches();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = initialData ? `/api/employees/${initialData.id}` : '/api/employees';
      const method = initialData ? 'PUT' : 'POST';
      const body = {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        role: form.role,
        branch_id: form.branch_id || null,
        employee_id: form.employee_id || null,
        is_active: form.is_active,
        ...(form.password && !initialData ? { password: form.password } : {}),
      };

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await res.json();
      if (!result.success) throw new Error(result.error?.message || 'Failed to save employee');
      
      router.push('/admin/employees');
      router.refresh();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to save employee.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl bg-[#061224] border-[#1E293B] p-6 shadow-2xl">
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Full Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="John Doe" className="w-full pl-10 pr-4 py-3 bg-[#040A15] border border-[#1E293B] rounded-xl text-sm text-white focus:outline-none focus:border-[#D2A02A] focus:ring-1 focus:ring-[#D2A02A] transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Employee ID</label>
            <input value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
              placeholder="e.g., EMP-001" className="w-full px-4 py-3 bg-[#040A15] border border-[#1E293B] rounded-xl text-sm text-white focus:outline-none focus:border-[#D2A02A] focus:ring-1 focus:ring-[#D2A02A] transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Address *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                disabled={!!initialData} // Email cannot be changed after creation easily via this form
                placeholder="john@anchorfashion.com" className="w-full pl-10 pr-4 py-3 bg-[#040A15] border border-[#1E293B] rounded-xl text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-[#D2A02A] focus:ring-1 focus:ring-[#D2A02A] transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+880 1xxx-xxxxxx" className="w-full pl-10 pr-4 py-3 bg-[#040A15] border border-[#1E293B] rounded-xl text-sm text-white focus:outline-none focus:border-[#D2A02A] focus:ring-1 focus:ring-[#D2A02A] transition-all" />
            </div>
          </div>
        </div>

        {!initialData && (
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Temporary Password *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input required type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min 6 characters" className="w-full pl-10 pr-4 py-3 bg-[#040A15] border border-[#1E293B] rounded-xl text-sm text-white focus:outline-none focus:border-[#D2A02A] focus:ring-1 focus:ring-[#D2A02A] transition-all" />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Staff will use this to login for the first time.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-[#1E293B]">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center">
              <Shield className="w-3.5 h-3.5 mr-1" /> System Role
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'employee' | 'branch_manager' | 'admin' }))}
              className="w-full px-4 py-3 bg-[#040A15] border border-[#1E293B] rounded-xl text-sm text-white appearance-none focus:outline-none focus:border-[#D2A02A]"
            >
              <option value="employee">Standard Employee</option>
              <option value="branch_manager">Branch Manager</option>
              <option value="admin">System Admin (HQ)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center">
              <Building2 className="w-3.5 h-3.5 mr-1" /> Assigned Branch
            </label>
            <select
              value={form.branch_id}
              onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
              className="w-full px-4 py-3 bg-[#040A15] border border-[#1E293B] rounded-xl text-sm text-white appearance-none focus:outline-none focus:border-[#D2A02A]"
            >
              <option value="">Unassigned (HQ / Float)</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>
        </div>

        {initialData && (
          <div className="flex items-center space-x-3 pt-2 bg-[#040A15] p-4 rounded-xl border border-[#1E293B]">
            <input
              type="checkbox"
              id="is_active_emp"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="w-5 h-5 rounded border-[#1E293B] text-[#D2A02A] focus:ring-[#D2A02A]"
            />
            <label htmlFor="is_active_emp" className="text-sm font-medium text-white flex items-center cursor-pointer">
              {form.is_active ? <Unlock className="w-4 h-4 mr-2 text-emerald-400" /> : <Lock className="w-4 h-4 mr-2 text-rose-400" />}
              Account is currently {form.is_active ? 'Active' : 'Suspended'}
            </label>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-6 border-t border-[#1E293B]">
          <Button type="button" variant="secondary" onClick={() => router.push('/admin/employees')}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving...' : initialData ? 'Update Profile' : 'Register Account'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
