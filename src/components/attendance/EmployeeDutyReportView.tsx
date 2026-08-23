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
  MessageSquare,
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
    whatsapp_number?: string;
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

  const getStatusBadge = (status: string, lateMinutes: number, overtimeMinutes: number) => {
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-semibold shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Present {overtimeMinutes > 0 && <strong className="text-emerald-800 font-bold">(+OT)</strong>}</span>
          </span>
        );
      case 'late':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/80 text-xs font-semibold shadow-2xs">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Late ({lateMinutes}m)</span>
          </span>
        );
      case 'half_day':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200/80 text-xs font-semibold shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>Half Day</span>
          </span>
        );
      case 'incomplete':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-200/80 text-xs font-semibold shadow-2xs">
            <AlertCircle className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            <span>Missed Check-out</span>
          </span>
        );
      case 'missed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200/80 text-xs font-semibold shadow-2xs">
            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>Missed / Absent</span>
          </span>
        );
      case 'on_leave':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200/80 text-xs font-semibold shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>Approved Leave</span>
          </span>
        );
      case 'holiday':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-xs font-medium shadow-2xs">
            Holiday
          </span>
        );
      case 'off_day':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium">
            Weekly Off Day
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-500 border border-slate-200 text-xs font-medium">
            Upcoming
          </span>
        );
    }
  };

  const filteredLogs = (data?.daily_breakdown || []).filter((log) => {
    if (filterTab === 'present' && log.status !== 'present' && log.status !== 'incomplete') return false;
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
    <div className="space-y-6 pb-12">
      {/* Top Header Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs">
        <div className="flex items-center space-x-4">
          {backUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(backUrl)}
              className="text-slate-900 hover:text-slate-900 hover:bg-slate-100 rounded-xl px-3 py-2 font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Button>
          )}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1dbf73]/15 via-emerald-50 to-slate-100 border border-[#1dbf73]/30 flex items-center justify-center text-[#16965a] font-bold text-xl shrink-0 shadow-inner">
            {data?.employee?.full_name?.charAt(0) || <User className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                {data?.employee?.full_name || 'Loading Employee...'}
              </h1>
              {data?.employee?.employee_id && (
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-semibold border border-slate-200/80">
                  ID: {data.employee.employee_id}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-900 mt-1.5">
              <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                <Building2 className="w-3.5 h-3.5 text-[#1dbf73]" />
                {data?.employee?.branch_name || 'Assigned Branch'}
              </span>
              <span className="flex items-center gap-1.5 text-[#1dbf73] font-bold bg-[#1dbf73]/10 px-2.5 py-0.5 rounded-md">
                <MessageSquare className="w-3.5 h-3.5 fill-current" />
                WA: {data?.employee?.whatsapp_number || data?.employee?.phone || 'N/A'}
              </span>
              <span className="capitalize px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60 font-medium">
                {data?.employee?.role?.replace('_', ' ') || 'Staff'}
              </span>
            </div>
          </div>
        </div>

        {/* Period Picker & Refresh */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100/80 border border-slate-200/80 rounded-xl p-1 shadow-2xs">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-transparent text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg focus:outline-none focus:bg-white cursor-pointer transition-colors"
            >
              {months.map((m, i) => (
                <option key={m} value={i + 1} className="bg-white text-slate-800">
                  {m}
                </option>
              ))}
            </select>
            <div className="w-[1px] h-5 bg-slate-300 mx-1" />
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-transparent text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg focus:outline-none focus:bg-white cursor-pointer transition-colors"
            >
              {years.map((y) => (
                <option key={y} value={y} className="bg-white text-slate-800">
                  {y}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshIndex((prev) => prev + 1)}
            disabled={loading}
            className="text-slate-700 hover:text-slate-900 hover:bg-slate-100 p-2 border border-slate-200 rounded-xl shadow-2xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#1dbf73]' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Enterprise Export Controls Toolbar */}
      <div className="bg-gradient-to-r from-[#1dbf73]/10 via-emerald-50/80 to-slate-100/90 border border-[#1dbf73]/25 rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-5 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-white border border-[#1dbf73]/30 flex items-center justify-center text-[#1dbf73] shrink-0 shadow-xs">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base tracking-tight">Detailed Export & Official Reports</h3>
            <p className="text-xs text-slate-900 mt-0.5">Download complete month-wise duty, overtime, and attendance logs</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button
            onClick={() => handleExport('csv')}
            disabled={exporting !== null || loading || !data}
            variant="outline"
            size="sm"
            className="flex-1 md:flex-none border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs py-2 px-3.5 rounded-xl gap-2 transition-all shadow-2xs hover:border-[#1dbf73]/40"
          >
            {exporting === 'csv' ? <Spinner size="sm" /> : <FileText className="w-4 h-4 text-sky-600" />}
            Export CSV
          </Button>
          <Button
            onClick={() => handleExport('excel')}
            disabled={exporting !== null || loading || !data}
            variant="outline"
            size="sm"
            className="flex-1 md:flex-none border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs py-2 px-3.5 rounded-xl gap-2 transition-all shadow-2xs hover:border-[#1dbf73]/40"
          >
            {exporting === 'excel' ? <Spinner size="sm" /> : <FileSpreadsheet className="w-4 h-4 text-[#1dbf73]" />}
            Export Excel
          </Button>
          <Button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null || loading || !data}
            variant="primary"
            size="sm"
            className="flex-1 md:flex-none bg-gradient-to-r from-[#1dbf73] to-[#16965a] hover:from-[#16965a] hover:to-[#108a50] text-white font-bold text-xs py-2 px-4 rounded-xl gap-2 shadow-sm shadow-[#1dbf73]/25 transition-all transform hover:-translate-y-0.5 border-0"
          >
            {exporting === 'pdf' ? <Spinner size="sm" /> : <Download className="w-4 h-4" />}
            Export PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-28 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <Spinner size="lg" />
          <p className="text-sm font-semibold text-slate-900 mt-4 animate-pulse">Calculating duty analytics, overtime, and punctuality logs...</p>
        </div>
      ) : data ? (
        <>
          <AnimatePresence>
            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`p-4 rounded-xl border text-sm font-semibold shadow-sm ${
                  feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
                  <span>{feedback.text}</span>
                  <button onClick={() => setFeedback(null)} className="ml-auto opacity-70 hover:opacity-100 font-bold">✕</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Today's Real-time Duty Spotlight Card (Sleek High-Contrast) */}
          {month === currentDate.getMonth() + 1 && year === currentDate.getFullYear() && (
            <div className="bg-gradient-to-br from-[#1dbf73]/10 via-white to-slate-50 border border-[#1dbf73]/30 rounded-2xl p-6 relative overflow-hidden shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-4 mb-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-[#1dbf73]/15 border border-[#1dbf73]/30 flex items-center justify-center text-[#16965a] shrink-0 animate-pulse">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-slate-900 text-base tracking-tight">Today&apos;s Live Attendance Spotlight</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#1dbf73] text-white shadow-2xs">LIVE</span>
                    </div>
                    <p className="text-xs text-slate-900 font-medium mt-0.5">Real-time attendance & check-in metrics for today ({new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Dhaka', month: 'short', day: 'numeric', year: 'numeric' })})</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider shadow-2xs border ${
                    data.summary.today_status === 'present' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    data.summary.today_status === 'late' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                    data.summary.today_status === 'half_day' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                    'bg-slate-100 text-slate-900 border-slate-200'
                  }`}>
                    Status Today: {data.summary.today_status || 'Upcoming'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 text-center sm:text-left">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Check-In</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-1 font-mono">{data.summary.today_check_in_time || '--:--'}</p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Check-Out</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-1 font-mono">{data.summary.today_check_out_time || '--:--'}</p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Duty Hours</p>
                  <p className="text-sm font-extrabold text-[#16965a] mt-1">{data.summary.today_duty_hours || 0} hrs</p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Punctuality</p>
                  {data.summary.today_late_minutes && data.summary.today_late_minutes > 0 ? (
                    <p className="text-sm font-extrabold text-amber-700 mt-1">{data.summary.today_late_minutes}m late ({data.summary.today_late_hours}h)</p>
                  ) : data.summary.today_check_in_time !== '--:--' ? (
                    <p className="text-sm font-extrabold text-emerald-600 mt-1">✓ On Time</p>
                  ) : (
                    <p className="text-sm font-bold text-slate-400 mt-1">Not Checked In</p>
                  )}
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Overtime</p>
                  <p className="text-sm font-extrabold text-[#16965a] mt-1">{data.summary.today_overtime_minutes || 0}m ({data.summary.today_overtime_hours || 0}h)</p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Verification</p>
                  <div className="flex items-center justify-between gap-1 mt-1">
                    <span className={`text-xs font-extrabold ${data.summary.today_face_verified ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {data.summary.today_face_verified ? '✓ Face Match' : '✗ Face Match'}
                    </span>
                    {data.summary.today_location && (
                      <button
                        onClick={() => setShowMapModal({
                          lat: data.summary.today_location!.lat,
                          lng: data.summary.today_location!.lng,
                          title: `Today Check-In Location (${data.employee.full_name})`,
                          subtitle: `Time: ${data.summary.today_check_in_time}`,
                        })}
                        className="text-[11px] font-extrabold text-sky-600 hover:underline flex items-center gap-0.5 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200"
                      >
                        <MapPin className="w-3 h-3" /> Map
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Admin & Management Profile Control Center Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left: Registration & Biometric Status */}
              <div className="space-y-3.5 flex-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base tracking-tight">Biometric & Identity Status</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Registration Date</span>
                    <span className="text-xs font-bold text-slate-800 mt-1 block font-mono">
                      {data.employee.created_at ? new Date(data.employee.created_at).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      }) : 'Date Not Recorded'}
                    </span>
                  </div>

                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Facial Biometric Enrollment</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-xs font-extrabold flex items-center gap-1.5 ${
                        data.employee.requires_face_reverification
                          ? 'text-rose-600 animate-pulse'
                          : data.employee.face_enrolled
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }`}>
                        {data.employee.requires_face_reverification
                          ? <><ShieldAlert className="w-4 h-4" /> Reverification Required</>
                          : data.employee.face_enrolled
                          ? <><CheckCircle2 className="w-4 h-4" /> Active & Enrolled</>
                          : <><AlertCircle className="w-4 h-4" /> Not Enrolled Yet</>}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle: Now Location vs First Verified Location */}
              <div className="space-y-3.5 flex-1 border-t lg:border-t-0 lg:border-l border-slate-200 pt-5 lg:pt-0 lg:pl-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                    <LocateFixed className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base tracking-tight">GPS Coordinates Tracking</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 relative group">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Live GPS Coordinates</span>
                      {data.employee.last_known_latitude && data.employee.last_known_longitude && (
                        <button
                          onClick={() => setShowMapModal({
                            lat: data.employee.last_known_latitude!,
                            lng: data.employee.last_known_longitude!,
                            title: `Live GPS Location (${data.employee.full_name})`,
                            subtitle: data.employee.last_location_updated_at ? `Last Updated: ${new Date(data.employee.last_location_updated_at).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}` : undefined,
                          })}
                          className="text-[11px] font-bold text-sky-600 hover:underline flex items-center gap-1 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200"
                        >
                          <MapPin className="w-3 h-3" /> View
                        </button>
                      )}
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-800 mt-1">
                      {data.employee.last_known_latitude && data.employee.last_known_longitude
                        ? `${data.employee.last_known_latitude.toFixed(5)}, ${data.employee.last_known_longitude.toFixed(5)}`
                        : 'No Live Coordinates'}
                    </p>
                    {data.employee.last_location_updated_at && (
                      <p className="text-[10px] font-medium text-slate-500 mt-1">Updated: {new Date(data.employee.last_location_updated_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' })}</p>
                    )}
                  </div>

                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 relative group">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">First Verified GPS</span>
                      {data.employee.first_verified_latitude && data.employee.first_verified_longitude && (
                        <button
                          onClick={() => setShowMapModal({
                            lat: data.employee.first_verified_latitude!,
                            lng: data.employee.first_verified_longitude!,
                            title: `First Verified Check-in Location (${data.employee.full_name})`,
                            subtitle: data.employee.first_verified_at ? `Verified on: ${new Date(data.employee.first_verified_at).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}` : undefined,
                          })}
                          className="text-[11px] font-bold text-sky-600 hover:underline flex items-center gap-1 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200"
                        >
                          <MapPin className="w-3 h-3" /> View
                        </button>
                      )}
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-800 mt-1">
                      {data.employee.first_verified_latitude && data.employee.first_verified_longitude
                        ? `${data.employee.first_verified_latitude.toFixed(5)}, ${data.employee.first_verified_longitude.toFixed(5)}`
                        : 'No Initial GPS Logged'}
                    </p>
                    {data.employee.first_verified_at && (
                      <p className="text-[10px] font-medium text-slate-500 mt-1">Date: {new Date(data.employee.first_verified_at).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Security Actions */}
              <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 pt-5 lg:pt-0 lg:pl-6 justify-center">
                <Button
                  onClick={handleResetFaceVerification}
                  disabled={resettingFace || data.employee.requires_face_reverification}
                  variant={data.employee.requires_face_reverification ? 'outline' : 'danger'}
                  className="w-full text-xs font-bold flex items-center justify-center gap-2 py-2.5 rounded-xl shadow-2xs"
                >
                  {resettingFace ? <Spinner size="sm" /> : <ShieldAlert className="w-4 h-4 shrink-0" />}
                  {data.employee.requires_face_reverification ? 'Reverification Pending' : 'Cancel & Reset Face ID'}
                </Button>
                <Button
                  onClick={() => setRefreshIndex(prev => prev + 1)}
                  variant="outline"
                  className="w-full text-xs font-bold flex items-center justify-center gap-2 py-2.5 rounded-xl border-slate-200 hover:bg-slate-100 text-slate-700 shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-900" />
                  Refresh Location Status
                </Button>
              </div>
            </div>
          </div>

          {/* 6 KPI Cards Grid (Enterprise High-Contrast Layout) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* 1. Duty Hours */}
            <Card className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md hover:border-[#1dbf73]/50 transition-all duration-200 flex flex-col justify-between group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-900 tracking-tight">Total Duty Hours</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{data.summary.total_duty_hours} <span className="text-xs font-semibold text-slate-500">hrs</span></p>
                <p className="text-[11px] font-medium text-slate-500 mt-1.5">Across {data.summary.total_present_days + data.summary.total_late_days} working shifts</p>
              </div>
            </Card>

            {/* 2. Overtime */}
            <Card className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md hover:border-[#1dbf73]/50 transition-all duration-200 flex flex-col justify-between group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-900 tracking-tight">Total Overtime</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-emerald-600 tracking-tight">{data.summary.total_overtime_hours} <span className="text-xs font-semibold text-slate-500">hrs</span></p>
                <p className="text-[11px] font-semibold text-emerald-700/80 mt-1.5">{data.summary.total_overtime_minutes} total OT minutes</p>
              </div>
            </Card>

            {/* 3. Missed Days */}
            <Card className="bg-rose-50/40 border border-rose-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md hover:border-rose-300 transition-all duration-200 flex flex-col justify-between group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-rose-800 tracking-tight">Missed / Absent</span>
                <div className="w-8 h-8 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
                  <XCircle className="w-4 h-4 animate-pulse" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-rose-600 tracking-tight">{data.summary.total_missed_days} <span className="text-xs font-semibold text-rose-700">days</span></p>
                <p className="text-[11px] font-semibold text-rose-700 mt-1.5">Unlogged working shifts</p>
              </div>
            </Card>

            {/* 4. Late Time */}
            <Card className="bg-amber-50/40 border border-amber-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md hover:border-amber-300 transition-all duration-200 flex flex-col justify-between group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-amber-900 tracking-tight">Total Late Time</span>
                <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 group-hover:scale-110 transition-transform">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-amber-700 tracking-tight">{data.summary.total_late_minutes} <span className="text-xs font-semibold text-amber-800">mins</span></p>
                <p className="text-[11px] font-semibold text-amber-800 mt-1.5">Across {data.summary.total_late_days} late days</p>
              </div>
            </Card>

            {/* 5. Present Days */}
            <Card className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md hover:border-sky-300 transition-all duration-200 flex flex-col justify-between group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-900 tracking-tight">Present Days</span>
                <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{data.summary.total_present_days + data.summary.total_late_days} <span className="text-xs font-semibold text-slate-500">days</span></p>
                <p className="text-[11px] font-medium text-slate-500 mt-1.5">Out of {data.summary.total_working_days} working days</p>
              </div>
            </Card>

            {/* 6. Leave & Off Days */}
            <Card className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md hover:border-purple-300 transition-all duration-200 flex flex-col justify-between group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-900 tracking-tight">Leave & Off Days</span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{data.summary.total_on_leave_days + data.summary.total_off_days + data.summary.total_holiday_days} <span className="text-xs font-semibold text-slate-500">days</span></p>
                <p className="text-[11px] font-medium text-slate-500 mt-1.5">{data.summary.total_on_leave_days} leave, {data.summary.total_off_days + data.summary.total_holiday_days} off/holidays</p>
              </div>
            </Card>
          </div>

          {/* Daily Breakdown Section */}
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
            {/* Table Header Controls */}
            <div className="p-6 border-b border-slate-200/80 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base tracking-tight">Day-by-Day Duty & Overtime Roster ({months[month - 1]} {year})</h3>
                <p className="text-xs text-slate-900 font-medium mt-0.5">Exact daily check-in, check-out, duty hours, overtime, GPS, and punctuality logs</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* Search input */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search date, status, notes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-200/80 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1dbf73]/20 focus:border-[#1dbf73] transition-all shadow-2xs"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex items-center bg-slate-200/60 p-1 rounded-xl border border-slate-300/50 w-full sm:w-auto overflow-x-auto gap-1">
                  <button
                    onClick={() => setFilterTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      filterTab === 'all' ? 'bg-white text-slate-900 shadow-sm border border-slate-300/80' : 'text-slate-900 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    All ({data.daily_breakdown.length})
                  </button>
                  <button
                    onClick={() => setFilterTab('present')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      filterTab === 'present' ? 'bg-[#1dbf73] text-white shadow-sm' : 'text-slate-900 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    Present
                  </button>
                  <button
                    onClick={() => setFilterTab('late')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      filterTab === 'late' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-900 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    Late ({data.summary.total_late_days})
                  </button>
                  <button
                    onClick={() => setFilterTab('missed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      filterTab === 'missed' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-900 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    Missed ({data.summary.total_missed_days})
                  </button>
                  <button
                    onClick={() => setFilterTab('overtime')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      filterTab === 'overtime' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-900 hover:text-slate-900 hover:bg-white/60'
                    }`}
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
                  <tr className="bg-slate-50 text-slate-500 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-200/80">
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
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center text-slate-500 font-semibold">
                        No daily logs found matching the selected filter or search term.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr
                        key={log.date}
                        className={`hover:bg-slate-50/80 transition-colors ${log.status === 'missed' ? 'bg-rose-50/30' : log.status === 'late' ? 'bg-amber-50/30' : log.status === 'incomplete' ? 'bg-orange-50/30' : ''}`}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{log.date}</td>
                        <td className="py-3.5 px-4 text-slate-700 font-semibold">{log.day_name}</td>
                        <td className="py-3.5 px-4">{getStatusBadge(log.status, log.late_minutes, log.overtime_minutes)}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700">{log.check_in_time}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700">{log.check_out_time}</td>
                        <td className="py-3.5 px-4 text-center font-extrabold text-slate-800">
                          {log.duty_hours > 0 ? `${log.duty_hours}h` : <span className="text-slate-400 font-normal">-</span>}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono">
                          {log.is_right_time ? (
                            <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[11px]">
                              Right Time
                            </span>
                          ) : log.late_minutes > 0 ? (
                            <span className="px-2 py-1 rounded-md bg-amber-50 text-amber-800 font-bold border border-amber-200 text-[11px]">
                              +{log.late_minutes}m ({log.late_hours}h)
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono">
                          {log.overtime_minutes > 0 ? (
                            <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[11px]">
                              +{log.overtime_hours}h ({log.overtime_minutes}m)
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {log.check_in_time !== '--:--' && log.status !== 'upcoming' && log.status !== 'holiday' && log.status !== 'off_day' ? (
                            <div className="flex items-center justify-center gap-2">
                              <span
                                title={log.face_verified ? 'Verified with facial biometrics' : 'Face verification not matched or bypassed'}
                                className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                  log.face_verified
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
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
                                  className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 font-bold text-[10px] hover:bg-sky-100 flex items-center gap-1 transition-colors"
                                >
                                  <MapPin className="w-2.5 h-2.5" /> GPS
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">No GPS</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-normal text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-900 font-medium">{log.notes}</td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base tracking-tight">{showMapModal.title}</h3>
                  {showMapModal.subtitle && <p className="text-xs text-slate-900 font-medium mt-0.5">{showMapModal.subtitle}</p>}
                </div>
              </div>
              <button
                onClick={() => setShowMapModal(null)}
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-900 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors shadow-2xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 bg-white">
              {/* Embedded OpenStreetMap / Leaflet preview or Google Maps iframe */}
              <div className="w-full h-80 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 relative">
                <iframe
                  title="GPS Location Map"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${showMapModal.lng - 0.005}%2C${showMapModal.lat - 0.005}%2C${showMapModal.lng + 0.005}%2C${showMapModal.lat + 0.005}&layer=mapnik&marker=${showMapModal.lat}%2C${showMapModal.lng}`}
                />
              </div>

              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="text-xs font-mono font-bold text-slate-700">
                  <span className="text-slate-500 font-medium">Lat:</span> {showMapModal.lat.toFixed(6)}, <span className="text-slate-500 font-medium">Lng:</span> {showMapModal.lng.toFixed(6)}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${showMapModal.lat},${showMapModal.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-[#1dbf73] hover:bg-[#16965a] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    Open in Google Maps <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <Button onClick={() => setShowMapModal(null)} variant="outline" size="sm" className="text-xs font-bold rounded-xl">
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
