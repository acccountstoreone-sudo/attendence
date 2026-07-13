'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  Search, MapPin, Clock, Filter, Download, RefreshCw, Calendar,
  CheckCircle2, XCircle, AlertCircle, Hourglass, Timer, TrendingUp, Building2
} from 'lucide-react';
import Abstract3DBackground from '@/components/Abstract3DBackground';
import { motion, AnimatePresence } from 'framer-motion';

type Tab = 'pending' | 'approved' | 'all';

interface AttendanceRecord {
  id: string;
  employee_id: string;
  full_name: string;
  branch_name: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  approval_status: string;
  approved_at: string | null;
  approval_note: string | null;
  overtime_minutes: number;
  is_manual_override?: boolean;
}

function formatTime(isoString: string | null) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatOvertime(minutes: number) {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AdminAttendancePage() {
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as Tab;
      if (tabParam && ['pending', 'approved', 'all'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
      const searchParam = params.get('search');
      if (searchParam) {
        setSearchTerm(searchParam);
      }
      const stParam = params.get('status');
      if (stParam) {
        setStatusFilter(stParam);
        if (!tabParam) setActiveTab('all');
      }
    }
  }, []);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const statusParam = activeTab === 'all' ? 'all' : activeTab;
      const res = await fetch(`/api/attendance/approve?date=${selectedDate}&status=${statusParam}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to fetch attendance');
      }

      const formatted: AttendanceRecord[] = (json.data || []).map((item: Record<string, unknown> & {
        profiles?: { full_name?: string };
        branches?: { name?: string };
      }) => ({
        id: String(item.id),
        employee_id: String(item.employee_id),
        full_name: (item.profiles as { full_name?: string })?.full_name || 'Unknown Employee',
        branch_name: (item.branches as { name?: string })?.name || 'Headquarters / All',
        status: String(item.status || 'present'),
        check_in_time: item.check_in_time as string | null,
        check_out_time: item.check_out_time as string | null,
        approval_status: String(item.approval_status || 'pending'),
        approved_at: item.approved_at as string | null,
        approval_note: item.approval_note as string | null,
        overtime_minutes: Number(item.overtime_minutes || 0),
        is_manual_override: Boolean(item.is_manual_override),
      }));
      setRecords(formatted);
    } catch (e) {
      console.error('Failed fetching attendance', e);
      setFeedback({ type: 'error', text: 'Failed to load attendance records.' });
    } finally {
      setLoading(false);
    }
  }, [selectedDate, activeTab]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  // Auto-refresh pending tab every 30 seconds
  useEffect(() => {
    if (activeTab !== 'pending') return;
    const id = setInterval(fetchAttendance, 30000);
    return () => clearInterval(id);
  }, [activeTab, fetchAttendance]);

  const handleApproval = async (id: string, action: 'approve' | 'reject') => {
    setApprovingId(id);
    setFeedback(null);
    try {
      const res = await fetch('/api/attendance/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendance_id: id, action }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Action failed');
      setFeedback({
        type: 'success',
        text: `Check-in has been ${action === 'approve' ? 'approved ✅' : 'rejected ❌'} successfully.`,
      });
      await fetchAttendance();
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: (err as Error).message || 'Failed to process action.' });
    } finally {
      setApprovingId(null);
    }
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = (r.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.branch_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const pendingCount = records.filter(r => r.approval_status === 'pending').length;

  const handleExport = () => {
    const headers = ['Employee', 'Branch', 'Check-In', 'Check-Out', 'Status', 'Approval', 'Overtime', 'Manual Override'];
    const rows = filteredRecords.map(r => [
      r.full_name, r.branch_name,
      r.check_in_time ? new Date(r.check_in_time).toISOString() : '',
      r.check_out_time ? new Date(r.check_out_time).toISOString() : 'Not checked out',
      r.status, r.approval_status,
      r.overtime_minutes > 0 ? `${r.overtime_minutes} min` : '0',
      r.is_manual_override ? 'Yes' : 'No'
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_hq_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 backdrop-blur-sm shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#1dbf73_1px,transparent_1px)] [background-size:40px_40px] mix-blend-overlay z-0" />
        <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
          <Abstract3DBackground />
        </div>

        <div className="relative z-10 pointer-events-none">
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-[#1dbf73]/10 border border-[#1dbf73]/30 text-[#1dbf73] text-xs font-bold uppercase tracking-widest">
              HQ Master Grid
            </span>
            {pendingCount > 0 && activeTab !== 'pending' && (
              <span className="px-2 py-0.5 bg-amber-500 text-amber-950 text-xs font-extrabold rounded-full animate-pulse">
                {pendingCount} Pending across stores
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
            Enterprise Live Attendance & Approvals
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''} shown ({selectedDate === 'all' ? 'All Dates' : selectedDate}).
          </p>
        </div>

        <div className="relative z-10 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-slate-200 bg-white/50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={fetchAttendance}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-slate-200 bg-white/50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExport}
            disabled={filteredRecords.length === 0}
          >
            Export CSV
          </Button>
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
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
            <span>{feedback.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs + Table */}
      <Card className="bg-white border-slate-200 p-0 overflow-hidden relative z-10 shadow-2xl">

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-white">
          {([
            { key: 'pending', label: 'Pending Approvals', icon: <Hourglass className="w-3.5 h-3.5" /> },
            { key: 'approved', label: 'Approved Records', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
            { key: 'all', label: 'All Records', icon: <Filter className="w-3.5 h-3.5" /> },
          ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-extrabold uppercase tracking-widest transition-all border-b-2 ${
                activeTab === tab.key
                  ? 'border-[#1dbf73] text-[#1dbf73] bg-[#1dbf73]/5'
                  : 'border-transparent text-slate-500 hover:text-slate-600'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.key === 'pending' && pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-amber-950 text-[10px] font-extrabold rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-3 justify-between items-center">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by employee name or branch..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dbf73] transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
              <Filter className="w-4 h-4 text-amber-500 shrink-0" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-transparent text-sm text-slate-600 focus:outline-none capitalize font-medium"
              >
                <option value="all">All Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="on_leave">On Leave</option>
              </select>
              {statusFilter !== 'all' && (
                <button onClick={() => setStatusFilter('all')} className="text-xs text-rose-500 font-bold hover:underline ml-1">
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
              <Calendar className="w-4 h-4 text-[#1dbf73] shrink-0" />
              <select
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm text-slate-600 focus:outline-none font-medium"
              >
                <option value="all">All Dates / Recent</option>
                <option value={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`}>Today</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 flex justify-center">
              <Spinner size="lg" label="Loading attendance records..." />
            </div>
          ) : (
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-white border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-600 font-bold">
                  <th className="py-4 px-6">Employee</th>
                  <th className="py-4 px-6">Branch / Store</th>
                  <th className="py-4 px-6">Check-In</th>
                  <th className="py-4 px-6">Check-Out</th>
                  <th className="py-4 px-6">Overtime</th>
                  <th className="py-4 px-6">Status</th>
                  {activeTab === 'pending' && <th className="py-4 px-6 text-center">HQ Actions</th>}
                  {activeTab !== 'pending' && <th className="py-4 px-6 text-right">Approval</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50 text-sm">
                <AnimatePresence>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 text-center text-slate-500 text-sm">
                          {activeTab === 'pending'
                            ? <><CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-600/40" /><p className="font-semibold text-[#1dbf73]/60">All caught up! No pending attendance check-in approvals across stores.</p></>
                            : <><Clock className="w-8 h-8 mx-auto mb-3 text-slate-600 opacity-50" /><p>No attendance records found matching your query.</p></>
                          }
                        </motion.div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map(rec => (
                      <motion.tr
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        key={rec.id}
                        className="hover:bg-slate-100/30 transition-colors group"
                      >
                        {/* Employee */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[#1dbf73] font-bold text-xs shrink-0">
                              {rec.full_name?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-bold text-slate-900 group-hover:text-[#1dbf73] transition-colors">{rec.full_name}</p>
                                {rec.is_manual_override && (
                                  <span className="text-[10px] bg-purple-500/15 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase">Manual / Override</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {rec.employee_id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="py-4 px-6">
                          <div className="flex items-center text-slate-600 text-sm font-medium">
                            <Building2 className="w-4 h-4 text-[#1dbf73]/60 mr-2 shrink-0" />
                            {rec.branch_name}
                          </div>
                        </td>

                        {/* Check-In */}
                        <td className="py-4 px-6 text-slate-600 font-mono text-xs">
                          {formatTime(rec.check_in_time)}
                        </td>

                        {/* Check-Out */}
                        <td className="py-4 px-6 text-slate-600 font-mono text-xs">
                          {rec.check_out_time
                            ? formatTime(rec.check_out_time)
                            : <span className="text-slate-500 italic">Not checked out</span>}
                        </td>

                        {/* Overtime */}
                        <td className="py-4 px-6">
                          {formatOvertime(rec.overtime_minutes) ? (
                            <span className="flex items-center gap-1 text-amber-400 font-bold text-xs">
                              <TrendingUp className="w-3.5 h-3.5" />
                              {formatOvertime(rec.overtime_minutes)}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-6">
                          <Badge
                            status={rec.status === 'late' ? 'late' : rec.status === 'absent' ? 'absent' : 'present'}
                            variant="subtle"
                          />
                        </td>

                        {/* Approve/Reject Actions (pending tab) */}
                        {activeTab === 'pending' && (
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2 justify-center">
                              <button
                                onClick={() => handleApproval(rec.id, 'approve')}
                                disabled={approvingId === rec.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1dbf73]/15 hover:bg-[#1dbf73]/25 border border-emerald-500/30 text-[#1dbf73] text-xs font-bold transition-all disabled:opacity-50"
                                title="Approve check-in"
                              >
                                {approvingId === rec.id
                                  ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                  : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Approve
                              </button>
                              <button
                                onClick={() => handleApproval(rec.id, 'reject')}
                                disabled={approvingId === rec.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 text-xs font-bold transition-all disabled:opacity-50"
                                title="Reject check-in"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            </div>
                          </td>
                        )}

                        {/* Approval status badge (approved/all tab) */}
                        {activeTab !== 'pending' && (
                          <td className="py-4 px-6 text-right">
                            {rec.approval_status === 'approved' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1dbf73]/15 border border-emerald-500/30 text-[#1dbf73] text-xs font-bold">
                                <CheckCircle2 className="w-3 h-3" /> Approved
                              </span>
                            ) : rec.approval_status === 'rejected' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold">
                                <XCircle className="w-3 h-3" /> Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
                                <AlertCircle className="w-3 h-3" /> Pending
                              </span>
                            )}
                          </td>
                        )}
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

