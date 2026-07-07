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
import { KYCReviewModal } from '@/components/admin/KYCReviewModal';

interface StoreEmployee {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  status: 'present' | 'late' | 'absent' | 'on_leave' | 'pending';
  check_in_time?: string;
  check_out_time?: string;
}

interface PendingApproval {
  id: string;
  full_name: string;
  email: string;
  nid?: string;
  nid_front_url?: string;
  nid_back_url?: string;
}

export default function BranchManagerDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [storeName, setStoreName] = useState('Anchor Fashion Store');
  const [employees, setEmployees] = useState<StoreEmployee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingCorrections, setPendingCorrections] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [reviewingEmployee, setReviewingEmployee] = useState<PendingApproval | null>(null);

  const fetchStoreDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Get branch info
      const { data: profile } = await supabase
        .from('profiles')
        .select('branch_id, branches(name)')
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

      // 2.5 Fetch pending approvals
      const { data: pendingList } = await supabase
        .from('profiles')
        .select('id, full_name, email, nid, nid_front_url, nid_back_url')
        .eq('registration_step', 'pending_approval');
      if (pendingList) setPendingApprovals(pendingList);

      // 3. Fetch today's attendance records for this branch using Supabase directly
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

      // Pending corrections feature is unimplemented in the database schema, setting to 0
      setPendingCorrections(0);

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

  const handleApprove = async (userId: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/auth/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action })
      });
      if (res.ok) {
        setPendingApprovals(prev => prev.filter(p => p.id !== userId));
        fetchStoreDashboard(); // refresh employee list
      }
    } catch (error) {
      console.error(error);
      alert('Failed to process approval.');
    }
  };

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

  return (
    <div className="space-y-6 pb-12">
      {/* Sleek Minimal Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <Store className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{storeName}</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Store Console</h1>
          <p className="text-sm text-slate-400 mt-1">
            Supervise staff attendance, punctuality, and manual override requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-slate-400 hover:text-white border-slate-700"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={() => fetchStoreDashboard()}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="primary"
            className="bg-blue-600 hover:bg-blue-700 text-white border-none"
            icon={<FileBarChart className="w-4 h-4" />}
            onClick={() => router.push('/branch-manager/reports')}
          >
            Export Report
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

        {/* KYC Enrollments Alert */}
        {pendingApprovals.length > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <UserCheck className="w-5 h-5 text-blue-500 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-blue-500">
                  {pendingApprovals.length} Identity Enrollment{pendingApprovals.length > 1 ? 's' : ''}
                </h4>
                <p className="text-xs text-blue-500/70 mt-0.5">New staff awaiting KYC approval.</p>
              </div>
            </div>
            <div className="flex -space-x-2">
              {pendingApprovals.slice(0, 3).map((emp) => (
                <div key={emp.id} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-[#061224] flex items-center justify-center text-xs font-medium text-slate-300">
                  {emp.full_name.charAt(0)}
                </div>
              ))}
              {pendingApprovals.length > 3 && (
                <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-[#061224] flex items-center justify-center text-xs font-medium text-slate-400">
                  +{pendingApprovals.length - 3}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* If there are pending approvals, show them in a flat list */}
      {pendingApprovals.length > 0 && (
        <div className="bg-[#0A101C] rounded-xl border border-[#1E293B] overflow-hidden">
          <div className="bg-transparent border-b border-[#1E293B] px-5 py-3 flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
            <span>Pending KYC Reviews</span>
          </div>
          <div className="divide-y divide-[#1E293B]">
             {pendingApprovals.map(emp => (
               <div key={emp.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-[#1E293B]/20 transition-colors gap-3">
                 <div>
                   <p className="text-slate-200 font-medium text-sm">{emp.full_name}</p>
                   <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                     <span>{emp.email}</span>
                     {emp.nid && !emp.nid.startsWith('doc_') && (
                       <>
                        <span>&bull;</span>
                        <span>NID: ****{emp.nid.slice(-4)}</span>
                       </>
                     )}
                   </div>
                 </div>
                 <Button size="sm" variant="outline" className="text-blue-400 border-blue-400/30 hover:bg-blue-900/30 shrink-0" onClick={() => setReviewingEmployee(emp)}>
                   Review KYC
                 </Button>
               </div>
             ))}
          </div>
        </div>
      )}

      <KYCReviewModal 
        isOpen={!!reviewingEmployee}
        onClose={() => setReviewingEmployee(null)}
        employee={reviewingEmployee ? { ...reviewingEmployee, branch_name: storeName } : null}
        onApprove={async (id, action) => {
          await handleApprove(id, action);
          setReviewingEmployee(null);
        }}
      />

      {/* Clean Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0A101C] border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-slate-400">Total Staff</p>
          <div className="mt-2 text-2xl font-bold text-white">
            {employees.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Assigned to {storeName}</p>
        </div>

        <div className="bg-[#0A101C] border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-emerald-500">Present Today</p>
          <div className="mt-2 text-2xl font-bold text-white">
            {presentCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {employees.length ? Math.round((presentCount / employees.length) * 100) : 0}% On Time
          </p>
        </div>

        <div className="bg-[#0A101C] border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-amber-500">Late Arrivals</p>
          <div className="mt-2 text-2xl font-bold text-white">
            {lateCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Arrived after grace period</p>
        </div>

        <div className="bg-[#0A101C] border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-rose-400">Absent / Off</p>
          <div className="mt-2 text-2xl font-bold text-white">
            {absentCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Not checked in today</p>
        </div>
      </div>

      {/* Live Employee Status Table */}
      <div className="bg-[#0A101C] rounded-xl border border-[#1E293B] overflow-hidden">
        <div className="p-5 border-b border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-transparent">
          <div>
            <h3 className="text-base font-semibold text-white">Live Store Attendance Roster</h3>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-transparent border border-[#1E293B] rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-transparent text-slate-500 text-xs font-semibold uppercase border-b border-[#1E293B]">
                <th className="py-3 px-5">Employee</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Check-In Time</th>
                <th className="py-3 px-5">Check-Out Time</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B] text-sm">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 text-sm">
                    No store employees found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((emp) => (
                  <tr key={emp.id} className="hover:bg-[#1E293B]/20 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-medium text-xs shrink-0">
                          {emp.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-200 text-sm">{emp.full_name}</p>
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
                    <td className="py-3 px-5 font-mono text-xs text-slate-400">
                      {emp.check_in_time ? (
                        <span className="text-emerald-400/90">
                          {new Date(emp.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-slate-600 italic">Not Checked In</span>
                      )}
                    </td>
                    <td className="py-3 px-5 font-mono text-xs text-slate-400">
                      {emp.check_out_time ? (
                        <span className="text-blue-400/90">
                          {new Date(emp.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-slate-600 italic">On Shift</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-400 hover:text-slate-200"
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
