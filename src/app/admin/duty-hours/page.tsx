'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  Clock, Save, History, ChevronDown, ChevronRight, Building2, CheckCircle2, XCircle, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface BranchSettings {
  work_start_time: string;
  work_end_time: string;
  late_grace_minutes: number;
  overtime_after_minutes: number;
  half_day_hours: number;
  overtime_slot_minutes: number;
  holiday_overtime_multiplier: number;
  require_overtime_approval: boolean;
  weekly_off_days: number[];
}

interface HistoryEntry {
  id: string;
  work_start_time: string;
  work_end_time: string;
  late_grace_minutes: number;
  overtime_after_minutes: number;
  half_day_hours: number;
  overtime_slot_minutes?: number;
  holiday_overtime_multiplier?: number;
  require_overtime_approval?: boolean;
  weekly_off_days?: number[];
  change_reason?: string | null;
  effective_from: string;
  effective_to: string | null;
  profiles: { full_name: string; role: string } | null;
}

function timeToInput(t: string | null | undefined): string {
  if (!t) return '09:00';
  return t.substring(0, 5);
}

export default function AdminDutyHoursPage() {
  const supabase = createClient();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [settings, setSettings] = useState<BranchSettings>({
    work_start_time: '09:00',
    work_end_time: '17:00',
    late_grace_minutes: 15,
    overtime_after_minutes: 0,
    half_day_hours: 4,
    overtime_slot_minutes: 15,
    holiday_overtime_multiplier: 2.0,
    require_overtime_approval: false,
    weekly_off_days: [5], // Default Friday
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [changeReason, setChangeReason] = useState('');

  // Load all branches
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('branches')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      if (data && data.length > 0) {
        setBranches(data);
        setSelectedBranchId(data[0].id);
      }
      setLoadingBranches(false);
    }
    load();
  }, [supabase]);

  // Load settings + history when branch selected
  const loadBranchData = useCallback(async (branchId: string) => {
    if (!branchId) return;
    setLoadingSettings(true);
    setFeedback(null);
    setShowHistory(false);

    try {
      // Fetch current settings
      const res = await fetch(`/api/branch-settings?branch_id=${branchId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSettings({
          work_start_time: timeToInput(json.data.work_start_time),
          work_end_time: timeToInput(json.data.work_end_time),
          late_grace_minutes: json.data.late_grace_minutes ?? 15,
          overtime_after_minutes: json.data.overtime_after_minutes ?? 0,
          half_day_hours: json.data.half_day_hours ?? 4,
          overtime_slot_minutes: json.data.overtime_slot_minutes ?? 15,
          holiday_overtime_multiplier: json.data.holiday_overtime_multiplier ?? 2.0,
          require_overtime_approval: Boolean(json.data.require_overtime_approval),
          weekly_off_days: Array.isArray(json.data.weekly_off_days) ? json.data.weekly_off_days : [5],
        });
      } else {
        // No settings yet — use defaults
        setSettings({ 
          work_start_time: '09:00', work_end_time: '17:00', late_grace_minutes: 15, overtime_after_minutes: 0, half_day_hours: 4,
          overtime_slot_minutes: 15, holiday_overtime_multiplier: 2.0, require_overtime_approval: false, weekly_off_days: [5]
        });
      }

      // Fetch history
      const hRes = await fetch(`/api/branch-settings/history?branch_id=${branchId}`);
      const hJson = await hRes.json();
      if (hJson.success) {
        setHistory(hJson.data || []);
      }
    } catch {
      setFeedback({ type: 'error', text: 'Failed to load branch settings.' });
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBranchId) loadBranchData(selectedBranchId);
  }, [selectedBranchId, loadBranchData]);

  const handleSave = async () => {
    if (!selectedBranchId) return;

    // Client-side validation
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(settings.work_start_time) || !timeRegex.test(settings.work_end_time)) {
      setFeedback({ type: 'error', text: 'Please enter valid Start and End times in HH:MM format (24-hour).' });
      return;
    }
    if (settings.work_start_time === settings.work_end_time) {
      setFeedback({ type: 'error', text: 'Duty Start Time and Duty End Time cannot be identical.' });
      return;
    }
    if (Number.isNaN(settings.late_grace_minutes) || settings.late_grace_minutes < 0 || settings.late_grace_minutes > 120) {
      setFeedback({ type: 'error', text: 'Late Grace Period must be between 0 and 120 minutes.' });
      return;
    }
    if (Number.isNaN(settings.overtime_after_minutes) || settings.overtime_after_minutes < 0) {
      setFeedback({ type: 'error', text: 'Overtime Threshold cannot be negative.' });
      return;
    }
    if (Number.isNaN(settings.half_day_hours) || settings.half_day_hours < 1 || settings.half_day_hours > 8) {
      setFeedback({ type: 'error', text: 'Half-Day Hours must be between 1 and 8 hours.' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/branch-settings?branch_id=${selectedBranchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_start_time: settings.work_start_time + ':00',
          work_end_time: settings.work_end_time + ':00',
          late_grace_minutes: Number(settings.late_grace_minutes),
          overtime_after_minutes: Number(settings.overtime_after_minutes),
          half_day_hours: Number(settings.half_day_hours),
          overtime_slot_minutes: Number(settings.overtime_slot_minutes),
          holiday_overtime_multiplier: Number(settings.holiday_overtime_multiplier),
          require_overtime_approval: Boolean(settings.require_overtime_approval),
          weekly_off_days: settings.weekly_off_days,
          change_reason: changeReason || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to save');
      setFeedback({ type: 'success', text: 'Duty hours updated successfully! History has been recorded.' });
      setChangeReason('');
      await loadBranchData(selectedBranchId);
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: (err as Error).message || 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-white via-blue-950/20 to-slate-50 p-6 rounded-3xl border border-slate-200 shadow-2xl">
        <div>
          <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Clock className="w-4 h-4" />
            <span>Duty Hours Management</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Branch Duty Hours
          </h1>
          <p className="text-sm text-slate-900 mt-1">
            Set work start/end times per branch. Overtime is auto-calculated after the end time.
          </p>
        </div>
      </div>

      {/* Branch Selector */}
      {loadingBranches ? (
        <div className="flex justify-center py-8"><Spinner size="lg" label="Loading branches..." /></div>
      ) : (
        <Card className="bg-white border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-blue-400" />
            <label className="text-xs font-bold uppercase text-slate-900 tracking-widest">Select Branch</label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {branches.map(b => (
              <button
                key={b.id}
                onClick={() => setSelectedBranchId(b.id)}
                className={`px-3 py-2.5 rounded-xl border text-sm font-bold transition-all text-left ${
                  selectedBranchId === b.id
                    ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-sm shadow-blue-500/20'
                    : 'bg-white border-slate-200 text-slate-900 hover:border-slate-400 hover:text-slate-700'
                }`}
              >
                <span className={`block text-[10px] font-extrabold uppercase tracking-wider mb-0.5 ${selectedBranchId === b.id ? 'text-blue-500/80' : 'text-slate-400'}`}>{b.code}</span>
                {b.name}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Settings Form */}
      {selectedBranchId && (
        <AnimatePresence mode="wait">
          {loadingSettings ? (
            <div className="flex justify-center py-8"><Spinner size="lg" label="Loading settings..." /></div>
          ) : (
            <motion.div
              key={selectedBranchId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Feedback */}
              <AnimatePresence>
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={`flex items-center gap-3 p-4 rounded-xl border text-sm font-medium ${
                      feedback.type === 'success'
                        ? 'bg-[#1dbf73]/10 border-emerald-500/20 text-[#1dbf73]'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}
                  >
                    {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
                    <span>{feedback.text}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <Card className="bg-white border-slate-200">
                <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">{selectedBranch?.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Configure duty hours for this branch</p>
                  </div>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                    {selectedBranch?.code}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Work Start Time */}
                  <div>
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-widest mb-2">
                      Duty Start Time
                    </label>
                    <input
                      type="time"
                      value={settings.work_start_time}
                      onChange={e => setSettings(s => ({ ...s, work_start_time: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  {/* Work End Time */}
                  <div>
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-widest mb-2">
                      Duty End Time (Overtime starts after this)
                    </label>
                    <input
                      type="time"
                      value={settings.work_end_time}
                      onChange={e => setSettings(s => ({ ...s, work_end_time: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  {/* Late Grace */}
                  <div>
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-widest mb-2">
                      Late Grace Period (minutes)
                    </label>
                    <input
                      type="number"
                      min={0} max={120}
                      value={settings.late_grace_minutes}
                      onChange={e => setSettings(s => ({ ...s, late_grace_minutes: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <p className="text-xs text-slate-900 mt-1">Check-in within this window is still counted as on-time</p>
                  </div>

                  {/* Overtime after */}
                  <div>
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-widest mb-2">
                      Overtime Threshold (minutes after end time)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={settings.overtime_after_minutes}
                      onChange={e => setSettings(s => ({ ...s, overtime_after_minutes: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <p className="text-xs text-slate-900 mt-1">0 = overtime starts immediately after duty end time</p>
                  </div>

                  {/* Half day hours */}
                  <div>
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-widest mb-2">
                      Half-Day Hours Threshold
                    </label>
                    <input
                      type="number"
                      min={1} max={8} step={0.5}
                      value={settings.half_day_hours}
                      onChange={e => setSettings(s => ({ ...s, half_day_hours: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <p className="text-xs text-slate-900 mt-1">If worked hours are below this, attendance is marked as Half Day</p>
                  </div>

                  {/* Overtime Slot Rounding */}
                  <div>
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-widest mb-2">
                      Overtime Slot Rounding (minutes)
                    </label>
                    <select
                      value={settings.overtime_slot_minutes}
                      onChange={e => setSettings(s => ({ ...s, overtime_slot_minutes: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value={0}>Exact minutes (0m rounding)</option>
                      <option value={15}>15-minute intervals (Standard)</option>
                      <option value={30}>30-minute intervals (Half-hour)</option>
                      <option value={60}>60-minute intervals (Hourly)</option>
                    </select>
                    <p className="text-xs text-slate-900 mt-1">Round overtime down to the nearest block</p>
                  </div>

                  {/* Holiday Overtime Multiplier */}
                  <div>
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-widest mb-2">
                      Holiday / Off-Day Overtime Multiplier
                    </label>
                    <select
                      value={settings.holiday_overtime_multiplier}
                      onChange={e => setSettings(s => ({ ...s, holiday_overtime_multiplier: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value={1.0}>1.0x (Standard Rate)</option>
                      <option value={1.5}>1.5x (Time & Half)</option>
                      <option value={2.0}>2.0x (Double Rate - Default)</option>
                      <option value={2.5}>2.5x (Double & Half)</option>
                      <option value={3.0}>3.0x (Triple Rate)</option>
                    </select>
                    <p className="text-xs text-slate-900 mt-1">Pay rate multiplier for duties on Fridays and holidays</p>
                  </div>

                  {/* Require Overtime Approval Toggle */}
                  <div>
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-widest mb-2">
                      Overtime Approval Workflow
                    </label>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-sm font-bold text-slate-900 block">Require Verification</span>
                        <span className="text-xs text-slate-900">Overtime requires BM/Admin sign-off before payout</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.require_overtime_approval}
                        onChange={e => setSettings(s => ({ ...s, require_overtime_approval: e.target.checked }))}
                        className="w-5 h-5 text-[#1dbf73] rounded border-slate-300 focus:ring-0 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Weekly Off Days */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-widest mb-2">
                      Weekly Off Days
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 0, label: 'Sunday' }, { id: 1, label: 'Monday' }, { id: 2, label: 'Tuesday' },
                        { id: 3, label: 'Wednesday' }, { id: 4, label: 'Thursday' }, { id: 5, label: 'Friday' }, { id: 6, label: 'Saturday' }
                      ].map(day => {
                        const isSelected = settings.weekly_off_days.includes(day.id);
                        return (
                          <button
                            key={day.id}
                            onClick={() => {
                              setSettings(s => {
                                const newDays = isSelected 
                                  ? s.weekly_off_days.filter(d => d !== day.id)
                                  : [...s.weekly_off_days, day.id];
                                return { ...s, weekly_off_days: newDays };
                              });
                            }}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                              isSelected 
                                ? 'bg-[#1dbf73] border-[#16965a] text-white' 
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Change reason */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-widest mb-2">
                      Change Reason (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramadan schedule, summer hours, updated holiday multiplier..."
                      value={changeReason}
                      onChange={e => setChangeReason(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Preview Banner */}
                <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center gap-2 text-blue-700 font-bold">
                    <Info className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                    <span>Duty Hours:</span>
                    <span className="font-mono text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-md">{settings.work_start_time} – {settings.work_end_time}</span>
                  </div>
                  <div className="text-slate-900 flex items-center gap-1">
                    <span>Late after:</span> <span className="text-slate-900 font-mono font-bold">{settings.work_start_time}</span>
                    {settings.late_grace_minutes > 0 && <span className="text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">+{settings.late_grace_minutes}min grace</span>}
                  </div>
                  <div className="text-slate-900 flex items-center gap-1">
                    <span>Overtime: after</span> <span className="text-amber-700 font-mono font-bold">{settings.work_end_time}</span>
                    {settings.overtime_after_minutes > 0 && <span className="text-amber-800 font-semibold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">+{settings.overtime_after_minutes}min threshold</span>}
                  </div>
                  <div className="text-slate-900 flex items-center gap-1">
                    <span>Slot: <strong className="text-slate-900">{settings.overtime_slot_minutes}m</strong></span>
                  </div>
                  <div className="text-slate-900 flex items-center gap-1">
                    <span>Holiday OT: <strong className="text-purple-800 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">{settings.holiday_overtime_multiplier}x</strong></span>
                  </div>
                  <div className="text-slate-900 flex items-center gap-1">
                    <span>Status: <strong className={`px-1.5 py-0.5 rounded font-bold ${settings.require_overtime_approval ? 'text-rose-800 bg-rose-50 border border-rose-200' : 'text-emerald-800 bg-emerald-50 border border-emerald-200'}`}>{settings.require_overtime_approval ? 'Approval Required' : 'Auto-Approved'}</strong></span>
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => selectedBranchId && loadBranchData(selectedBranchId)}
                    disabled={saving || loadingSettings}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 font-bold"
                  >
                    Reset Form
                  </Button>
                  <Button
                    variant="primary"
                    icon={saving ? undefined : <Save className="w-4 h-4 text-white" />}
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[#1dbf73] text-[#ffffff] hover:bg-[#16965a] border-none font-bold"
                  >
                    {saving ? 'Saving...' : 'Save Duty Hours'}
                  </Button>
                </div>
              </Card>

              {/* Duty Hours History */}
              {history.length > 0 && (
                <Card className="bg-white border-slate-200">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-[#1dbf73]" />
                      <h3 className="font-bold text-slate-900 text-sm">Duty Hours Change History</h3>
                      <span className="text-xs text-slate-500 font-semibold">({history.length} records)</span>
                    </div>
                    {showHistory ? <ChevronDown className="w-4 h-4 text-slate-900" /> : <ChevronRight className="w-4 h-4 text-slate-900" />}
                  </button>

                  <AnimatePresence>
                    {showHistory && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 space-y-2">
                          {history.map((entry, idx) => (
                            <div
                              key={entry.id}
                              className={`p-4 rounded-xl border text-xs ${
                                idx === 0
                                  ? 'bg-emerald-50/60 border-emerald-500/30'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  {idx === 0 && (
                                    <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-800 rounded-full text-[10px] font-bold uppercase tracking-wider">Current Schedule</span>
                                  )}
                                  <span className="font-mono text-slate-900 font-bold text-sm bg-white px-2 py-0.5 rounded border border-slate-200">
                                    {timeToInput(entry.work_start_time)} – {timeToInput(entry.work_end_time)}
                                  </span>
                                </div>
                                <div className="text-slate-500 flex items-center gap-1 font-medium">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {new Date(entry.effective_from).toLocaleString('en-BD', {
                                    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka'
                                  })}
                                  {entry.effective_to && (
                                    <span> → {new Date(entry.effective_to).toLocaleString('en-BD', {
                                      dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Dhaka'
                                    })}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-3 text-slate-900 font-medium pt-1">
                                <span>Grace: <strong className="text-slate-900">{entry.late_grace_minutes}min</strong></span>
                                <span>OT Threshold: <strong className="text-slate-900">{entry.overtime_after_minutes}min after end</strong></span>
                                <span>Half-day: <strong className="text-slate-900">&lt;{entry.half_day_hours}h</strong></span>
                                {entry.overtime_slot_minutes !== undefined && <span>Slot: <strong className="text-slate-900">{entry.overtime_slot_minutes}m</strong></span>}
                                {entry.holiday_overtime_multiplier !== undefined && <span>Holiday: <strong className="text-purple-800 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">{entry.holiday_overtime_multiplier}x</strong></span>}
                                {entry.require_overtime_approval !== undefined && <span>OT Workflow: <strong className={`px-1.5 py-0.5 rounded font-bold ${entry.require_overtime_approval ? 'text-rose-800 bg-rose-50 border border-rose-200' : 'text-emerald-800 bg-emerald-50 border border-emerald-200'}`}>{entry.require_overtime_approval ? 'Required' : 'Auto'}</strong></span>}
                                {entry.weekly_off_days !== undefined && (
                                  <span>Weekly Off: <strong className="text-indigo-800 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                                    {entry.weekly_off_days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}
                                  </strong></span>
                                )}
                                {entry.change_reason && (
                                  <span>Reason: <strong className="text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">{entry.change_reason}</strong></span>
                                )}
                                {entry.profiles && (
                                  <span>By: <strong className="text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">{entry.profiles.full_name}</strong></span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

