'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import {
  UserCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  Calendar,
  User,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CorrectionRequest {
  id: string;
  user_id: string;
  employee_name: string;
  date: string;
  type: 'check_in' | 'check_out';
  original_time?: string;
  requested_time: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export default function ManualCorrectionsPage() {
  const [loading, setLoading] = useState(true);
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [reviewModal, setReviewModal] = useState<CorrectionRequest | null>(null);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadCorrections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/manual-correction');
      const json = await res.json();
      if (json.success) setCorrections(json.data || []);
    } catch (err) {
      console.error('Load corrections error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadCorrections(); }, [loadCorrections]);

  const handleReview = async (id: string, action: 'approved' | 'rejected', reviewNote?: string) => {
    setProcessing(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/attendance/manual-correction/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action, review_note: reviewNote || '' }),
      });
      if (res.ok) {
        setReviewModal(null);
        setFeedback({ type: 'success', message: `Correction request ${action} successfully.` });
        await loadCorrections();
      } else {
        const json = await res.json();
        setFeedback({ type: 'error', message: json.error?.message || `Failed to mark request as ${action}.` });
      }
    } catch (err) {
      console.error('Review error:', err);
      setFeedback({ type: 'error', message: 'A network error occurred while processing the review.' });
    } finally {
      setProcessing(false);
    }
  };

  const filtered = corrections.filter((c) => {
    const matchSearch = c.employee_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filter === 'all' || c.status === filter;
    return matchSearch && matchStatus;
  });

  const pendingCount = corrections.filter((c) => c.status === 'pending').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Sleek Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-amber-500/20 text-[11px] font-semibold text-amber-500 bg-amber-500/5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {pendingCount} Pending Action{pendingCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Manual Corrections</h1>
          <p className="text-sm text-slate-400 mt-1">
            Review and authorize staff requests for attendance timestamp adjustments.
          </p>
        </div>
      </div>

      {/* Feedback Banner */}
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

      {/* Action Bar */}
      <div className="flex flex-wrap gap-3 items-center justify-between bg-[#0A101C] p-3 rounded-xl border border-[#1E293B]">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search staff name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-transparent border border-[#1E293B] rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
          />
        </div>
        <div className="flex bg-[#1E293B]/30 p-1 rounded-lg border border-[#1E293B]">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                filter === s
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Corrections List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 border border-[#1E293B] rounded-xl bg-[#040A15]">
          <Spinner size="md" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-16 text-center border border-[#1E293B] bg-[#0A101C] rounded-xl">
          <UserCheck className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-sm font-medium text-slate-400">
            {filter === 'pending' ? 'No pending requests. You are all caught up.' : `No ${filter} correction requests found.`}
          </h3>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => (
            <div key={req.id} className="bg-[#0A101C] border border-[#1E293B] p-4 rounded-xl shadow-sm hover:border-slate-700 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                    req.status === 'pending'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                      : req.status === 'approved'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                  }`}>
                    <Clock className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-semibold text-slate-200 text-sm">{req.employee_name}</h4>
                      <Badge status={req.status === 'pending' ? 'late' : req.status === 'approved' ? 'present' : 'absent'} variant="subtle">
                        {req.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1.5 mt-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                        <span><strong className="text-slate-300 font-medium">{req.date}</strong> <span className="text-slate-600 px-1">•</span> <strong className="text-amber-500/90 capitalize">{req.type.replace('_', ' ')}</strong></span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                        <span>Original: <strong className="text-slate-300 font-medium">{req.original_time || '—'}</strong> <span className="text-slate-600 px-1">→</span> Requested: <strong className="text-blue-400 font-medium">{req.requested_time}</strong></span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <User className="w-3.5 h-3.5 shrink-0 text-slate-500 mt-0.5" />
                        <span className="text-slate-400">Reason: <span className="italic text-slate-300">&quot;{req.reason}&quot;</span></span>
                      </div>
                    </div>
                  </div>
                </div>

                {req.status === 'pending' && (
                  <div className="flex items-center space-x-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 px-3 py-1.5 h-auto text-xs font-semibold rounded-lg"
                      icon={<X className="w-3.5 h-3.5" />}
                      onClick={() => handleReview(req.id, 'rejected')}
                      isLoading={processing}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      className="bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_15px_rgba(5,150,105,0.2)] px-3 py-1.5 h-auto text-xs font-semibold rounded-lg border-none"
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      onClick={() => handleReview(req.id, 'approved')}
                      isLoading={processing}
                    >
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Detail Modal */}
      {reviewModal && (
        <Modal
          isOpen={!!reviewModal}
          onClose={() => setReviewModal(null)}
          title="Review Correction Request"
          description="Carefully review the employee's justification before authorizing this attendance amendment."
        >
          <div className="space-y-4 text-sm text-slate-300 mt-4">
            <div className="grid grid-cols-2 gap-4">
               <div>
                 <p className="text-xs text-slate-500 mb-1">Employee</p>
                 <p className="font-semibold text-slate-200">{reviewModal.employee_name}</p>
               </div>
               <div>
                 <p className="text-xs text-slate-500 mb-1">Date</p>
                 <p className="font-semibold text-slate-200">{reviewModal.date}</p>
               </div>
               <div>
                 <p className="text-xs text-slate-500 mb-1">Type</p>
                 <p className="font-semibold text-amber-500 capitalize">{reviewModal.type.replace('_', ' ')}</p>
               </div>
               <div>
                 <p className="text-xs text-slate-500 mb-1">Requested Time</p>
                 <p className="font-semibold text-blue-400">{reviewModal.requested_time}</p>
               </div>
            </div>
            
            <div>
              <p className="text-xs text-slate-500 mb-1">Provided Justification</p>
              <div className="bg-[#040A15] p-3 rounded-lg border border-[#1E293B]">
                <p className="italic text-slate-300">&quot;{reviewModal.reason}&quot;</p>
              </div>
            </div>

            <div className="flex space-x-3 pt-4 border-t border-[#1E293B]">
              <Button variant="ghost" className="flex-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-[#1E293B]" onClick={() => handleReview(reviewModal.id, 'rejected')} isLoading={processing}>Reject Request</Button>
              <Button variant="primary" className="flex-1 bg-emerald-600 hover:bg-emerald-500 border-none" onClick={() => handleReview(reviewModal.id, 'approved')} isLoading={processing}>Approve Correction</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

