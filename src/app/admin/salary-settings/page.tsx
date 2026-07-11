'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { DollarSign, Plus, Pencil, Save, X, Search, RefreshCcw, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

interface SalarySetting {
  user_id: string;
  base_salary: number;
  house_rent_allowance: number;
  medical_allowance: number;
  transport_allowance: number;
  updated_at: string;
  profiles: {
    id: string;
    full_name: string;
    employee_id?: string;
    branches?: { name?: string } | Array<{ name?: string }> | null;
  };
}

interface Employee {
  id: string;
  full_name: string;
  employee_id?: string;
  branch_id?: string;
  branches?: { name?: string } | Array<{ name?: string }> | null;
}

const defaultForm = { user_id: '', base_salary: 0, house_rent_allowance: 0, medical_allowance: 0, transport_allowance: 0 };

export default function AdminSalarySettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<SalarySetting[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [settingsRes, empsRes] = await Promise.all([
      fetch('/api/salary-settings'),
      supabase.from('profiles').select('id, full_name, employee_id, branch_id, branches!branch_id(name)').eq('role', 'employee').eq('is_active', true).order('full_name'),
    ]);
    const settingsJson = await settingsRes.json();
    if (settingsJson.success) setSettings((settingsJson.data ?? []) as unknown as SalarySetting[]);
    if (!empsRes.error) setEmployees((empsRes.data ?? []) as unknown as Employee[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { setTimeout(() => loadData(), 0); }, [loadData]);

  const employeesWithoutSalary = employees.filter((e) => !settings.find((s) => s.user_id === e.id));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.user_id || form.base_salary <= 0) {
      setFeedback({ type: 'error', text: 'Please select an employee and enter a valid base salary.' });
      return;
    }
    setSaving(true);
    const res = await fetch('/api/salary-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (json.success) {
      setFeedback({ type: 'success', text: 'Salary settings saved.' });
      setForm(defaultForm);
      setShowAddForm(false);
      setEditingId(null);
      loadData();
    } else {
      setFeedback({ type: 'error', text: json.error?.message ?? 'Failed to save.' });
    }
    setSaving(false);
  };

  const startEdit = (s: SalarySetting) => {
    setForm({ user_id: s.user_id, base_salary: s.base_salary, house_rent_allowance: s.house_rent_allowance, medical_allowance: s.medical_allowance, transport_allowance: s.transport_allowance });
    setEditingId(s.user_id);
    setShowAddForm(false);
  };

  const totalPackage = (s: SalarySetting) => s.base_salary + s.house_rent_allowance + s.medical_allowance + s.transport_allowance;

  const filtered = settings.filter((s) =>
    s.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.profiles?.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
    (Array.isArray(s.profiles?.branches) ? s.profiles.branches[0]?.name : s.profiles?.branches?.name)?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-[#1dbf73]" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Salary Settings</h1>
            <p className="text-sm text-slate-400">Configure base salary and allowances per employee.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button id="refresh-salary-btn" variant="secondary" onClick={loadData} disabled={loading}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button id="add-salary-btn" onClick={() => { setShowAddForm(true); setEditingId(null); setForm(defaultForm); }}>
            <Plus className="w-4 h-4 mr-1" /> Add Employee Salary
          </Button>
        </div>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-between ${feedback.type === 'success' ? 'bg-[#1dbf73]/20 text-[#1dbf73] border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
            {feedback.text}
            <button onClick={() => setFeedback(null)}><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Warning: employees without salary */}
      {!loading && employeesWithoutSalary.length > 0 && (
        <div className="flex items-center gap-2 text-amber-300 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {employeesWithoutSalary.length} employee(s) have no salary configured. Payroll generation will skip them.
        </div>
      )}

      {/* Add / Edit Form */}
      <AnimatePresence>
        {(showAddForm || editingId) && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <Card className="p-5 border border-emerald-500/30 bg-slate-800/60">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                {editingId ? 'Edit Salary' : 'Set Employee Salary'}
              </h2>
              <form onSubmit={handleSave} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {!editingId && (
                  <div className="col-span-2 sm:col-span-3 lg:col-span-2">
                    <label className="text-xs text-slate-400 mb-1 block">Employee *</label>
                    <select id="salary-employee-select" required value={form.user_id}
                      onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                      className="w-full bg-slate-700 text-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500">
                      <option value="">Select…</option>
                      {employeesWithoutSalary.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name}{emp.employee_id ? ` (${emp.employee_id})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {[
                  { key: 'base_salary', label: 'Base Salary ৳ *', id: 'salary-base-input' },
                  { key: 'house_rent_allowance', label: 'House Rent ৳', id: 'salary-hra-input' },
                  { key: 'medical_allowance', label: 'Medical ৳', id: 'salary-medical-input' },
                  { key: 'transport_allowance', label: 'Transport ৳', id: 'salary-transport-input' },
                ].map(({ key, label, id }) => (
                  <div key={key}>
                    <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                    <input id={id} type="number" min={0} step={0.01}
                      value={form[key as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                      className="w-full bg-slate-700 text-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                ))}
                <div className="col-span-2 sm:col-span-3 lg:col-span-6 flex gap-2 justify-end pt-1">
                  <div className="flex-1 flex items-center text-sm text-[#1dbf73] font-semibold">
                    Total: ৳{(form.base_salary + form.house_rent_allowance + form.medical_allowance + form.transport_allowance).toLocaleString()}
                  </div>
                  <Button id="cancel-salary-btn" type="button" variant="secondary" onClick={() => { setShowAddForm(false); setEditingId(null); }}>Cancel</Button>
                  <Button id="save-salary-btn" type="submit" disabled={saving}>
                    {saving ? <Spinner className="w-4 h-4" /> : <><Save className="w-4 h-4 mr-1" />Save</>}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input id="salary-search-input" type="text" placeholder="Search by name, ID, or branch…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-800 text-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <DollarSign className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No salary settings found. Add one using the button above.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((s) => (
            <motion.div key={s.user_id} layout>
              {editingId === s.user_id ? (
                <Card className="p-5 border border-emerald-500/30 bg-slate-800/60">
                  <form onSubmit={handleSave} className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'base_salary', label: 'Base ৳', id: `edit-base-${s.user_id}` },
                      { key: 'house_rent_allowance', label: 'HRA ৳', id: `edit-hra-${s.user_id}` },
                      { key: 'medical_allowance', label: 'Medical ৳', id: `edit-med-${s.user_id}` },
                      { key: 'transport_allowance', label: 'Transport ৳', id: `edit-trans-${s.user_id}` },
                    ].map(({ key, label, id }) => (
                      <div key={key}>
                        <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                        <input id={id} type="number" min={0} step={0.01}
                          value={form[key as keyof typeof form]}
                          onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                          className="w-full bg-slate-700 text-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    ))}
                    <div className="col-span-2 flex gap-2 justify-end">
                      <Button id={`cancel-edit-${s.user_id}`} type="button" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button id={`save-edit-${s.user_id}`} type="submit" disabled={saving}>
                        {saving ? <Spinner className="w-4 h-4" /> : 'Update'}
                      </Button>
                    </div>
                  </form>
                </Card>
              ) : (
                <Card className="p-4 bg-slate-800/60 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-slate-900 font-semibold">{s.profiles?.full_name}</p>
                      {s.profiles?.employee_id && <Badge variant="info">{s.profiles.employee_id}</Badge>}
                    </div>
                    <p className="text-slate-400 text-xs">{(Array.isArray(s.profiles?.branches) ? s.profiles.branches[0]?.name : s.profiles?.branches?.name) ?? 'No branch'}</p>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 text-xs">
                      <span className="text-slate-400">Base: <span className="text-slate-900">৳{s.base_salary.toLocaleString()}</span></span>
                      <span className="text-slate-400">HRA: <span className="text-slate-900">৳{s.house_rent_allowance.toLocaleString()}</span></span>
                      <span className="text-slate-400">Medical: <span className="text-slate-900">৳{s.medical_allowance.toLocaleString()}</span></span>
                      <span className="text-slate-400">Transport: <span className="text-slate-900">৳{s.transport_allowance.toLocaleString()}</span></span>
                    </div>
                    <p className="text-[#1dbf73] text-sm font-bold mt-1">Total: ৳{totalPackage(s).toLocaleString()}/month</p>
                  </div>
                  <button id={`edit-salary-${s.user_id}`} onClick={() => startEdit(s)}
                    className="text-slate-400 hover:text-indigo-400 transition-colors p-2 flex-shrink-0">
                    <Pencil className="w-4 h-4" />
                  </button>
                </Card>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

