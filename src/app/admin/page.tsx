'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
      } catch (e) { console.warn('Failed fetching company summary:', (e as Error).message); }

      // 2. Fetch Branches Summary
      try {
        const resBranch = await fetch('/api/reports/branch-summary');
        if (resBranch.ok) {
          const jsonBranch = await resBranch.json();
          if (jsonBranch.success) setBranches(jsonBranch.data || []);
        }
      } catch (e) { console.warn('Failed fetching branch summary:', (e as Error).message); }

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
      } catch (e) { console.warn('Failed fetching live attendance:', (e as Error).message); }
    } catch (err) {
      console.warn('Failed to load dashboard data:', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      {/* Minimal SaaS Header (Jibble Style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Overview of company attendance and branch activities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={() => fetchDashboardData()}
            className="text-slate-400 hover:text-white border-slate-700"
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            icon={<FileText className="w-4 h-4" />}
            onClick={() => router.push('/admin/reports')}
            className="text-slate-400 hover:text-white border-slate-700"
          >
            Reports
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => router.push('/admin/branches')}
            className="bg-blue-600 hover:bg-blue-700 text-white border-none"
          >
            Add Branch
          </Button>
        </div>
      </div>

      {/* Clean Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="bg-[#0A101C] border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-slate-400">Total Staff</p>
          <div className="mt-2 text-2xl font-bold text-white">
            {summary?.total_employees || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Across {summary?.total_branches || 0} locations</p>
        </div>

        <div className="bg-[#0A101C] border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-emerald-500">Present Today</p>
          <div className="mt-2 text-2xl font-bold text-white">
            {summary?.present_today || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {summary?.total_employees ? Math.round(((summary.present_today || 0) / summary.total_employees) * 100) : 0}% Attendance
          </p>
        </div>

        <div className="bg-[#0A101C] border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-amber-500">Late Arrivals</p>
          <div className="mt-2 text-2xl font-bold text-white">
            {summary?.late_today || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Requires review</p>
        </div>

        <div className="bg-[#0A101C] border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-purple-400">On Leave</p>
          <div className="mt-2 text-2xl font-bold text-white">
            {summary?.on_leave_today || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Approved absences</p>
        </div>

        <div className="col-span-2 md:col-span-1 bg-[#0A101C] border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between">
          <p className="text-xs font-medium text-blue-400">System Status</p>
          <div className="mt-2 text-sm font-medium text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Operational
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{summary?.system_health || 'All systems go'}</p>
        </div>
      </div>

      {/* Main Dashboard Section: Branch Grid + Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Branches List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between bg-[#0A101C] p-4 rounded-xl border border-[#1E293B]">
            <h2 className="text-base font-semibold text-white">Branch Locations</h2>
            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search branches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-transparent border border-[#1E293B] rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
              />
            </div>
          </div>

          {filteredBranches.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-[#0A101C] rounded-xl border border-[#1E293B]">
              <p className="text-sm">No branches found matching "{searchTerm}"</p>
            </div>
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

        {/* Right 1 Col: Live Attendance List (Who's In) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#0A101C] p-4 rounded-xl border border-[#1E293B]">
            <h2 className="text-base font-semibold text-white">Live Activity</h2>
            <button
              onClick={() => router.push('/admin/attendance')}
              className="text-sm text-blue-400 hover:text-blue-300 font-medium"
            >
              View All
            </button>
          </div>

          <div className="bg-[#0A101C] rounded-xl border border-[#1E293B] overflow-hidden max-h-[580px] flex flex-col">
            {/* Header for table */}
            <div className="bg-transparent border-b border-[#1E293B] px-5 py-3 flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
              <span>Employee</span>
              <span>Status</span>
            </div>
            
            <div className="overflow-y-auto flex-1 divide-y divide-[#1E293B]">
              <AnimatePresence>
                {liveFeed.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    No activity recorded yet today.
                  </div>
                ) : (
                  liveFeed.map((rec) => (
                    <div key={rec.id} className="p-4 hover:bg-[#1E293B]/20 transition-colors flex items-center justify-between">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-medium text-xs shrink-0">
                          {rec.full_name?.charAt(0) || 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">{rec.full_name}</p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{rec.branch_name}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <Badge
                          status={rec.status === 'late' ? 'late' : rec.status === 'absent' ? 'absent' : 'present'}
                          variant="subtle"
                        />
                        <p className="text-[11px] text-slate-500 mt-1 font-mono">
                          {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
