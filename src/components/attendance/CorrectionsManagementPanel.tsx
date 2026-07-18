'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserCheck, CheckCircle2, XCircle, Clock, AlertTriangle, 
  Search, Filter, MessageSquare, RefreshCw, Building2, Calendar, ArrowRight,
  ShieldCheck, AlertCircle, TrendingUp, MapPin
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

export interface AttendanceApprovalRecord {
  id: string;
  employee_id: string;
  branch_id?: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  overtime_approval_status?: 'pending' | 'approved' | 'rejected' | null;
  approved_overtime_minutes?: number | null;
  overtime_approval_note?: string | null;
  is_holiday_duty?: boolean;
  is_manual_override?: boolean;
  approved_by?: string | null;
  approved_at?: string | null;
  approval_note?: string | null;
  overtime_minutes?: number;
  face_verified?: boolean;
  profiles?: { full_name?: string; photo_url?: string; employee_id?: string };
  branches?: { name?: string };
}

interface CorrectionsManagementPanelProps {
  role: 'admin' | 'branch_manager';
}

export const CorrectionsManagementPanel: React.FC<CorrectionsManagementPanelProps> = ({ role }) => {
  const [categoryTab, setCategoryTab] = useState<'checkins' | 'corrections' | 'overtime'>('checkins');
  const [statusTab, setStatusTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data states
  const [corrections, setCorrections] = useState<CorrectionRequestRecord[]>([]);
  const [checkins, setCheckins] = useState<AttendanceApprovalRecord[]>([]);
  const [overtimes, setOvertimes] = useState<AttendanceApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  // Note modals
  const [noteModalReq, setNoteModalReq] = useState<CorrectionRequestRecord | null>(null);
  const [checkinModalReq, setCheckinModalReq] = useState<AttendanceApprovalRecord | null>(null);
  const [overtimeModalReq, setOvertimeModalReq] = useState<AttendanceApprovalRecord | null>(null);
  const [approvedMinutesInput, setApprovedMinutesInput] = useState<number>(0);
  const [modalAction, setModalAction] = useState<'approve' | 'reject'>('approve');
  const [reviewerNote, setReviewerNote] = useState('');

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const statusParam = statusTab === 'all' ? 'all' : statusTab;
      
      // Fetch check-in approvals, correction requests, and overtime verification list simultaneously
      const [corrRes, checkinRes, overtimeRes] = await Promise.all([
        fetch(`/api/corrections/list?status=${statusParam}`),
        fetch(`/api/attendance/approve?status=${statusParam}&date=all`),
        fetch(`/api/attendance/approve?status=${statusParam}&date=all&type=overtime`)
      ]);

      const corrData = await corrRes.json();
      const checkinData = await checkinRes.json();
      const overtimeData = await overtimeRes.json();

      if (!corrRes.ok || !corrData.success) {
        throw new Error(corrData.error?.message || corrData.error || 'Failed to fetch correction requests');
      }
      if (!checkinRes.ok || !checkinData.success) {
        throw new Error(checkinData.error?.message || checkinData.error || 'Failed to fetch attendance approvals');
      }

      setCorrections(corrData.data || []);
      setCheckins(checkinData.data || []);
      setOvertimes(overtimeData.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred fetching records.');
    } finally {
      setLoading(false);
    }
  }, [statusTab]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchAllData();
    });
  }, [fetchAllData]);

  // Action for time correction request
  const handleCorrectionAction = async (id: string, action: 'approve' | 'reject', note?: string) => {
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
      await fetchAllData();
      setNoteModalReq(null);
      setReviewerNote('');
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setActingId(null);
    }
  };

  // Action for live attendance check-in approval
  const handleCheckinAction = async (id: string, action: 'approve' | 'reject', note?: string) => {
    setActingId(id);
    try {
      const res = await fetch('/api/attendance/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendance_id: id, action, note }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || result.error || `Failed to ${action} check-in`);
      }
      setFeedback({ type: 'success', text: `Attendance check-in ${action}d successfully.` });
      await fetchAllData();
      setCheckinModalReq(null);
      setReviewerNote('');
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setActingId(null);
    }
  };

  // Action for overtime approval/rejection
  const handleOvertimeAction = async (id: string, action: 'approved' | 'rejected', approvedMinutes?: number, note?: string) => {
    setActingId(id);
    try {
      const res = await fetch('/api/attendance/overtime/approve', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: id,
          status: action,
          approved_minutes: approvedMinutes,
          note: note,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || result.error || `Failed to ${action} overtime`);
      }
      setFeedback({ type: 'success', text: `Overtime ${action} successfully (${approvedMinutes ?? 0} mins).` });
      await fetchAllData();
      setOvertimeModalReq(null);
      setReviewerNote('');
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setActingId(null);
    }
  };

  const formatTimeStr = (isoString?: string | null) => {
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

  const filteredCheckins = checkins.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = c.profiles?.full_name || '';
    const code = c.profiles?.employee_id || '';
    const branch = c.branches?.name || '';
    return name.toLowerCase().includes(q) || code.toLowerCase().includes(q) || branch.toLowerCase().includes(q);
  });

  const filteredOvertimes = overtimes.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = c.profiles?.full_name || '';
    const code = c.profiles?.employee_id || '';
    const branch = c.branches?.name || '';
    return name.toLowerCase().includes(q) || code.toLowerCase().includes(q) || branch.toLowerCase().includes(q);
  });

  const checkinsPendingCount = checkins.filter(c => c.approval_status === 'pending').length;
  const correctionsPendingCount = corrections.filter(c => c.status === 'pending').length;
  const overtimesPendingCount = overtimes.filter(c => !c.overtime_approval_status || c.overtime_approval_status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#ffffff]/90 border border-slate-200 p-6 rounded-2xl backdrop-blur-sm shadow-xl">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <UserCheck className="w-7 h-7 text-[#1dbf73]" />
            {role === 'admin' ? 'HQ Manual Corrections & Overrides' : 'Store Manual Corrections & Overrides'}
          </h1>
          <p className="text-sm text-slate-900 mt-1">
            Review live check-in approvals, manual override entries, employee time adjustment requests, and overtime sign-offs.
          </p>
        </div>
        <Button onClick={fetchAllData} variant="secondary" className="flex items-center gap-2 shrink-0">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Category Tabs (Check-ins vs Corrections vs Overtime) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => setCategoryTab('checkins')}
          className={`p-5 rounded-2xl border transition-all text-left flex items-center justify-between ${
            categoryTab === 'checkins'
              ? 'bg-[#1dbf73]/10 border-[#1dbf73] shadow-lg shadow-emerald-500/10 ring-2 ring-[#1dbf73]/20'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl ${categoryTab === 'checkins' ? 'bg-[#1dbf73] text-white' : 'bg-slate-100 text-slate-900'}`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                Live Check-In Approvals
              </h3>
              <p className="text-xs text-slate-900 mt-0.5">
                Attendance timestamps & geofence overrides
              </p>
            </div>
          </div>
          {checkinsPendingCount > 0 && (
            <span className="px-3 py-1 bg-amber-500 text-amber-950 text-xs font-extrabold rounded-full shrink-0 animate-pulse">
              {checkinsPendingCount} Pending
            </span>
          )}
        </button>

        <button
          onClick={() => setCategoryTab('corrections')}
          className={`p-5 rounded-2xl border transition-all text-left flex items-center justify-between ${
            categoryTab === 'corrections'
              ? 'bg-[#1dbf73]/10 border-[#1dbf73] shadow-lg shadow-emerald-500/10 ring-2 ring-[#1dbf73]/20'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl ${categoryTab === 'corrections' ? 'bg-[#1dbf73] text-white' : 'bg-slate-100 text-slate-900'}`}>
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                Time Corrections
              </h3>
              <p className="text-xs text-slate-900 mt-0.5">
                Past record modification requests
              </p>
            </div>
          </div>
          {correctionsPendingCount > 0 && (
            <span className="px-3 py-1 bg-amber-500 text-amber-950 text-xs font-extrabold rounded-full shrink-0 animate-pulse">
              {correctionsPendingCount} Pending
            </span>
          )}
        </button>

        <button
          onClick={() => setCategoryTab('overtime')}
          className={`p-5 rounded-2xl border transition-all text-left flex items-center justify-between ${
            categoryTab === 'overtime'
              ? 'bg-[#1dbf73]/10 border-[#1dbf73] shadow-lg shadow-emerald-500/10 ring-2 ring-[#1dbf73]/20'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl ${categoryTab === 'overtime' ? 'bg-[#1dbf73] text-white' : 'bg-slate-100 text-slate-900'}`}>
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                Overtime Verification
              </h3>
              <p className="text-xs text-slate-900 mt-0.5">
                Review & approve extra duty hours
              </p>
            </div>
          </div>
          {overtimesPendingCount > 0 && (
            <span className="px-3 py-1 bg-amber-500 text-amber-950 text-xs font-extrabold rounded-full shrink-0 animate-pulse">
              {overtimesPendingCount} Pending
            </span>
          )}
        </button>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex bg-[#ffffff]/90 border border-slate-200 p-1 rounded-xl shadow-inner overflow-x-auto">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all whitespace-nowrap flex items-center gap-2 ${
                statusTab === tab
                  ? 'bg-[#1dbf73] text-[#ffffff] shadow-md'
                  : 'text-slate-900 hover:text-slate-900'
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
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-900" />
          <input
            type="text"
            placeholder="Search employee, ID, branch, reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#ffffff]/90 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dbf73] transition-colors"
          />
        </div>
      </div>

      {/* Error / Feedback Banners */}
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

      {/* Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner size="lg" />
          <p className="mt-3 text-sm text-slate-900">Loading attendance & correction records...</p>
        </div>
      ) : categoryTab === 'checkins' ? (
        /* ── Live Check-In / Check-Out Approvals List ── */
        filteredCheckins.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-slate-200 bg-[#ffffff]/50">
            <ShieldCheck className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-60" />
            <h3 className="text-lg font-semibold text-slate-900">No Live Check-In Approvals Found</h3>
            <p className="text-sm text-slate-900 mt-1 max-w-md mx-auto">
              {statusTab === 'pending'
                ? 'All check-ins and manual overrides have been reviewed.'
                : `No ${statusTab} attendance check-ins match your filter criteria.`}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence>
              {filteredCheckins.map((c) => {
                const isPending = c.approval_status === 'pending';
                const isApproved = c.approval_status === 'approved';
                const fullName = c.profiles?.full_name || 'Unknown Employee';
                const empCode = c.profiles?.employee_id || c.employee_id.slice(0, 8);
                const branchName = c.branches?.name || 'Headquarters / Main Branch';
                const checkInDateStr = c.check_in_time ? new Date(c.check_in_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date';

                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <Card className={`p-6 border transition-all ${
                      isPending ? 'border-[#1dbf73]/40 bg-gradient-to-r from-[#ffffff] to-[#f1f5f9]' :
                      isApproved ? 'border-emerald-500/30 bg-[#ffffff]/70' :
                      'border-red-500/30 bg-[#ffffff]/50'
                    }`}>
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        {/* Left: Employee details */}
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${
                            isPending ? 'bg-[#1dbf73]/10 text-[#1dbf73] border border-[#1dbf73]/30' :
                            isApproved ? 'bg-[#1dbf73]/20 text-[#1dbf73] border border-emerald-500/30' :
                            'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-bold text-slate-900 tracking-wide truncate">
                                {fullName}
                              </h3>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                                #{empCode}
                              </span>
                              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                                isPending ? 'bg-amber-500/20 text-amber-700 border border-amber-500/30' :
                                isApproved ? 'bg-[#1dbf73]/20 text-[#1dbf73] border border-emerald-500/30' :
                                'bg-red-500/20 text-red-600 border border-red-500/30'
                              }`}>
                                {c.approval_status}
                              </span>
                              {c.is_manual_override && (
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 border border-purple-500/30 font-extrabold uppercase">
                                  Manual / Out of Geofence Override
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-900 pt-1">
                              <span className="flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                                {branchName}
                              </span>
                              <span className="text-slate-500">•</span>
                              <span className="flex items-center gap-1 text-blue-600 font-medium">
                                <Calendar className="w-3.5 h-3.5" />
                                {checkInDateStr}
                              </span>
                              {c.overtime_minutes && c.overtime_minutes > 0 ? (
                                <>
                                  <span className="text-slate-500">•</span>
                                  <span className="flex items-center gap-1 text-amber-600 font-bold">
                                    <TrendingUp className="w-3.5 h-3.5" />
                                    +{c.overtime_minutes} min Overtime
                                  </span>
                                </>
                              ) : null}
                            </div>
                            {c.approval_note && (
                              <div className="pt-2 flex items-center gap-1.5 text-xs text-slate-700">
                                <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                                <span className="font-semibold">Reviewer Note:</span> {c.approval_note}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Middle: Timestamps diff */}
                        <div className="bg-white/90 border border-slate-200/80 rounded-xl p-4 flex items-center justify-between gap-6 shrink-0 min-w-[280px]">
                          <div className="text-center">
                            <p className="text-[10px] text-slate-900 uppercase tracking-wider font-semibold">Check-In Time</p>
                            <p className="text-sm font-bold text-slate-900 mt-1 font-mono">
                              {formatTimeStr(c.check_in_time)}
                            </p>
                          </div>
                          <ArrowRight className="w-5 h-5 text-slate-400 shrink-0" />
                          <div className="text-center">
                            <p className="text-[10px] text-blue-600 uppercase tracking-wider font-semibold">Check-Out Time</p>
                            <p className="text-sm font-bold text-slate-900 mt-1 font-mono">
                              {c.check_out_time ? formatTimeStr(c.check_out_time) : <span className="text-slate-400 italic">On Duty</span>}
                            </p>
                          </div>
                        </div>

                        {/* Right: Actions */}
                        {isPending && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleCheckinAction(c.id, 'approve')}
                              disabled={actingId === c.id}
                              className="bg-[#16965a] hover:bg-[#1dbf73] text-white shadow-lg shadow-emerald-950/20 font-bold px-4 py-2.5"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1.5" />
                              {actingId === c.id ? 'Approving...' : 'Approve'}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setCheckinModalReq(c);
                                setModalAction('reject');
                                setReviewerNote('');
                              }}
                              disabled={actingId === c.id}
                              className="border-red-500/40 text-red-600 hover:bg-red-500/10 font-bold px-3 py-2.5"
                            >
                              <XCircle className="w-4 h-4 mr-1.5" />
                              Reject
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setCheckinModalReq(c);
                                setModalAction('approve');
                                setReviewerNote('');
                              }}
                              disabled={actingId === c.id}
                              title="Add Note before approving"
                              className="px-2.5 py-2.5"
                            >
                              <MessageSquare className="w-4 h-4 text-slate-900" />
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
        )
      ) : categoryTab === 'corrections' ? (
        /* ── Time Correction & Missing Day Requests List ── */
        filteredCorrections.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-slate-200 bg-[#ffffff]/50">
            <UserCheck className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-60" />
            <h3 className="text-lg font-semibold text-slate-900">No Time Correction Requests Found</h3>
            <p className="text-sm text-slate-900 mt-1 max-w-md mx-auto">
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
                      isPending ? 'border-[#1dbf73]/40 bg-gradient-to-r from-[#ffffff] to-[#f1f5f9]' :
                      isApproved ? 'border-emerald-500/30 bg-[#ffffff]/70' :
                      'border-red-500/30 bg-[#ffffff]/50'
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
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                                  #{c.employee_code}
                                </span>
                              )}
                              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                                isPending ? 'bg-amber-500/20 text-amber-700 border border-amber-500/30' :
                                isApproved ? 'bg-[#1dbf73]/20 text-[#1dbf73] border border-emerald-500/30' :
                                'bg-red-500/20 text-red-600 border border-red-500/30'
                              }`}>
                                {c.status}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-900">
                              <span className="flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                                {c.branch_name}
                              </span>
                              <span className="text-slate-500">•</span>
                              <span className="flex items-center gap-1 text-blue-600 font-medium uppercase">
                                <Calendar className="w-3.5 h-3.5" />
                                {c.date} ({c.type.replace('_', ' ')})
                              </span>
                            </div>
                            <div className="pt-2">
                              <p className="text-sm text-slate-800 bg-white/90 border border-slate-200 p-3 rounded-xl italic">
                                &quot;{c.reason}&quot;
                              </p>
                            </div>
                            {c.reviewer_note && (
                              <div className="pt-1 flex items-center gap-1.5 text-xs text-slate-700">
                                <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                                <span className="font-semibold">Reviewer Note:</span> {c.reviewer_note}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Middle: Time change diff */}
                        <div className="bg-white/90 border border-slate-200/80 rounded-xl p-4 flex items-center justify-between gap-4 shrink-0 min-w-[240px]">
                          <div className="text-center">
                            <p className="text-[10px] text-slate-900 uppercase tracking-wider font-semibold">Original Time</p>
                            <p className="text-sm font-medium text-slate-900 mt-1 font-mono">
                              {formatTimeStr(c.original_time)}
                            </p>
                          </div>
                          <ArrowRight className="w-5 h-5 text-[#1dbf73] shrink-0" />
                          <div className="text-center">
                            <p className="text-[10px] text-[#1dbf73] uppercase tracking-wider font-bold">Requested Time</p>
                            <p className="text-sm font-bold text-slate-900 mt-1 font-mono bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-500/30">
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
                              onClick={() => handleCorrectionAction(c.id, 'approve')}
                              disabled={actingId === c.id}
                              className="bg-[#16965a] hover:bg-[#1dbf73] text-white shadow-lg shadow-emerald-950/20 font-bold px-4 py-2.5"
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
                              className="border-red-500/40 text-red-600 hover:bg-red-500/10 font-bold px-3 py-2.5"
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
                              className="px-2.5 py-2.5"
                            >
                              <MessageSquare className="w-4 h-4 text-slate-900" />
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
        )
      ) : (
        /* ── Overtime Verification & Approvals List ── */
        filteredOvertimes.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-slate-200 bg-[#ffffff]/50">
            <TrendingUp className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-60" />
            <h3 className="text-lg font-semibold text-slate-900">No Overtime Verification Records Found</h3>
            <p className="text-sm text-slate-900 mt-1 max-w-md mx-auto">
              {statusTab === 'pending'
                ? 'There are currently no pending overtime hours awaiting verification.'
                : `No ${statusTab} overtime verification records match your filter criteria.`}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence>
              {filteredOvertimes.map((c) => {
                const otStatus = c.overtime_approval_status || 'pending';
                const isPending = otStatus === 'pending';
                const isApproved = otStatus === 'approved';
                const checkInDate = c.check_in_time ? new Date(c.check_in_time).toLocaleDateString('en-US', { timeZone: 'Asia/Dhaka', month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                
                return (
                  <motion.div
                    key={`ot-${c.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <Card className={`p-6 border transition-all ${
                      isPending ? 'border-[#1dbf73]/40 bg-gradient-to-r from-[#ffffff] to-[#f1f5f9]' :
                      isApproved ? 'border-emerald-500/30 bg-[#ffffff]/70' :
                      'border-red-500/30 bg-[#ffffff]/50'
                    }`}>
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        {/* Left: Employee details */}
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${
                            isPending ? 'bg-[#1dbf73]/10 text-[#1dbf73] border border-[#1dbf73]/30' :
                            isApproved ? 'bg-[#1dbf73]/20 text-[#1dbf73] border border-emerald-500/30' :
                            'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {(c.profiles?.full_name || 'E').charAt(0).toUpperCase()}
                          </div>
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-bold text-slate-900 tracking-wide truncate">
                                {c.profiles?.full_name || 'Unknown Employee'}
                              </h3>
                              {c.profiles?.employee_id && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                                  #{c.profiles.employee_id}
                                </span>
                              )}
                              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                                isPending ? 'bg-amber-500/20 text-amber-700 border border-amber-500/30' :
                                isApproved ? 'bg-[#1dbf73]/20 text-[#1dbf73] border border-emerald-500/30' :
                                'bg-red-500/20 text-red-600 border border-red-500/30'
                              }`}>
                                {otStatus}
                              </span>
                              {c.is_holiday_duty && (
                                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700 border border-purple-300">
                                  🎉 Holiday Duty
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-900">
                              <span className="flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                                {c.branches?.name || 'Assigned Branch'}
                              </span>
                              <span className="text-slate-500">•</span>
                              <span className="flex items-center gap-1 text-blue-600 font-medium">
                                <Calendar className="w-3.5 h-3.5" />
                                {checkInDate}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-6 pt-2 text-sm">
                              <div>
                                <span className="text-xs text-slate-500 block">Check-In</span>
                                <span className="font-mono font-medium text-slate-800">{formatTimeStr(c.check_in_time)}</span>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500 block">Check-Out</span>
                                <span className="font-mono font-medium text-slate-800">{formatTimeStr(c.check_out_time)}</span>
                              </div>
                            </div>
                            {c.overtime_approval_note && (
                              <div className="pt-1 flex items-center gap-1.5 text-xs text-slate-700">
                                <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                                <span className="font-semibold">Reviewer Note:</span> {c.overtime_approval_note}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Middle: Overtime minutes badge */}
                        {(() => {
                          const requestedOvertime = c.is_holiday_duty && c.check_in_time && c.check_out_time
                            ? Math.floor((new Date(c.check_out_time).getTime() - new Date(c.check_in_time).getTime()) / 60000)
                            : (c.overtime_minutes || 0);
                          return (
                            <React.Fragment>
                              <div className="bg-white/90 border border-slate-200/80 rounded-xl p-4 flex items-center justify-between gap-6 shrink-0 min-w-[220px]">
                                <div className="text-center">
                                  <p className="text-[10px] text-slate-900 uppercase tracking-wider font-semibold">Logged OT</p>
                                  <p className="text-lg font-bold text-amber-600 mt-1 font-mono">
                                    {requestedOvertime} <span className="text-xs font-normal text-slate-500">mins</span>
                                  </p>
                                </div>
                                <ArrowRight className="w-5 h-5 text-[#1dbf73] shrink-0" />
                                <div className="text-center">
                                  <p className="text-[10px] text-[#1dbf73] uppercase tracking-wider font-bold">Approved OT</p>
                                  <p className="text-lg font-bold text-emerald-700 mt-1 font-mono bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-500/30">
                                    {c.approved_overtime_minutes !== null && c.approved_overtime_minutes !== undefined ? c.approved_overtime_minutes : requestedOvertime} <span className="text-xs font-normal text-slate-500">mins</span>
                                  </p>
                                </div>
                              </div>

                              {/* Right: Actions */}
                              {isPending && (
                                <div className="flex items-center gap-2 shrink-0">
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleOvertimeAction(c.id, 'approved', requestedOvertime)}
                                    disabled={actingId === c.id}
                                    className="bg-[#16965a] hover:bg-[#1dbf73] text-white shadow-lg shadow-emerald-950/20 font-bold px-4 py-2.5"
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                    {actingId === c.id ? 'Approving...' : 'Approve Full'}
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      setOvertimeModalReq(c);
                                      setApprovedMinutesInput(c.approved_overtime_minutes !== null && c.approved_overtime_minutes !== undefined ? c.approved_overtime_minutes : requestedOvertime);
                                      setModalAction('approve');
                                      setReviewerNote('');
                                    }}
                                    disabled={actingId === c.id}
                                    className="font-bold px-3 py-2.5 text-blue-700 hover:bg-blue-50 border-blue-200"
                                  >
                                    Adjust Mins & Note
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      setOvertimeModalReq(c);
                                      setModalAction('reject');
                                      setReviewerNote('');
                                    }}
                                    disabled={actingId === c.id}
                                    className="border-red-500/40 text-red-600 hover:bg-red-500/10 font-bold px-3 py-2.5"
                                  >
                                    <XCircle className="w-4 h-4 mr-1.5" />
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })()}
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )
      )}

      {/* Review Note / Adjust Minutes Modal for Overtime Approval */}
      {overtimeModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 bg-[#ffffff] border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {modalAction === 'approve' ? (
                  <CheckCircle2 className="w-5 h-5 text-[#1dbf73]" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                {modalAction === 'approve' ? 'Verify & Approve Overtime' : 'Reject Overtime'}
              </h3>
              <button onClick={() => setOvertimeModalReq(null)} className="text-slate-900 hover:text-slate-900 text-sm">✕</button>
            </div>
            <p className="text-sm text-slate-900">
              {modalAction === 'approve' 
                ? `Verify approved overtime minutes for ${overtimeModalReq.profiles?.full_name || 'this employee'}.`
                : `Provide a reason for rejecting ${overtimeModalReq.profiles?.full_name || 'this employee'}'s overtime claim.`}
            </p>
            {modalAction === 'approve' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Approved Overtime Minutes</label>
                <input
                  type="number"
                  min={0}
                  max={1440}
                  value={approvedMinutesInput}
                  onChange={(e) => setApprovedMinutesInput(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-mono text-slate-900 focus:outline-none focus:border-[#1dbf73]"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Reviewer Note / Reason</label>
              <textarea
                rows={3}
                placeholder={modalAction === 'approve' ? 'e.g., Verified store closing CCTV & daily sales report.' : 'e.g., Overtime not pre-approved by store manager.'}
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dbf73]"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setOvertimeModalReq(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => handleOvertimeAction(
                  overtimeModalReq.id,
                  modalAction === 'approve' ? 'approved' : 'rejected',
                  modalAction === 'approve' ? approvedMinutesInput : 0,
                  reviewerNote
                )}
                disabled={actingId === overtimeModalReq.id}
                className={modalAction === 'approve' ? 'bg-[#16965a] hover:bg-[#1dbf73] text-white' : 'bg-red-600 hover:bg-red-500 text-white'}
              >
                {actingId === overtimeModalReq.id ? 'Processing...' : `Confirm ${modalAction === 'approve' ? 'Overtime Approval' : 'Rejection'}`}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Review Note Modal for Time Correction */}
      {noteModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 bg-[#ffffff] border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {modalAction === 'approve' ? (
                  <CheckCircle2 className="w-5 h-5 text-[#1dbf73]" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                {modalAction === 'approve' ? 'Approve with Note' : 'Reject Correction Request'}
              </h3>
              <button onClick={() => setNoteModalReq(null)} className="text-slate-900 hover:text-slate-900 text-sm">✕</button>
            </div>
            <p className="text-sm text-slate-900">
              {modalAction === 'approve' 
                ? `You are about to approve ${noteModalReq.employee_name}'s ${noteModalReq.type.replace('_', ' ')} correction.`
                : `Please provide a reason for rejecting ${noteModalReq.employee_name}'s correction request.`}
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Reviewer Note / Reason</label>
              <textarea
                rows={3}
                placeholder={modalAction === 'approve' ? 'e.g., Verified via store CCTV log.' : 'e.g., Time mismatch with store entrance log.'}
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dbf73]"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setNoteModalReq(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => handleCorrectionAction(noteModalReq.id, modalAction, reviewerNote)}
                disabled={actingId === noteModalReq.id}
                className={modalAction === 'approve' ? 'bg-[#16965a] hover:bg-[#1dbf73] text-white' : 'bg-red-600 hover:bg-red-500 text-white'}
              >
                {actingId === noteModalReq.id ? 'Processing...' : `Confirm ${modalAction === 'approve' ? 'Approval' : 'Rejection'}`}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Review Note Modal for Check-In Approval */}
      {checkinModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 bg-[#ffffff] border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {modalAction === 'approve' ? (
                  <CheckCircle2 className="w-5 h-5 text-[#1dbf73]" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                {modalAction === 'approve' ? 'Approve Check-In with Note' : 'Reject Check-In Request'}
              </h3>
              <button onClick={() => setCheckinModalReq(null)} className="text-slate-900 hover:text-slate-900 text-sm">✕</button>
            </div>
            <p className="text-sm text-slate-900">
              {modalAction === 'approve' 
                ? `You are about to approve ${checkinModalReq.profiles?.full_name || 'this employee'}'s check-in.`
                : `Please provide a reason for rejecting ${checkinModalReq.profiles?.full_name || 'this employee'}'s check-in.`}
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Reviewer Note / Reason</label>
              <textarea
                rows={3}
                placeholder={modalAction === 'approve' ? 'e.g., Verified manager override.' : 'e.g., Checked in outside store without prior permission.'}
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dbf73]"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setCheckinModalReq(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => handleCheckinAction(checkinModalReq.id, modalAction, reviewerNote)}
                disabled={actingId === checkinModalReq.id}
                className={modalAction === 'approve' ? 'bg-[#16965a] hover:bg-[#1dbf73] text-white' : 'bg-red-600 hover:bg-red-500 text-white'}
              >
                {actingId === checkinModalReq.id ? 'Processing...' : `Confirm ${modalAction === 'approve' ? 'Approval' : 'Rejection'}`}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

