'use client';

import React, { useState, useCallback } from 'react';
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
  Building2,
  BarChart3,
  RefreshCw,
  Search,
  ChevronDown,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

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
  branchId: string;
}

export default function AdminReportsPage() {
  const currentDate = new Date();
  const [filter, setFilter] = useState<FilterState>({
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
    branchId: '',
  });
  const [reportData, setReportData] = useState<BranchReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);

  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: String(filter.month),
        year: String(filter.year),
        ...(filter.branchId ? { branch_id: filter.branchId } : {}),
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
  }, [filter]);

  const handleExport = async (format: 'pdf' | 'excel') => {
    setExporting(format);
    try {
      const params = new URLSearchParams({
        month: String(filter.month),
        year: String(filter.year),
        format,
        ...(filter.branchId ? { branch_id: filter.branchId } : {}),
      });
      const res = await fetch(`/api/reports/export?${params}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AnchorFashion_Attendance_${months[filter.month - 1]}_${filter.year}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert(`Export failed. Please try again.`);
    } finally {
      setExporting(null);
    }
  };

  const filtered = reportData.filter(
    (r) =>
      r.branch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.branch_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const avgAttendance =
    reportData.length > 0
      ? Math.round(reportData.reduce((s, r) => s + r.attendance_rate, 0) / reportData.length)
      : 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-blue-950/30 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl">
        <div>
          <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>HR Reporting Suite</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Payroll & Attendance Reports
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Generate monthly branch-wise attendance summaries for payroll finalization.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<FileSpreadsheet className="w-4 h-4 text-emerald-400" />}
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

      {/* Filter Bar (Spec P30) */}
      <Card className="bg-slate-900 border-slate-800 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col space-y-1 min-w-[160px]">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              <Calendar className="w-3 h-3 inline mr-1" />Month
            </label>
            <div className="relative">
              <select
                value={filter.month}
                onChange={(e) => setFilter((f) => ({ ...f, month: Number(e.target.value) }))}
                className="w-full appearance-none bg-slate-950 border border-slate-800 rounded-xl text-sm text-white px-3 py-2 pr-8 focus:outline-none focus:border-blue-500 transition-colors"
              >
                {months.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col space-y-1 min-w-[120px]">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Year</label>
            <div className="relative">
              <select
                value={filter.year}
                onChange={(e) => setFilter((f) => ({ ...f, year: Number(e.target.value) }))}
                className="w-full appearance-none bg-slate-950 border border-slate-800 rounded-xl text-sm text-white px-3 py-2 pr-8 focus:outline-none focus:border-blue-500 transition-colors"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col space-y-1 min-w-[200px]">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              <Building2 className="w-3 h-3 inline mr-1" />Branch Filter
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter by branch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
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
      {hasLoaded && reportData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800">
            <p className="text-xs font-bold uppercase text-slate-400">Branches Reported</p>
            <p className="text-2xl font-extrabold text-white mt-1">{reportData.length}</p>
          </Card>
          <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800">
            <p className="text-xs font-bold uppercase text-slate-400">Company Avg Attendance</p>
            <div className="flex items-center space-x-2 mt-1">
              <p className={`text-2xl font-extrabold ${avgAttendance >= 90 ? 'text-emerald-400' : avgAttendance >= 75 ? 'text-amber-400' : 'text-rose-400'}`}>
                {avgAttendance}%
              </p>
              {avgAttendance >= 90 ? (
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-rose-400" />
              )}
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800">
            <p className="text-xs font-bold uppercase text-slate-400">Best Performing Store</p>
            <p className="text-sm font-extrabold text-emerald-400 mt-1 truncate">
              {reportData.reduce((best, r) => r.attendance_rate > best.attendance_rate ? r : best, reportData[0])?.branch_name || '—'}
            </p>
          </Card>
          <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800">
            <p className="text-xs font-bold uppercase text-slate-400">Needs Attention</p>
            <p className="text-sm font-extrabold text-rose-400 mt-1 truncate">
              {reportData.reduce((worst, r) => r.attendance_rate < worst.attendance_rate ? r : worst, reportData[0])?.branch_name || '—'}
            </p>
          </Card>
        </div>
      )}

      {/* Branch-wise Data Table (Spec P30) */}
      {!hasLoaded ? (
        <Card className="p-16 text-center border-slate-800 border-dashed">
          <BarChart3 className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-400">Select Period & Generate Report</h3>
          <p className="text-sm text-slate-500 mt-1">
            Choose a month and year above, then click <strong className="text-blue-400">Generate Report</strong> to pull live attendance data.
          </p>
        </Card>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" label="Fetching Branch Attendance Data..." />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center border-slate-800">
          <p className="text-slate-400 font-semibold">No report data found for selected period.</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/80 text-slate-400 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-800">
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
                {filtered.map((row) => (
                  <tr key={row.branch_id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-4 px-5">
                      <div>
                        <span className="text-xs font-extrabold text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded-md mr-2">
                          {row.branch_code}
                        </span>
                        <span className="font-bold text-white">{row.branch_name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-center text-slate-300 font-semibold">{row.total_days}</td>
                    <td className="py-4 px-5 text-center font-bold text-emerald-400">{row.present_days}</td>
                    <td className="py-4 px-5 text-center font-bold text-amber-400">{row.late_days}</td>
                    <td className="py-4 px-5 text-center font-bold text-rose-400">{row.absent_days}</td>
                    <td className="py-4 px-5 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-lg font-extrabold ${row.attendance_rate >= 90 ? 'text-emerald-400' : row.attendance_rate >= 75 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {row.attendance_rate.toFixed(1)}%
                        </span>
                        {/* Mini Progress Bar */}
                        <div className="w-20 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.attendance_rate >= 90 ? 'bg-emerald-500' : row.attendance_rate >= 75 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${row.attendance_rate}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-center">
                      <span className={`font-bold ${row.punctuality_rate >= 85 ? 'text-emerald-400' : row.punctuality_rate >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {row.punctuality_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-4 px-5 text-center">
                      <Badge
                        status={row.attendance_rate >= 90 ? 'present' : row.attendance_rate >= 75 ? 'late' : 'absent'}
                        variant="subtle"
                      >
                        {row.attendance_rate >= 90 ? 'Excellent' : row.attendance_rate >= 75 ? 'Acceptable' : 'Critical'}
                      </Badge>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Download className="w-3.5 h-3.5" />}
                        onClick={() =>
                          window.open(
                            `/api/reports/export?branch_id=${row.branch_id}&month=${filter.month}&year=${filter.year}&format=excel`,
                            '_blank'
                          )
                        }
                      >
                        Download
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
