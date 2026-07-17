'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Search,
  UserCheck,
  FileBarChart,
  Calendar,
  MapPin,
  Store,
  Building2,
  FileText,
} from 'lucide-react';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface StoreEmployee {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  status: 'present' | 'late' | 'absent' | 'on_leave' | 'pending';
  check_in_time?: string;
  check_out_time?: string;
}

export default function BranchManagerDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [storeName, setStoreName] = useState('Anchor Fashion Store');
  const [employees, setEmployees] = useState<StoreEmployee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingCorrections, setPendingCorrections] = useState(0);
  const [exporting, setExporting] = useState(false);

  const fetchStoreDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Get branch info
      const { data: profile } = await supabase
        .from('profiles')
        .select('branch_id, branches!profiles_branch_id_fkey(name)')
        .eq('id', user.id)
        .single();

      const branchId = profile?.branch_id;
      if (profile && profile.branches) {
        setStoreName((profile as unknown as { branches: { name: string } }).branches.name);
      }

      // 2. Fetch staff in this branch
      let query = supabase.from('profiles').select('id, full_name, email, phone').eq('role', 'employee');
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      const { data: staffList } = await query;

      // 2. Fetch staff in this branch
      // (RLS automatically filters this to the manager's assigned branch)
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const [month, day, year] = formatter.format(now).split('/');
      const startOfDay = new Date(`${year}-${month}-${day}T00:00:00+06:00`);
      const endOfDay = new Date(`${year}-${month}-${day}T23:59:59+06:00`);

      const { data: todayRecords } = await supabase
        .from('attendance_records')
        .select('employee_id, status, check_in_time, check_out_time')
        .gte('check_in_time', startOfDay.toISOString())
        .lte('check_in_time', endOfDay.toISOString());

      // Fetch pending corrections count
      let correctionsQuery = supabase
        .from('correction_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      if (branchId) {
        correctionsQuery = correctionsQuery.eq('branch_id', branchId);
      }
      const { count: correctionsCount } = await correctionsQuery;
      setPendingCorrections(correctionsCount || 0);

      // Map employees with their current status today
      if (staffList) {
        const mapped: StoreEmployee[] = staffList.map((emp) => {
          const rec = (todayRecords || []).find((r) => r.employee_id === emp.id);
          return {
            id: emp.id,
            full_name: emp.full_name,
            email: emp.email,
            phone: emp.phone,
            status: rec ? (rec.status as 'present' | 'late' | 'absent') : 'absent',
            check_in_time: rec?.check_in_time,
            check_out_time: rec?.check_out_time,
          };
        });
        setEmployees(mapped);
      }
    } catch (err) {
      console.error('Store dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStoreDashboard();
  }, [fetchStoreDashboard]);

  const presentCount = employees.filter((e) => e.status === 'present').length;
  const lateCount = employees.filter((e) => e.status === 'late').length;
  const absentCount = employees.filter((e) => e.status === 'absent').length;

  const filteredStaff = employees.filter(
    (e) =>
      e.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <Spinner size="lg" label="Loading Store Operations Console..." />
      </div>
    );
  }

  const handleExportTodayPDF = async () => {
    setExporting(true);
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('branch_id').eq('id', user?.id).single();
      const branchId = profile?.branch_id || '';

      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
        format: 'pdf',
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
          a.download = `Store_Report_${month}_${year}.pdf`;
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
      a.download = `Store_Report_${month}_${year}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(`Export failed: ${err instanceof Error ? err.message : 'Please try again.'}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Sleek Minimal Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <Store className="w-4 h-4 text-slate-900" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{storeName}</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Store Console</h1>
          <p className="text-sm text-slate-900 mt-1">
            Supervise staff attendance, punctuality, and manual override requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-slate-900 hover:text-slate-900 border-slate-200"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={() => fetchStoreDashboard()}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="primary"
            className="bg-blue-600 hover:bg-blue-700 text-slate-900 border-none"
            icon={exporting ? undefined : <FileBarChart className="w-4 h-4" />}
            isLoading={exporting}
            onClick={handleExportTodayPDF}
          >
            Download PDF
          </Button>
        </div>
      </div>

      {/* Action Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending Corrections Alert */}
        {pendingCorrections > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-amber-500">
                  {pendingCorrections} Pending Correction{pendingCorrections > 1 ? 's' : ''}
                </h4>
                <p className="text-xs text-amber-500/70 mt-0.5">Requires supervisor authorization.</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-amber-500 border-amber-500/30 hover:bg-amber-500/20 shrink-0"
              onClick={() => router.push('/branch-manager/corrections')}
            >
              Review
            </Button>
          </div>
        )}
      </div>

      {/* Clean Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#ffffff] border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-slate-900">Total Staff</p>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {employees.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Assigned to {storeName}</p>
        </div>

        <div className="bg-[#ffffff] border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-[#1dbf73]">Present Today</p>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {presentCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {employees.length ? Math.round((presentCount / employees.length) * 100) : 0}% On Time
          </p>
        </div>

        <div className="bg-[#ffffff] border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-amber-500">Late Arrivals</p>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {lateCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Arrived after grace period</p>
        </div>

        <div className="bg-[#ffffff] border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-rose-400">Absent / Off</p>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {absentCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Not checked in today</p>
        </div>
      </div>

      {/* Live Employee Status Table */}
      <div className="bg-[#ffffff] rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-transparent">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Live Store Attendance Roster</h3>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-transparent border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-slate-500 transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-transparent text-slate-500 text-xs font-semibold uppercase border-b border-slate-200">
                <th className="py-3 px-5">Employee</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Check-In Time</th>
                <th className="py-3 px-5">Check-Out Time</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 text-sm">
                    No store employees found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-100/20 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-900 font-medium text-xs shrink-0">
                          {emp.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-700 text-sm">{emp.full_name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5">
                      <Badge
                        status={emp.status === 'late' ? 'late' : emp.status === 'present' ? 'present' : 'absent'}
                        variant="subtle"
                      />
                    </td>
                    <td className="py-3 px-5 font-mono text-xs text-slate-900">
                      {emp.check_in_time ? (
                        <span className="text-[#1dbf73]/90">
                          {new Date(emp.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-slate-900 italic">Not Checked In</span>
                      )}
                    </td>
                    <td className="py-3 px-5 font-mono text-xs text-slate-900">
                      {emp.check_out_time ? (
                        <span className="text-blue-400/90">
                          {new Date(emp.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-slate-900 italic">On Shift</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-900 hover:text-slate-700"
                        onClick={() => router.push(`/branch-manager/corrections?user_id=${emp.id}`)}
                      >
                        Correction
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

