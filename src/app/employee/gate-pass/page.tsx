'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Clock, CheckCircle2, History, Plus, AlertTriangle, Coffee, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function EmployeeGatePassPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [activeBreak, setActiveBreak] = useState<any>(null);
  const [pendingBreak, setPendingBreak] = useState<any>(null);
  const [todaysBreaks, setTodaysBreaks] = useState<any[]>([]);
  
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [breakType, setBreakType] = useState('tea_lunch');
  const [durationMins, setDurationMins] = useState(30);
  const [reason, setReason] = useState('');

  const fetchBreaks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' });
      const [month, day, year] = formatter.format(now).split('/');
      const todayStart = new Date(`${year}-${month}-${day}T00:00:00+06:00`).toISOString();

      const { data } = await supabase
        .from('attendance_breaks')
        .select('*')
        .eq('employee_id', user.id)
        .gte('created_at', todayStart)
        .order('created_at', { ascending: false });

      if (data) {
        setTodaysBreaks(data);
        const active = data.find(b => b.status === 'active' || b.status === 'overstayed');
        const pending = data.find(b => b.status === 'pending');
        setActiveBreak(active || null);
        setPendingBreak(pending || null);
        if (!active && !pending) setShowForm(true);
        else setShowForm(false);
      }
    } catch (err) {
      console.error('Failed to load gate passes', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBreaks();
    const interval = setInterval(fetchBreaks, 30000);
    return () => clearInterval(interval);
  }, [supabase]);

  const handleStartBreak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/attendance/breaks/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          break_type: breakType,
          expected_duration_minutes: Number(durationMins),
          reason
        })
      });
      const data = await res.json();
      if (data.success) {
        setReason('');
        setShowForm(false);
        fetchBreaks();
      } else {
        alert(data.error?.message || data.error || 'Failed to request Gate-Pass');
      }
    } catch (err) {
      alert('Network error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async () => {
    if (!activeBreak) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/attendance/breaks/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ break_id: activeBreak.id })
      });
      const data = await res.json();
      if (data.success) {
        fetchBreaks();
      } else {
        alert(data.error?.message || data.error || 'Failed to verify return');
      }
    } catch (err) {
      alert('Network error.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatBreakType = (type: string) => {
    const map: Record<string, string> = {
      namaz_prayer: '🕌 Prayer / Namaz',
      tea_lunch: '☕ Tea / Lunch Break',
      official_bank: '🏦 Official / Bank Duty',
      short_emergency: '🏥 Short Emergency',
      personal: '🚶 Personal Pass'
    };
    return map[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <Spinner size="lg" label="Loading Gate Pass details..." />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Coffee className="w-6 h-6 text-[#1dbf73]" />
            Gate Pass & Short Breaks
          </h1>
          <p className="text-sm text-slate-900 mt-1">
            Request temporary exits for prayer, lunch, or official bank duties.
          </p>
        </div>
      </div>

      {pendingBreak ? (
        <div className="bg-blue-50 border border-blue-200 p-6 rounded-3xl">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center animate-pulse">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Waiting for Approval...</h2>
              <p className="text-slate-900 mt-1">
                You requested <span className="font-bold">{formatBreakType(pendingBreak.break_type)}</span>
              </p>
              <p className="text-sm text-slate-500 mt-1">Your store manager must approve this request before you can leave.</p>
            </div>
          </div>
        </div>
      ) : activeBreak ? (
        <div className="bg-[#1dbf73]/10 border border-[#1dbf73]/30 p-6 rounded-3xl">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-[#1dbf73]/20 text-[#1dbf73] rounded-full flex items-center justify-center animate-pulse">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Active: {formatBreakType(activeBreak.break_type)}</h2>
              <p className="text-slate-900 mt-1">
                You went out at <span className="font-bold">{new Date(activeBreak.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </p>
              <p className="text-sm text-slate-500 mt-1">Allowed duration: {activeBreak.expected_duration_minutes} mins</p>
            </div>
            
            <Button
              size="lg"
              className="bg-[#1dbf73] hover:bg-[#19a563] text-white font-bold w-full max-w-sm mt-4"
              onClick={handleReturn}
              disabled={submitting}
            >
              {submitting ? 'Verifying...' : '✅ Verify Return & Resume Duty'}
            </Button>
          </div>
        </div>
      ) : (
        showForm ? (
          <Card className="p-6 bg-white border border-slate-200 shadow-sm rounded-3xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#1dbf73]" /> Request New Gate Pass
            </h3>
            <form onSubmit={handleStartBreak} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Break Type</label>
                  <select
                    value={breakType}
                    onChange={(e) => setBreakType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 ring-[#1dbf73]/50 font-medium"
                  >
                    <option value="namaz_prayer">🕌 Namaz/Prayer</option>
                    <option value="tea_lunch">☕ Tea/Lunch Break</option>
                    <option value="official_bank">🏦 Official Bank Duty</option>
                    <option value="short_emergency">🏥 Emergency Out</option>
                    <option value="personal">🚶 Personal Pass</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Duration (Mins)</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={durationMins}
                    onChange={(e) => setDurationMins(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 ring-[#1dbf73]/50 font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Where are you going?"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-900 focus:outline-none focus:ring-2 ring-[#1dbf73]/50"
                  required
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="mr-3"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#1dbf73] hover:bg-[#19a563] text-white font-bold"
                >
                  {submitting ? 'Requesting...' : 'Start Gate Pass'}
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <div className="flex justify-center">
            <Button
              size="lg"
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold w-full max-w-sm"
              onClick={() => setShowForm(true)}
            >
              <Plus className="w-5 h-5 mr-2" /> Request New Gate Pass
            </Button>
          </div>
        )
      )}

      {/* History for today */}
      {todaysBreaks.length > 0 && (
        <Card className="bg-white border-slate-200 overflow-hidden rounded-3xl mt-8">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-slate-400" />
              Today's Passes
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {todaysBreaks.map(brk => (
              <div key={brk.id} className="p-5 flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-800">{formatBreakType(brk.break_type)}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      brk.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      brk.status === 'active' ? 'bg-amber-100 text-amber-700' :
                      brk.status === 'pending' ? 'bg-blue-100 text-blue-700' :
                      brk.status === 'rejected' ? 'bg-slate-100 text-slate-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {brk.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Reason: {brk.reason}</p>
                </div>
                <div className="text-sm font-mono text-slate-900 sm:text-right">
                  <div>
                    {brk.out_time ? `Out: ${new Date(brk.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `Requested: ${new Date(brk.created_at || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                  {brk.return_time && (
                    <div>In: {new Date(brk.return_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  )}
                  {brk.actual_duration_minutes && (
                    <div className="text-xs text-slate-400 mt-0.5">{brk.actual_duration_minutes} mins total</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
