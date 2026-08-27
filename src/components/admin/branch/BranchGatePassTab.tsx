'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Clock, User, CheckCircle2, AlertTriangle, Plus, RefreshCw, LogOut } from 'lucide-react';
import { Branch } from './types';

interface BranchGatePassTabProps {
  branch: Branch;
}

interface BreakRecord {
  id: string;
  employee_id: string;
  break_type: string;
  expected_duration_minutes: number;
  out_time: string;
  return_time: string | null;
  status: string;
  reason: string;
  actual_duration_minutes?: number;
  profiles?: { full_name?: string; photo_url?: string; profile_picture?: string; employee_id?: string; role?: string };
  branches?: { name?: string };
}

interface Employee {
  id: string;
  full_name: string;
  employee_id?: string;
  role: string;
}

export const BranchGatePassTab: React.FC<BranchGatePassTabProps> = ({ branch }) => {
  const [breaks, setBreaks] = useState<BreakRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'active' | 'completed' | 'overstayed' | 'all'>('pending');
  
  // Modal states for issuing Gate Pass
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [breakType, setBreakType] = useState('namaz_prayer');
  const [durationMins, setDurationMins] = useState(30);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchBreaks = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/attendance/breaks/list?branch_id=${branch.id}${filter !== 'all' ? `&status=${filter}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setBreaks(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch gate passes:', err);
    } finally {
      setLoading(false);
    }
  }, [branch.id, filter]);

  const fetchEmployees = async () => {
    try {
      const url = branch.id === 'all' ? '/api/employees?limit=200' : `/api/employees?branch_id=${branch.id}&limit=200`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setEmployees(data.data || []);
        if (data.data?.length > 0) setSelectedEmpId(data.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBreaks();
    const interval = setInterval(fetchBreaks, 30000); // Live refresh every 30s
    return () => clearInterval(interval);
  }, [fetchBreaks]);

  const handleIssueGatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !reason) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/attendance/breaks/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: selectedEmpId,
          break_type: breakType,
          expected_duration_minutes: Number(durationMins),
          reason
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowIssueModal(false);
        setReason('');
        fetchBreaks();
      } else {
        alert(data.error?.message || data.error || 'Failed to issue Gate-Pass.');
      }
    } catch (err) {
      alert('Network error while issuing Gate-Pass.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyReturn = async (breakId: string, empName: string) => {
    if (!confirm(`Verify store return and resume duty for ${empName}?`)) return;
    try {
      const res = await fetch('/api/attendance/breaks/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ break_id: breakId })
      });
      const data = await res.json();
      if (data.success) {
        fetchBreaks();
      } else {
        alert(data.error?.message || data.error || 'Failed to verify return.');
      }
    } catch (err) {
      alert('Network error while verifying return.');
    }
  };

  const handleApproveReject = async (breakId: string, action: 'approve' | 'reject') => {
    if (!confirm(`Are you sure you want to ${action} this Gate Pass?`)) return;
    try {
      const res = await fetch('/api/attendance/breaks/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ break_id: breakId, action })
      });
      const data = await res.json();
      if (data.success) {
        fetchBreaks();
      } else {
        alert(data.error?.message || data.error || `Failed to ${action} gate pass.`);
      }
    } catch (err) {
      alert(`Network error while trying to ${action} gate pass.`);
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

  const getRunningMinutes = (outTime: string) => {
    const diff = new Date().getTime() - new Date(outTime).getTime();
    return Math.max(1, Math.round(diff / 60000));
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white text-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#1dbf73]" />
            Live Gate-Pass & Short Break Monitor
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Track temporary store exits (Prayer, Lunch, Bank duty) with live countdowns & overstay detection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => fetchBreaks()}
            variant="outline"
            size="sm"
            className="border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
          <Button
            onClick={() => { fetchEmployees(); setShowIssueModal(true); }}
            className="bg-[#1dbf73] hover:bg-[#19a563] text-white font-bold text-xs px-4"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Issue Gate-Pass
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2 overflow-x-auto whitespace-nowrap">
        {(['pending', 'active', 'overstayed', 'completed', 'all'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all shrink-0 ${
              filter === t
                ? 'bg-[#1dbf73] text-white shadow-md'
                : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
            }`}
          >
            {t === 'pending' && '⏳ Pending Approvals'}
            {t === 'active' && '🔴 Live Outside (Active)'}
            {t === 'overstayed' && '⚠️ Overstayed Alerts'}
            {t === 'completed' && '✅ Returned Today'}
            {t === 'all' && '📋 All Passes'}
          </button>
        ))}
      </div>

      {/* List of Gate Passes */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 font-medium">Loading gate passes...</div>
      ) : breaks.length === 0 ? (
        <Card className="p-12 text-center border-slate-200 shadow-sm bg-white">
          <LogOut className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-900 font-bold">No {filter !== 'all' ? filter : ''} gate passes found right now.</p>
          <p className="text-xs text-slate-400 mt-1">When staff go out for Namaz or Bank duties, active passes will appear here live.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {breaks.map((item) => {
            const runningMins = (item.status === 'pending' || item.status === 'rejected') ? 0 : 
              (item.status === 'active' 
                ? getRunningMinutes(item.out_time) 
                : (item.actual_duration_minutes || (item.return_time ? Math.max(1, Math.round((new Date(item.return_time).getTime() - new Date(item.out_time).getTime()) / 60000)) : getRunningMinutes(item.out_time))));
            
            const isPending = item.status === 'pending';
            const isRejected = item.status === 'rejected';
            const isReturned = item.status === 'completed' || item.status === 'overstayed';
            const lateMins = Math.max(0, runningMins - item.expected_duration_minutes);
            const isLate = lateMins > 0;
            
            return (
              <Card 
                key={item.id} 
                className={`p-5 bg-white border shadow-lg relative overflow-hidden transition-all duration-300 ${
                  isPending ? 'border-blue-300 ring-2 ring-blue-500/20' :
                  isRejected ? 'border-slate-300 opacity-70' :
                  !isReturned
                    ? isLate 
                      ? 'border-red-500/80 ring-2 ring-red-500/20' 
                      : 'border-amber-500/80 ring-2 ring-amber-500/20'
                    : isLate
                    ? 'border-red-300 bg-red-50/10'
                    : 'border-emerald-200 bg-emerald-50/10'
                }`}
              >
                {/* Status badge banner */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                    {formatBreakType(item.break_type)}
                  </span>
                  <span className={`text-[11px] font-extrabold uppercase px-2 py-0.5 rounded ${
                    isPending ? 'bg-blue-100 text-blue-700 animate-pulse' :
                    isRejected ? 'bg-slate-100 text-slate-600' :
                    !isReturned
                      ? isLate 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : 'bg-amber-500 text-white'
                      : isLate
                      ? 'bg-red-100 text-red-700 font-bold'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {isPending && 'Waiting Approval'}
                    {isRejected && 'Rejected'}
                    {!isPending && !isRejected && !isReturned && (isLate ? `Outside +${lateMins}m Over` : 'Active Outside')}
                    {!isPending && !isRejected && isReturned && (isLate ? `Returned (${lateMins}m Late)` : 'Returned On Time')}
                  </span>
                </div>

                {/* Employee info */}
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200">
                    {(item.profiles?.photo_url || item.profiles?.profile_picture) ? (
                      <img src={item.profiles?.photo_url || item.profiles?.profile_picture} alt={item.profiles?.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 leading-tight">{item.profiles?.full_name || 'Staff'}</h5>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.profiles?.employee_id || 'ID N/A'} &bull; {item.profiles?.role?.replace(/_/g, ' ')}
                      {item.branches?.name ? ` • ${item.branches.name}` : ''}
                    </p>
                  </div>
                </div>

                {/* Return vs Outside Prominent Indicator Box */}
                {isPending ? (
                  <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl text-blue-900 font-bold mb-3 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-blue-600 shrink-0" /> REQUESTED</span>
                    <span className="text-xs font-bold bg-blue-500 text-white px-2 py-0.5 rounded">{item.expected_duration_minutes}m limit</span>
                  </div>
                ) : isRejected ? (
                  <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-700 font-bold mb-3 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-slate-500 shrink-0" /> REQUEST REJECTED</span>
                  </div>
                ) : !isReturned ? (
                  isLate ? (
                    <div className="bg-red-500 text-white p-2.5 rounded-xl font-bold mb-3 flex items-center justify-between animate-pulse shadow-md text-xs">
                      <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 shrink-0" /> STILL OUTSIDE (LATE!)</span>
                      <span className="text-xs font-black bg-white text-red-600 px-2 py-0.5 rounded">+{lateMins}m Overstay</span>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-amber-900 font-bold mb-3 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-amber-600 shrink-0" /> CURRENTLY OUTSIDE</span>
                      <span className="text-xs font-bold bg-amber-500 text-white px-2 py-0.5 rounded">{runningMins}m / {item.expected_duration_minutes}m limit</span>
                    </div>
                  )
                ) : (
                  isLate ? (
                    <div className="bg-red-50 border border-red-200 p-2.5 rounded-xl text-red-800 font-bold mb-3 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-red-600 shrink-0" /> RETURNED LATE</span>
                      <span className="text-xs font-black bg-red-600 text-white px-2 py-0.5 rounded">+{lateMins} mins late</span>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-emerald-800 font-bold mb-3 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> RETURNED ON TIME</span>
                      <span className="text-xs font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">{runningMins}m / {item.expected_duration_minutes}m</span>
                    </div>
                  )
                )}

                {/* Details box */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs text-slate-900 mb-4">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-400">{isPending ? 'Requested At:' : 'Out Time:'}</span>
                    <span className="font-bold text-slate-800">
                      {isPending 
                        ? new Date((item as any).created_at || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                        : (item.out_time ? new Date(item.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A')}
                    </span>
                  </div>
                  {item.return_time && (
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-400">Return Time:</span>
                      <span className="font-bold text-emerald-700">{new Date(item.return_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-400">Total Duration:</span>
                    <span className={`font-bold ${isLate ? 'text-red-600' : 'text-slate-800'}`}>
                      {isPending || isRejected ? '0' : runningMins} mins <span className="text-slate-400 font-normal">(/ {item.expected_duration_minutes}m limit)</span>
                    </span>
                  </div>
                  <div className="pt-1 border-t border-slate-200/60 mt-1">
                    <span className="text-slate-400 block font-medium">Reason:</span>
                    <p className="text-slate-700 italic font-medium mt-0.5">&ldquo;{item.reason}&rdquo;</p>
                  </div>
                </div>

                {/* Actions */}
                {isPending && (
                  <div className="flex space-x-2 pt-2">
                    <Button
                      onClick={() => handleApproveReject(item.id, 'reject')}
                      variant="secondary"
                      className="flex-1 text-xs py-2 text-rose-600 bg-rose-50 hover:bg-rose-100"
                    >
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleApproveReject(item.id, 'approve')}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2"
                    >
                      Approve & Start
                    </Button>
                  </div>
                )}
                
                {/* Return button if active */}
                {item.status === 'active' && (
                  <Button
                    onClick={() => handleVerifyReturn(item.id, item.profiles?.full_name || 'Employee')}
                    className="w-full bg-[#1dbf73] hover:bg-[#19a563] text-white font-bold text-xs py-2 mt-2"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" /> Verify Return & Resume Duty
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Issue Gate Pass Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-white border-slate-200 p-6 max-w-md w-full shadow-2xl rounded-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#1dbf73]" /> Issue Short Gate-Pass
              </h4>
              <button onClick={() => setShowIssueModal(false)} className="text-slate-400 hover:text-slate-900 font-bold text-sm">✕</button>
            </div>

            <form onSubmit={handleIssueGatePass} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Employee</label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ring-[#1dbf73]/50 font-medium"
                  required
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_id || emp.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Pass Type</label>
                  <select
                    value={breakType}
                    onChange={(e) => setBreakType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ring-[#1dbf73]/50 font-medium"
                  >
                    <option value="namaz_prayer">🕌 Namaz/Prayer</option>
                    <option value="tea_lunch">☕ Tea/Lunch Break</option>
                    <option value="official_bank">🏦 Official Bank Duty</option>
                    <option value="short_emergency">🏥 Emergency Out</option>
                    <option value="personal">🚶 Personal Pass</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Allowed Mins</label>
                  <input
                    type="number"
                    min={5}
                    max={480}
                    value={durationMins}
                    onChange={(e) => setDurationMins(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ring-[#1dbf73]/50 font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reason / Note</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. Going to mosque for Jummah prayer..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 ring-[#1dbf73]/50"
                  required
                />
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 font-bold text-xs"
                  onClick={() => setShowIssueModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-[#1dbf73] hover:bg-[#19a563] text-white font-bold text-xs"
                >
                  {submitting ? 'Issuing...' : '🚀 Issue Gate-Pass'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
