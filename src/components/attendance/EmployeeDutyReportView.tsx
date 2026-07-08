'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  Clock,
  TrendingUp,
  AlertCircle,
  XCircle,
  CheckCircle2,
  Calendar,
  Download,
  FileText,
  FileSpreadsheet,
  Building2,
  User,
  ArrowLeft,
  Filter,
  Search,
  RefreshCw,
  Info,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface DailyLog {
  date: string;
  day_name: string;
  status: 'present' | 'late' | 'half_day' | 'missed' | 'on_leave' | 'off_day' | 'holiday' | 'upcoming';
  check_in_time: string;
  check_out_time: string;
  duty_hours: number;
  late_minutes: number;
  overtime_minutes: number;
  overtime_hours: number;
  notes: string;
}

interface DutySummaryData {
  employee: {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    photo_url?: string;
    role: string;
    branch_id?: string;
    employee_id?: string;
    branch_name: string;
    branch_code?: string;
  };
  period: {
    month: number;
    year: number;
    work_start_time: string;
    work_end_time: string;
    late_grace_minutes: number;
  };
  summary: {
    total_working_days: number;
    total_present_days: number;
    total_late_days: number;
    total_half_days: number;
    total_missed_days: number;
    total_on_leave_days: number;
    total_off_days: number;
    total_holiday_days: number;
    total_duty_hours: number;
    total_overtime_minutes: number;
    total_overtime_hours: number;
    total_late_minutes: number;
    total_late_hours: number;
  };
  daily_breakdown: DailyLog[];
}

interface Props {
  employeeId: string;
  backUrl?: string;
}

