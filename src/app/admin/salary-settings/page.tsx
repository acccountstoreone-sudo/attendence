'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { DollarSign, Plus, Pencil, Save, X, Search, RefreshCcw, AlertTriangle, Clock, Coffee, Building2, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

interface SalarySetting {
  user_id: string;
  base_salary: number;
  house_rent_allowance: number;
  medical_allowance: number;
  transport_allowance: number;
  overtime_rate_per_hour?: number | null;
  daily_snack_allowance?: number | null;
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

const defaultForm = { user_id: '', base_salary: '' as string | number, house_rent_allowance: '' as string | number, medical_allowance: '' as string | number, transport_allowance: '' as string | number, overtime_rate_per_hour: '' as string | number, daily_snack_allowance: '' as string | number };

export default function AdminSalarySettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<SalarySetting[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
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
    if (!form.user_id || Number(form.base_salary) <= 0) {
      setFeedback({ type: 'error', text: 'Please select an employee and enter a valid base salary.' });
      return;
    }
    setSaving(true);
    const payload = {
      user_id: form.user_id,
      base_salary: Number(form.base_salary || 0),
      house_rent_allowance: Number(form.house_rent_allowance || 0),
      medical_allowance: Number(form.medical_allowance || 0),
      transport_allowance: Number(form.transport_allowance || 0),
      overtime_rate_per_hour: form.overtime_rate_per_hour === '' || form.overtime_rate_per_hour === null ? null : Number(form.overtime_rate_per_hour),
      daily_snack_allowance: form.daily_snack_allowance === '' || form.daily_snack_allowance === null ? null : Number(form.daily_snack_allowance),
    };

    const res = await fetch('/api/salary-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.success) {
      setFeedback({ type: 'success', text: 'Salary settings saved successfully.' });
      setForm(defaultForm);
      setShowModal(false);
      setEditingId(null);
      loadData();
    } else {
      setFeedback({ type: 'error', text: json.error?.message ?? 'Failed to save.' });
    }
    setSaving(false);
  };

  const startAdd = () => {
    setForm(defaultForm);
    setEditingId(null);
    setShowModal(true);
  };

  const startEdit = (s: SalarySetting) => {
    setForm({
      user_id: s.user_id,
      base_salary: s.base_salary || '',
      house_rent_allowance: s.house_rent_allowance || '',
      medical_allowance: s.medical_allowance || '',
      transport_allowance: s.transport_allowance || '',
      overtime_rate_per_hour: s.overtime_rate_per_hour ?? '',
      daily_snack_allowance: s.daily_snack_allowance ?? ''
    });
    setEditingId(s.user_id);
    setShowModal(true);
  };

  const totalPackage = (s: { base_salary?: number | string; house_rent_allowance?: number | string; medical_allowance?: number | string; transport_allowance?: number | string }) => {
    return Number(s.base_salary || 0) + Number(s.house_rent_allowance || 0) + Number(s.medical_allowance || 0) + Number(s.transport_allowance || 0);
  };

  const filtered = settings.filter((s) =>
    s.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.profiles?.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
    (Array.isArray(s.profiles?.branches) ? s.profiles.branches[0]?.name : s.profiles?.branches?.name)?.toLowerCase().includes(search.toLowerCase())
  );

  const currentEditingProfile = editingId ? settings.find((s) => s.user_id === editingId)?.profiles : null;

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#1dbf73]/10 flex items-center justify-center border border-[#1dbf73]/20 flex-shrink-0">
            <DollarSign className="w-8 h-8 text-[#1dbf73]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Salary & Allowances Configuration</h1>
            <p className="text-sm text-slate-500 font-medium mt-0.5">Manage fixed salaries, monthly allowances, and custom hourly/snack overrides per staff member.</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button id="refresh-salary-btn" variant="secondary" onClick={loadData} disabled={loading} className="h-11 px-4 rounded-xl font-bold">
            <RefreshCcw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button id="add-salary-btn" onClick={startAdd} className="h-11 px-5 rounded-xl font-bold bg-[#1dbf73] hover:bg-[#19a865] text-white shadow-lg shadow-[#1dbf73]/25">
            <Plus className="w-5 h-5 mr-1" /> Configure New Salary
          </Button>
        </div>
      </div>

