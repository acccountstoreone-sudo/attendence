'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Filter,
  Calendar,
  BarChart3,
  RefreshCw,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  UserCheck,
  Clock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { OvertimeHistoryReport } from '@/components/reports/OvertimeHistoryReport';

interface BranchReportRow {
  branch_id: string;
  branch_name: string;
  branch_code: string;
  total_days: number;
  present_days: number;
  late_days: number;
  absent_days: number;
  attendance_rate: number;
  punctuality_rate: number;
}

interface FilterState {
  month: number;
  year: number;
}

export default function BranchManagerReportsPage() {
  const [activeTab, setActiveTab] = useState<'attendance' | 'overtime'>('attendance');
  const router = useRouter();
  const currentDate = new Date();
  const [filter, setFilter] = useState<FilterState>({
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
  });
  const [reportData, setReportData] = useState<BranchReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | 'csv' | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: String(filter.month),
        year: String(filter.year),
      });
      const res = await fetch(`/api/reports/branch-summary?${params}`);
      const json = await res.json();
      if (json.success) {
        setReportData(json.data || []);
      }
    } catch (err) {
      console.error('Report fetch error:', err);
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    setExporting(format);
    try {
      const branchId = reportData[0]?.branch_id || '';
      const params = new URLSearchParams({
        month: String(filter.month),
        year: String(filter.year),
        format,
        ...(branchId ? { branch_id: branchId } : {}),
      });
      const res = await fetch(`/api/reports/export?${params}`);
      if (!res.ok) {
        let errorMsg = 'Export request failed';
        try {
          const errData = await res.json();
          if (errData.error?.message) errorMsg = errData.error.message;
        } catch (_) {}
        throw new Error(errorMsg);
      }
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (!json.success) throw new Error(json?.error?.message || 'Export failed');
        if (json.data?.signed_url) {
          window.open(json.data.signed_url, '_blank');
          return;
        } else if (json.data?.content_base64) {
          const byteCharacters = atob(json.data.content_base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray]);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = json.data.file_name || `Attendance_${months[filter.month - 1]}_${filter.year}.${format === 'excel' ? 'xlsx' : format === 'csv' ? 'csv' : 'pdf'}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          return;
        }
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Attendance_${months[filter.month - 1]}_${filter.year}.${format === 'excel' ? 'xlsx' : format === 'csv' ? 'csv' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(`Export failed: ${err instanceof Error ? err.message : 'Please try again.'}`);
    } finally {
      setExporting(null);
    }
  };

  const storeData = reportData[0];

  return (
    <div className="space-y-8 pb-12">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner w-fit">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
            activeTab === 'attendance'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Store Attendance Summary
        </button>
        <button
          onClick={() => setActiveTab('overtime')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
            activeTab === 'overtime'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          ⏱️ Store Overtime History
        </button>
      </div>

      {activeTab === 'overtime' && <OvertimeHistoryReport role="branch_manager" />}
      {activeTab !== 'attendance' ? null : <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-white via-blue-950/30 to-slate-50 p-6 rounded-3xl border border-slate-200 shadow-2xl">
        <div>
          <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Store Reporting Suite</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Store Attendance Reports
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Generate monthly attendance summaries for your store.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<FileText className="w-4 h-4 text-sky-400" />}
            isLoading={exporting === 'csv'}
            disabled={!hasLoaded || reportData.length === 0}
            onClick={() => handleExport('csv')}
          >
            Export CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            icon={<FileSpreadsheet className="w-4 h-4 text-[#1dbf73]" />}
            isLoading={exporting === 'excel'}
            disabled={!hasLoaded || reportData.length === 0}
            onClick={() => handleExport('excel')}
          >
            Export Excel
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={<FileText className="w-4 h-4" />}
            isLoading={exporting === 'pdf'}
            disabled={!hasLoaded || reportData.length === 0}
            onClick={() => handleExport('pdf')}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {/* Quick Access to Individual Store Employee Month-wise Duty & Overtime Reports */}
      <div className="bg-gradient-to-r from-amber-500/10 via-white to-amber-500/10 border border-amber-500/30 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Individual Staff Duty & Overtime Analytics</h3>
            <p className="text-xs text-slate-600">View & export exact month-wise duty hours, late minutes, overtime, and missed days for your store staff</p>
          </div>
        </div>
        <Button
          onClick={() => router.push('/branch-manager/employees')}
          variant="primary"
          size="sm"
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs gap-1.5 shadow-md shadow-amber-500/20 shrink-0"
        >
          View Store Staff Rosters & Export &rarr;
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="bg-white border-slate-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col space-y-1 min-w-[160px]">
            <label className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">
              <Calendar className="w-3 h-3 inline mr-1" />Month
            </label>
            <div className="relative">
              <select
                value={filter.month}
                onChange={(e) => setFilter((f) => ({ ...f, month: Number(e.target.value) }))}
                className="w-full appearance-none bg-white border border-slate-200 rounded-xl text-sm text-slate-900 px-3 py-2 pr-8 focus:outline-none focus:border-blue-500 transition-colors"
              >
                {months.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-600 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col space-y-1 min-w-[120px]">
            <label className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">Year</label>
            <div className="relative">
              <select
                value={filter.year}
                onChange={(e) => setFilter((f) => ({ ...f, year: Number(e.target.value) }))}
                className="w-full appearance-none bg-white border border-slate-200 rounded-xl text-sm text-slate-900 px-3 py-2 pr-8 focus:outline-none focus:border-blue-500 transition-colors"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-600 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            icon={<Filter className="w-4 h-4" />}
            isLoading={loading}
            onClick={fetchReport}
          >
            Generate Report
          </Button>

          {hasLoaded && (
            <Button
              variant="ghost"
              size="md"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={fetchReport}
            >
              Refresh
            </Button>
          )}
        </div>
      </Card>

      {/* Summary KPI Tiles */}
      {hasLoaded && storeData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-white to-slate-50 border-slate-200">
            <p className="text-xs font-bold uppercase text-slate-600">Attendance Rate</p>
            <div className="flex items-center space-x-2 mt-1">
              <p className={`text-2xl font-extrabold ${storeData.attendance_rate >= 90 ? 'text-[#1dbf73]' : storeData.attendance_rate >= 75 ? 'text-amber-400' : 'text-rose-400'}`}>
                {storeData.attendance_rate.toFixed(1)}%
              </p>
              {storeData.attendance_rate >= 90 ? (
                <TrendingUp className="w-5 h-5 text-[#1dbf73]" />
              ) : (
                <TrendingDown className="w-5 h-5 text-rose-400" />
              )}
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-white to-slate-50 border-slate-200">
            <p className="text-xs font-bold uppercase text-slate-600">Punctuality Rate</p>
            <div className="flex items-center space-x-2 mt-1">
              <p className={`text-2xl font-extrabold ${storeData.punctuality_rate >= 85 ? 'text-[#1dbf73]' : storeData.punctuality_rate >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>
                {storeData.punctuality_rate.toFixed(1)}%
              </p>
              {storeData.punctuality_rate >= 85 ? (
                <TrendingUp className="w-5 h-5 text-[#1dbf73]" />
              ) : (
                <TrendingDown className="w-5 h-5 text-rose-400" />
              )}
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-white to-slate-50 border-slate-200">
            <p className="text-xs font-bold uppercase text-slate-600">Total Absences</p>
            <p className="text-2xl font-extrabold text-rose-400 mt-1">{storeData.absent_days}</p>
          </Card>
          <Card className="bg-gradient-to-br from-white to-slate-50 border-slate-200">
            <p className="text-xs font-bold uppercase text-slate-600">Late Arrivals</p>
            <p className="text-2xl font-extrabold text-amber-400 mt-1">{storeData.late_days}</p>
          </Card>
        </div>
      )}

      {/* Store Data Table */}
      {!hasLoaded ? (
        <Card className="p-16 text-center border-slate-200 border-dashed">
          <BarChart3 className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-600">Select Period & Generate Report</h3>
          <p className="text-sm text-slate-500 mt-1">
            Choose a month and year above, then click <strong className="text-blue-400">Generate Report</strong> to pull live attendance data.
          </p>
        </Card>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" label="Fetching Store Attendance Data..." />
        </div>
      ) : !storeData ? (
        <Card className="p-12 text-center border-slate-200">
          <p className="text-slate-600 font-semibold">No report data found for selected period.</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/80 text-slate-600 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-4 px-5">Branch</th>
                  <th className="py-4 px-5 text-center">Working Days</th>
                  <th className="py-4 px-5 text-center">Present</th>
                  <th className="py-4 px-5 text-center">Late</th>
                  <th className="py-4 px-5 text-center">Absent</th>
                  <th className="py-4 px-5 text-center">Attendance Rate</th>
                  <th className="py-4 px-5 text-center">Punctuality Rate</th>
                  <th className="py-4 px-5 text-center">Status</th>
                  <th className="py-4 px-5 text-right">Employee Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                  <tr className="hover:bg-white/40 transition-colors">
                    <td className="py-4 px-5">
                      <div>
                        <span className="text-xs font-extrabold text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded-md mr-2">
                          {storeData.branch_code}
                        </span>
                        <span className="font-bold text-slate-900">{storeData.branch_name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-center text-slate-600 font-semibold">{storeData.total_days}</td>
                    <td className="py-4 px-5 text-center font-bold text-[#1dbf73]">{storeData.present_days}</td>
                    <td className="py-4 px-5 text-center font-bold text-amber-400">{storeData.late_days}</td>
                    <td className="py-4 px-5 text-center font-bold text-rose-400">{storeData.absent_days}</td>
                    <td className="py-4 px-5 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-lg font-extrabold ${storeData.attendance_rate >= 90 ? 'text-[#1dbf73]' : storeData.attendance_rate >= 75 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {storeData.attendance_rate.toFixed(1)}%
                        </span>
                        {/* Mini Progress Bar */}
                        <div className="w-20 h-1.5 bg-slate-50 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${storeData.attendance_rate >= 90 ? 'bg-[#1dbf73]' : storeData.attendance_rate >= 75 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${storeData.attendance_rate}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-center">
                      <span className={`font-bold ${storeData.punctuality_rate >= 85 ? 'text-[#1dbf73]' : storeData.punctuality_rate >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {storeData.punctuality_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-4 px-5 text-center">
                      <Badge
                        status={storeData.attendance_rate >= 90 ? 'present' : storeData.attendance_rate >= 75 ? 'late' : 'absent'}
                        variant="subtle"
                      >
                        {storeData.attendance_rate >= 90 ? 'Excellent' : storeData.attendance_rate >= 75 ? 'Acceptable' : 'Critical'}
                      </Badge>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Download className="w-3.5 h-3.5" />}
                        onClick={() => handleExport('pdf')}
                      >
                        Download
                      </Button>
                    </td>
                  </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
      </>}
    </div>
  );
}

