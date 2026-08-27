'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  AlertTriangle,
  RefreshCw,
  Search,
  FileBarChart,
  Store,
  ClipboardList,
  CheckCircle2,
  Circle,
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

const DAILY_TASKS = [
  { key: 'showroom_clean', label: 'শোরুম পরিষ্কার করা ও ঝাড়ু দেওয়া' },
  { key: 'generator_oil', label: 'জেনারেটরের তেল চেক করা' },
  { key: 'products_organized', label: 'শোরুমের সব পণ্য/কাপড় সুন্দরভাবে গোছানো' },
  { key: 'cash_office_table', label: 'ক্যাশ/অফিস টেবিল পরিষ্কার ও গোছানো' },
  { key: 'display_rack', label: 'ডিসপ্লে র‍্যাক ও হ্যাঙ্গার ঠিকভাবে সাজানো' },
  { key: 'mirror_glass_door', label: 'আয়না, গ্লাস ও দরজা পরিষ্কার করা' },
  { key: 'light_fan_ac', label: 'লাইট, ফ্যান ও AC চেক করা' },
  { key: 'cash_counter', label: 'ক্যাশ কাউন্টার পরিষ্কার ও গোছানো' },
  { key: 'dustbin', label: 'ডাস্টবিন পরিষ্কার করা' },
  { key: 'entrance_clean', label: 'শোরুমের বাইরে প্রবেশপথ পরিষ্কার রাখা' },
];

export default function BranchManagerDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [storeName, setStoreName] = useState('Anchor Fashion Store');
  const [branchIdState, setBranchIdState] = useState<string | null>(null);
  const [employees, setEmployees] = useState<StoreEmployee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingCorrections, setPendingCorrections] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [dailyTasksState, setDailyTasksState] = useState<Record<string, boolean>>({});
  const [dailyTasksUpdatedBy, setDailyTasksUpdatedBy] = useState<string | null>(null);
  const [dailyTasksUpdatedAt, setDailyTasksUpdatedAt] = useState<string | null>(null);

  const fetchStoreDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Get branch info
      const { data: profile } = await supabase
        .from('profiles')
        .select('branch_id, branch:branches!profiles_branch_id_fkey(name)')
        .eq('id', user.id)
        .single();

      const branchId = profile?.branch_id;
      if (branchId) setBranchIdState(branchId);
      if (profile) {
        const branchData = (profile as any).branch || (profile as any).branches;
        const bName = Array.isArray(branchData) ? branchData[0]?.name : branchData?.name;
        if (bName) {
          setStoreName(bName);
        }
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

      // 3. Fetch today's daily tasks progress for this branch
      if (branchId) {
        const now = new Date();
        const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const { data: tasksData } = await supabase
          .from('showroom_daily_tasks')
          .select('tasks_state, updated_at, completed_by:profiles!showroom_daily_tasks_completed_by_fkey(full_name)')
          .eq('branch_id', branchId)
          .eq('date', todayLocal)
          .maybeSingle();
        if (tasksData) {
          setDailyTasksState((tasksData.tasks_state as Record<string, boolean>) || {});
          setDailyTasksUpdatedAt(tasksData.updated_at || null);
          const nameData = (tasksData as any).completed_by;
          setDailyTasksUpdatedBy(
            Array.isArray(nameData) ? nameData[0]?.full_name : nameData?.full_name || null
          );
        }
      }

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
      {/* Daily Tasks Monitor */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1dbf73]/10 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-[#1dbf73]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">🏬 Showroom Daily Tasks</h3>
              <p className="text-xs text-slate-500">
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                {dailyTasksUpdatedBy && (
                  <span className="ml-2 text-slate-400">
                    · Last updated by <span className="font-medium text-slate-600">{dailyTasksUpdatedBy}</span>
                    {dailyTasksUpdatedAt && (
                      <> at {new Date(dailyTasksUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                    )}
                  </span>
                )}
              </p>
            </div>
          </div>
          {/* Progress pill */}
          {(() => {
            const done = DAILY_TASKS.filter(t => dailyTasksState[t.key]).length;
            const pct = Math.round((done / DAILY_TASKS.length) * 100);
            return (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-600">{done}/{DAILY_TASKS.length}</span>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                  pct === 100 ? 'border-[#1dbf73] bg-[#1dbf73]/10 text-[#1dbf73]' : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}>{pct}%</div>
              </div>
            );
          })()}
        </div>

        {/* Progress bar */}
        {(() => {
          const pct = Math.round((DAILY_TASKS.filter(t => dailyTasksState[t.key]).length / DAILY_TASKS.length) * 100);
          return (
            <div className="px-5 pt-4">
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: pct === 100 ? '#1dbf73' : 'linear-gradient(90deg,#1dbf73,#0ea5e9)' }}
                />
              </div>
            </div>
          );
        })()}

        {/* Task list — read only */}
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-5">
          {DAILY_TASKS.map((task, idx) => {
            const done = !!dailyTasksState[task.key];
            return (
              <li key={task.key} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${
                done ? 'bg-[#1dbf73]/5 border-[#1dbf73]/25' : 'bg-slate-50 border-slate-200'
              }`}>
                {done
                  ? <CheckCircle2 className="w-4.5 h-4.5 text-[#1dbf73] shrink-0" />
                  : <Circle className="w-4.5 h-4.5 text-slate-300 shrink-0" />}
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className={`text-xs font-bold shrink-0 ${done ? 'text-[#1dbf73]' : 'text-slate-400'}`}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className={`text-sm leading-snug ${
                    done ? 'text-slate-400 line-through decoration-[#1dbf73]/50' : 'text-slate-700'
                  }`}>{task.label}</span>
                </div>
              </li>
            );
          })}
        </ul>

        {!branchIdState && (
          <p className="text-center text-xs text-slate-400 pb-4">No branch assigned — cannot load tasks.</p>
        )}
      </div>
    </div>
  );
}
