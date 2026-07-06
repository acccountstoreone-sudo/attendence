'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Abstract3DBackground from '@/components/Abstract3DBackground';
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
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [storeName, setStoreName] = useState('Anchor Fashion Store');
  const [employees, setEmployees] = useState<StoreEmployee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingCorrections, setPendingCorrections] = useState(2); // simulated or fetched count
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

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
        .select('id, full_name, email, nid')
        .eq('registration_step', 'pending_approval');
      if (pendingList) setPendingApprovals(pendingList);

      // 3. Fetch today's attendance records for this branch
      const resAtt = await fetch('/api/attendance/today');
      const jsonAtt = await resAtt.json();
      const todayRecords = jsonAtt.success ? jsonAtt.data : [];

      // Map employees with their current status today
      if (staffList) {
        const mapped: StoreEmployee[] = staffList.map((emp) => {
          const rec = todayRecords.find((r: { user_id: string }) => r.user_id === emp.id);
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
    } catch (e) {
      console.error(e);
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
    <div className="space-y-8 pb-12">
      {/* Pending Corrections Prominent Banner (Spec P27) */}
      {pendingCorrections > 0 && (
        <div className="bg-gradient-to-r from-amber-950/90 via-amber-900/60 to-slate-900 border border-amber-500/50 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-amber-950/20 animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-400 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-amber-200">
                Action Required: {pendingCorrections} Pending Attendance Correction Request{pendingCorrections > 1 ? 's' : ''}
              </h4>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Staff have submitted manual override logs requiring your immediate supervisor authorization.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="bg-amber-600 hover:bg-amber-500 text-white shrink-0 border-none"
            onClick={() => router.push('/branch-manager/corrections')}
          >
            Review Requests
          </Button>
        </div>
      )}

      {/* Pending Identity Enrollments */}
      {pendingApprovals.length > 0 && (
        <div className="bg-[#061224] border border-[#D2A02A]/50 p-4 rounded-2xl shadow-xl shadow-[#D2A02A]/10 mb-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#D2A02A_1px,transparent_1px)] [background-size:20px_20px] mix-blend-overlay z-0" />
          <div className="relative z-10 flex items-center space-x-3 mb-4">
            <div className="p-2.5 bg-[#D2A02A]/20 rounded-xl text-[#D2A02A] shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-[#D2A02A]">
                Identity Enrollments ({pendingApprovals.length})
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                New employees have completed KYC & Face Scan and are waiting for your approval.
              </p>
            </div>
          </div>
          <div className="space-y-3 relative z-10">
             {pendingApprovals.map(emp => (
               <div key={emp.id} className="flex items-center justify-between bg-[#040A15]/80 p-3 rounded-xl border border-[#1E293B]">
                 <div>
                   <p className="text-white font-bold text-sm">{emp.full_name}</p>
                   <p className="text-slate-400 text-xs">Email: {emp.email} | NID: {emp.nid}</p>
                 </div>
                 <div className="flex gap-2">
                   <Button size="sm" variant="ghost" className="text-rose-400 hover:bg-rose-950/30" onClick={() => handleApprove(emp.id, 'reject')}>Reject</Button>
                   <Button size="sm" variant="primary" className="bg-[#D2A02A] hover:bg-[#C08F1E] text-[#040A15] font-bold border-none" onClick={() => handleApprove(emp.id, 'approve')}>Approve & Enroll</Button>
                 </div>
               </div>
             ))}
          </div>
        </div>
      )}

      {/* Store Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#061224] p-6 rounded-3xl border border-[#1E293B] shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#D2A02A_1px,transparent_1px)] [background-size:40px_40px] mix-blend-overlay z-0" />
        
        {/* Added 3D Premium Background Effect */}
        <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
          <Abstract3DBackground />
        </div>

        <div className="relative z-10">
          <div className="flex items-center space-x-2">
            <Store className="w-4 h-4 text-[#D2A02A]" />
            <span className="text-xs font-bold text-[#D2A02A] uppercase tracking-wider">{storeName}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1 tracking-tight">
            Store Management Console
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time shift attendance, punctuality supervision, and biometric check-in tracking.
          </p>
        </div>

        <div className="flex items-center space-x-2 relative z-10">
          <Button
            size="sm"
            variant="outline"
            className="border-[#1E293B] text-slate-300 hover:bg-[#1E293B] hover:text-white backdrop-blur-md bg-[#040A15]/50"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={() => fetchStoreDashboard()}
          >
            Refresh Feed
          </Button>
          <Button
            size="sm"
            variant="primary"
            className="bg-[#D2A02A] text-[#040A15] hover:bg-[#C08F1E] font-bold border-none shadow-[0_0_20px_rgba(210,160,42,0.3)]"
            icon={<FileBarChart className="w-4 h-4 text-[#040A15]" />}
            onClick={() => router.push('/branch-manager/reports')}
          >
            Export Store Report
          </Button>
        </div>
      </motion.div>

      {/* Overview Metric Cards */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <Card className="bg-[#061224] border-[#1E293B] hover:border-[#D2A02A]/30 transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Store Staff</span>
            <Users className="w-5 h-5 text-[#D2A02A]" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-white">{employees.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Assigned to this store</p>
        </Card>

        <Card className="bg-[#061224] border-[#1E293B] hover:border-emerald-500/30 transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Present Today</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-emerald-400">{presentCount}</div>
          <p className="text-[11px] text-emerald-500/80 mt-1">
            {employees.length ? Math.round((presentCount / employees.length) * 100) : 0}% On Time
          </p>
        </Card>

        <Card className="bg-[#061224] border-[#1E293B] hover:border-amber-500/30 transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Late Today</span>
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-amber-400">{lateCount}</div>
          <p className="text-[11px] text-amber-500/80 mt-1">Arrived after grace period</p>
        </Card>

        <Card className="bg-[#061224] border-[#1E293B] hover:border-rose-500/30 transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Absent / Off</span>
            <Calendar className="w-5 h-5 text-rose-400" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-rose-400">{absentCount}</div>
          <p className="text-[11px] text-rose-500/80 mt-1">Not checked in today</p>
        </Card>
      </motion.div>

      {/* Live Employee Status Table (Spec P27) */}
      <Card className="p-0 overflow-hidden bg-[#061224] border-[#1E293B]">
        <div className="p-6 border-b border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#040A15]/40">
          <div>
            <h3 className="text-lg font-bold text-white">Live Store Attendance Roster</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Supervise employee biometric check-in timestamps and current presence status.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search staff name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-[#040A15] border border-[#1E293B] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#D2A02A] transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#040A15] text-slate-400 text-[11px] font-extrabold uppercase tracking-wider border-b border-[#1E293B]">
                <th className="py-3.5 px-6">Employee</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Check-In Time</th>
                <th className="py-3.5 px-6">Check-Out Time</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B] text-sm">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 text-xs">
                    No store employees found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((emp) => (
                  <tr key={emp.id} className="hover:bg-[#1E293B]/40 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-[#040A15] border border-[#1E293B] flex items-center justify-center text-[#D2A02A] font-bold text-xs shrink-0">
                          {emp.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{emp.full_name}</p>
                          <p className="text-xs text-slate-400">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <Badge
                        status={emp.status === 'late' ? 'late' : emp.status === 'present' ? 'present' : 'absent'}
                        variant="subtle"
                      />
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-300">
                      {emp.check_in_time ? (
                        <span className="text-emerald-400 font-semibold">
                          {new Date(emp.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs italic">Not Checked In</span>
                      )}
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-300">
                      {emp.check_out_time ? (
                        <span className="text-blue-400 font-semibold">
                          {new Date(emp.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs italic">On Shift</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-400 hover:text-[#D2A02A] hover:bg-[#1E293B]"
                        icon={<UserCheck className="w-3.5 h-3.5" />}
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
      </Card>
    </div>
  );
}