export function EmployeeDutyReportView({ employeeId, backUrl }: Props) {
  const router = useRouter();
  const currentDate = new Date();
  const [month, setMonth] = useState<number>(currentDate.getMonth() + 1);
  const [year, setYear] = useState<number>(currentDate.getFullYear());
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<DutySummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'excel' | 'pdf' | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'present' | 'late' | 'missed' | 'overtime'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  const fetchDutyData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/employee/${employeeId}/duty-summary?month=${month}&year=${year}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to calculate monthly duty profile.');
      }
      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Error fetching report.');
    } finally {
      setLoading(false);
    }
  }, [employeeId, month, year]);

  useEffect(() => {
    fetchDutyData();
  }, [fetchDutyData]);

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setExporting(format);
    try {
      const res = await fetch(`/api/reports/employee/${employeeId}/export?month=${month}&year=${year}&format=${format}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Export generation failed.');
      }

      if (json.data?.content_base64) {
        // Convert base64 to Blob and trigger download
        const byteCharacters = atob(json.data.content_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: json.data.content_type || 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = json.data.file_name || `Duty_Report_${month}_${year}.${format === 'excel' ? 'xlsx' : format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else if (json.data?.signed_url) {
        window.open(json.data.signed_url, '_blank');
      } else {
        throw new Error('No downloadable file returned.');
      }
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(null);
    }
  };

  const getStatusBadge = (status: DailyLog['status'], lateMins: number, otMins: number) => {
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Present
            {otMins > 0 && <span className="ml-1 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px]">+{otMins}m OT</span>}
          </span>
        );
      case 'late':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            Late (+{lateMins}m)
            {otMins > 0 && <span className="ml-1 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px]">+{otMins}m OT</span>}
          </span>
        );
      case 'half_day':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-semibold">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            Half Day
          </span>
        );
      case 'missed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs font-semibold shadow-sm animate-pulse">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            Missed / Absent
          </span>
        );
      case 'on_leave':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-semibold">
            <Calendar className="w-3.5 h-3.5 text-purple-400" />
            Approved Leave
          </span>
        );
      case 'holiday':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-medium">
            Holiday
          </span>
        );
      case 'off_day':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700 text-xs font-medium">
            Weekly Off Day
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/60 text-slate-500 border border-slate-700/60 text-xs">
            Upcoming
          </span>
        );
    }
  };

  const filteredLogs = (data?.daily_breakdown || []).filter((log) => {
    if (filterTab === 'present' && log.status !== 'present') return false;
    if (filterTab === 'late' && log.status !== 'late') return false;
    if (filterTab === 'missed' && log.status !== 'missed') return false;
    if (filterTab === 'overtime' && log.overtime_minutes <= 0) return false;

    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const matchDate = log.date.toLowerCase().includes(q);
      const matchDay = log.day_name.toLowerCase().includes(q);
      const matchNotes = log.notes.toLowerCase().includes(q);
      const matchStatus = log.status.toLowerCase().includes(q);
      if (!matchDate && !matchDay && !matchNotes && !matchStatus) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0A101C] border border-[#1E293B] p-6 rounded-2xl shadow-xl">
        <div className="flex items-center space-x-4">
          {backUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(backUrl)}
              className="text-slate-400 hover:text-white mr-1"
            >
              <ArrowLeft className="w-5 h-5 mr-1" /> Back
            </Button>
          )}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-slate-800 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xl shrink-0 shadow-inner">
            {data?.employee?.full_name?.charAt(0) || <User className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                {data?.employee?.full_name || 'Loading Employee...'}
              </h1>
              {data?.employee?.employee_id && (
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-xs border border-slate-700">
                  ID: {data.employee.employee_id}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-amber-400/80" />
                {data?.employee?.branch_name || 'Assigned Branch'}
              </span>
              <span className="capitalize px-2 py-0.5 rounded bg-slate-800/80 text-slate-300">
                {data?.employee?.role?.replace('_', ' ') || 'Staff'}
              </span>
            </div>
          </div>
        </div>

        {/* Period Picker & Refresh */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-[#141E33] border border-[#1E293B] rounded-xl p-1 shadow-inner">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-transparent text-slate-200 text-sm font-medium px-3 py-1.5 rounded-lg focus:outline-none focus:bg-slate-800 cursor-pointer"
            >
              {months.map((m, i) => (
                <option key={m} value={i + 1} className="bg-[#0A101C] text-slate-200">
                  {m}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-transparent text-slate-200 text-sm font-medium px-3 py-1.5 rounded-lg focus:outline-none focus:bg-slate-800 border-l border-[#1E293B] cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y} className="bg-[#0A101C] text-slate-200">
                  {y}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchDutyData}
            disabled={loading}
            className="text-slate-400 hover:text-white p-2 border border-[#1E293B] rounded-xl"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Export Controls Toolbar */}
      <div className="bg-gradient-to-r from-[#0E1726] to-[#141E33] border border-amber-500/20 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-200 text-sm">Detailed Export & Reports</h3>
            <p className="text-xs text-slate-400">Download complete month-wise and day-wise overtime & duty analytics</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <Button
            onClick={() => handleExport('csv')}
            disabled={exporting !== null || loading || !data}
            variant="outline"
            size="sm"
            className="flex-1 md:flex-none border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs gap-1.5"
          >
            {exporting === 'csv' ? <Spinner size="sm" /> : <FileText className="w-3.5 h-3.5 text-sky-400" />}
            Export CSV
          </Button>
          <Button
            onClick={() => handleExport('excel')}
            disabled={exporting !== null || loading || !data}
            variant="outline"
            size="sm"
            className="flex-1 md:flex-none border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs gap-1.5"
          >
            {exporting === 'excel' ? <Spinner size="sm" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />}
            Export Excel
          </Button>
          <Button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null || loading || !data}
            variant="primary"
            size="sm"
            className="flex-1 md:flex-none bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-semibold text-xs gap-1.5 shadow-md shadow-amber-500/20"
          >
            {exporting === 'pdf' ? <Spinner size="sm" /> : <Download className="w-3.5 h-3.5" />}
            Export PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-28 bg-[#0A101C] rounded-2xl border border-[#1E293B]">
          <Spinner size="lg" />
          <p className="text-sm text-slate-400 mt-3 animate-pulse">Calculating duty hours, overtime, and punctuality breakdown...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-rose-300">Calculation Error</h3>
          <p className="text-sm text-slate-400 mt-1 mb-4">{error}</p>
          <Button onClick={fetchDutyData} variant="outline" size="sm">Try Again</Button>
        </div>
      ) : data ? (
        <>
          {/* 6 KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* 1. Duty Hours */}
            <Card className="bg-[#0A101C]/90 border-[#1E293B] p-4 relative overflow-hidden group hover:border-amber-500/30 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400">Total Duty Hours</span>
                <Clock className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight">{data.summary.total_duty_hours} <span className="text-sm font-normal text-slate-400">hrs</span></p>
              <p className="text-[11px] text-slate-500 mt-1">Across {data.summary.total_present_days + data.summary.total_late_days} working shifts</p>
            </Card>

            {/* 2. Overtime */}
            <Card className="bg-[#0A101C]/90 border-[#1E293B] p-4 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400">Total Overtime</span>
                <TrendingUp className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-2xl font-bold text-emerald-400 tracking-tight">{data.summary.total_overtime_hours} <span className="text-sm font-normal text-slate-400">hrs</span></p>
              <p className="text-[11px] text-slate-500 mt-1">{data.summary.total_overtime_minutes} minutes overtime</p>
            </Card>

            {/* 3. Missed Days */}
            <Card className="bg-[#0A101C]/90 border-rose-500/20 p-4 relative overflow-hidden group hover:border-rose-500/40 transition-all bg-gradient-to-br from-rose-500/5 to-[#0A101C]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-rose-300">Missed / Absent</span>
                <XCircle className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform animate-pulse" />
              </div>
              <p className="text-2xl font-bold text-rose-400 tracking-tight">{data.summary.total_missed_days} <span className="text-sm font-normal text-slate-400">days</span></p>
              <p className="text-[11px] text-rose-400/80 mt-1">Unlogged working days</p>
            </Card>

            {/* 4. Late Minutes & Days */}
            <Card className="bg-[#0A101C]/90 border-amber-500/20 p-4 relative overflow-hidden group hover:border-amber-500/40 transition-all bg-gradient-to-br from-amber-500/5 to-[#0A101C]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-amber-300">Total Late Time</span>
                <AlertCircle className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-2xl font-bold text-amber-400 tracking-tight">{data.summary.total_late_minutes} <span className="text-sm font-normal text-slate-400">mins</span></p>
              <p className="text-[11px] text-amber-400/80 mt-1">Across {data.summary.total_late_days} late days</p>
            </Card>

            {/* 5. Present Days */}
            <Card className="bg-[#0A101C]/90 border-[#1E293B] p-4 relative overflow-hidden group hover:border-sky-500/30 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400">Present Days</span>
                <CheckCircle2 className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight">{data.summary.total_present_days + data.summary.total_late_days} <span className="text-sm font-normal text-slate-400">days</span></p>
              <p className="text-[11px] text-slate-500 mt-1">Out of {data.summary.total_working_days} working days</p>
            </Card>

            {/* 6. Leave & Off Days */}
            <Card className="bg-[#0A101C]/90 border-[#1E293B] p-4 relative overflow-hidden group hover:border-purple-500/30 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400">Leave & Off Days</span>
                <Calendar className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight">{data.summary.total_on_leave_days + data.summary.total_off_days + data.summary.total_holiday_days} <span className="text-sm font-normal text-slate-400">days</span></p>
              <p className="text-[11px] text-slate-500 mt-1">{data.summary.total_on_leave_days} leave, {data.summary.total_off_days + data.summary.total_holiday_days} off/holidays</p>
            </Card>
          </div>

          {/* Daily Breakdown Section */}
          <div className="bg-[#0A101C] border border-[#1E293B] rounded-2xl overflow-hidden shadow-xl">
            {/* Table Header Controls */}
            <div className="p-5 border-b border-[#1E293B] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-200 text-base">Day-by-Day Duty Roster ({months[month - 1]} {year})</h3>
                <p className="text-xs text-slate-400 mt-0.5">Exact daily check-in, check-out, duty hours, overtime, and punctuality log</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* Search input */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search date, status, notes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#141E33] border border-[#1E293B] rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center bg-[#141E33] p-1 rounded-xl border border-[#1E293B] w-full sm:w-auto overflow-x-auto">
                  <button
                    onClick={() => setFilterTab('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filterTab === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    All ({data.daily_breakdown.length})
                  </button>
                  <button
                    onClick={() => setFilterTab('present')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filterTab === 'present' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Present
                  </button>
                  <button
                    onClick={() => setFilterTab('late')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filterTab === 'late' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Late ({data.summary.total_late_days})
                  </button>
                  <button
                    onClick={() => setFilterTab('missed')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filterTab === 'missed' ? 'bg-rose-500 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Missed ({data.summary.total_missed_days})
                  </button>
                  <button
                    onClick={() => setFilterTab('overtime')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filterTab === 'overtime' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Overtime
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0E1726]/80 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-[#1E293B]">
                    <th className="py-3.5 px-5">Date</th>
                    <th className="py-3.5 px-5">Day</th>
                    <th className="py-3.5 px-5">Status</th>
                    <th className="py-3.5 px-5">Check-In</th>
                    <th className="py-3.5 px-5">Check-Out</th>
                    <th className="py-3.5 px-5 text-center">Duty Hours</th>
                    <th className="py-3.5 px-5 text-center">Late (Mins)</th>
                    <th className="py-3.5 px-5 text-center">Overtime</th>
                    <th className="py-3.5 px-5">Notes / Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]/60 text-xs">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-slate-500">
                        No daily logs found matching the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr
                        key={log.date}
                        className={`hover:bg-[#141E33]/60 transition-colors ${log.status === 'missed' ? 'bg-rose-500/[0.03]' : log.status === 'late' ? 'bg-amber-500/[0.03]' : ''}`}
                      >
                        <td className="py-3.5 px-5 font-mono font-medium text-slate-200">{log.date}</td>
                        <td className="py-3.5 px-5 text-slate-400">{log.day_name}</td>
                        <td className="py-3.5 px-5">{getStatusBadge(log.status, log.late_minutes, log.overtime_minutes)}</td>
                        <td className="py-3.5 px-5 font-mono text-slate-300">{log.check_in_time}</td>
                        <td className="py-3.5 px-5 font-mono text-slate-300">{log.check_out_time}</td>
                        <td className="py-3.5 px-5 text-center font-bold text-slate-200">
                          {log.duty_hours > 0 ? `${log.duty_hours}h` : '-'}
                        </td>
                        <td className="py-3.5 px-5 text-center font-mono">
                          {log.late_minutes > 0 ? (
                            <span className="text-amber-400 font-bold">+{log.late_minutes}m</span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-center font-mono">
                          {log.overtime_minutes > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/20">
                              +{log.overtime_hours}h ({log.overtime_minutes}m)
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-slate-400">{log.notes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
