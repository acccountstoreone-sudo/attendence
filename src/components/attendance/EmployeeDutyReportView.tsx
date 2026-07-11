'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { motion, AnimatePresence } from 'framer-motion';
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
  Search,
  RefreshCw,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  LocateFixed,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DailyLog {
  date: string;
  day_name: string;
  status: 'present' | 'late' | 'half_day' | 'missed' | 'on_leave' | 'off_day' | 'holiday' | 'upcoming';
  check_in_time: string;
  check_out_time: string;
  duty_hours: number;
  late_minutes: number;
  late_hours?: number;
  overtime_minutes: number;
  overtime_hours: number;
  notes: string;
  face_verified?: boolean;
  face_match_score?: number | null;
  check_in_lat?: number | null;
  check_in_lng?: number | null;
  check_out_lat?: number | null;
  check_out_lng?: number | null;
  is_right_time?: boolean;
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
    created_at?: string;
    facial_id?: string | null;
    face_enrolled?: boolean;
    requires_face_reverification?: boolean;
    face_reset_at?: string | null;
    last_known_latitude?: number | null;
    last_known_longitude?: number | null;
    last_location_updated_at?: string | null;
    first_verified_latitude?: number | null;
    first_verified_longitude?: number | null;
    first_verified_at?: string | null;
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
    today_status?: string;
    today_duty_hours?: number;
    today_late_minutes?: number;
    today_late_hours?: number;
    today_overtime_minutes?: number;
    today_overtime_hours?: number;
    today_face_verified?: boolean;
    today_check_in_time?: string;
    today_check_out_time?: string;
    today_location?: { lat: number; lng: number } | null;
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
  const [exporting, setExporting] = useState<'csv' | 'excel' | 'pdf' | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'present' | 'late' | 'missed' | 'overtime'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [refreshIndex, setRefreshIndex] = useState<number>(0);
  const [resettingFace, setResettingFace] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showMapModal, setShowMapModal] = useState<{ lat: number; lng: number; title: string; subtitle?: string } | null>(null);

  const handleResetFaceVerification = async () => {
    if (!data?.employee?.id) return;
    const confirmReset = window.confirm(
      `Are you sure you want to cancel and reset biometric face verification for ${data.employee.full_name}?\n\nThis will immediately revoke their current face enrollment and send a notification requiring them to re-verify their face right now before checking in.`
    );
    if (!confirmReset) return;

    setResettingFace(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/employees/${data.employee.id}/reset-face-verification`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Failed to reset face verification.');
      }
      setFeedback({ type: 'success', text: `Face verification cancelled successfully! Employee notified.` });
      setRefreshIndex((prev) => prev + 1);
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: `Error resetting face verification: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setResettingFace(false);
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  useEffect(() => {
    let mounted = true;
    const fetchDutyData = async () => {
      setLoading(true);
      setFeedback(null);
      try {
        const res = await fetch(`/api/reports/employee/${employeeId}/duty-summary?month=${month}&year=${year}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'Failed to calculate monthly duty profile.');
        }
        if (mounted) setData(json.data);
      } catch (err: unknown) {
        if (mounted) setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Error fetching report.' });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    queueMicrotask(() => {
      fetchDutyData();
    });

    return () => {
      mounted = false;
    };
  }, [employeeId, month, year, refreshIndex]);

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
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: `Export error: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setExporting(null);
    }
  };

  const getStatusBadge = (status: DailyLog['status'], lateMins: number, otMins: number) => {
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1dbf73]/10 text-[#1dbf73] border border-emerald-500/20 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#1dbf73]" />
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 text-slate-600 border border-slate-200 text-xs font-medium">
            Weekly Off Day
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50/60 text-slate-500 border border-slate-200/60 text-xs">
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#ffffff] border border-[#ffffff] p-6 rounded-2xl shadow-xl">
        <div className="flex items-center space-x-4">
          {backUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(backUrl)}
              className="text-slate-600 hover:text-slate-900 mr-1"
            >
              <ArrowLeft className="w-5 h-5 mr-1" /> Back
            </Button>
          )}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-slate-100 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xl shrink-0 shadow-inner">
            {data?.employee?.full_name?.charAt(0) || <User className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                {data?.employee?.full_name || 'Loading Employee...'}
              </h1>
              {data?.employee?.employee_id && (
                <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 font-mono text-xs border border-slate-200">
                  ID: {data.employee.employee_id}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 mt-1">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-amber-400/80" />
                {data?.employee?.branch_name || 'Assigned Branch'}
              </span>
              <span className="capitalize px-2 py-0.5 rounded bg-slate-50/80 text-slate-600">
                {data?.employee?.role?.replace('_', ' ') || 'Staff'}
              </span>
            </div>
          </div>
        </div>

        {/* Period Picker & Refresh */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-[#f8fafc] border border-[#ffffff] rounded-xl p-1 shadow-inner">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-transparent text-slate-700 text-sm font-medium px-3 py-1.5 rounded-lg focus:outline-none focus:bg-slate-50 cursor-pointer"
            >
              {months.map((m, i) => (
                <option key={m} value={i + 1} className="bg-[#ffffff] text-slate-700">
                  {m}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-transparent text-slate-700 text-sm font-medium px-3 py-1.5 rounded-lg focus:outline-none focus:bg-slate-50 border-l border-[#ffffff] cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y} className="bg-[#ffffff] text-slate-700">
                  {y}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRefreshIndex((prev) => prev + 1)}
            disabled={loading}
            className="text-slate-600 hover:text-slate-900 p-2 border border-[#ffffff] rounded-xl"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Export Controls Toolbar */}
      <div className="bg-gradient-to-r from-[#ffffff] to-[#f8fafc] border border-amber-500/20 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-700 text-sm">Detailed Export & Reports</h3>
            <p className="text-xs text-slate-600">Download complete month-wise and day-wise overtime & duty analytics</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <Button
            onClick={() => handleExport('csv')}
            disabled={exporting !== null || loading || !data}
            variant="outline"
            size="sm"
            className="flex-1 md:flex-none border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-slate-700 text-xs gap-1.5"
          >
            {exporting === 'csv' ? <Spinner size="sm" /> : <FileText className="w-3.5 h-3.5 text-sky-400" />}
            Export CSV
          </Button>
          <Button
            onClick={() => handleExport('excel')}
            disabled={exporting !== null || loading || !data}
            variant="outline"
            size="sm"
            className="flex-1 md:flex-none border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-slate-700 text-xs gap-1.5"
          >
            {exporting === 'excel' ? <Spinner size="sm" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-[#1dbf73]" />}
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
        <div className="flex flex-col items-center justify-center py-28 bg-[#ffffff] rounded-2xl border border-[#ffffff]">
          <Spinner size="lg" />
          <p className="text-sm text-slate-600 mt-3 animate-pulse">Calculating duty hours, overtime, and punctuality breakdown...</p>
        </div>
      ) : data ? (
        <>
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
                  <button onClick={() => setFeedback(null)} className="ml-auto opacity-70 hover:opacity-100">X</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Today's Real-time Duty Spotlight Card */}
          {month === currentDate.getMonth() + 1 && year === currentDate.getFullYear() && (
            <div className="bg-gradient-to-r from-amber-500/15 via-[#ffffff] to-cyan-500/15 border border-amber-500/30 rounded-2xl p-5 relative overflow-hidden shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-500/20 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 animate-pulse">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-base">Today&apos;s Real-Time Duty Spotlight</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-slate-950">LIVE</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">Instant attendance, punctuality, and face/GPS status for today ({new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Dhaka', month: 'short', day: 'numeric', year: 'numeric' })})</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    data.summary.today_status === 'present' ? 'bg-[#1dbf73]/20 text-[#1dbf73] border border-emerald-500/40' :
                    data.summary.today_status === 'late' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                    data.summary.today_status === 'half_day' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' :
                    'bg-slate-50 text-slate-600 border border-slate-200'
                  }`}>
                    Today: {data.summary.today_status || 'Upcoming'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center sm:text-left">
                <div className="bg-[#f8fafc]/60 p-3 rounded-xl border border-[#ffffff]">
                  <p className="text-[11px] font-medium text-slate-600">Check-In Time</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">{data.summary.today_check_in_time || '--:--'}</p>
                </div>

                <div className="bg-[#f8fafc]/60 p-3 rounded-xl border border-[#ffffff]">
                  <p className="text-[11px] font-medium text-slate-600">Check-Out Time</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">{data.summary.today_check_out_time || '--:--'}</p>
                </div>

                <div className="bg-[#f8fafc]/60 p-3 rounded-xl border border-[#ffffff]">
                  <p className="text-[11px] font-medium text-slate-600">Duty Hours Today</p>
                  <p className="text-sm font-bold text-amber-400 mt-1">{data.summary.today_duty_hours || 0} hrs</p>
                </div>

                <div className="bg-[#f8fafc]/60 p-3 rounded-xl border border-[#ffffff]">
                  <p className="text-[11px] font-medium text-slate-600">Punctuality</p>
                  {data.summary.today_late_minutes && data.summary.today_late_minutes > 0 ? (
                    <p className="text-sm font-bold text-rose-400 mt-1">{data.summary.today_late_minutes}m late ({data.summary.today_late_hours}h)</p>
                  ) : data.summary.today_check_in_time !== '--:--' ? (
                    <p className="text-sm font-bold text-[#1dbf73] mt-1">✓ Right Time</p>
                  ) : (
                    <p className="text-sm font-bold text-slate-500 mt-1">Not Check In</p>
                  )}
                </div>

                <div className="bg-[#f8fafc]/60 p-3 rounded-xl border border-[#ffffff]">
                  <p className="text-[11px] font-medium text-slate-600">Today Overtime</p>
                  <p className="text-sm font-bold text-[#1dbf73] mt-1">{data.summary.today_overtime_minutes || 0}m ({data.summary.today_overtime_hours || 0}h)</p>
                </div>

                <div className="bg-[#f8fafc]/60 p-3 rounded-xl border border-[#ffffff] flex flex-col justify-between">
                  <p className="text-[11px] font-medium text-slate-600">Biometric & GPS</p>
                  <div className="flex items-center justify-between gap-1 mt-1">
                    <span className={`text-xs font-bold ${data.summary.today_face_verified ? 'text-[#1dbf73]' : 'text-slate-600'}`}>
                      {data.summary.today_face_verified ? '✓ Face' : '✗ Face'}
                    </span>
                    {data.summary.today_location ? (
                      <button
                        onClick={() => setShowMapModal({
                          lat: data.summary.today_location!.lat,
                          lng: data.summary.today_location!.lng,
                          title: `Today Check-In Location (${data.employee.full_name})`,
                          subtitle: `Time: ${data.summary.today_check_in_time}`,
                        })}
                        className="text-[11px] font-bold text-cyan-400 hover:underline flex items-center gap-0.5"
                      >
                        <MapPin className="w-3 h-3" /> GPS
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500">No GPS</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Admin & Management Control Center Card */}
          <div className="bg-[#ffffff] border border-[#ffffff] rounded-2xl p-5 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left: Registration & Biometric Status */}
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-slate-900 text-base">Employee Profile & Biometric Verification Center</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-[#f8fafc]/80 p-3 rounded-xl border border-[#ffffff]">
                    <span className="text-[11px] font-medium text-slate-600 block">App Registration Date</span>
                    <span className="text-xs font-bold text-slate-700 mt-1 block">
                      {data.employee.created_at ? new Date(data.employee.created_at).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      }) : 'Date Not Recorded'}
                    </span>
                  </div>

                  <div className="bg-[#f8fafc]/80 p-3 rounded-xl border border-[#ffffff]">
                    <span className="text-[11px] font-medium text-slate-600 block">Biometric KYC Status</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-xs font-bold flex items-center gap-1.5 ${
                        data.employee.requires_face_reverification
                          ? 'text-rose-400 animate-pulse'
                          : data.employee.face_enrolled
                          ? 'text-[#1dbf73]'
                          : 'text-amber-400'
                      }`}>
                        {data.employee.requires_face_reverification
                          ? <><ShieldAlert className="w-3.5 h-3.5" /> Reverification Required (Cancelled)</>
                          : data.employee.face_enrolled
                          ? <><CheckCircle2 className="w-3.5 h-3.5" /> Verified & Active</>
                          : <><AlertCircle className="w-3.5 h-3.5" /> Not Enrolled Yet</>}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle: Now Location vs First Verified Location */}
              <div className="space-y-3 flex-1 border-t lg:border-t-0 lg:border-l border-[#ffffff] pt-4 lg:pt-0 lg:pl-6">
                <div className="flex items-center gap-2">
                  <LocateFixed className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-slate-900 text-base">Live GPS Coordinates & Verification Tracking</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-[#f8fafc]/80 p-3 rounded-xl border border-[#ffffff] relative group">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-600">Now Location (Live)</span>
                      {data.employee.last_known_latitude && data.employee.last_known_longitude && (
                        <button
                          onClick={() => setShowMapModal({
                            lat: data.employee.last_known_latitude!,
                            lng: data.employee.last_known_longitude!,
                            title: `Now Location — Live GPS (${data.employee.full_name})`,
                            subtitle: data.employee.last_location_updated_at ? `Last Updated: ${new Date(data.employee.last_location_updated_at).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}` : undefined,
                          })}
                          className="text-[11px] font-bold text-amber-400 hover:underline flex items-center gap-1"
                        >
                          <MapPin className="w-3 h-3" /> View Map
                        </button>
                      )}
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-700 mt-1">
                      {data.employee.last_known_latitude && data.employee.last_known_longitude
                        ? `${data.employee.last_known_latitude.toFixed(5)}, ${data.employee.last_known_longitude.toFixed(5)}`
                        : 'No Live GPS Received'}
                    </p>
                    {data.employee.last_location_updated_at && (
                      <p className="text-[10px] text-slate-500 mt-0.5">Updated: {new Date(data.employee.last_location_updated_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' })}</p>
                    )}
                  </div>

                  <div className="bg-[#f8fafc]/80 p-3 rounded-xl border border-[#ffffff] relative group">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-600">First Verified Location</span>
                      {data.employee.first_verified_latitude && data.employee.first_verified_longitude && (
                        <button
                          onClick={() => setShowMapModal({
                            lat: data.employee.first_verified_latitude!,
                            lng: data.employee.first_verified_longitude!,
                            title: `First Verified Check-in Location (${data.employee.full_name})`,
                            subtitle: data.employee.first_verified_at ? `Verified on: ${new Date(data.employee.first_verified_at).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}` : undefined,
                          })}
                          className="text-[11px] font-bold text-cyan-400 hover:underline flex items-center gap-1"
                        >
                          <MapPin className="w-3 h-3" /> View Map
                        </button>
                      )}
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-700 mt-1">
                      {data.employee.first_verified_latitude && data.employee.first_verified_longitude
                        ? `${data.employee.first_verified_latitude.toFixed(5)}, ${data.employee.first_verified_longitude.toFixed(5)}`
                        : 'No Initial GPS Logged'}
                    </p>
                    {data.employee.first_verified_at && (
                      <p className="text-[10px] text-slate-500 mt-0.5">Date: {new Date(data.employee.first_verified_at).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 border-t lg:border-t-0 lg:border-l border-[#ffffff] pt-4 lg:pt-0 lg:pl-6 justify-center">
                <Button
                  onClick={handleResetFaceVerification}
                  disabled={resettingFace || data.employee.requires_face_reverification}
                  variant={data.employee.requires_face_reverification ? 'outline' : 'danger'}
                  className="w-full text-xs font-semibold flex items-center justify-center gap-2 py-2"
                >
                  {resettingFace ? <Spinner size="sm" /> : <ShieldAlert className="w-4 h-4" />}
                  {data.employee.requires_face_reverification ? 'Already Cancelled / Waiting Re-verify' : 'Cancel & Reset Face Verification'}
                </Button>
                <Button
                  onClick={() => setRefreshIndex(prev => prev + 1)}
                  variant="outline"
                  className="w-full text-xs font-semibold flex items-center justify-center gap-2 py-2 border-[#ffffff] hover:bg-slate-50"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                  Refresh Location & Status
                </Button>
              </div>
            </div>
          </div>

          {/* 6 KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* 1. Duty Hours */}
            <Card className="bg-[#ffffff]/90 border-[#ffffff] p-4 relative overflow-hidden group hover:border-amber-500/30 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Total Duty Hours</span>
                <Clock className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-2xl font-bold text-slate-900 tracking-tight">{data.summary.total_duty_hours} <span className="text-sm font-normal text-slate-600">hrs</span></p>
              <p className="text-[11px] text-slate-500 mt-1">Across {data.summary.total_present_days + data.summary.total_late_days} working shifts</p>
            </Card>

            {/* 2. Overtime */}
            <Card className="bg-[#ffffff]/90 border-[#ffffff] p-4 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Total Overtime</span>
                <TrendingUp className="w-4 h-4 text-[#1dbf73] group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-2xl font-bold text-[#1dbf73] tracking-tight">{data.summary.total_overtime_hours} <span className="text-sm font-normal text-slate-600">hrs</span></p>
              <p className="text-[11px] text-slate-500 mt-1">{data.summary.total_overtime_minutes} minutes overtime</p>
            </Card>

            {/* 3. Missed Days */}
            <Card className="bg-[#ffffff]/90 border-rose-500/20 p-4 relative overflow-hidden group hover:border-rose-500/40 transition-all bg-gradient-to-br from-rose-500/5 to-[#ffffff]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-rose-300">Missed / Absent</span>
                <XCircle className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform animate-pulse" />
              </div>
              <p className="text-2xl font-bold text-rose-400 tracking-tight">{data.summary.total_missed_days} <span className="text-sm font-normal text-slate-600">days</span></p>
              <p className="text-[11px] text-rose-400/80 mt-1">Unlogged working days</p>
            </Card>

            {/* 4. Late Minutes & Days */}
            <Card className="bg-[#ffffff]/90 border-amber-500/20 p-4 relative overflow-hidden group hover:border-amber-500/40 transition-all bg-gradient-to-br from-amber-500/5 to-[#ffffff]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-amber-300">Total Late Time</span>
                <AlertCircle className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-2xl font-bold text-amber-400 tracking-tight">{data.summary.total_late_minutes} <span className="text-sm font-normal text-slate-600">mins</span></p>
              <p className="text-[11px] text-amber-400/80 mt-1">Across {data.summary.total_late_days} late days</p>
            </Card>

            {/* 5. Present Days */}
            <Card className="bg-[#ffffff]/90 border-[#ffffff] p-4 relative overflow-hidden group hover:border-sky-500/30 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Present Days</span>
                <CheckCircle2 className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-2xl font-bold text-slate-900 tracking-tight">{data.summary.total_present_days + data.summary.total_late_days} <span className="text-sm font-normal text-slate-600">days</span></p>
              <p className="text-[11px] text-slate-500 mt-1">Out of {data.summary.total_working_days} working days</p>
            </Card>

            {/* 6. Leave & Off Days */}
            <Card className="bg-[#ffffff]/90 border-[#ffffff] p-4 relative overflow-hidden group hover:border-purple-500/30 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Leave & Off Days</span>
                <Calendar className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-2xl font-bold text-slate-900 tracking-tight">{data.summary.total_on_leave_days + data.summary.total_off_days + data.summary.total_holiday_days} <span className="text-sm font-normal text-slate-600">days</span></p>
              <p className="text-[11px] text-slate-500 mt-1">{data.summary.total_on_leave_days} leave, {data.summary.total_off_days + data.summary.total_holiday_days} off/holidays</p>
            </Card>
          </div>

          {/* Daily Breakdown Section */}
          <div className="bg-[#ffffff] border border-[#ffffff] rounded-2xl overflow-hidden shadow-xl">
            {/* Table Header Controls */}
            <div className="p-5 border-b border-[#ffffff] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-700 text-base">Day-by-Day Duty Roster ({months[month - 1]} {year})</h3>
                <p className="text-xs text-slate-600 mt-0.5">Exact daily check-in, check-out, duty hours, overtime, and punctuality log</p>
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
                    className="w-full bg-[#f8fafc] border border-[#ffffff] rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center bg-[#f8fafc] p-1 rounded-xl border border-[#ffffff] w-full sm:w-auto overflow-x-auto">
                  <button
                    onClick={() => setFilterTab('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filterTab === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    All ({data.daily_breakdown.length})
                  </button>
                  <button
                    onClick={() => setFilterTab('present')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filterTab === 'present' ? 'bg-[#1dbf73] text-slate-950 font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Present
                  </button>
                  <button
                    onClick={() => setFilterTab('late')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filterTab === 'late' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Late ({data.summary.total_late_days})
                  </button>
                  <button
                    onClick={() => setFilterTab('missed')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filterTab === 'missed' ? 'bg-rose-500 text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Missed ({data.summary.total_missed_days})
                  </button>
                  <button
                    onClick={() => setFilterTab('overtime')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filterTab === 'overtime' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-600 hover:text-slate-900'}`}
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
                  <tr className="bg-[#ffffff]/80 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-[#ffffff]">
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Day</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Check-In</th>
                    <th className="py-3.5 px-4">Check-Out</th>
                    <th className="py-3.5 px-4 text-center">Duty Hours</th>
                    <th className="py-3.5 px-4 text-center">Punctuality</th>
                    <th className="py-3.5 px-4 text-center">Overtime</th>
                    <th className="py-3.5 px-4 text-center">Face & GPS</th>
                    <th className="py-3.5 px-4">Notes / Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ffffff]/60 text-xs">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center text-slate-500">
                        No daily logs found matching the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr
                        key={log.date}
                        className={`hover:bg-[#f8fafc]/60 transition-colors ${log.status === 'missed' ? 'bg-rose-500/[0.03]' : log.status === 'late' ? 'bg-amber-500/[0.03]' : ''}`}
                      >
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-700">{log.date}</td>
                        <td className="py-3.5 px-4 text-slate-600">{log.day_name}</td>
                        <td className="py-3.5 px-4">{getStatusBadge(log.status, log.late_minutes, log.overtime_minutes)}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{log.check_in_time}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{log.check_out_time}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                          {log.duty_hours > 0 ? `${log.duty_hours}h` : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono">
                          {log.is_right_time ? (
                            <span className="px-2 py-0.5 rounded bg-[#1dbf73]/15 text-[#1dbf73] font-bold border border-emerald-500/20 text-[11px]">
                              Right Time
                            </span>
                          ) : log.late_minutes > 0 ? (
                            <span className="text-amber-400 font-bold text-[11px]">+{log.late_minutes}m ({log.late_hours}h)</span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono">
                          {log.overtime_minutes > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-[#1dbf73]/15 text-[#1dbf73] font-bold border border-emerald-500/20 text-[11px]">
                              +{log.overtime_hours}h ({log.overtime_minutes}m)
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {log.check_in_time !== '--:--' && log.status !== 'upcoming' && log.status !== 'holiday' && log.status !== 'off_day' ? (
                            <div className="flex items-center justify-center gap-2">
                              <span
                                title={log.face_verified ? 'Verified with facial biometrics' : 'Face verification not matched or bypassed'}
                                className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                  log.face_verified
                                    ? 'bg-[#1dbf73]/20 text-[#1dbf73] border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                {log.face_verified ? '✓ Face' : '✗ Face'}
                              </span>
                              {log.check_in_lat && log.check_in_lng ? (
                                <button
                                  onClick={() => setShowMapModal({
                                    lat: log.check_in_lat!,
                                    lng: log.check_in_lng!,
                                    title: `Check-in GPS Location (${log.date})`,
                                    subtitle: `Coordinates: ${log.check_in_lat!.toFixed(5)}, ${log.check_in_lng!.toFixed(5)} | Check-in: ${log.check_in_time}`,
                                  })}
                                  className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold text-[10px] hover:bg-cyan-500/30 flex items-center gap-1"
                                >
                                  <MapPin className="w-2.5 h-2.5" /> GPS
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-500">No GPS</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">{log.notes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {/* Interactive Map Modal */}
      {showMapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#ffffff] border border-[#ffffff] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[#ffffff] flex items-center justify-between bg-[#f8fafc]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{showMapModal.title}</h3>
                  {showMapModal.subtitle && <p className="text-[11px] text-slate-600">{showMapModal.subtitle}</p>}
                </div>
              </div>
              <button
                onClick={() => setShowMapModal(null)}
                className="w-8 h-8 rounded-lg bg-[#ffffff] border border-[#ffffff] text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-[#ffffff]">
              {/* Embedded OpenStreetMap / Leaflet preview or Google Maps iframe */}
              <div className="w-full h-80 rounded-xl overflow-hidden border border-[#ffffff] bg-white relative">
                <iframe
                  title="GPS Location Map"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${showMapModal.lng - 0.005}%2C${showMapModal.lat - 0.005}%2C${showMapModal.lng + 0.005}%2C${showMapModal.lat + 0.005}&layer=mapnik&marker=${showMapModal.lat}%2C${showMapModal.lng}`}
                />
              </div>

              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#f8fafc]/60 p-3 rounded-xl border border-[#ffffff]">
                <div className="text-xs font-mono text-slate-600">
                  <span className="text-slate-500">Lat:</span> {showMapModal.lat.toFixed(6)}, <span className="text-slate-500">Lng:</span> {showMapModal.lng.toFixed(6)}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${showMapModal.lat},${showMapModal.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 flex items-center gap-1.5 shadow"
                  >
                    Open in Google Maps <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <Button onClick={() => setShowMapModal(null)} variant="outline" size="sm" className="text-xs">
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
