'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  Users,
  Activity,
  Search,
  ChevronDown,
  MoreVertical,
  AlertTriangle,
  Bell,
  Wifi,
  X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActivePresence } from '@/hooks/useActivePresence';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

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

// Circular Progress Component
const CircularProgress = ({ percentage, color }: { percentage: number; color: string }) => {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-12 h-12">
      <svg className="transform -rotate-90 w-12 h-12">
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          className="text-white/10"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke={color}
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-white">{percentage}%</span>
    </div>
  );
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [liveFeed, setLiveFeed] = useState<AttendanceRecord[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [weeklyTrendData, setWeeklyTrendData] = useState<any[]>([]);
  
  const { onlineUsers } = useActivePresence();
  const [showActiveUsersModal, setShowActiveUsersModal] = useState(false);

  const totalCheckins = React.useMemo(() => {
    return weeklyTrendData.reduce((sum, item) => sum + (item.val || 0), 0);
  }, [weeklyTrendData]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      try {
        const resComp = await fetch('/api/reports/company-summary');
        if (resComp.ok) {
          const jsonComp = await resComp.json();
          if (jsonComp.success) setSummary(jsonComp.data);
        }
      } catch (e) {}

      try {
        const resBranch = await fetch('/api/reports/branch-summary');
        if (resBranch.ok) {
          const jsonBranch = await resBranch.json();
          if (jsonBranch.success) setBranches(jsonBranch.data || []);
        }
      } catch (e) {}

      try {
        const resTrends = await fetch('/api/reports/trends');
        if (resTrends.ok) {
          const jsonTrends = await resTrends.json();
          if (jsonTrends.success) {
            setMonthlyData(jsonTrends.data.monthlyData || []);
            setWeeklyTrendData(jsonTrends.data.weeklyTrendData || []);
          }
        }
      } catch (e) {}

      try {
        const resLive = await fetch('/api/reports/live-feed');
        if (resLive.ok) {
          const jsonLive = await resLive.json();
          if (jsonLive.success) {
            const liveData = Array.isArray(jsonLive.data) ? jsonLive.data : [];
            const records: AttendanceRecord[] = liveData.map((item: unknown) => {
              const rec = item as any;
              return {
                id: rec.id,
                user_id: rec.user_id,
                full_name: rec.profiles?.full_name || 'Unknown',
                branch_name: rec.profiles?.branches?.name || 'HQ',
                type: rec.check_out_time ? 'Check-Out' : 'Check-In',
                status: rec.status || 'present',
                timestamp: rec.check_out_time || rec.check_in_time || new Date().toISOString(),
              };
            });
            setLiveFeed(records);
          }
        }
      } catch (e) {}
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  if (loading && !summary) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <Spinner size="lg" label="Loading Dashboard..." />
      </div>
    );
  }

  // Calculate percentages for the circular charts
  const presentRate = summary?.total_employees ? Math.round(((summary.present_today || 0) / summary.total_employees) * 100) : 0;
  const lateRate = summary?.total_employees ? Math.round(((summary.late_today || 0) / summary.total_employees) * 100) : 0;
  const leaveRate = summary?.total_employees ? Math.round(((summary.on_leave_today || 0) / summary.total_employees) * 100) : 0;
  const alertsCount = branches.reduce((acc, b) => acc + (b.alert_count || 0), 0);

  return (
    <div className="space-y-6 pb-12 text-slate-200">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 relative">
          <div className="w-2 h-8 bg-[#00aa44] rounded-full shadow-[0_0_10px_rgba(0,170,68,0.5)]"></div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64 hidden md:block">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Type to search..."
              className="w-full pl-9 pr-4 py-2 bg-[#021a0a] border border-[#0a3a1e] rounded-full text-sm text-slate-200 focus:outline-none focus:border-[#004417] transition-colors shadow-inner"
            />
          </div>
          <Button
            size="sm"
            className="bg-transparent border border-[#00aa44]/50 hover:bg-[#00aa44]/10 text-emerald-400 rounded-full px-5 shadow-[0_4px_15px_rgba(0,170,68,0.1)] transition-all"
            onClick={() => setShowActiveUsersModal(true)}
          >
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse mr-2" />
            {onlineUsers.length} Active Now
          </Button>
          <Button
            size="sm"
            className="bg-[#004417] hover:bg-[#006622] text-white border-none rounded-full px-5 shadow-[0_4px_15px_rgba(0,68,23,0.4)]"
            onClick={() => router.push('/admin/branches/new')}
          >
            Add branch <ChevronDown className="w-4 h-4 ml-2 opacity-70" />
          </Button>
        </div>
      </div>

      {/* 4 Metric Cards (Ultra Premium Dark Theme) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Total & Present */}
        <div className="group rounded-3xl p-6 relative overflow-hidden bg-gradient-to-br from-[#021a0a]/90 to-[#010e05]/95 backdrop-blur-xl border border-white/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_10px_40px_rgba(0,0,0,0.5)] hover:-translate-y-1 transition-all duration-300">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#00aa44]/10 rounded-full blur-3xl group-hover:bg-[#00aa44]/20 transition-all duration-500"></div>
          <div className="absolute top-0 right-0 p-4"><MoreVertical className="w-4 h-4 text-slate-600" /></div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-2 bg-[#00aa44]/10 rounded-xl ring-1 ring-[#00aa44]/20 shadow-[0_0_15px_rgba(0,170,68,0.2)]"><Users className="w-4 h-4 text-[#00aa44]" /></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Staff</span>
          </div>
          <div className="flex items-end justify-between relative z-10">
            <div>
              <div className="text-4xl font-extrabold text-white tracking-tight">{summary?.total_employees || 0}</div>
              <div className="text-[10px] text-slate-500 font-medium mt-1">Total in company</div>
            </div>
            <CircularProgress percentage={presentRate} color="#00aa44" />
          </div>
        </div>

        {/* Card 2: Late / Risks */}
        <div className="group rounded-3xl p-6 relative overflow-hidden bg-gradient-to-br from-[#021a0a]/90 to-[#010e05]/95 backdrop-blur-xl border border-white/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_10px_40px_rgba(0,0,0,0.5)] hover:-translate-y-1 transition-all duration-300">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all duration-500"></div>
          <div className="absolute top-0 right-0 p-4"><MoreVertical className="w-4 h-4 text-slate-600" /></div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-2 bg-amber-500/10 rounded-xl ring-1 ring-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]"><AlertTriangle className="w-4 h-4 text-amber-500" /></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Late Arrivals</span>
          </div>
          <div className="flex items-end justify-between relative z-10">
            <div>
              <div className="text-4xl font-extrabold text-white tracking-tight">{summary?.late_today || 0}</div>
              <div className="text-[10px] text-slate-500 font-medium mt-1">Requires review</div>
            </div>
            <CircularProgress percentage={lateRate} color="#f59e0b" />
          </div>
        </div>

        {/* Card 3: Leaves */}
        <div className="group rounded-3xl p-6 relative overflow-hidden bg-gradient-to-br from-[#021a0a]/90 to-[#010e05]/95 backdrop-blur-xl border border-white/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_10px_40px_rgba(0,0,0,0.5)] hover:-translate-y-1 transition-all duration-300">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-500"></div>
          <div className="absolute top-0 right-0 p-4"><MoreVertical className="w-4 h-4 text-slate-600" /></div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-2 bg-blue-500/10 rounded-xl ring-1 ring-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]"><Users className="w-4 h-4 text-blue-400" /></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">On Leave</span>
          </div>
          <div className="flex items-end justify-between relative z-10">
            <div>
              <div className="text-4xl font-extrabold text-white tracking-tight">{summary?.on_leave_today || 0}</div>
              <div className="text-[10px] text-slate-500 font-medium mt-1">Approved absences</div>
            </div>
            <CircularProgress percentage={leaveRate} color="#3b82f6" />
          </div>
        </div>

        {/* Card 4: Alerts */}
        <div className="group rounded-3xl p-6 relative overflow-hidden bg-gradient-to-br from-[#021a0a]/90 to-[#010e05]/95 backdrop-blur-xl border border-white/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_10px_40px_rgba(0,0,0,0.5)] hover:-translate-y-1 transition-all duration-300">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl group-hover:bg-rose-500/20 transition-all duration-500"></div>
          <div className="absolute top-0 right-0 p-4"><MoreVertical className="w-4 h-4 text-slate-600" /></div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-2 bg-rose-500/10 rounded-xl ring-1 ring-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.2)]"><Activity className="w-4 h-4 text-rose-500" /></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Branch Alerts</span>
          </div>
          <div className="flex items-end justify-between relative z-10">
            <div>
              <div className="text-4xl font-extrabold text-white tracking-tight">{alertsCount < 10 ? `0${alertsCount}` : alertsCount}</div>
              <div className="text-[10px] text-slate-500 font-medium mt-1">Action required</div>
            </div>
            <CircularProgress percentage={Math.min(100, alertsCount * 10)} color="#ef4444" />
          </div>
        </div>

      </div>

      {/* Main Line Chart */}
      <div className="bg-[#021a0a]/80 backdrop-blur-xl border border-white/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_15px_50px_rgba(0,0,0,0.6)] rounded-3xl p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#00aa44]/5 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>
        <div className="flex items-center justify-between mb-8 relative z-10">
          <div>
            <h2 className="text-lg font-extrabold text-white tracking-tight">Attendance in time</h2>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">Historical trend across all branches</p>
          </div>
          <div className="px-4 py-1.5 bg-[#010e05]/80 backdrop-blur-md border border-[#00aa44]/20 rounded-full text-[10px] font-bold text-[#00aa44] shadow-[0_0_15px_rgba(0,170,68,0.15)] uppercase tracking-wider">
            Current Year
          </div>
        </div>
        
        <div className="h-[250px] w-full relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.03} vertical={false} />
              <XAxis dataKey="name" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis 
                stroke="#475569" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false} 
                domain={[0, (dataMax: number) => Math.max(dataMax, 10)]}
                tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value} 
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(1, 14, 5, 0.9)', backdropFilter: 'blur(16px)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                itemStyle={{ color: '#fff' }}
              />
              <Line type="monotone" dataKey="expected" stroke="#004417" strokeWidth={3} dot={false} strokeOpacity={0.6} connectNulls />
              <Line type="monotone" dataKey="attendance" stroke="#00aa44" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#010e05' }} activeDot={{ r: 6, strokeWidth: 0, fill: '#00aa44' }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Branch Locations Accordion/List */}
        <div className="bg-[#021a0a]/80 backdrop-blur-xl border border-white/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_15px_50px_rgba(0,0,0,0.6)] rounded-3xl p-6 flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-4 relative z-10">Branch Status</h2>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[320px] scrollbar-thin scrollbar-thumb-white/10 relative z-10 pr-2">
            {branches.map(b => (
              <div 
                key={b.branch_id} 
                onClick={() => router.push(`/admin/branches/${b.branch_id}`)}
                className="p-4 rounded-2xl bg-[#010e05]/60 border border-white/[0.03] flex items-center justify-between cursor-pointer hover:border-[#00aa44]/40 hover:bg-[#00aa44]/5 hover:shadow-[0_0_20px_rgba(0,170,68,0.1)] transition-all duration-300 group/item"
              >
                <div>
                  <p className="text-sm font-bold text-white tracking-tight group-hover/item:text-[#00aa44] transition-colors">{b.name}</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">{b.present_today} Present / {b.total_staff} Staff</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-500 -rotate-90 group-hover/item:translate-x-1 transition-transform" />
              </div>
            ))}
          </div>
          <button 
            onClick={() => router.push('/admin/branches')}
            className="w-full py-3.5 mt-4 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-all border border-white/10 rounded-2xl hover:bg-white/5 hover:border-white/20 relative z-10"
          >
            View All Branches
          </button>
        </div>

        {/* Middle Col: Area Chart */}
        <div className="bg-[#021a0a]/80 backdrop-blur-xl border border-white/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_15px_50px_rgba(0,0,0,0.6)] rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#00aa44]/10 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
          <div className="relative z-10">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-1">Weekly Check-ins</h2>
            <p className="text-[10px] text-slate-500 font-medium">Last 10 days</p>
          </div>
          
          <div className="h-[200px] w-full mt-4 relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyTrendData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00aa44" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#00aa44" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(1, 14, 5, 0.9)', backdropFilter: 'blur(16px)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                />
                <XAxis dataKey="day" hide />
                <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax, 5)]} />
                <Area type="monotone" dataKey="val" stroke="#00aa44" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" activeDot={{ r: 6, strokeWidth: 0, fill: '#00aa44' }} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex items-center justify-between mt-4 relative z-10">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Check-ins</div>
            <div className="text-2xl font-extrabold text-white tracking-tight">{totalCheckins > 0 ? totalCheckins.toLocaleString() : '00'}</div>
          </div>
        </div>

        {/* Right Col: Feed & Notifications */}
        <div className="bg-[#021a0a]/80 backdrop-blur-xl border border-white/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_15px_50px_rgba(0,0,0,0.6)] rounded-3xl p-6 flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
          
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest">System Feed</h2>
            <MoreVertical className="w-4 h-4 text-slate-500" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 max-h-[300px] relative z-10 scrollbar-thin scrollbar-thumb-white/10 pr-2">
            {liveFeed.slice(0,4).map((feed) => (
              <div key={feed.id} className="p-4 bg-[#010e05]/60 rounded-2xl border border-white/[0.03] hover:border-white/10 hover:bg-white/[0.02] transition-all duration-300 flex items-start gap-3 group/item">
                <div className="mt-0.5 p-1.5 bg-white/5 rounded-lg group-hover/item:bg-white/10 transition-colors"><Bell className="w-3.5 h-3.5 text-slate-400" /></div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">{feed.full_name}</h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-medium leading-relaxed">
                    {feed.type} recorded at {feed.branch_name}. Status: <span className={feed.status === 'late' ? 'text-amber-400' : feed.status === 'absent' ? 'text-rose-400' : 'text-emerald-400'}>{feed.status}</span>.
                  </p>
                  <button className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-3 hover:text-white flex items-center gap-1 transition-colors">
                    View details <ChevronDown className="w-3 h-3 -rotate-90" />
                  </button>
                </div>
              </div>
            ))}
            {liveFeed.length === 0 && (
              <div className="text-xs font-medium text-slate-500 text-center p-8 bg-[#010e05]/30 rounded-2xl border border-white/5 border-dashed">No recent activity</div>
            )}
          </div>
          
          <button className="w-full py-3.5 mt-4 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-all border border-transparent rounded-2xl hover:bg-white/5 hover:border-white/10 relative z-10">
            View All Activity
          </button>
        </div>

      </div>

      {/* Active Users Modal */}
      {showActiveUsersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#010e05] border border-[#0a3a1e] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-[#0a3a1e] flex items-center justify-between bg-[#021a0a]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center relative">
                  <Wifi className="w-5 h-5 text-emerald-400" />
                  <div className="absolute top-2 right-2 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Online Now</h3>
                  <p className="text-xs text-slate-400">{onlineUsers.length} users active</p>
                </div>
              </div>
              <button onClick={() => setShowActiveUsersModal(false)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {onlineUsers.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">No users currently active.</div>
              ) : (
                onlineUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#0a3a1e] text-emerald-400 font-bold text-xs rounded-full flex items-center justify-center shrink-0">
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-200">{u.full_name}</p>
                        <p className="text-[10px] text-slate-500 capitalize">{u.role.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]" title="Online" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
