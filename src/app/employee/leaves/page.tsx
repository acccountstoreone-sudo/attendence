'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Calendar, CheckCircle2, AlertTriangle, ArrowLeft, Clock, FileText } from 'lucide-react';
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

  const [balances, setBalances] = useState<LeaveBalanceItem[]>([
    { id: '1', code: 'CASUAL', name: 'Casual Leave', allocated: 10, used: 2 },
    { id: '2', code: 'SICK', name: 'Sick Leave', allocated: 14, used: 2 },
    { id: '3', code: 'EARNED', name: 'Earned Leave', allocated: 15, used: 0 },
  ]);

  const [leaveType, setLeaveType] = useState('CASUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    async function loadBalances() {
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
    }
    loadBalances();
  }, [supabase]);

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
      } else {
        setFeedback({ type: 'error', message: json.error || 'Failed to submit leave application.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'A network error occurred. Please try again.' });
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
      <div className="flex items-center justify-between bg-[#061224] p-6 rounded-3xl border border-[#1E293B] shadow-xl">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/employee')}
            className="p-2.5 rounded-2xl bg-[#040A15]/80 hover:bg-[#1E293B] text-slate-300 hover:text-[#D2A02A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-xs text-[#D2A02A] font-bold uppercase tracking-wider">Annual Leave Management</span>
            <h1 className="text-2xl font-extrabold text-white mt-1">Leave Application Portal</h1>
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
                ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/80 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
            <span className="text-sm font-semibold">{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leave Balance Cards (B8 fix: Dark Theme styled) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {balances.map((b) => {
          const remaining = Math.max(0, b.allocated - b.used);
          return (
            <Card key={b.id} className="bg-[#061224] border-[#1E293B] hover:border-[#D2A02A]/30 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#D2A02A]">{b.name}</span>
                <Calendar className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-extrabold text-white">{remaining}</span>
                <span className="text-xs text-slate-400">/ {b.allocated} Days Left</span>
              </div>
              <div className="w-full bg-[#040A15] h-1.5 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-[#D2A02A] h-full rounded-full transition-all"
                  style={{ width: `${b.allocated > 0 ? (remaining / b.allocated) * 100 : 0}%` }}
                />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Application Form Card */}
      <Card className="bg-[#061224] border-[#1E293B] p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center space-x-3 border-b border-[#1E293B] pb-4 mb-6">
          <FileText className="w-5 h-5 text-[#D2A02A]" />
          <div>
            <h3 className="text-lg font-bold text-white">Submit New Request</h3>
            <p className="text-xs text-slate-400">Fill out the required dates and justification for your supervisor&apos;s review.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">Leave Type</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              disabled={submitting}
              className="w-full bg-[#040A15] border border-[#1E293B] hover:border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#D2A02A] transition-all"
            >
              {balances.map((b) => (
                <option key={b.code} value={b.code} className="bg-[#040A15] text-white">
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
                className="w-full bg-[#040A15] border border-[#1E293B] hover:border-slate-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#D2A02A] transition-all"
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
                className="w-full bg-[#040A15] border border-[#1E293B] hover:border-slate-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#D2A02A] transition-all"
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
              className="w-full bg-[#040A15] border border-[#1E293B] hover:border-slate-700 rounded-xl p-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#D2A02A] transition-all"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            variant="primary"
            size="lg"
            className="w-full bg-[#D2A02A] text-[#040A15] hover:bg-[#C08F1E] font-extrabold border-none py-4 shadow-lg shadow-[#D2A02A]/20"
          >
            {submitting ? 'Submitting Request...' : 'Submit Leave Application'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
