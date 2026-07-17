'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { CalendarDays, Plus, Trash2, RefreshCcw, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  is_recurring: boolean;
  created_at: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function AdminHolidaysPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', holiday_date: '', is_recurring: false });

  const loadHolidays = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/holidays?year=${year}`);
    const json = await res.json();
    if (json.success) setHolidays(json.data ?? []);
    else setFeedback({ type: 'error', text: json.error?.message || (typeof json.error === 'string' ? json.error : 'Failed to load holidays.') });
    setLoading(false);
  }, [year]);

  useEffect(() => { setTimeout(() => loadHolidays(), 0); }, [loadHolidays]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.holiday_date) return;
    setSaving(true);
    const res = await fetch('/api/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (json.success) {
      setFeedback({ type: 'success', text: `"${form.name}" added successfully.` });
      setForm({ name: '', holiday_date: '', is_recurring: false });
      setShowForm(false);
      loadHolidays();
    } else {
      setFeedback({ type: 'error', text: json.error?.message || (typeof json.error === 'string' ? json.error : 'Failed to add holiday.') });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    setDeleting(id);
    const res = await fetch(`/api/holidays?id=${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      setFeedback({ type: 'success', text: `"${name}" deleted.` });
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    } else {
      setFeedback({ type: 'error', text: json.error?.message || (typeof json.error === 'string' ? json.error : 'Failed to delete.') });
    }
    setDeleting(null);
  };

  // Group holidays by month
  const byMonth = holidays.reduce<Record<number, Holiday[]>>((acc, h) => {
    const month = new Date(h.holiday_date).getMonth();
    if (!acc[month]) acc[month] = [];
    acc[month].push(h);
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-7 h-7 text-indigo-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Public Holidays</h1>
            <p className="text-sm text-slate-900">Attendance will not be counted on holidays.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Year picker */}
          <div className="flex items-center gap-1 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">
            <button onClick={() => setYear((y) => y - 1)} className="text-slate-900 hover:text-slate-900 px-1">‹</button>
            <span className="text-slate-900 font-semibold w-12 text-center">{year}</span>
            <button onClick={() => setYear((y) => y + 1)} className="text-slate-900 hover:text-slate-900 px-1">›</button>
          </div>
          <Button id="refresh-holidays-btn" variant="secondary" onClick={loadHolidays} disabled={loading}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button id="add-holiday-btn" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Holiday
          </Button>
        </div>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`rounded-lg px-4 py-3 text-sm font-medium ${
              feedback.type === 'success' ? 'bg-[#1dbf73]/20 text-[#1dbf73] border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
            }`}
          >
            {feedback.text}
            <button onClick={() => setFeedback(null)} className="ml-4 text-xs opacity-60 hover:opacity-100">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <Card className="p-5 border border-indigo-500/30 bg-slate-50/60 backdrop-blur">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Add New Holiday</h2>
              <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-900 mb-1 block">Holiday Name *</label>
                  <input
                    id="holiday-name-input"
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Eid-ul-Adha"
                    className="w-full bg-slate-100 text-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-900 mb-1 block">Date *</label>
                  <input
                    id="holiday-date-input"
                    type="date"
                    required
                    value={form.holiday_date}
                    onChange={(e) => setForm({ ...form, holiday_date: e.target.value })}
                    className="w-full bg-slate-100 text-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 text-sm text-slate-900 cursor-pointer mb-3">
                    <input
                      id="holiday-recurring-checkbox"
                      type="checkbox"
                      checked={form.is_recurring}
                      onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })}
                      className="rounded"
                    />
                    Repeats every year
                  </label>
                  <div className="flex gap-2">
                    <Button id="save-holiday-btn" type="submit" disabled={saving} className="flex-1">
                      {saving ? <Spinner className="w-4 h-4" /> : 'Save'}
                    </Button>
                    <Button id="cancel-holiday-btn" type="button" variant="secondary" onClick={() => setShowForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
      ) : holidays.length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarDays className="w-12 h-12 text-slate-900 mx-auto mb-3" />
          <p className="text-slate-900">No holidays defined for {year}. Click &quot;Add Holiday&quot; to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MONTHS.map((monthName, idx) => {
            const monthHolidays = byMonth[idx];
            if (!monthHolidays?.length) return null;
            return (
              <Card key={idx} className="p-4 bg-slate-50/60">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">{monthName} {year}</h3>
                <div className="space-y-2">
                  {monthHolidays.map((h) => (
                    <motion.div
                      key={h.id}
                      layout
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-100/50 border border-slate-200"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-indigo-400 font-bold text-sm w-6 text-center">
                          {new Date(h.holiday_date).getDate()}
                        </span>
                        <div className="min-w-0">
                          <p className="text-slate-900 text-sm font-medium truncate">{h.name}</p>
                          {h.is_recurring && (
                            <span className="flex items-center gap-1 text-xs text-[#1dbf73]">
                              <Repeat className="w-3 h-3" /> Recurring
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        id={`delete-holiday-${h.id}`}
                        onClick={() => handleDelete(h.id, h.name)}
                        disabled={deleting === h.id}
                        className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                      >
                        {deleting === h.id ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </motion.div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Summary badge */}
      {!loading && holidays.length > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="info">{holidays.length} holidays in {year}</Badge>
          <Badge variant="success">{holidays.filter((h) => h.is_recurring).length} recurring</Badge>
        </div>
      )}
    </div>
  );
}

