'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Settings, Shield, Bell, Clock, Building, Save, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CompanyProfile {
  name: string;
  hq_address: string;
  working_hours_start: string;
  working_hours_end: string;
  grace_period_minutes: number;
  overtime_multiplier: number;
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<'general' | 'attendance' | 'security'>('general');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [profile, setProfile] = useState<CompanyProfile>({
    name: 'Anchor Fashion Ltd.',
    hq_address: 'Anchor Tower, Dhaka, Bangladesh',
    working_hours_start: '09:00',
    working_hours_end: '18:00',
    grace_period_minutes: 15,
    overtime_multiplier: 1.5,
  });

  // Bug 9 fix: Load real data from API on mount
  const loadSettings = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/company/profile');
      const json = await res.json();
      if (json.success && json.data) {
        setProfile({
          name: json.data.name || 'Anchor Fashion Ltd.',
          hq_address: json.data.hq_address || '',
          working_hours_start: json.data.working_hours_start || '09:00',
          working_hours_end: json.data.working_hours_end || '18:00',
          grace_period_minutes: json.data.grace_period_minutes ?? 15,
          overtime_multiplier: json.data.overtime_multiplier ?? 1.5,
        });
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setFetching(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadSettings(); }, [loadSettings]);

  // Bug 9 fix: Actually save to the real API
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/company/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          hq_address: profile.hq_address,
          working_hours_start: profile.working_hours_start,
          working_hours_end: profile.working_hours_end,
          grace_period_minutes: Number(profile.grace_period_minutes),
          overtime_multiplier: Number(profile.overtime_multiplier),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedback({ type: 'success', text: 'Company settings saved successfully.' });
      } else {
        throw new Error(json.error?.message || 'Save failed.');
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: (err as Error).message || 'Failed to save settings.' });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-slate-400 text-sm">
        Loading configuration...
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#1dbf73_1px,transparent_1px)] [background-size:40px_40px] mix-blend-overlay z-0" />

        <div className="relative z-10 pointer-events-none">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-[#1dbf73]" />
            <span className="px-3 py-1 rounded-full bg-[#1dbf73]/10 border border-[#1dbf73]/30 text-[#1dbf73] text-xs font-bold uppercase tracking-widest">
              System Configuration
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">
            Platform Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage global operational parameters, security thresholds, and company preferences.
          </p>
        </div>
      </motion.div>

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex items-center gap-3 p-4 rounded-xl border text-sm font-medium ${
              feedback.type === 'success'
                ? 'bg-[#1dbf73]/10 border-emerald-500/20 text-[#1dbf73]'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span>{feedback.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

        {/* Navigation Tabs */}
        <div className="md:col-span-1 space-y-2">
          {([
            { key: 'general', label: 'General Information', icon: <Building className="w-4 h-4" /> },
            { key: 'attendance', label: 'Attendance Rules', icon: <Clock className="w-4 h-4" /> },
            { key: 'security', label: 'Security & Access', icon: <Shield className="w-4 h-4" /> },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                activeTab === tab.key
                  ? 'bg-[#1dbf73]/10 text-[#1dbf73] border border-[#1dbf73]/30'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Configuration Forms */}
        <div className="md:col-span-3">
          <Card className="bg-white border-slate-200 shadow-2xl">
            <form onSubmit={handleSave} className="space-y-6">

              {activeTab === 'general' && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">Company Profile</h3>
                    <p className="text-xs text-slate-400">Basic information about the organization.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Company Name</label>
                      <input
                        type="text"
                        required
                        value={profile.name}
                        onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] transition-colors"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Headquarters Address</label>
                      <textarea
                        rows={2}
                        value={profile.hq_address}
                        onChange={(e) => setProfile((p) => ({ ...p, hq_address: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] resize-none transition-colors"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'attendance' && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">Attendance Parameters</h3>
                    <p className="text-xs text-slate-400">Configure global shift timings and grace periods.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Default Shift Start</label>
                      <input
                        type="time"
                        required
                        value={profile.working_hours_start}
                        onChange={(e) => setProfile((p) => ({ ...p, working_hours_start: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Default Shift End</label>
                      <input
                        type="time"
                        required
                        value={profile.working_hours_end}
                        onChange={(e) => setProfile((p) => ({ ...p, working_hours_end: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Late Grace Period (Mins)</label>
                      <input
                        type="number"
                        required
                        min={0}
                        max={120}
                        value={profile.grace_period_minutes}
                        onChange={(e) => setProfile((p) => ({ ...p, grace_period_minutes: Number(e.target.value) }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Overtime Multiplier (×)</label>
                      <input
                        type="number"
                        required
                        min={1}
                        max={5}
                        step={0.5}
                        value={profile.overtime_multiplier}
                        onChange={(e) => setProfile((p) => ({ ...p, overtime_multiplier: Number(e.target.value) }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] transition-colors"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'security' && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">Security & Access</h3>
                    <p className="text-xs text-slate-400">Biometric and session policies — managed at infrastructure level.</p>
                  </div>
                  <div className="space-y-4">
                    {[
                      {
                        title: 'Strict Face Matching',
                        desc: 'Require higher confidence score (distance < 0.4) for check-in.',
                        enabled: true,
                      },
                      {
                        title: 'Device Spoof Protection',
                        desc: 'Block fake GPS mock locations and rooted devices.',
                        enabled: true,
                      },
                    ].map((item) => (
                      <div key={item.title} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{item.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked={item.enabled} className="sr-only peer" />
                          <div className="w-11 h-6 bg-slate-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1dbf73]"></div>
                        </label>
                      </div>
                    ))}
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                      <Bell className="w-4 h-4 inline mr-1" />
                      Security policy changes require a server redeploy to take effect. Contact the DevOps team.
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="pt-6 border-t border-slate-200 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  className="bg-[#1dbf73] text-[#ffffff] hover:bg-[#16965a] font-bold border-none"
                  icon={<Save className="w-4 h-4" />}
                  isLoading={loading}
                >
                  Save Configuration
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

