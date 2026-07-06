'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BranchTile } from '@/components/ui/BranchTile';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';

import {
  Users,
  CheckCircle2,
  Clock,
  Calendar,
  Activity,
  Plus,
  FileText,
  Bell,
  RefreshCw,
  Search,
  ArrowRight,
  MapPin,
  Building2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Abstract3DBackground from '@/components/Abstract3DBackground';

interface CompanySummary {
  total_branches: number;
  total_employees: number;
  present_today: number;
  late_today: number;
  absent_today: number;
  on_leave_today: number;
  system_health: string;
}

interface BranchItem {
  branch_id: string;
  name: string;
  code: string;
  address: string;
  total_staff: number;
  present_today: number;
  late_today: number;
  absent_today: number;
  alert_count: number;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  full_name?: string;
  branch_name?: string;
  type: string;
  status: string;
  timestamp: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [liveFeed, setLiveFeed] = useState<AttendanceRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Company Summary
      try {
        const resComp = await fetch('/api/reports/company-summary');
        if (resComp.ok) {
          const jsonComp = await resComp.json();
          if (jsonComp.success) setSummary(jsonComp.data);
        }
      } catch (e) { console.error('Failed fetching company summary', e); }

      // 2. Fetch Branches Summary
      try {
        const resBranch = await fetch('/api/reports/branch-summary');
        if (resBranch.ok) {
          const jsonBranch = await resBranch.json();
          if (jsonBranch.success) setBranches(jsonBranch.data || []);
        }
      } catch (e) { console.error('Failed fetching branch summary', e); }

      // 3. Fetch Live Attendance Today
      try {
        const resLive = await fetch('/api/reports/live-feed');
        if (resLive.ok) {
          const jsonLive = await resLive.json();
          if (jsonLive.success) {
            const liveData = Array.isArray(jsonLive.data) ? jsonLive.data : [];
            const records: AttendanceRecord[] = liveData.map((item: unknown) => {
              const rec = item as {
                id: string;
                user_id: string;
                check_in_time?: string;
                check_out_time?: string;
                status: string;
                profiles?: { full_name?: string; branches?: { name?: string } };
              };
              return {
                id: rec.id,
                user_id: rec.user_id,
                full_name: rec.profiles?.full_name || 'Unknown Employee',
                branch_name: rec.profiles?.branches?.name || 'Headquarters',
                type: rec.check_out_time ? 'Check-Out' : 'Check-In',
                status: rec.status || 'present',
                timestamp: rec.check_out_time || rec.check_in_time || new Date().toISOString(),
              };
            });
            setLiveFeed(records);
          }
        }
      } catch (e) { console.error('Failed fetching live attendance', e); }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    // Poll every 30 seconds for live feed updates
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const filteredBranches = branches.filter(
    (b) =>
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && !summary) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <Spinner size="lg" label="Aggregating Company-Wide Analytics..." />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Top Welcome Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/[0.01] p-8 rounded-3xl border border-white/[0.03] backdrop-blur-3xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_12px_40px_rgba(0,0,0,0.4)] relative overflow-hidden"
      >
        {/* Subtle Mesh Gradient Orb */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-[#D2A02A]/10 via-[#C08F1E]/5 to-transparent rounded-full blur-3xl opacity-60 pointer-events-none -translate-y-1/2 translate-x-1/3" />
        
        {/* Added 3D Premium Background Effect (Muted) */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none mix-blend-screen">
          <Abstract3DBackground />
        </div>

        <div className="relative z-10 pointer-events-none">
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 text-[10px] font-bold uppercase tracking-[0.2em] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
              Live Command Center
            </span>
            <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase flex items-center">
              <Activity className="w-3 h-3 text-emerald-500 mr-1.5 animate-pulse" />
              {summary?.system_health || '99.99% Operational'}
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white via-white/90 to-white/40 mt-4 tracking-tighter drop-shadow-sm">
            HQ Executive Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-2 font-medium tracking-tight">
            Real-time biometric attendance supervision across all Anchor Fashion stores.
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex items-center flex-wrap gap-3 relative z-10">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={() => fetchDashboardData()}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<FileText className="w-4 h-4" />}
            onClick={() => router.push('/admin/reports')}
          >
            Payroll Reports
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-4 h-4 text-[#040A15]" />}
            onClick={() => router.push('/admin/branches')}
          >
            Add Branch
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={<Bell className="w-4 h-4" />}
            onClick={() => router.push('/admin/broadcast')}
          >
            Broadcast
          </Button>
        </div>
      </motion.div>

      {/* Company Overview Cards Grid (Spec P27) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
      >
        <Card variant="glass" className="hover:-translate-y-1 transition-transform">
          <div className="flex items-center justify-between text-slate-500 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest">Total Staff</span>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-500 shadow-[0_0_8px_rgba(100,116,139,0.8)]" />
          </div>
          <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white to-white/40 tracking-tighter">
            {summary?.total_employees || 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-2 font-medium tracking-tight">Across {summary?.total_branches || 0} Stores</p>
        </Card>

        <Card variant="glass" className="hover:-translate-y-1 transition-transform">
          <div className="flex items-center justify-between text-emerald-500/50 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/80">Present Today</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          </div>
          <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white to-white/40 tracking-tighter">
            {summary?.present_today || 0}
          </div>
          <p className="text-[10px] text-emerald-500/60 mt-2 font-medium tracking-tight">
            {summary?.total_employees ? Math.round(((summary.present_today || 0) / summary.total_employees) * 100) : 0}% Attendance Rate
          </p>
        </Card>

        <Card variant="glass" className="hover:-translate-y-1 transition-transform">
          <div className="flex items-center justify-between text-amber-500/50 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80">Late Arrivals</span>
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
          </div>
          <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white to-white/40 tracking-tighter">
            {summary?.late_today || 0}
          </div>
          <p className="text-[10px] text-amber-500/60 mt-2 font-medium tracking-tight">Requiring supervisor attention</p>
        </Card>

        <Card variant="glass" className="hover:-translate-y-1 transition-transform">
          <div className="flex items-center justify-between text-purple-500/50 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-500/80">On Leave</span>
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
          </div>
          <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white to-white/40 tracking-tighter">
            {summary?.on_leave_today || 0}
          </div>
          <p className="text-[10px] text-purple-500/60 mt-2 font-medium tracking-tight">Approved absences</p>
        </Card>

        <Card className="col-span-2 md:col-span-1 bg-gradient-to-br from-white/[0.05] to-transparent border-white/5 relative overflow-hidden group shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
          <div className="absolute inset-0 bg-[#D2A02A]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex items-center justify-between text-[#D2A02A]/80 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest">System Health</span>
              <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
            </div>
            <div>
               <div className="text-lg font-bold text-white flex items-center tracking-tight">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-ping shadow-[0_0_10px_rgba(16,185,129,1)]" />
                Active & Secure
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-medium tracking-tight">Geofencing & Biometrics online</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Main Dashboard Section: Branch Grid + Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Store Branch Tiles Grid (Spec P27) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-[#D2A02A]" />
              <h2 className="text-lg font-bold text-white">Retail Branch Performance</h2>
            </div>
            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search branches or codes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
              />
            </div>
          </div>

          {filteredBranches.length === 0 ? (
            <Card className="p-12 text-center text-slate-400">
              <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="font-semibold">No stores found matching &quot;{searchTerm}&quot;</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredBranches.map((branch) => (
                <BranchTile
                  key={branch.branch_id}
                  branchId={branch.branch_id}
                  name={branch.name}
                  code={branch.code}
                  address={branch.address}
                  staffCount={branch.total_staff}
                  onlineCount={branch.present_today}
                  lateCount={branch.late_today}
                  alertCount={branch.alert_count}
                  onClick={() => router.push(`/admin/branches/${branch.branch_id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Live Attendance Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-[#D2A02A]" />
              <h2 className="text-lg font-bold text-white">Live Check-In Feed</h2>
            </div>
            <button
              onClick={() => router.push('/admin/attendance')}
              className="text-xs text-[#D2A02A] hover:text-[#C08F1E] flex items-center font-semibold"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>

          <Card variant="glass" className="p-0 overflow-hidden max-h-[580px] flex flex-col relative z-10">
            {/* Header for table */}
            <div className="bg-white/[0.02] p-4 border-b border-white/5 flex items-center justify-between text-[10px] font-bold uppercase text-slate-500 tracking-[0.2em]">
              <span>Employee</span>
              <span>Status</span>
            </div>
            
            <div className="overflow-y-auto flex-1 divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              <AnimatePresence>
                {liveFeed.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 text-center text-slate-600 text-xs font-medium tracking-tight">
                    No attendance activity recorded yet today.
                  </motion.div>
                ) : (
                  liveFeed.map((rec) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      key={rec.id} 
                      className="p-4 hover:bg-white/[0.02] transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-4 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
                          {rec.full_name?.charAt(0) || 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate tracking-tight">{rec.full_name}</p>
                          <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 mt-1 font-medium tracking-tight">
                            <MapPin className="w-3 h-3 text-[#D2A02A]/70 shrink-0" />
                            <span className="truncate">{rec.branch_name}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <Badge
                          status={rec.status === 'late' ? 'late' : rec.status === 'absent' ? 'absent' : 'present'}
                          variant="subtle"
                        />
                        <p className="text-[10px] text-slate-500 mt-1.5 font-mono tracking-tighter">
                          {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </Card>
        </div>
      </div>

    </div>
  );
}
