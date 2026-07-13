'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Clock, User, CheckCircle2, AlertTriangle, Plus, RefreshCw, LogOut } from 'lucide-react';
import { Branch } from './types';

interface BranchGatePassTabProps {
  branch: Branch;
}

export const BranchGatePassTab: React.FC<BranchGatePassTabProps> = ({ branch }) => {
  const [breaks, setBreaks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'overstayed'>('active');
  
  // Modal states for issuing Gate Pass
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [breakType, setBreakType] = useState('namaz_prayer');
  const [durationMins, setDurationMins] = useState(30);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchBreaks = async () => {
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
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch(`/api/employees?branch_id=${branch.id}`);
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
    fetchBreaks();
    const interval = setInterval(fetchBreaks, 30000); // Live refresh every 30s
    return () => clearInterval(interval);
  }, [branch.id, filter]);

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
        alert(data.error || 'Failed to issue Gate-Pass.');
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
        alert(data.error || 'Failed to verify return.');
      }
    } catch (err) {
      alert('Network error while verifying return.');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-5 rounded-2xl shadow-xl border border-slate-800">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#1dbf73]" />
            Live Gate-Pass & Short Break Monitor
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Track temporary store exits (Prayer, Lunch, Bank duty) with live countdowns & overstay detection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => fetchBreaks()}
            variant="secondary"
            size="sm"
            className="bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
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
      <div className="flex space-x-2 border-b border-slate-200 pb-2">
        {(['active', 'overstayed', 'completed', 'all'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
              filter === t
                ? 'bg-[#1dbf73] text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
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
          <p className="text-slate-600 font-bold">No {filter !== 'all' ? filter : ''} gate passes found right now.</p>
          <p className="text-xs text-slate-400 mt-1">When staff go out for Namaz or Bank duties, active passes will appear here live.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {breaks.map((item) => {
            const runningMins = item.status === 'active' ? getRunningMinutes(item.out_time) : item.actual_duration_minutes;
            const isOver = runningMins > item.expected_duration_minutes;
            
            return (
              <Card 
                key={item.id} 
                className={`p-5 bg-white border shadow-lg relative overflow-hidden transition-all duration-300 ${
                  item.status === 'active'
                    ? isOver 
                      ? 'border-red-500/80 ring-2 ring-red-500/20' 
                      : 'border-amber-500/80 ring-2 ring-amber-500/20'
                    : item.status === 'overstayed'
                    ? 'border-red-300 bg-red-50/20'
                    : 'border-slate-200 opacity-90'
                }`}
              >
                {/* Status badge banner */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                    {formatBreakType(item.break_type)}
                  </span>
                  <span className={`text-[11px] font-extrabold uppercase px-2 py-0.5 rounded ${
                    item.status === 'active'
                      ? isOver 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : 'bg-amber-500 text-white'
                      : item.status === 'overstayed'
                      ? 'bg-red-100 text-red-700 font-bold'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {item.status === 'active' && (isOver ? `Overstayed +${runningMins - item.expected_duration_minutes}m` : 'Outside Now')}
                    {item.status === 'overstayed' && `Overstayed (${runningMins}m)`}
                    {item.status === 'completed' && `Returned (${runningMins}m)`}
                  </span>
                </div>

                {/* Employee info */}
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200">
                    {item.profiles?.profile_picture ? (
                      <img src={item.profiles.profile_picture} alt={item.profiles?.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 leading-tight">{item.profiles?.full_name || 'Staff'}</h5>
                    <p className="text-xs text-slate-500 mt-0.5">{item.profiles?.employee_id || 'ID N/A'} &bull; {item.profiles?.role?.replace(/_/g, ' ')}</p>
                  </div>
                </div>

                {/* Details box */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs text-slate-600 mb-4">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-400">Out Time:</span>
                    <span className="font-bold text-slate-800">{new Date(item.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {item.return_time && (
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-400">Return Time:</span>
                      <span className="font-bold text-slate-800">{new Date(item.return_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-400">Duration:</span>
                    <span className={`font-bold ${isOver ? 'text-red-600' : 'text-slate-800'}`}>
                      {runningMins} mins <span className="text-slate-400 font-normal">(/ {item.expected_duration_minutes}m limit)</span>
                    </span>
                  </div>
                  <div className="pt-1 border-t border-slate-200/60 mt-1">
                    <span className="text-slate-400 block font-medium">Reason:</span>
                    <p className="text-slate-700 italic font-medium mt-0.5">&ldquo;{item.reason}&rdquo;</p>
                  </div>
                </div>

                {/* Return button if active */}
                {item.status === 'active' && (
                  <Button
                    onClick={() => handleVerifyReturn(item.id, item.profiles?.full_name || 'Employee')}
                    className="w-full bg-[#1dbf73] hover:bg-[#19a563] text-white font-bold text-xs py-2"
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
              <button onClick={() => setShowIssueModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
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
