'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { User, Mail, Phone, Building2, Shield, Lock, Unlock, CheckCircle2, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface Branch {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
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
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string; details?: string } | null>(null);
  
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
      // Fetch all branches so inactive assigned branches still show up properly
      const { data } = await supabase.from('branches').select('id, name, code, is_active').order('name');
      if (data) setBranches(data);
    };
    loadBranches();
  }, [supabase]);

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
        ...(form.password ? { password: form.password } : {}),
      };

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await res.json();
      if (!result.success) throw new Error(result.error?.message || 'Failed to save employee');
      
      setFeedback({ type: 'success', text: result.message || 'Saved successfully', details: result.generatedPassword ? `Auto-generated Password: ${result.generatedPassword}` : undefined });
      
      // Delay navigation slightly so they can see the generated password or success message
      if (!result.generatedPassword) {
        setTimeout(() => {
          router.push('/admin/employees');
          router.refresh();
        }, 1500);
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: (err as Error).message || 'Failed to save employee.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl bg-white border-slate-200 p-6 shadow-2xl">
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`mb-6 p-4 rounded-xl border text-sm font-medium ${
              feedback.type === 'success' ? 'bg-[#1dbf73]/10 border-emerald-500/20 text-[#1dbf73]' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            <div className="flex items-center gap-3">
              {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
              <span>{feedback.text}</span>
            </div>
            {feedback.details && (
              <div className="mt-3 ml-8 p-3 bg-white/30 rounded border border-emerald-500/30 text-[#1dbf73] font-mono tracking-wider break-all select-all">
                {feedback.details}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Full Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="John Doe" className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Employee ID</label>
            <input value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
              placeholder="e.g., EMP-001" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Address *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                disabled={!!initialData} // Email cannot be changed after creation easily via this form
                placeholder="john@anchorfashion.com" className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+880 1xxx-xxxxxx" className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            {initialData ? 'Reset Password (Optional)' : 'Temporary Password (Optional)'}
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
            <input type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={initialData ? "Type to overwrite password" : "Leave empty to auto-generate"} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all" />
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {initialData ? "Leave blank to keep the current password." : "Staff will use this to login for the first time. If left blank, a secure password will be generated."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-200">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center">
              <Shield className="w-3.5 h-3.5 mr-1" /> System Role
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'employee' | 'branch_manager' | 'admin' }))}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 appearance-none focus:outline-none focus:border-[#1dbf73]"
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
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 appearance-none focus:outline-none focus:border-[#1dbf73]"
            >
              <option value="">Unassigned (HQ / Float)</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code}) {!b.is_active ? '(Inactive)' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {initialData && (
          <div className="flex items-center space-x-3 pt-2 bg-white p-4 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              id="is_active_emp"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="w-5 h-5 rounded border-slate-200 text-[#1dbf73] focus:ring-[#1dbf73]"
            />
            <label htmlFor="is_active_emp" className="text-sm font-medium text-slate-900 flex items-center cursor-pointer">
              {form.is_active ? <Unlock className="w-4 h-4 mr-2 text-[#1dbf73]" /> : <Lock className="w-4 h-4 mr-2 text-rose-400" />}
              Account is currently {form.is_active ? 'Active' : 'Suspended'}
            </label>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200">
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

