'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CalendarDays, CheckCircle2, XCircle, Clock, AlertTriangle, 
  Search, Filter, MessageSquare, RefreshCw, Building2 
} from 'lucide-react';

export interface LeaveRequestRecord {
  id: string;
  user_id?: string;
  employee_id?: string;
  branch_id: string;
  leave_type_id?: string;
  type?: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  reviewer_note?: string;
  created_at: string;
  employee_name?: string;
  employee_email?: string;
  employee_code?: string;
  branch_name?: string;
  leave_type_name?: string;
  leave_type_code?: string;
}

interface LeaveManagementPanelProps {
  role: 'admin' | 'branch_manager';
}

export const LeaveManagementPanel: React.FC<LeaveManagementPanelProps> = ({ role }) => {
  const [leaves, setLeaves] = useState<LeaveRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusTab, setStatusTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [noteModalLeave, setNoteModalLeave] = useState<LeaveRequestRecord | null>(null);
  const [modalAction, setModalAction] = useState<'approve' | 'reject'>('approve');
  const [reviewerNote, setReviewerNote] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/leaves/list?status=${statusTab === 'all' ? '' : statusTab}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || 'Failed to fetch leave requests');
      }
      setLeaves(data.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred fetching leave requests.');
    } finally {
      setLoading(false);
    }
  }, [statusTab]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchLeaves();
    });
  }, [fetchLeaves]);

  const handleQuickAction = async (id: string, action: 'approve' | 'reject', note?: string) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/leaves/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewer_note: note }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || result.error || `Failed to ${action} leave request`);
      }
      setFeedback({ type: 'success', text: `Leave request ${action}d successfully.` });
      // Refresh list
      await fetchLeaves();
      setNoteModalLeave(null);
      setReviewerNote('');
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setActingId(null);
    }
  };

  const filteredLeaves = leaves.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (l.employee_name && l.employee_name.toLowerCase().includes(q)) ||
      (l.employee_code && String(l.employee_code).toLowerCase().includes(q)) ||
      (l.branch_name && l.branch_name.toLowerCase().includes(q)) ||
      (l.reason && l.reason.toLowerCase().includes(q)) ||
      (l.leave_type_name && l.leave_type_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#0A1628]/80 border border-slate-200 p-6 rounded-2xl backdrop-blur-sm shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-[#1dbf73]" />
            {role === 'admin' ? 'HQ Leave Applications Management' : 'Store Leave Applications Management'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review, approve, or decline employee leave applications with automatic balance deduction.
          </p>
        </div>
        <Button onClick={fetchLeaves} variant="secondary" className="flex items-center gap-2">
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
          <p className="mt-3 text-sm text-slate-400">Loading leave requests...</p>
        </div>
      ) : filteredLeaves.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-200 bg-[#0A1628]/50">
          <CalendarDays className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-60" />
          <h3 className="text-lg font-semibold text-slate-900">No Leave Requests Found</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            {statusTab === 'pending' 
              ? 'There are currently no pending leave applications awaiting verification.' 
              : `No ${statusTab} leave requests match your filter criteria.`}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence>
            {filteredLeaves.map((l) => {
              const isPending = l.status === 'pending';
              const isApproved = l.status === 'approved';
              return (
                <motion.div
                  key={l.id}
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
                      {/* Left side: Employee & Branch info */}
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${
                          isPending ? 'bg-[#1dbf73]/10 text-[#1dbf73] border border-[#1dbf73]/30' :
                          isApproved ? 'bg-[#1dbf73]/20 text-[#1dbf73] border border-emerald-500/30' :
                          'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {(l.employee_name || 'E').charAt(0).toUpperCase()}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900 tracking-wide truncate">
                              {l.employee_name}
                            </h3>
                            {l.employee_code && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                                #{l.employee_code}
                              </span>
                            )}
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                              isPending ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                              isApproved ? 'bg-[#1dbf73]/20 text-[#1dbf73] border border-emerald-500/30' :
                              'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}>
                              {l.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                            <span className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-500" />
                              {l.branch_name}
                            </span>
                            <span className="text-slate-500">•</span>
                            <span className="text-purple-400 font-medium">
                              {l.leave_type_name || l.leave_type_code || 'Casual Leave'}
                            </span>
                            <span className="text-slate-500">•</span>
                            <span>Applied on {new Date(l.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="pt-2">
                            <p className="text-sm text-slate-200 bg-slate-900/80 border border-slate-800 p-3 rounded-xl italic">
                              &quot;{l.reason}&quot;
                            </p>
                          </div>
                          {l.reviewer_note && (
                            <div className="pt-1 flex items-center gap-1.5 text-xs text-slate-400">
                              <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                              <span className="font-semibold text-slate-300">Reviewer Note:</span> {l.reviewer_note}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Middle: Duration Dates */}
                      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 text-center shrink-0 min-w-[180px]">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Leave Duration</p>
                        <p className="text-lg font-bold text-slate-900 mt-1">
                          {l.total_days || 1} {Number(l.total_days) === 1 ? 'Day' : 'Days'}
                        </p>
                        <p className="text-xs text-[#1dbf73] font-mono mt-0.5">
                          {l.start_date} &rarr; {l.end_date}
                        </p>
                      </div>

                      {/* Right: Actions */}
                      {isPending && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleQuickAction(l.id, 'approve')}
                            disabled={actingId === l.id}
                            className="bg-[#16965a] hover:bg-[#1dbf73] text-slate-900 shadow-lg shadow-emerald-950/40"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1.5" />
                            {actingId === l.id ? 'Approving...' : 'Approve'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setNoteModalLeave(l);
                              setModalAction('reject');
                              setReviewerNote('');
                            }}
                            disabled={actingId === l.id}
                            className="border-red-500/40 text-red-400 hover:bg-red-500/10"
                          >
                            <XCircle className="w-4 h-4 mr-1.5" />
                            Reject
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setNoteModalLeave(l);
                              setModalAction('approve');
                              setReviewerNote('');
                            }}
                            disabled={actingId === l.id}
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
      {noteModalLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 bg-[#0A1628] border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {modalAction === 'approve' ? (
                  <CheckCircle2 className="w-5 h-5 text-[#1dbf73]" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                {modalAction === 'approve' ? 'Approve with Note' : 'Reject Leave Request'}
              </h3>
              <button onClick={() => setNoteModalLeave(null)} className="text-slate-400 hover:text-slate-900 text-sm">✕</button>
            </div>
            <p className="text-sm text-slate-300">
              {modalAction === 'approve' 
                ? `You are about to approve ${noteModalLeave.employee_name}'s leave for ${noteModalLeave.total_days} days.`
                : `Please provide a reason for rejecting ${noteModalLeave.employee_name}'s leave request.`}
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reviewer Note / Reason</label>
              <textarea
                rows={3}
                placeholder={modalAction === 'approve' ? 'e.g., Approved. Hand over pending work to Team Lead.' : 'e.g., Critical shift shortage during project delivery week.'}
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-[#1dbf73]"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setNoteModalLeave(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => handleQuickAction(noteModalLeave.id, modalAction, reviewerNote)}
                disabled={actingId === noteModalLeave.id}
                className={modalAction === 'approve' ? 'bg-[#16965a] hover:bg-[#1dbf73]' : 'bg-red-600 hover:bg-red-500'}
              >
                {actingId === noteModalLeave.id ? 'Processing...' : `Confirm ${modalAction === 'approve' ? 'Approval' : 'Rejection'}`}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