      {/* Feedback Alert */}
      <AnimatePresence>
        {feedback && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`rounded-2xl px-5 py-4 text-sm font-bold flex items-center justify-between shadow-md ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-red-50 text-red-800 border border-red-300'}`}>
            <span className="flex items-center gap-2">
              {feedback.type === 'success' ? <UserCheck className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
              {feedback.text}
            </span>
            <button onClick={() => setFeedback(null)} className="p-1.5 hover:bg-black/5 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Warning: employees without salary */}
      {!loading && employeesWithoutSalary.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-amber-900 text-sm font-semibold">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl text-amber-700">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            </div>
            <span>
              <strong className="font-extrabold text-amber-950">{employeesWithoutSalary.length} active employee(s)</strong> currently have no salary settings configured. They will be skipped during automated payroll generation.
            </span>
          </div>
          <Button size="sm" variant="secondary" onClick={startAdd} className="bg-amber-500 hover:bg-amber-600 text-white border-0 rounded-xl px-4 py-2 text-xs font-bold shadow-sm">
            Configure Now &rarr;
          </Button>
        </div>
      )}

      {/* Clean Modal Dialog for Add & Edit */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden my-8"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#1dbf73]/20 rounded-2xl border border-[#1dbf73]/30">
                    <DollarSign className="w-6 h-6 text-[#1dbf73]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">
                      {editingId ? `Update Rates — ${currentEditingProfile?.full_name}` : 'Setup Employee Salary & Rates'}
                    </h2>
                    <p className="text-xs text-slate-300 font-medium mt-0.5">
                      {editingId ? `Employee ID: ${currentEditingProfile?.employee_id || 'N/A'}` : 'Assign fixed base salary, allowances & optional rate overrides'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowModal(false); setEditingId(null); }}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSave} className="p-6 space-y-6">
                {/* Section 1: Employee & Fixed Package */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#1dbf73]" /> Monthly Fixed Basic & Allowances
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {!editingId && (
                      <div className="sm:col-span-2">
                        <label className="text-xs text-slate-700 font-bold mb-1.5 block">Select Staff Member *</label>
                        <select
                          id="salary-employee-select"
                          required
                          value={form.user_id}
                          onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                          className="w-full bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-300 rounded-xl px-3.5 py-3 text-sm font-semibold focus:outline-none focus:border-[#1dbf73] focus:ring-4 focus:ring-[#1dbf73]/15 transition-all"
                        >
                          <option value="">Choose an employee without salary...</option>
                          {employeesWithoutSalary.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.full_name} {emp.employee_id ? `(#${emp.employee_id})` : ''} — {(Array.isArray(emp.branches) ? emp.branches[0]?.name : emp.branches?.name) || 'Store'}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="text-xs text-slate-700 font-bold mb-1.5 block">Base Salary (Monthly) *</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">৳</span>
                        <input
                          id="salary-base-input"
                          type="number" min={0} step={0.01} required
                          value={form.base_salary}
                          placeholder="e.g. 25000"
                          onChange={(e) => setForm({ ...form, base_salary: e.target.value })}
                          className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 font-bold border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-[#1dbf73] focus:ring-4 focus:ring-[#1dbf73]/15 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-700 font-bold mb-1.5 block">House Rent Allowance (HRA)</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">৳</span>
                        <input
                          id="salary-hra-input"
                          type="number" min={0} step={0.01}
                          value={form.house_rent_allowance}
                          placeholder="0"
                          onChange={(e) => setForm({ ...form, house_rent_allowance: e.target.value })}
                          className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 font-bold border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-[#1dbf73] focus:ring-4 focus:ring-[#1dbf73]/15 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-700 font-bold mb-1.5 block">Medical Allowance</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">৳</span>
                        <input
                          id="salary-medical-input"
                          type="number" min={0} step={0.01}
                          value={form.medical_allowance}
                          placeholder="0"
                          onChange={(e) => setForm({ ...form, medical_allowance: e.target.value })}
                          className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 font-bold border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-[#1dbf73] focus:ring-4 focus:ring-[#1dbf73]/15 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-700 font-bold mb-1.5 block">Transport Allowance</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">৳</span>
                        <input
                          id="salary-transport-input"
                          type="number" min={0} step={0.01}
                          value={form.transport_allowance}
                          placeholder="0"
                          onChange={(e) => setForm({ ...form, transport_allowance: e.target.value })}
                          className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 font-bold border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-[#1dbf73] focus:ring-4 focus:ring-[#1dbf73]/15 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Custom Rate Overrides */}
                <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#1dbf73]" /> Overtime & Snack Rate Overrides (Optional)
                      </h3>
                      <p className="text-xs text-emerald-800/80 mt-0.5">
                        If left blank, the system automatically uses the assigned store/branch default rates on payroll.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-emerald-950 font-bold mb-1.5 block">Overtime Rate (Tk / Hour Override)</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-emerald-600">৳</span>
                        <input
                          id="salary-ot-input"
                          type="number" min={0} step={0.01}
                          value={form.overtime_rate_per_hour}
                          placeholder="Leave blank for store default"
                          onChange={(e) => setForm({ ...form, overtime_rate_per_hour: e.target.value })}
                          className="w-full pl-8 pr-3.5 py-2.5 bg-white text-slate-900 font-bold border border-emerald-300 rounded-xl text-sm focus:outline-none focus:border-[#1dbf73] focus:ring-4 focus:ring-[#1dbf73]/15 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-emerald-950 font-bold mb-1.5 block">Snack Allowance (Tk / Day Override)</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-emerald-600">৳</span>
                        <input
                          id="salary-snack-input"
                          type="number" min={0} step={0.01}
                          value={form.daily_snack_allowance}
                          placeholder="Leave blank for store default"
                          onChange={(e) => setForm({ ...form, daily_snack_allowance: e.target.value })}
                          className="w-full pl-8 pr-3.5 py-2.5 bg-white text-slate-900 font-bold border border-emerald-300 rounded-xl text-sm focus:outline-none focus:border-[#1dbf73] focus:ring-4 focus:ring-[#1dbf73]/15 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200">
                  <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/80">
                    <span className="text-xs text-slate-500 font-medium block">Total Fixed Monthly Package:</span>
                    <span className="text-lg font-black text-[#1dbf73]">
                      ৳{totalPackage(form).toLocaleString()}
                    </span>
                    <span className="text-[11px] text-slate-400 font-semibold ml-1.5">+ Overtime & Snacks</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      id="cancel-salary-btn"
                      type="button"
                      variant="secondary"
                      onClick={() => { setShowModal(false); setEditingId(null); }}
                      className="h-11 px-5 rounded-xl font-bold border-slate-300"
                    >
                      Cancel
                    </Button>
                    <Button
                      id="save-salary-btn"
                      type="submit"
                      disabled={saving}
                      className="h-11 px-6 rounded-xl font-bold bg-[#1dbf73] hover:bg-[#19a865] text-white shadow-lg shadow-[#1dbf73]/25"
                    >
                      {saving ? <Spinner className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      {editingId ? 'Update Rates' : 'Save Salary Settings'}
                    </Button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          id="salary-search-input"
          type="text"
          placeholder="Search staff members by name, employee ID, or store branch..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white text-slate-900 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium shadow-sm focus:outline-none focus:border-[#1dbf73] focus:ring-4 focus:ring-[#1dbf73]/10 transition-all"
        />
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner className="w-10 h-10 text-[#1dbf73]" />
          <p className="text-slate-500 text-sm font-semibold mt-3">Loading salary configurations & store rates...</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-16 text-center border-dashed border-2 border-slate-200 rounded-3xl bg-slate-50/50">
          <div className="w-16 h-16 rounded-2xl bg-slate-200/60 flex items-center justify-center mx-auto mb-4">
            <DollarSign className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No salary settings found</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto mt-1">
            {search ? `No staff members match your search "${search}".` : 'Get started by configuring fixed salary rates for your store employees.'}
          </p>
          {!search && (
            <Button onClick={startAdd} className="mt-5 rounded-xl px-6 py-2.5 font-bold bg-[#1dbf73] hover:bg-[#19a865] text-white shadow-md">
              <Plus className="w-4 h-4 mr-1.5" /> Configure First Salary
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((s) => (
            <motion.div key={s.user_id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <Card className="p-5 bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-[#1dbf73]/40 rounded-2xl flex flex-col justify-between gap-4 transition-all duration-300">
                <div>
                  {/* Card Header: Employee info & Edit button */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-slate-900 font-extrabold text-base tracking-tight">{s.profiles?.full_name}</h4>
                        {s.profiles?.employee_id && <Badge variant="info" className="font-bold text-[11px]">#{s.profiles.employee_id}</Badge>}
                      </div>
                      <p className="text-slate-500 text-xs font-semibold flex items-center gap-1 mt-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {(Array.isArray(s.profiles?.branches) ? s.profiles.branches[0]?.name : s.profiles?.branches?.name) ?? 'No branch assigned'}
                      </p>
                    </div>
                    <button
                      id={`edit-salary-${s.user_id}`}
                      onClick={() => startEdit(s)}
                      className="text-slate-500 hover:text-white hover:bg-[#1dbf73] transition-all p-2 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-1.5 text-xs font-bold shadow-xs flex-shrink-0 group"
                      title="Edit Salary & Overtime Rates"
                    >
                      <Pencil className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      <span>Edit</span>
                    </button>
                  </div>

                  {/* 4 Allowances Box */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs mb-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/60">
                    <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Base Salary</span>
                      <span className="font-black text-slate-900 text-sm">৳{s.base_salary.toLocaleString()}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">House Rent</span>
                      <span className="font-bold text-slate-700 text-sm">৳{s.house_rent_allowance.toLocaleString()}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Medical</span>
                      <span className="font-bold text-slate-700 text-sm">৳{s.medical_allowance.toLocaleString()}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Transport</span>
                      <span className="font-bold text-slate-700 text-sm">৳{s.transport_allowance.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Custom vs Default Overtime/Snack Badges */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-100/80">
                      <Clock className="w-4 h-4 text-[#1dbf73] flex-shrink-0" />
                      <div className="overflow-hidden">
                        <span className="text-[9px] text-emerald-700 font-extrabold block uppercase tracking-wider">Overtime Rate</span>
                        <span className="font-extrabold text-xs block truncate">
                          {s.overtime_rate_per_hour !== null && s.overtime_rate_per_hour !== undefined ? (
                            <span className="text-emerald-950">৳{s.overtime_rate_per_hour}/Hr <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-1.5 py-0.5 rounded-md ml-0.5">Custom</span></span>
                          ) : (
                            <span className="text-slate-600">Store Default</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-100/80">
                      <Coffee className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <div className="overflow-hidden">
                        <span className="text-[9px] text-amber-700 font-extrabold block uppercase tracking-wider">Snack Allowance</span>
                        <span className="font-extrabold text-xs block truncate">
                          {s.daily_snack_allowance !== null && s.daily_snack_allowance !== undefined ? (
                            <span className="text-amber-950">৳{s.daily_snack_allowance}/Day <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded-md ml-0.5">Custom</span></span>
                          ) : (
                            <span className="text-slate-600">Store Default</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Monthly Total */}
                <div className="pt-3.5 flex justify-between items-center text-sm border-t border-slate-100">
                  <div>
                    <span className="text-slate-500 text-xs font-bold block uppercase tracking-wider">Total Monthly Package</span>
                    <span className="text-[10px] text-slate-400 font-semibold">+ Overtime & Snack Pay</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#1dbf73] font-black text-lg tracking-tight">৳{totalPackage(s).toLocaleString()}</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

