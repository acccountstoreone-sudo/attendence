'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  Calendar,
  Play,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Users,
} from 'lucide-react';

// Bug 5 fix: Proper typed interfaces instead of any[]
interface PayrollRecord {
  user_id: string;
  full_name?: string; // APP-06 fix: was missing from interface
  status: 'success' | 'error';
  reason?: string;
  data?: {
    total_payable_days: number;
    gross_salary: number;
    deductions: number;
    net_payable: number;
    overtime_hours?: number;
    overtime_pay?: number;
    snack_allowance_pay?: number;
    duty_summary_snapshot?: {
      present_days?: number;
      overtime_hours?: number;
      overtime_pay?: number;
      snack_allowance_pay?: number;
    };
  };
}

export default function AdminPayrollDashboard() {
  const [monthYear, setMonthYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PayrollRecord[] | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = useCallback(async () => {
    if (!monthYear) {
      setError('Please select a valid month.');
      return;
    }
    setLoading(true);
    setError('');
    setResults(null);

    try {
      const res = await fetch('/api/payroll/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month_year: monthYear }),
      });
      const json = await res.json();
      if (json.success) {
        setResults(json.data as PayrollRecord[]);
      } else {
        setError(json.error?.message || json.error || 'Failed to generate payroll.');
      }
    } catch {
      setError('Network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [monthYear]);

  // Bug 8 fix: Export payroll as CSV
  const handleExport = useCallback(() => {
    if (!results) return;
    const headers = ['Employee Name', 'Employee ID', 'Status', 'Payable Days', 'Gross Salary', 'Overtime (Hrs)', 'Overtime Pay', 'Snacks Allowance Pay', 'Deductions', 'Net Payable', 'Reason'];
    const rows = results.map((r) => [
      r.full_name || r.user_id,
      r.user_id,
      r.status,
      r.data?.total_payable_days ?? '',
      r.data?.gross_salary ?? '',
      r.data?.duty_summary_snapshot?.overtime_hours ?? r.data?.overtime_hours ?? 0,
      r.data?.duty_summary_snapshot?.overtime_pay ?? r.data?.overtime_pay ?? 0,
      r.data?.duty_summary_snapshot?.snack_allowance_pay ?? r.data?.snack_allowance_pay ?? 0,
      r.data?.deductions ?? '',
      r.data?.net_payable ?? '',
      r.reason ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => {
        let s = String(v ?? '');
        if (/^[=+\-@]/.test(s)) s = "'" + s;
        return `"${s.replace(/"/g, '""')}"`;
      }).join(','))
      .join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_${monthYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results, monthYear]);

  const successCount = results?.filter((r) => r.status === 'success').length ?? 0;
  const errorCount = results?.filter((r) => r.status === 'error').length ?? 0;
  const totalNet = results
    ?.filter((r) => r.status === 'success')
    .reduce((acc, r) => acc + (r.data?.net_payable ?? 0), 0) ?? 0;

  return (
    // Bug 13/14 fix: Removed all shadcn CSS variable classes (text-muted-foreground, bg-indigo-50, etc.)
    // Now consistently uses the dark admin theme matching all other admin pages
    <div className="space-y-8 pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#1dbf73_1px,transparent_1px)] [background-size:40px_40px] mix-blend-overlay z-0" />
        <div className="relative z-10 pointer-events-none">
          <div className="flex items-center space-x-2 mb-1">
            <DollarSign className="w-5 h-5 text-[#1dbf73]" />
            <span className="px-3 py-1 rounded-full bg-[#1dbf73]/10 border border-[#1dbf73]/30 text-[#1dbf73] text-xs font-bold uppercase tracking-widest">
              Finance
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Payroll Generation</h1>
          <p className="text-sm text-slate-600 mt-1">Compute monthly salary sheets based on attendance records.</p>
        </div>
      </motion.div>

      {/* Generator Card */}
      <Card className="bg-white border-slate-200 shadow-2xl">
        <div className="border-b border-slate-200 pb-4 mb-6">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#1dbf73]" />
            Run Payroll Calculation
          </h2>
          <p className="text-sm text-slate-600 mt-1">Select the target month. This will process all employees in your scope.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 max-w-sm space-y-2">
            <label htmlFor="month" className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
              Month & Year
            </label>
            <input
              id="month"
              type="month"
              value={monthYear}
              onChange={(e) => setMonthYear(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] transition-colors"
            />
          </div>
          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={loading || !monthYear}
            icon={loading ? undefined : <Play className="w-4 h-4" />}
            isLoading={loading}
          >
            {loading ? 'Computing...' : 'Generate Payroll'}
          </Button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-medium"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Results */}
      <AnimatePresence>
        {results && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Processed', value: results.length, icon: <Users className="w-5 h-5 text-blue-400" />, color: 'text-slate-900' },
                { label: 'Successful', value: successCount, icon: <CheckCircle2 className="w-5 h-5 text-[#1dbf73]" />, color: 'text-[#1dbf73]' },
                { label: 'Errors', value: errorCount, icon: <XCircle className="w-5 h-5 text-rose-400" />, color: 'text-rose-400' },
                { label: 'Total Net Payable', value: `৳${totalNet.toLocaleString()}`, icon: <TrendingUp className="w-5 h-5 text-[#1dbf73]" />, color: 'text-[#1dbf73]' },
              ].map((s) => (
                <Card key={s.label} variant="glass" className="hover:-translate-y-0.5 transition-transform">
                  <div className="flex items-center justify-between mb-2 text-slate-500">
                    {s.icon}
                  </div>
                  <div className={`text-2xl font-extrabold tracking-tight ${s.color}`}>{s.value}</div>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium uppercase tracking-wider">{s.label}</p>
                </Card>
              ))}
            </div>

            {/* Table Card */}
            <Card className="bg-white border-slate-200 p-0 overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <div>
                  <h2 className="font-bold text-slate-900">Generation Results</h2>
                  <p className="text-xs text-slate-600">{results.length} records for {monthYear}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Download className="w-4 h-4" />}
                  onClick={handleExport}
                  className="border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  Export CSV
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-600 font-bold">
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Payable Days</th>
                      <th className="py-3 px-4 text-right">Gross Salary</th>
                      <th className="py-3 px-4 text-right text-emerald-600">Overtime Pay</th>
                      <th className="py-3 px-4 text-right text-amber-600">Snacks Bill</th>
                      <th className="py-3 px-4 text-right text-rose-500">Deductions</th>
                      <th className="py-3 px-4 text-right font-extrabold text-[#1dbf73]">Net Payable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/50 text-sm">
                    {results.map((res, idx) => (
                      <tr key={idx} className="hover:bg-slate-100/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800 text-sm">
                            {res.full_name || 'Unknown Employee'}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                            {res.user_id.split('-')[0]}...
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {res.status === 'success' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-[#1dbf73]/10 border border-emerald-500/20 text-[#1dbf73]">
                              <CheckCircle2 className="w-3 h-3" /> Success
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400" title={res.reason}>
                              <XCircle className="w-3 h-3" /> Error
                            </span>
                          )}
                        </td>
                        {res.status === 'success' && res.data ? (
                          <>
                            <td className="py-3 px-4 text-right text-slate-600 font-semibold">{res.data.total_payable_days}</td>
                            <td className="py-3 px-4 text-right text-slate-600">৳{res.data.gross_salary.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right text-emerald-600 font-bold">
                              +৳{(res.data.duty_summary_snapshot?.overtime_pay ?? res.data.overtime_pay ?? 0).toLocaleString()}
                              <span className="block text-[10px] text-slate-400 font-normal">{(res.data.duty_summary_snapshot?.overtime_hours ?? res.data.overtime_hours ?? 0)} hrs</span>
                            </td>
                            <td className="py-3 px-4 text-right text-amber-600 font-bold">+৳{(res.data.duty_summary_snapshot?.snack_allowance_pay ?? res.data.snack_allowance_pay ?? 0).toLocaleString()}</td>
                            <td className="py-3 px-4 text-right text-rose-400 font-semibold">-৳{res.data.deductions.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-extrabold text-[#1dbf73] text-base">৳{res.data.net_payable.toLocaleString()}</td>
                          </>
                        ) : (
                          <td colSpan={6} className="py-3 px-4 text-slate-500 text-xs italic">{res.reason}</td>
                        )}
                      </tr>
                    ))}
                    {results.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-500 text-sm">
                          No employees found in your scope.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

