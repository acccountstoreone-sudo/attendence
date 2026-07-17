'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Clock, Plus, Trash2, Users, RefreshCcw, UserPlus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
  branch_id: string;
}

interface Employee {
  id: string;
  full_name: string;
  employee_id?: string;
  avatar_url?: string;
}

interface Assignment {
  id: string;
  effective_from: string;
  effective_to: string | null;
  shifts: { id: string; name: string; start_time: string; end_time: string };
  profiles: { id: string; full_name: string; employee_id?: string };
}

function fmt12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${((h % 12) || 12).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
}

export default function BranchManagerShiftsPage() {
  const supabase = useMemo(() => createClient(), []); // BUG-NEW-08 fix: memoize client
  const [branchId, setBranchId] = useState<string | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Forms
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [shiftForm, setShiftForm] = useState({ name: '', start_time: '09:00', end_time: '18:00', grace_period_minutes: 15 });
  const [savingShift, setSavingShift] = useState(false);

  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignForm, setAssignForm] = useState({ user_id: '', shift_id: '', effective_from: new Date().toISOString().slice(0, 10) });
  const [savingAssign, setSavingAssign] = useState(false);

  const getBranch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('branch_id').eq('id', user.id).single();
    if (profile?.branch_id) setBranchId(profile.branch_id);
  }, [supabase]);

  const loadData = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);

    const [shiftsRes, empsRes, assignRes] = await Promise.all([
      fetch(`/api/shifts?branch_id=${branchId}`),
      supabase.from('profiles').select('id, full_name, employee_id').eq('branch_id', branchId).eq('role', 'employee').eq('is_active', true).order('full_name'),
      fetch(`/api/employee-shifts?branch_id=${branchId}`),
    ]);

    const shiftsJson = await shiftsRes.json();
    const assignJson = await assignRes.json();

    if (shiftsJson.success) setShifts(shiftsJson.data ?? []);
    if (!empsRes.error) setEmployees(empsRes.data ?? []);
    if (assignJson.success) setAssignments(assignJson.data ?? []);

    setLoading(false);
  }, [branchId, supabase]);

  useEffect(() => { setTimeout(() => getBranch(), 0); }, [getBranch]);
  useEffect(() => { if (branchId) setTimeout(() => loadData(), 0); }, [branchId, loadData]);

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return;
    setSavingShift(true);
    const res = await fetch('/api/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...shiftForm, branch_id: branchId }),
    });
    const json = await res.json();
    if (json.success) {
      setFeedback({ type: 'success', text: `"${shiftForm.name}" shift created.` });
      setShiftForm({ name: '', start_time: '09:00', end_time: '18:00', grace_period_minutes: 15 });
      setShowShiftForm(false);
      loadData();
    } else {
      setFeedback({ type: 'error', text: json.error?.message || (typeof json.error === 'string' ? json.error : 'Failed to create shift.') });
    }
    setSavingShift(false);
  };

  const handleDeleteShift = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" shift? All assignments for this shift will also be removed.`)) return;
    const res = await fetch(`/api/shifts?id=${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      setFeedback({ type: 'success', text: `"${name}" deleted.` });
      loadData();
    } else {
      setFeedback({ type: 'error', text: json.error?.message || (typeof json.error === 'string' ? json.error : 'Failed to delete.') });
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAssign(true);
    const res = await fetch('/api/employee-shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assignForm),
    });
    const json = await res.json();
    if (json.success) {
      setFeedback({ type: 'success', text: 'Shift assigned successfully.' });
      setAssignForm({ user_id: '', shift_id: '', effective_from: new Date().toISOString().slice(0, 10) });
      setShowAssignForm(false);
      loadData();
    } else {
      setFeedback({ type: 'error', text: json.error?.message || (typeof json.error === 'string' ? json.error : 'Failed to assign shift.') });
    }
    setSavingAssign(false);
  };

  const handleRemoveAssignment = async (id: string) => {
    const res = await fetch(`/api/employee-shifts?id=${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      setFeedback({ type: 'success', text: 'Assignment removed.' });
    }
  };

  // Active assignments only (effective_to is null)
  const activeAssignments = assignments.filter((a) => !a.effective_to);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Clock className="w-7 h-7 text-indigo-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Shift Management</h1>
            <p className="text-sm text-slate-900">Define shift schedules and assign employees to shifts.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button id="refresh-shifts-btn" variant="secondary" onClick={loadData} disabled={loading}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button id="add-shift-btn" variant="secondary" onClick={() => setShowShiftForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> New Shift
          </Button>
          <Button id="assign-shift-btn" onClick={() => setShowAssignForm(true)} disabled={shifts.length === 0}>
            <UserPlus className="w-4 h-4 mr-1" /> Assign Shift
          </Button>
        </div>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-between ${
              feedback.type === 'success' ? 'bg-[#1dbf73]/20 text-[#1dbf73] border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
            }`}
          >
            {feedback.text}
            <button onClick={() => setFeedback(null)}><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Shift Form */}
      <AnimatePresence>
        {showShiftForm && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <Card className="p-5 border border-indigo-500/30 bg-slate-50/60 backdrop-blur">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Create New Shift</h2>
              <form onSubmit={handleAddShift} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs text-slate-900 mb-1 block">Shift Name *</label>
                  <input id="shift-name-input" type="text" required value={shiftForm.name}
                    onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                    placeholder="e.g., Morning" className="w-full bg-slate-100 text-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-900 mb-1 block">Start Time *</label>
                  <input id="shift-start-input" type="time" required value={shiftForm.start_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                    className="w-full bg-slate-100 text-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-900 mb-1 block">End Time *</label>
                  <input id="shift-end-input" type="time" required value={shiftForm.end_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                    className="w-full bg-slate-100 text-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-900 mb-1 block">Grace (mins)</label>
                  <input id="shift-grace-input" type="number" min={0} max={120} value={shiftForm.grace_period_minutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, grace_period_minutes: Number(e.target.value) })}
                    className="w-full bg-slate-100 text-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="col-span-2 sm:col-span-4 flex gap-2 justify-end">
                  <Button id="cancel-shift-btn" type="button" variant="secondary" onClick={() => setShowShiftForm(false)}>Cancel</Button>
                  <Button id="save-shift-btn" type="submit" disabled={savingShift}>
                    {savingShift ? <Spinner className="w-4 h-4" /> : 'Create Shift'}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assign Form */}
      <AnimatePresence>
        {showAssignForm && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <Card className="p-5 border border-emerald-500/30 bg-slate-50/60 backdrop-blur">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Assign Employee to Shift</h2>
              <form onSubmit={handleAssign} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-slate-900 mb-1 block">Employee *</label>
                  <select id="assign-employee-select" required value={assignForm.user_id}
                    onChange={(e) => setAssignForm({ ...assignForm, user_id: e.target.value })}
                    className="w-full bg-slate-100 text-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select employee…</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.full_name} {emp.employee_id ? `(${emp.employee_id})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-900 mb-1 block">Shift *</label>
                  <select id="assign-shift-select" required value={assignForm.shift_id}
                    onChange={(e) => setAssignForm({ ...assignForm, shift_id: e.target.value })}
                    className="w-full bg-slate-100 text-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select shift…</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({fmt12(s.start_time)} – {fmt12(s.end_time)})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-900 mb-1 block">Effective From *</label>
                  <input id="assign-from-input" type="date" required value={assignForm.effective_from}
                    onChange={(e) => setAssignForm({ ...assignForm, effective_from: e.target.value })}
                    className="w-full bg-slate-100 text-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button id="cancel-assign-btn" type="button" variant="secondary" onClick={() => setShowAssignForm(false)} className="flex-1">Cancel</Button>
                  <Button id="save-assign-btn" type="submit" disabled={savingAssign} className="flex-1">
                    {savingAssign ? <Spinner className="w-4 h-4" /> : 'Assign'}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Shift Definitions */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Shift Definitions</h2>
            {shifts.length === 0 ? (
              <Card className="p-8 text-center">
                <Clock className="w-10 h-10 text-slate-900 mx-auto mb-2" />
                <p className="text-slate-900 text-sm">No shifts created yet.</p>
              </Card>
            ) : (
              shifts.map((s) => (
                <motion.div key={s.id} layout>
                  <Card className="p-4 flex items-center justify-between gap-3 bg-slate-50/60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-slate-900 font-semibold">{s.name}</p>
                        <p className="text-slate-900 text-sm">{fmt12(s.start_time)} – {fmt12(s.end_time)}</p>
                        <p className="text-slate-500 text-xs">{s.grace_period_minutes} min grace period</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="info">
                        {activeAssignments.filter((a) => a.shifts?.id === s.id).length} staff
                      </Badge>
                      <button id={`delete-shift-${s.id}`} onClick={() => handleDeleteShift(s.id, s.name)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>

          {/* Active Assignments */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4" /> Active Assignments
            </h2>
            {activeAssignments.length === 0 ? (
              <Card className="p-8 text-center">
                <Users className="w-10 h-10 text-slate-900 mx-auto mb-2" />
                <p className="text-slate-900 text-sm">No shift assignments yet. Assign employees to shifts above.</p>
              </Card>
            ) : (
              activeAssignments.map((a) => (
                <motion.div key={a.id} layout>
                  <Card className="p-4 flex items-center justify-between gap-3 bg-slate-50/60">
                    <div>
                      <p className="text-slate-900 font-medium">{a.profiles?.full_name}</p>
                      <p className="text-indigo-300 text-sm">{a.shifts?.name} · {fmt12(a.shifts?.start_time)} – {fmt12(a.shifts?.end_time)}</p>
                      <p className="text-slate-500 text-xs">Since {new Date(a.effective_from).toLocaleDateString()}</p>
                    </div>
                    <button id={`remove-assign-${a.id}`} onClick={() => handleRemoveAssignment(a.id)}
                      className="text-slate-500 hover:text-red-400 transition-colors p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </Card>
                </motion.div>
              ))
            )}
          </div>

        </div>
      )}
    </div>
  );
}

