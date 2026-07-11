'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserCheck, CheckCircle2, XCircle, Clock, AlertTriangle, 
  Search, Filter, MessageSquare, RefreshCw, Building2, Calendar, ArrowRight
} from 'lucide-react';

export interface CorrectionRequestRecord {
  id: string;
  employee_id: string;
  branch_id: string;
  record_id?: string;
  date: string;
  type: 'check_in' | 'check_out';
  original_time?: string;
  requested_time: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_note?: string;
  reviewed_by?: string;
  created_at: string;
  employee_name?: string;
  employee_email?: string;
  employee_code?: string;
  branch_name?: string;
}

interface CorrectionsManagementPanelProps {
  role: 'admin' | 'branch_manager';
}

export const CorrectionsManagementPanel: React.FC<CorrectionsManagementPanelProps> = ({ role }) => {
  const [corrections, setCorrections] = useState<CorrectionRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [statusTab, setStatusTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [noteModalReq, setNoteModalReq] = useState<CorrectionRequestRecord | null>(null);
  const [modalAction, setModalAction] = useState<'approve' | 'reject'>('approve');
  const [reviewerNote, setReviewerNote] = useState('');

  const fetchCorrections = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/corrections/list?status=${statusTab === 'all' ? '' : statusTab}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || 'Failed to fetch correction requests');
      }
      setCorrections(data.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred fetching correction requests.');
    } finally {
      setLoading(false);
    }
  }, [statusTab]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchCorrections();
    });
  }, [fetchCorrections]);

  const handleQuickAction = async (id: string, action: 'approve' | 'reject', note?: string) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/corrections/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewer_note: note }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || result.error || `Failed to ${action} correction request`);
      }
      setFeedback({ type: 'success', text: `Correction request ${action}d successfully.` });
      await fetchCorrections();
      setNoteModalReq(null);
      setReviewerNote('');
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setActingId(null);
    }
  };

  const formatTimeStr = (isoString?: string) => {
    if (!isoString) return 'Missing / Not Recorded';
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dhaka',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  const filteredCorrections = corrections.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.employee_name && c.employee_name.toLowerCase().includes(q)) ||
      (c.employee_code && String(c.employee_code).toLowerCase().includes(q)) ||
      (c.branch_name && c.branch_name.toLowerCase().includes(q)) ||
      (c.reason && c.reason.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#0A1628]/80 border border-slate-200 p-6 rounded-2xl backdrop-blur-sm shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-[#1dbf73]" />
            {role === 'admin' ? 'HQ Manual Corrections & Overrides' : 'Store Manual Corrections & Overrides'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review and approve employee check-in / check-out time adjustment requests.
          </p>
        </div>
        <Button onClick={fetchCorrections} variant="secondary" className="flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex bg-[#0A1628]/90 border border-slate-200 p-1 rounded-xl shadow-inner overflow-x-auto">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all whitespace-nowrap flex items-center gap-2 ${
                statusTab === tab
                  ? 'bg-[#1dbf73] text-[#ffffff] shadow-md'
                  : 'text-slate-400 hover:text-slate-900'
              }`}
            >
              {tab === 'pending' && <Clock className="w-4 h-4" />}
              {tab === 'approved' && <CheckCircle2 className="w-4 h-4" />}
              {tab === 'rejected' && <XCircle className="w-4 h-4" />}
              {tab === 'all' && <Filter className="w-4 h-4" />}
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee, ID, branch, reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0A1628]/90 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-[#1dbf73] transition-colors"
          />
        </div>
      </div>

      {/* Content Area */}
      {error && (
        <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-300 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`p-4 rounded-xl border text-sm font-medium ${
              feedback.type === 'success' ? 'bg-[#1dbf73]/10 border-emerald-500/20 text-[#1dbf73]' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            <div className="flex items-center gap-3">
              {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
              <span>{feedback.text}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner size="lg" />
          <p className="mt-3 text-sm text-slate-400">Loading correction requests...</p>
        </div>
      ) : filteredCorrections.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-200 bg-[#0A1628]/50">
          <UserCheck className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-60" />
          <h3 className="text-lg font-semibold text-slate-900">No Correction Requests Found</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            {statusTab === 'pending' 
              ? 'There are currently no pending attendance time corrections awaiting review.' 
              : `No ${statusTab} correction requests match your filter criteria.`}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence>
            {filteredCorrections.map((c) => {
              const isPending = c.status === 'pending';
              const isApproved = c.status === 'approved';
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <Card className={`p-6 border transition-all ${
                    isPending ? 'border-[#1dbf73]/40 bg-gradient-to-r from-[#0A1628] to-[#0D1E38]' :
                    isApproved ? 'border-emerald-500/30 bg-[#0A1628]/70' :
                    'border-red-500/30 bg-[#0A1628]/50'
                  }`}>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      {/* Left: Employee details */}
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${
                          isPending ? 'bg-[#1dbf73]/10 text-[#1dbf73] border border-[#1dbf73]/30' :
                          isApproved ? 'bg-[#1dbf73]/20 text-[#1dbf73] border border-emerald-500/30' :
                          'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {(c.employee_name || 'E').charAt(0).toUpperCase()}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900 tracking-wide truncate">
                              {c.employee_name}
                            </h3>
                            {c.employee_code && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                                #{c.employee_code}
                              </span>
                            )}
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                              isPending ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                              isApproved ? 'bg-[#1dbf73]/20 text-[#1dbf73] border border-emerald-500/30' :
                              'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}>
                              {c.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                            <span className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-500" />
                              {c.branch_name}
                            </span>
                            <span className="text-slate-500">•</span>
                            <span className="flex items-center gap-1 text-blue-400 font-medium uppercase">
                              <Calendar className="w-3.5 h-3.5" />
                              {c.date} ({c.type.replace('_', ' ')})
                            </span>
                          </div>
                          <div className="pt-2">
                            <p className="text-sm text-slate-200 bg-slate-900/80 border border-slate-800 p-3 rounded-xl italic">
                              &quot;{c.reason}&quot;
                            </p>
                          </div>
                          {c.reviewer_note && (
                            <div className="pt-1 flex items-center gap-1.5 text-xs text-slate-400">
                              <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                              <span className="font-semibold text-slate-300">Reviewer Note:</span> {c.reviewer_note}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Middle: Time change diff */}
                      <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between gap-4 shrink-0 min-w-[240px]">
                        <div className="text-center">
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Original Time</p>
                          <p className="text-sm font-medium text-slate-300 mt-1 font-mono">
                            {formatTimeStr(c.original_time)}
                          </p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-[#1dbf73] shrink-0" />
                        <div className="text-center">
                          <p className="text-[10px] text-[#1dbf73] uppercase tracking-wider font-bold">Requested Time</p>
                          <p className="text-sm font-bold text-slate-900 mt-1 font-mono bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-500/30">
                            {formatTimeStr(c.requested_time)}
                          </p>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      {isPending && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleQuickAction(c.id, 'approve')}
                            disabled={actingId === c.id}
                            className="bg-[#16965a] hover:bg-[#1dbf73] text-slate-900 shadow-lg shadow-emerald-950/40"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1.5" />
                            {actingId === c.id ? 'Approving...' : 'Approve'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setNoteModalReq(c);
                              setModalAction('reject');
                              setReviewerNote('');
                            }}
                            disabled={actingId === c.id}
                            className="border-red-500/40 text-red-400 hover:bg-red-500/10"
                          >
                            <XCircle className="w-4 h-4 mr-1.5" />
                            Reject
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setNoteModalReq(c);
                              setModalAction('approve');
                              setReviewerNote('');
                            }}
                            disabled={actingId === c.id}
                            title="Add Reviewer Note before approving"
                            className="px-2"
                          >
                            <MessageSquare className="w-4 h-4 text-slate-400" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Review Note Modal */}
      {noteModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 bg-[#0A1628] border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {modalAction === 'approve' ? (
                  <CheckCircle2 className="w-5 h-5 text-[#1dbf73]" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                {modalAction === 'approve' ? 'Approve with Note' : 'Reject Correction Request'}
              </h3>
              <button onClick={() => setNoteModalReq(null)} className="text-slate-400 hover:text-slate-900 text-sm">✕</button>
            </div>
            <p className="text-sm text-slate-300">
              {modalAction === 'approve' 
                ? `You are about to approve ${noteModalReq.employee_name}'s ${noteModalReq.type.replace('_', ' ')} correction.`
                : `Please provide a reason for rejecting ${noteModalReq.employee_name}'s correction request.`}
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reviewer Note / Reason</label>
              <textarea
                rows={3}
                placeholder={modalAction === 'approve' ? 'e.g., Verified via store CCTV log.' : 'e.g., Time mismatch with store entrance log.'}
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-[#1dbf73]"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setNoteModalReq(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => handleQuickAction(noteModalReq.id, modalAction, reviewerNote)}
                disabled={actingId === noteModalReq.id}
                className={modalAction === 'approve' ? 'bg-[#16965a] hover:bg-[#1dbf73]' : 'bg-red-600 hover:bg-red-500'}
              >
                {actingId === noteModalReq.id ? 'Processing...' : `Confirm ${modalAction === 'approve' ? 'Approval' : 'Rejection'}`}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

