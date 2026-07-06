'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Settings, Clock, CalendarDays, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BranchSettings {
  work_start_time: string;
  work_end_time: string;
  late_grace_minutes: number;
  overtime_after_minutes: number;
  half_day_hours: number;
  weekly_off_days: number[];
}

const DEFAULT_SETTINGS: BranchSettings = {
  work_start_time: '09:00:00',
  work_end_time: '18:00:00',
  late_grace_minutes: 15,
  overtime_after_minutes: 30,
  half_day_hours: 4,
  weekly_off_days: [5], // Friday
};

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function StoreSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BranchSettings>(DEFAULT_SETTINGS);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/branch-settings');
      const json = await res.json();
      if (json.success && json.data) {
        setSettings(json.data);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/branch-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to update store settings.');
      }
      setFeedback({ type: 'success', message: 'Duty hours and settings updated successfully.' });
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const toggleOffDay = (day: number) => {
    setSettings((prev) => {
      const isSelected = prev.weekly_off_days.includes(day);
      const newOffDays = isSelected
        ? prev.weekly_off_days.filter((d) => d !== day)
        : [...prev.weekly_off_days, day];
      return { ...prev, weekly_off_days: newOffDays };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" label="Loading Store Settings..." />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-[#1E293B] pb-6">
        <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Store Duty Hours & Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure the operating hours, grace periods, and weekly days off for your branch.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl border flex items-center space-x-3 shadow-lg ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span className="text-sm font-semibold">{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Shift Timings */}
          <Card className="bg-[#0A101C] border border-[#1E293B] p-6 rounded-xl shadow-md">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-[#1E293B] rounded-lg text-amber-500">
                <Clock className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold text-white">Daily Shift Timings</h2>
            </div>
            
            <div className="space-y-5">
              <Input
                label="Standard Work Start Time"
                type="time"
                step="1"
                required
                value={settings.work_start_time}
                onChange={(e) => setSettings({ ...settings, work_start_time: e.target.value })}
                className="bg-transparent border-[#1E293B] focus:border-slate-500 text-slate-200"
              />
              <Input
                label="Standard Work End Time"
                type="time"
                step="1"
                required
                value={settings.work_end_time}
                onChange={(e) => setSettings({ ...settings, work_end_time: e.target.value })}
                className="bg-transparent border-[#1E293B] focus:border-slate-500 text-slate-200"
              />
              
              <div className="pt-2">
                <p className="text-xs text-slate-500 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  Staff checking in after the Start Time + Grace Period will be marked as Late.
                </p>
              </div>
            </div>
          </Card>

          {/* Grace Periods & Overtime */}
          <Card className="bg-[#0A101C] border border-[#1E293B] p-6 rounded-xl shadow-md">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-[#1E293B] rounded-lg text-emerald-500">
                <Settings className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold text-white">Policies & Allowances</h2>
            </div>
            
            <div className="space-y-5">
              <Input
                label="Late Check-in Grace Period (Minutes)"
                type="number"
                min="0"
                max="120"
                required
                value={settings.late_grace_minutes}
                onChange={(e) => setSettings({ ...settings, late_grace_minutes: parseInt(e.target.value) || 0 })}
                className="bg-transparent border-[#1E293B] focus:border-slate-500 text-slate-200"
              />
              <Input
                label="Overtime Trigger Threshold (Minutes)"
                type="number"
                min="0"
                required
                value={settings.overtime_after_minutes}
                onChange={(e) => setSettings({ ...settings, overtime_after_minutes: parseInt(e.target.value) || 0 })}
                className="bg-transparent border-[#1E293B] focus:border-slate-500 text-slate-200"
              />
              <Input
                label="Half-Day Qualification Minimum (Hours)"
                type="number"
                min="1"
                max="8"
                step="0.5"
                required
                value={settings.half_day_hours}
                onChange={(e) => setSettings({ ...settings, half_day_hours: parseFloat(e.target.value) || 4 })}
                className="bg-transparent border-[#1E293B] focus:border-slate-500 text-slate-200"
              />
            </div>
          </Card>
        </div>

        {/* Weekly Off Days */}
        <Card className="bg-[#0A101C] border border-[#1E293B] p-6 rounded-xl shadow-md">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-[#1E293B] rounded-lg text-blue-500">
              <CalendarDays className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white">Weekly Rest Days</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = settings.weekly_off_days.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleOffDay(day.value)}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-semibold transition-all ${
                    isSelected
                      ? 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                      : 'bg-transparent border-[#1E293B] text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  {isSelected && <CheckCircle2 className="w-4 h-4" />}
                  {day.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-4">
            Select the default non-working days for your branch. Employees are not penalized for absenteeism on these days.
          </p>
        </Card>

        {/* Submit */}
        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            variant="primary"
            isLoading={saving}
            className="bg-amber-600 hover:bg-amber-500 text-white font-semibold border-none shadow-[0_0_20px_rgba(217,119,6,0.4)] px-8"
          >
            Save Branch Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
