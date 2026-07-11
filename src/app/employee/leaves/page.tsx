'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Calendar, CheckCircle2, AlertTriangle, ArrowLeft, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LeaveBalanceItem {
  id: string;
  code: string;
  name: string;
  allocated: number;
  used: number;
}

export default function EmployeeLeavePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [balances, setBalances] = useState<LeaveBalanceItem[]>([]);

  const [leaveType, setLeaveType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const loadBalances = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentYear = new Date().getFullYear();
      const { data: balData } = await supabase
        .from('leave_balances')
        .select('allocated_days, used_days, leave_types(code, name)')
        .eq('user_id', user.id)
        .eq('year', currentYear);

      if (balData && balData.length > 0) {
        const mapped = balData.map((b, idx) => {
          const typeObj = (b as unknown as { leave_types?: { code: string; name: string } }).leave_types;
          return {
            id: String(idx),
            code: typeObj?.code || 'GENERAL',
            name: typeObj?.name || 'General Leave',
            allocated: b.allocated_days || 0,
            used: b.used_days || 0,
          };
        });
        setBalances(mapped);
        if (mapped.length > 0) setLeaveType(mapped[0].code);
      }
    } catch (err) {
      console.error('Failed to load leave balances:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      await loadBalances();
      if (isMounted) setLoading(false);
    };
    init();
    return () => { isMounted = false; };
  }, [loadBalances]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/leaves/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leave_type_code: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setFeedback({ type: 'success', message: 'Leave application submitted successfully! Pending manager approval.' });
        setStartDate('');
        setEndDate('');
        setReason('');
        loadBalances(); // Refresh balances in case backend returns updated counts
      } else {
        const errorMessage = typeof json.error === 'object' && json.error?.message
          ? json.error.message
          : typeof json.error === 'string' ? json.error : 'Failed to submit leave application.';
        setFeedback({ type: 'error', message: errorMessage });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFeedback({ type: 'error', message: err.message });
      } else {
        setFeedback({ type: 'error', message: 'An unexpected error occurred' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <Spinner size="lg" label="Loading Leave Allocations & Portal..." />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-slate-200 shadow-xl">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/employee')}
            className="p-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-300 hover:text-[#1dbf73] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-xs text-[#1dbf73] font-bold uppercase tracking-wider">Annual Leave Management</span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Leave Application Portal</h1>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      <AnimatePresence mode="wait">
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl border flex items-center space-x-3 shadow-lg ${
              feedback.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/30 text-[#1dbf73]'
                : 'bg-rose-950/80 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-[#1dbf73] shrink-0" /> : <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
            <span className="text-sm font-semibold">{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leave Balance Cards (B8 fix: Dark Theme styled) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {balances.length === 0 ? (
          <div className="col-span-1 md:col-span-3 text-center py-6 text-slate-500 border border-dashed border-slate-200 rounded-2xl">
            No active leave allocations found for this year.
          </div>
        ) : (
          balances.map((b) => {
            const remaining = Math.max(0, b.allocated - b.used);
            return (
              <Card key={b.id} className="bg-white border-slate-200 hover:border-[#1dbf73]/30 transition-all">
                <div className="flex items-center justify-between text-slate-400 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1dbf73]">{b.name}</span>
                  <Calendar className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-extrabold text-slate-900">{remaining}</span>
                  <span className="text-xs text-slate-400">/ {b.allocated} Days Left</span>
                </div>
                <div className="w-full bg-white h-1.5 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-[#1dbf73] h-full rounded-full transition-all"
                    style={{ width: `${b.allocated > 0 ? (remaining / b.allocated) * 100 : 0}%` }}
                  />
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Application Form Card */}
      <Card className="bg-white border-slate-200 p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center space-x-3 border-b border-slate-200 pb-4 mb-6">
          <FileText className="w-5 h-5 text-[#1dbf73]" />
          <div>
            <h3 className="text-lg font-bold text-slate-900">Submit New Request</h3>
            <p className="text-xs text-slate-400">Fill out the required dates and justification for your supervisor&apos;s review.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">Leave Type</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              disabled={submitting || balances.length === 0}
              className="w-full bg-white border border-slate-200 hover:border-slate-700 rounded-xl py-3 px-4 text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] transition-all"
            >
              {balances.length === 0 && (
                <option value="" disabled className="bg-white text-slate-500">
                  No leave allocations available
                </option>
              )}
              {balances.map((b) => (
                <option key={b.code} value={b.code} className="bg-white text-slate-900">
                  {b.name} ({b.code}) — {Math.max(0, b.allocated - b.used)} days available
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={submitting}
                className="w-full bg-white border border-slate-200 hover:border-slate-700 rounded-xl py-2.5 px-4 text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={submitting}
                className="w-full bg-white border border-slate-200 hover:border-slate-700 rounded-xl py-2.5 px-4 text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">Reason / Justification</label>
            <textarea
              rows={4}
              required
              placeholder="Please provide a brief justification for your leave request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              className="w-full bg-white border border-slate-200 hover:border-slate-700 rounded-xl p-4 text-sm text-slate-900 placeholder-slate-600 focus:outline-none focus:border-[#1dbf73] transition-all"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting || balances.length === 0 || !leaveType}
            variant="primary"
            size="lg"
            className="w-full bg-[#1dbf73] text-[#ffffff] hover:bg-[#16965a] font-extrabold border-none py-4 shadow-lg shadow-[#1dbf73]/20 disabled:opacity-50"
          >
            {submitting ? 'Submitting Request...' : 'Submit Leave Application'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

