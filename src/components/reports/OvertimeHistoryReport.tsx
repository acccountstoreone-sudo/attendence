'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  Clock, Calendar, Building2, Users, FileText, FileSpreadsheet,
  Download, Search, CheckCircle2, AlertCircle, XCircle, TrendingUp,
  TrendingDown, RefreshCw, Sparkles, MessageSquare, Printer,
  DollarSign, Award, ShieldAlert, CheckSquare, Square, BarChart3,
  ChevronUp, ChevronDown, Minus,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { OvertimeHistoryRow } from '@/app/api/reports/overtime-history/route';

interface OvertimeHistoryReportProps {
  role: 'admin' | 'branch_manager';
}

const COLORS = ['#1dbf73', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6'];

function getMedalEmoji(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

export function OvertimeHistoryReport({ role }: OvertimeHistoryReportProps) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];

  // ─── Filter State ───────────────────────────────────────────
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(today);
  const [branchId, setBranchId] = useState('all');
  const [employeeId, setEmployeeId] = useState('all');
  const [status, setStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [otThreshold, setOtThreshold] = useState(40); // hours threshold per period
  const [showThresholdConfig, setShowThresholdConfig] = useState(false);

  // ─── Data State ─────────────────────────────────────────────
  const [rows, setRows] = useState<OvertimeHistoryRow[]>([]);
  const [prevRows, setPrevRows] = useState<OvertimeHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'excel' | 'pdf' | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; full_name: string; employee_id: string; branch_id: string }[]>([]);

  // ─── OT Rates State (fetched for cost calc) ─────────────────
  const [defaultOtRate, setDefaultOtRate] = useState(100); // ৳/hr

  // ─── Bulk Selection State ────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkNote, setBulkNote] = useState('');
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // ─── UI State ────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<'table' | 'charts' | 'leaderboard'>('table');
  const printRef = useRef<HTMLDivElement>(null);

  // ─── Reference Data Fetch ────────────────────────────────────
  useEffect(() => {
    if (role === 'admin') {
      fetch('/api/branches').then(r => r.json()).then(j => { if (j.success) setBranches(j.data || []); }).catch(console.error);
    }
    fetch('/api/employees?limit=500').then(r => r.json()).then(j => {
      if (j.success && j.data?.employees) setEmployees(j.data.employees);
    }).catch(console.error);
    fetch('/api/branch-settings').then(r => r.json()).then(j => {
      if (j.success && j.data?.overtime_rate_per_hour) setDefaultOtRate(Number(j.data.overtime_rate_per_hour));
    }).catch(console.error);
  }, [role]);

  // ─── Main Data Fetch ─────────────────────────────────────────
  const fetchHistory = useCallback(async (sd = startDate, ed = endDate) => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const params = new URLSearchParams({ start_date: sd, end_date: ed, status, ...(branchId !== 'all' ? { branch_id: branchId } : {}), ...(employeeId !== 'all' ? { employee_id: employeeId } : {}) });
      const res = await fetch(`/api/reports/overtime-history?${params}`);
      const json = await res.json();
      if (json.success) setRows(json.data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [startDate, endDate, branchId, employeeId, status]);

  // ─── Previous Period Fetch (for comparison) ──────────────────
  const fetchPrevPeriod = useCallback(async () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - diff);
    const ps = prevStart.toISOString().split('T')[0];
    const pe = prevEnd.toISOString().split('T')[0];
    try {
      const params = new URLSearchParams({ start_date: ps, end_date: pe, status, ...(branchId !== 'all' ? { branch_id: branchId } : {}), ...(employeeId !== 'all' ? { employee_id: employeeId } : {}) });
      const res = await fetch(`/api/reports/overtime-history?${params}`);
      const json = await res.json();
      if (json.success) setPrevRows(json.data || []);
    } catch { /* silent */ }
  }, [startDate, endDate, branchId, employeeId, status]);

  useEffect(() => { fetchHistory(); fetchPrevPeriod(); }, [fetchHistory, fetchPrevPeriod]);

  // ─── Date Presets ─────────────────────────────────────────────
  const applyPreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'last_month') => {
    const d = new Date();
    const fmt = (dt: Date) => dt.toISOString().split('T')[0];
    const todayStr = fmt(d);
    if (preset === 'today') { setStartDate(todayStr); setEndDate(todayStr); }
    else if (preset === 'yesterday') { const y = new Date(d); y.setDate(d.getDate() - 1); setStartDate(fmt(y)); setEndDate(fmt(y)); }
    else if (preset === 'week') { const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1)); setStartDate(fmt(mon)); setEndDate(todayStr); }
    else if (preset === 'month') { setStartDate(fmt(new Date(d.getFullYear(), d.getMonth(), 1))); setEndDate(todayStr); }
    else if (preset === 'last_month') { setStartDate(fmt(new Date(d.getFullYear(), d.getMonth() - 1, 1))); setEndDate(fmt(new Date(d.getFullYear(), d.getMonth(), 0))); }
  };

  // ─── Export ───────────────────────────────────────────────────
  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setExporting(format);
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate, status, export: format, ...(branchId !== 'all' ? { branch_id: branchId } : {}), ...(employeeId !== 'all' ? { employee_id: employeeId } : {}) });
      const res = await fetch(`/api/reports/overtime-history?${params}`);
      if (!res.ok) {
        let errorMsg = 'Export failed';
        try {
          const errData = await res.json();
          if (errData.error?.message) errorMsg = errData.error.message;
        } catch (_) {}
        throw new Error(errorMsg);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Overtime_History_${startDate}_to_${endDate}.${format === 'excel' ? 'xlsx' : format}`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally { setExporting(null); }
  };

  // ─── Print ────────────────────────────────────────────────────
  const handlePrint = () => window.print();

  // ─── Bulk Actions ─────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAllPending = () => {
    const pendingIds = filteredRows.filter(r => r.overtime_approval_status === 'pending').map(r => r.record_id);
    setSelectedIds(new Set(pendingIds));
  };
  const clearSelection = () => setSelectedIds(new Set());

  const executeBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map(id =>
        fetch('/api/attendance/overtime/approve', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            record_id: id,
            status: action === 'approve' ? 'approved' : 'rejected',
            note: bulkNote || undefined
          }),
        })
      ));
      await fetchHistory();
      setSelectedIds(new Set());
      setBulkNote('');
    } catch { alert('Bulk action failed.'); } finally { setBulkLoading(false); }
  };

  // ─── Computed / Derived Data ──────────────────────────────────
  const filteredRows = rows.filter(r =>
    r.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.employee_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.branch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.designation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calcOtPay = (row: OvertimeHistoryRow) => {
    const hrs = row.approved_overtime_minutes / 60;
    const multiplier = row.is_holiday_duty ? 2.0 : 1.0;
    return Math.round(hrs * defaultOtRate * multiplier);
  };

  const uniqueStaffCount = new Set(filteredRows.map(r => r.employee_id)).size;
  const totalLoggedMins = filteredRows.reduce((a, r) => a + r.logged_overtime_minutes, 0);
  const totalApprovedMins = filteredRows.reduce((a, r) => a + r.approved_overtime_minutes, 0);
  const totalHolidayMins = filteredRows.filter(r => r.is_holiday_duty).reduce((a, r) => a + r.approved_overtime_minutes, 0);
  const totalOtCost = filteredRows.reduce((a, r) => a + calcOtPay(r), 0);
  const pendingCount = filteredRows.filter(r => r.overtime_approval_status === 'pending').length;

  // Previous period comparisons
  const prevApprovedMins = prevRows.reduce((a, r) => a + r.approved_overtime_minutes, 0);
  const prevOtCost = prevRows.reduce((a, r) => {
    const hrs = r.approved_overtime_minutes / 60;
    const multiplier = r.is_holiday_duty ? 2.0 : 1.0;
    return a + Math.round(hrs * defaultOtRate * multiplier);
  }, 0);
  const prevStaffCount = new Set(prevRows.map(r => r.employee_id)).size;
  const diffMins = totalApprovedMins - prevApprovedMins;
  const diffCost = totalOtCost - prevOtCost;
  const diffStaff = uniqueStaffCount - prevStaffCount;

  // ─── Top OT Earners ───────────────────────────────────────────
  const earnerMap: Record<string, { name: string; code: string; branch: string; mins: number; cost: number; records: number }> = {};
  filteredRows.forEach(r => {
    if (!earnerMap[r.employee_id]) earnerMap[r.employee_id] = { name: r.employee_name, code: r.employee_code, branch: r.branch_name, mins: 0, cost: 0, records: 0 };
    earnerMap[r.employee_id].mins += r.approved_overtime_minutes;
    earnerMap[r.employee_id].cost += calcOtPay(r);
    earnerMap[r.employee_id].records += 1;
  });
  const topEarners = Object.values(earnerMap).sort((a, b) => b.mins - a.mins).slice(0, 10);

  // ─── Branch Chart Data ────────────────────────────────────────
  const branchMap: Record<string, number> = {};
  filteredRows.forEach(r => { branchMap[r.branch_name] = (branchMap[r.branch_name] || 0) + r.approved_overtime_minutes; });
  const branchChartData = Object.entries(branchMap).map(([name, mins]) => ({ name, hours: Number((mins / 60).toFixed(1)) }));

  // ─── Daily Trend Chart Data ───────────────────────────────────
  const dateMap: Record<string, number> = {};
  filteredRows.forEach(r => { dateMap[r.date] = (dateMap[r.date] || 0) + r.approved_overtime_minutes; });
  const trendData = Object.entries(dateMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, mins]) => ({ date: date.slice(5), hours: Number((mins / 60).toFixed(1)) }));

  // ─── Donut Chart Data ─────────────────────────────────────────
  const regularMins = filteredRows.filter(r => !r.is_holiday_duty).reduce((a, r) => a + r.approved_overtime_minutes, 0);
  const holidayMins = totalHolidayMins;
  const donutData = [
    { name: 'Regular OT', value: Math.round(regularMins / 60 * 10) / 10 },
    { name: 'Holiday OT (2x)', value: Math.round(holidayMins / 60 * 10) / 10 },
  ].filter(d => d.value > 0);

  // ─── Threshold Alert ──────────────────────────────────────────
  const overThresholdEmployees = Object.entries(earnerMap)
    .filter(([, v]) => v.mins / 60 > otThreshold)
    .map(([id, v]) => ({ id, ...v }));

  const formatHrsMins = (mins: number) => {
    const h = Math.floor(mins / 60); const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const diffArrow = (diff: number) => diff > 0 ? <ChevronUp className="w-4 h-4 text-amber-500 inline" /> : diff < 0 ? <ChevronDown className="w-4 h-4 text-emerald-500 inline" /> : <Minus className="w-4 h-4 text-slate-400 inline" />;

  return (
    <div className="space-y-6 print:space-y-4" ref={printRef}>

      {/* ── Print Header (only visible when printing) ── */}
      <div className="hidden print:block mb-4 border-b pb-3">
        <h1 className="text-xl font-extrabold">Anchor Fashion Management</h1>
        <p className="text-sm font-semibold text-gray-600">Overtime History Report — {startDate} to {endDate}</p>
      </div>

      {/* ── Preset & Export Bar ── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950/10 via-white to-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date Presets:</span>
          {(['today', 'yesterday', 'week', 'month', 'last_month'] as const).map(p => (
            <button key={p} onClick={() => applyPreset(p)} className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors capitalize">
              {p === 'last_month' ? 'Last Month' : p === 'month' ? 'This Month' : p === 'week' ? 'This Week' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          <Button size="sm" variant="outline" icon={<FileText className="w-4 h-4 text-sky-500" />} isLoading={exporting === 'csv'} disabled={loading || rows.length === 0} onClick={() => handleExport('csv')} className="font-bold text-xs">CSV</Button>
          <Button size="sm" variant="outline" icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />} isLoading={exporting === 'excel'} disabled={loading || rows.length === 0} onClick={() => handleExport('excel')} className="font-bold text-xs border-emerald-400/50 text-emerald-700">Excel</Button>
          <Button size="sm" variant="danger" icon={<Download className="w-4 h-4" />} isLoading={exporting === 'pdf'} disabled={loading || rows.length === 0} onClick={() => handleExport('pdf')} className="font-bold text-xs">PDF</Button>
          <Button size="sm" variant="outline" icon={<Printer className="w-4 h-4" />} disabled={rows.length === 0} onClick={handlePrint} className="font-bold text-xs">Print</Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <Card className="bg-white border-slate-200 p-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3 items-end">
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-emerald-500" />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-emerald-500" />
          </div>
          {role === 'admin' && (
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider"><Building2 className="w-3 h-3 inline mr-1" />Branch</label>
              <select value={branchId} onChange={e => { setBranchId(e.target.value); setEmployeeId('all'); }} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500">
                <option value="all">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider"><Users className="w-3 h-3 inline mr-1" />Employee</label>
            <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500">
              <option value="all">All Employees</option>
              {employees.filter(e => branchId === 'all' || e.branch_id === branchId).map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_id || 'ID'})</option>)}
            </select>
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500">
              <option value="all">All</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
              <option value="auto">Auto</option>
            </select>
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider"><Search className="w-3 h-3 inline mr-1" />Search</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Name, ID..." className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500" />
            </div>
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">OT Limit (hrs)</label>
            <div className="flex gap-2 items-center">
              <input type="number" min={1} value={otThreshold} onChange={e => setOtThreshold(Number(e.target.value))} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-700 w-20 focus:outline-none focus:border-amber-500" />
              <Button size="sm" variant="ghost" onClick={() => fetchHistory()} icon={<RefreshCw className="w-3.5 h-3.5" />} className="text-xs">Apply</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Threshold Alert Banner ── */}
      {overThresholdEmployees.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-2xl shadow-sm">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-800 text-sm">⚠️ {overThresholdEmployees.length} employee{overThresholdEmployees.length > 1 ? 's' : ''} exceeded the {otThreshold}h overtime limit</p>
            <p className="text-xs text-amber-700 mt-1">
              {overThresholdEmployees.map(e => `${e.name} (${formatHrsMins(e.mins)})`).join(' • ')}
            </p>
          </div>
        </div>
      )}

      {/* ── Summary Metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Staff with OT', val: uniqueStaffCount, diff: diffStaff, icon: <Users className="w-6 h-6" />, color: 'blue', fmt: (v: number) => String(v) },
          { label: 'Logged OT', val: totalLoggedMins, diff: null, icon: <Clock className="w-6 h-6" />, color: 'amber', fmt: formatHrsMins },
          { label: 'Approved OT', val: totalApprovedMins, diff: diffMins, icon: <CheckCircle2 className="w-6 h-6" />, color: 'emerald', fmt: formatHrsMins },
          { label: 'Holiday OT (2x)', val: totalHolidayMins, diff: null, icon: <Sparkles className="w-6 h-6" />, color: 'purple', fmt: formatHrsMins },
          { label: 'Est. OT Cost', val: totalOtCost, diff: diffCost, icon: <DollarSign className="w-6 h-6" />, color: 'rose', fmt: (v: number) => `৳${v.toLocaleString()}` },
        ].map(({ label, val, diff, icon, color, fmt }) => (
          <Card key={label} className={`p-4 border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-sm`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{label}</p>
                <p className={`text-2xl font-extrabold mt-1 ${color === 'emerald' ? 'text-[#1dbf73]' : color === 'purple' ? 'text-purple-600' : color === 'rose' ? 'text-rose-600' : color === 'amber' ? 'text-amber-600' : 'text-blue-600'}`}>
                  {fmt(val)}
                </p>
                {diff !== null && prevApprovedMins > 0 && (
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-0.5">
                    {diffArrow(diff)}
                    <span className={diff > 0 ? 'text-amber-600 font-bold' : diff < 0 ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                      {diff === 0 ? 'Same' : `${diff > 0 ? '+' : ''}${label.includes('Cost') ? '৳' + Math.abs(diff).toLocaleString() : formatHrsMins(Math.abs(diff))} vs prev`}
                    </span>
                  </p>
                )}
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color === 'emerald' ? 'bg-emerald-100 text-emerald-600' : color === 'purple' ? 'bg-purple-100 text-purple-600' : color === 'rose' ? 'bg-rose-100 text-rose-600' : color === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                {icon}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Pending OT quick badge ── */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl print:hidden">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-sm font-bold text-amber-800">{pendingCount} records pending verification</span>
          <button onClick={selectAllPending} className="ml-auto text-xs font-bold px-3 py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">Select All Pending</button>
        </div>
      )}

      {/* ── View Tab Switcher ── */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 w-fit print:hidden">
        {([['table', 'Table View', BarChart3], ['charts', 'Analytics Charts', TrendingUp], ['leaderboard', 'Top Earners', Award]] as const).map(([view, label, Icon]) => (
          <button key={view} onClick={() => setActiveView(view as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeView === view ? 'bg-white shadow-sm text-slate-900 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* ── TABLE VIEW ── */}
      {/* ══════════════════════════════════════════════ */}
      {(activeView === 'table') && (
        <Card className="bg-white border-slate-200 overflow-hidden shadow-md">
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#1dbf73]" />
              <h3 className="font-bold text-slate-900">Overtime Records ({filteredRows.length})</h3>
            </div>
            <Button size="sm" variant="outline" onClick={() => fetchHistory()} icon={<RefreshCw className="w-3.5 h-3.5" />} className="print:hidden text-xs">Refresh</Button>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center"><Spinner size="lg" /><p className="text-sm text-slate-500 mt-3">Loading records...</p></div>
          ) : filteredRows.length === 0 ? (
            <div className="py-14 text-center space-y-2"><Clock className="w-12 h-12 mx-auto text-slate-300 stroke-[1.5]" /><p className="font-bold text-slate-700">No overtime records found</p><p className="text-xs text-slate-500">Adjust filters to see records</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] uppercase font-extrabold text-slate-900 tracking-wider">
                    <th className="py-3 px-3 print:hidden"><button onClick={() => selectedIds.size > 0 ? clearSelection() : selectAllPending()} className="text-slate-400 hover:text-slate-700">{selectedIds.size > 0 ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4" />}</button></th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Date & Day</th>
                    <th className="py-3 px-4">Timestamps</th>
                    <th className="py-3 px-4 text-center">Logged OT</th>
                    <th className="py-3 px-4 text-center">Approved OT</th>
                    <th className="py-3 px-4 text-center">Est. Pay</th>
                    <th className="py-3 px-4 text-center">Rate</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map(row => {
                    const isOverThreshold = (earnerMap[row.employee_id]?.mins || 0) / 60 > otThreshold;
                    const isSelected = selectedIds.has(row.record_id);
                    const otPay = calcOtPay(row);
                    return (
                      <tr key={row.record_id} className={`transition-colors ${isSelected ? 'bg-emerald-50 border-l-2 border-emerald-500' : isOverThreshold ? 'bg-amber-50/60' : 'hover:bg-slate-50/80'}`}>
                        <td className="py-3 px-3 print:hidden">
                          <button onClick={() => toggleSelect(row.record_id)} className="text-slate-400 hover:text-emerald-600 transition-colors">
                            {isSelected ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            {isOverThreshold && <span title="Exceeded OT threshold"><ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" /></span>}
                            {row.employee_name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            <span className="font-mono font-medium text-slate-700">{row.employee_code}</span> · {row.designation}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-700">{row.branch_name}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 text-xs">{row.date}</div>
                          <div className="text-[11px] text-slate-500">{row.day_name}</div>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <div className="font-mono">
                            <span className="text-emerald-700 font-semibold">{row.check_in_time}</span>
                            <span className="text-slate-400 mx-1">→</span>
                            <span className="text-amber-700 font-semibold">{row.check_out_time}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{row.duty_hours}h shift</div>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-900">{formatHrsMins(row.logged_overtime_minutes)}</td>
                        <td className="py-3 px-4 text-center font-extrabold text-[#1dbf73] text-base">{formatHrsMins(row.approved_overtime_minutes)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-bold text-rose-600 text-sm">৳{otPay.toLocaleString()}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.is_holiday_duty
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200"><Sparkles className="w-3 h-3" />2.0x</span>
                            : <span className="text-xs text-slate-400 font-medium">1.0x</span>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.overtime_approval_status === 'approved' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"><CheckCircle2 className="w-3 h-3" />Approved</span>}
                          {row.overtime_approval_status === 'pending' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300"><AlertCircle className="w-3 h-3" />Pending</span>}
                          {row.overtime_approval_status === 'rejected' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300"><XCircle className="w-3 h-3" />Rejected</span>}
                          {row.overtime_approval_status === 'auto' && <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">Auto</span>}
                        </td>
                        <td className="py-3 px-4 max-w-[180px]">
                          {row.overtime_approval_note
                            ? <div className="flex items-start gap-1 bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-xs text-slate-900 italic"><MessageSquare className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />{row.overtime_approval_note}</div>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Bulk Action Bar ── */}
      {selectedIds.size > 0 && activeView === 'table' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 border border-slate-700 print:hidden">
          <span className="font-bold text-sm">{selectedIds.size} selected</span>
          <div className="w-px h-5 bg-slate-700" />
          <input
            type="text"
            value={bulkNote}
            onChange={e => setBulkNote(e.target.value)}
            placeholder="Optional reviewer note..."
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1 text-xs text-white placeholder-slate-400 focus:outline-none w-52"
          />
          <button onClick={() => executeBulkAction('approve')} disabled={bulkLoading} className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-bold text-sm transition-colors disabled:opacity-60 flex items-center gap-1.5">
            {bulkLoading ? <Spinner size="sm" /> : <CheckCircle2 className="w-4 h-4" />} Approve All
          </button>
          <button onClick={() => executeBulkAction('reject')} disabled={bulkLoading} className="px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 font-bold text-sm transition-colors disabled:opacity-60 flex items-center gap-1.5">
            <XCircle className="w-4 h-4" /> Reject All
          </button>
          <button onClick={clearSelection} className="text-slate-400 hover:text-white text-xs underline">Cancel</button>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* ── CHARTS VIEW ── */}
      {/* ══════════════════════════════════════════════ */}
      {activeView === 'charts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Branch Bar Chart */}
          <Card className="p-5 border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-500" />Branch-wise OT Hours</h3>
            {branchChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={branchChartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip formatter={(v) => [`${v}h`, 'OT Hours']} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="hours" fill="#1dbf73" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-slate-400 text-center py-10">No data for chart</p>}
          </Card>

          {/* Daily Trend */}
          <Card className="p-5 border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" />Daily OT Trend</h3>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip formatter={(v) => [`${v}h`, 'OT Hours']} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Line type="monotone" dataKey="hours" stroke="#1dbf73" strokeWidth={2.5} dot={{ r: 3, fill: '#1dbf73' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-slate-400 text-center py-10">No data for chart</p>}
          </Card>

          {/* Donut */}
          <Card className="p-5 border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-500" />Regular vs Holiday OT</h3>
            {donutData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}h`} labelLine={false}>
                    {donutData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v}h`, '']} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-slate-400 text-center py-10">No data</p>}
          </Card>

          {/* Month-over-Month Comparison */}
          <Card className="p-5 border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-amber-500" />Period Comparison</h3>
            <div className="space-y-4">
              {[
                { label: 'Approved OT Hours', curr: Number((totalApprovedMins / 60).toFixed(1)), prev: Number((prevApprovedMins / 60).toFixed(1)), fmt: (v: number) => `${v}h` },
                { label: 'Est. OT Cost', curr: totalOtCost, prev: prevOtCost, fmt: (v: number) => `৳${v.toLocaleString()}` },
                { label: 'Unique Staff', curr: uniqueStaffCount, prev: prevStaffCount, fmt: (v: number) => `${v}` },
              ].map(({ label, curr, prev, fmt }) => {
                const pct = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-slate-700">{label}</span>
                      <span className={`font-extrabold text-sm ${pct > 0 ? 'text-amber-600' : pct < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {pct > 0 ? `+${pct}%` : pct < 0 ? `${pct}%` : 'Same'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-center">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Current</p>
                        <p className="text-base font-extrabold text-[#1dbf73]">{fmt(curr)}</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-center">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Previous</p>
                        <p className="text-base font-extrabold text-slate-500">{fmt(prev)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* ── LEADERBOARD VIEW ── */}
      {/* ══════════════════════════════════════════════ */}
      {activeView === 'leaderboard' && (
        <Card className="bg-white border-slate-200 shadow-md overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-amber-500/10 to-white">
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2"><Award className="w-5 h-5 text-amber-500" />Top OT Earners — {startDate} to {endDate}</h3>
            <p className="text-xs text-slate-500 mt-1">Ranked by total approved overtime hours</p>
          </div>
          {topEarners.length === 0 ? (
            <div className="py-14 text-center text-slate-400"><Award className="w-12 h-12 mx-auto mb-3 stroke-[1.5]" /><p className="font-bold">No overtime records to rank</p></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {topEarners.map((e, i) => {
                const hrs = Number((e.mins / 60).toFixed(1));
                const isOver = hrs > otThreshold;
                const maxMins = topEarners[0]?.mins || 1;
                const pct = Math.round((e.mins / maxMins) * 100);
                return (
                  <div key={i} className={`flex items-center gap-4 px-6 py-4 transition-colors ${i === 0 ? 'bg-amber-50/50' : i === 1 ? 'bg-slate-50/50' : i === 2 ? 'bg-orange-50/30' : 'hover:bg-slate-50/50'}`}>
                    <span className="text-2xl w-10 text-center font-extrabold shrink-0">{getMedalEmoji(i + 1)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-extrabold text-slate-900 truncate">{e.name}</p>
                        {isOver && <span title="Exceeded threshold"><ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" /></span>}
                        {e.records >= 10 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0">Consistent ⭐</span>}
                      </div>
                      <p className="text-xs text-slate-500">{e.code} · {e.branch} · {e.records} session{e.records !== 1 ? 's' : ''}</p>
                      <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#1dbf73] to-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-extrabold text-[#1dbf73]">{hrs}h</p>
                      <p className="text-xs font-bold text-rose-600">৳{e.cost.toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── Print-only Summary Table ── */}
      <div className="hidden print:block mt-6">
        <h2 className="font-extrabold text-base mb-3">Overtime Records Summary</h2>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100 border border-gray-300">
              {['Date', 'Day', 'Employee', 'Branch', 'Check In → Out', 'Approved OT', 'Est. Pay', 'Status'].map(h => (
                <th key={h} className="border border-gray-300 px-2 py-1 text-left font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(r => (
              <tr key={r.record_id} className="border border-gray-200">
                <td className="border border-gray-200 px-2 py-1">{r.date}</td>
                <td className="border border-gray-200 px-2 py-1">{r.day_name.slice(0, 3)}</td>
                <td className="border border-gray-200 px-2 py-1">{r.employee_name} ({r.employee_code})</td>
                <td className="border border-gray-200 px-2 py-1">{r.branch_name}</td>
                <td className="border border-gray-200 px-2 py-1 font-mono">{r.check_in_time} → {r.check_out_time}</td>
                <td className="border border-gray-200 px-2 py-1 font-bold">{formatHrsMins(r.approved_overtime_minutes)}</td>
                <td className="border border-gray-200 px-2 py-1 font-bold">৳{calcOtPay(r).toLocaleString()}</td>
                <td className="border border-gray-200 px-2 py-1 capitalize">{r.overtime_approval_status}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td colSpan={5} className="border border-gray-300 px-2 py-1 text-right">TOTAL</td>
              <td className="border border-gray-300 px-2 py-1">{formatHrsMins(totalApprovedMins)}</td>
              <td className="border border-gray-300 px-2 py-1">৳{totalOtCost.toLocaleString()}</td>
              <td className="border border-gray-300 px-2 py-1"></td>
            </tr>
          </tfoot>
        </table>
        <p className="text-[10px] text-gray-500 mt-4">Generated: {new Date().toLocaleString()} · Anchor Fashion Management System</p>
      </div>

    </div>
  );
}
