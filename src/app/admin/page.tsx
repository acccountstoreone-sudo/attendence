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
  name?: string;
  branch_name?: string;
  code?: string;
  branch_code?: string;
  address?: string;
  total_staff?: number;
  present_today?: number;
  late_today?: number;
  absent_today?: number;
  alert_count?: number;
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
          className="text-slate-700"
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
      <span className="absolute text-[10px] font-bold text-slate-700">{percentage}%</span>
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
  
  const [searchQuery, setSearchQuery] = useState(''); // APP-03 fix: search state

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
                branch_name: rec.branches?.name || rec.profiles?.branches?.name || 'HQ',
                type: rec.check_out_time ? 'Check-Out' : 'Check-In',
                status: rec.status || 'present',
                timestamp: rec.check_out_time || rec.check_in_time || new Date().toISOString(),
              };
            }).sort((a: AttendanceRecord, b: AttendanceRecord) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
    <div className="space-y-6 pb-12 text-slate-900">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 relative">
          <div className="w-2 h-8 bg-[#1dbf73] rounded-full shadow-sm"></div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64 hidden md:block">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search branches or employees..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  router.push(`/admin/employees?search=${encodeURIComponent(searchQuery.trim())}`);
                }
              }}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm text-slate-700 placeholder:text-slate-900 focus:outline-none focus:border-[#1dbf73] transition-colors shadow-inner"
            />
          </div>
          <Button
            size="sm"
            className="bg-[#1dbf73] hover:bg-[#16965a] text-slate-900 border-none rounded-full px-5 shadow-sm"
            onClick={() => router.push('/admin/branches/new')}
          >
            Add branch <ChevronDown className="w-4 h-4 ml-2 opacity-70" />
          </Button>
        </div>
      </div>

      {/* 4 Metric Cards (Ultra Premium Dark Theme) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Total & Present */}
        <div 
          onClick={() => router.push('/admin/employees')}
          className="group rounded-3xl p-6 relative overflow-hidden bg-white border border-slate-200 shadow-sm hover:-translate-y-1 hover:border-[#1dbf73]/50 hover:shadow-md cursor-pointer transition-all duration-300"
          title="Click to manage all staff and present records"
        >
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#1dbf73]/10 rounded-full blur-3xl group-hover:bg-[#1dbf73]/20 transition-all duration-500"></div>
          <div className="absolute top-0 right-0 p-4"><MoreVertical className="w-4 h-4 text-slate-400 group-hover:text-slate-900" /></div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-2 bg-[#1dbf73]/10 rounded-xl ring-1 ring-[#1dbf73]/20 shadow-[0_0_15px_rgba(0,170,68,0.2)]"><Users className="w-4 h-4 text-[#1dbf73]" /></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-900 group-hover:text-slate-900 transition-colors">Total Staff</span>
          </div>
          <div className="flex items-end justify-between relative z-10">
            <div>
              <div className="text-4xl font-extrabold text-slate-900 tracking-tight group-hover:text-[#1dbf73] transition-colors">{summary?.total_employees || 0}</div>
              <div className="text-[10px] text-slate-500 font-medium mt-1">Total in company &rarr;</div>
            </div>
            <CircularProgress percentage={presentRate} color="#1dbf73" />
          </div>
        </div>

        {/* Card 2: Late / Risks */}
        <div 
          onClick={() => router.push('/admin/attendance?tab=all&status=late')}
          className="group rounded-3xl p-6 relative overflow-hidden bg-white border border-slate-200 shadow-sm hover:-translate-y-1 hover:border-amber-500/50 hover:shadow-md cursor-pointer transition-all duration-300"
          title="Click to review late arrival records"
        >
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/25 transition-all duration-500"></div>
          <div className="absolute top-0 right-0 p-4"><MoreVertical className="w-4 h-4 text-slate-400 group-hover:text-slate-900" /></div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-2 bg-amber-500/10 rounded-xl ring-1 ring-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]"><AlertTriangle className="w-4 h-4 text-amber-500" /></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-900 group-hover:text-slate-900 transition-colors">Late Arrivals</span>
          </div>
          <div className="flex items-end justify-between relative z-10">
            <div>
              <div className="text-4xl font-extrabold text-slate-900 tracking-tight group-hover:text-amber-600 transition-colors">{summary?.late_today || 0}</div>
              <div className="text-[10px] text-slate-500 font-medium mt-1">Requires review &rarr;</div>
            </div>
            <CircularProgress percentage={lateRate} color="#f59e0b" />
          </div>
        </div>

        {/* Card 3: Leaves */}
        <div 
          onClick={() => router.push('/admin/leaves')}
          className="group rounded-3xl p-6 relative overflow-hidden bg-white border border-slate-200 shadow-sm hover:-translate-y-1 hover:border-blue-500/50 hover:shadow-md cursor-pointer transition-all duration-300"
          title="Click to view staff on leave"
        >
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/25 transition-all duration-500"></div>
          <div className="absolute top-0 right-0 p-4"><MoreVertical className="w-4 h-4 text-slate-400 group-hover:text-slate-900" /></div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-2 bg-blue-500/10 rounded-xl ring-1 ring-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]"><Users className="w-4 h-4 text-blue-500" /></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-900 group-hover:text-slate-900 transition-colors">On Leave</span>
          </div>
          <div className="flex items-end justify-between relative z-10">
            <div>
              <div className="text-4xl font-extrabold text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">{summary?.on_leave_today || 0}</div>
              <div className="text-[10px] text-slate-500 font-medium mt-1">Approved absences &rarr;</div>
            </div>
            <CircularProgress percentage={leaveRate} color="#3b82f6" />
          </div>
        </div>

        {/* Card 4: Alerts */}
        <div 
          onClick={() => router.push('/admin/corrections')}
          className="group rounded-3xl p-6 relative overflow-hidden bg-white border border-slate-200 shadow-sm hover:-translate-y-1 hover:border-rose-500/50 hover:shadow-md cursor-pointer transition-all duration-300"
          title="Click to resolve branch alerts and corrections"
        >
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl group-hover:bg-rose-500/25 transition-all duration-500"></div>
          <div className="absolute top-0 right-0 p-4"><MoreVertical className="w-4 h-4 text-slate-400 group-hover:text-slate-900" /></div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-2 bg-rose-500/10 rounded-xl ring-1 ring-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.2)]"><Activity className="w-4 h-4 text-rose-500" /></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-900 group-hover:text-slate-900 transition-colors">Branch Alerts</span>
          </div>
          <div className="flex items-end justify-between relative z-10">
            <div>
              <div className="text-4xl font-extrabold text-slate-900 tracking-tight group-hover:text-rose-600 transition-colors">{alertsCount < 10 ? `0${alertsCount}` : alertsCount}</div>
              <div className="text-[10px] text-slate-500 font-medium mt-1">Action required &rarr;</div>
            </div>
            <CircularProgress percentage={Math.min(100, alertsCount * 10)} color="#ef4444" />
          </div>
        </div>

      </div>

      {/* Main Line Chart */}
      <div 
        onClick={() => router.push('/admin/analytics')}
        className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 relative overflow-hidden group cursor-pointer hover:border-[#1dbf73]/50 hover:shadow-md transition-all duration-300"
        title="Click to open full Attendance Analytics page"
      >
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#1dbf73]/5 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>
        <div className="flex items-center justify-between mb-8 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight group-hover:text-[#1dbf73] transition-colors">Attendance in time</h2>
              <span className="text-[10px] text-[#1dbf73] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">View Full Analytics &rarr;</span>
            </div>
            <p className="text-[11px] font-medium text-slate-900 mt-0.5">Historical trend across all branches</p>
          </div>
            <div className="px-4 py-1.5 bg-white backdrop-blur-md border border-[#1dbf73]/20 rounded-full text-[10px] font-bold text-[#1dbf73] shadow-[0_0_15px_rgba(0,170,68,0.15)] uppercase tracking-wider">
              Last 30 Days
            </div>
          </div>
        
        <div className="h-[250px] w-full relative z-10">
          {monthlyData.every(m => !m.attendance || m.attendance === 0) ? (
            <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-slate-200 border-dashed p-6 text-center">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">No Attendance Plotted For {new Date().getFullYear()}</p>
              <p className="text-[11px] text-slate-500 font-medium mt-1.5 max-w-md">
                Historical attendance curves will dynamically render here as daily check-ins accumulate or when demo trends are seeded.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.8} vertical={false} />
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
                  contentStyle={{ backgroundColor: '#ffffff', backdropFilter: 'blur(16px)', borderColor: '#e2e8f0', borderRadius: '12px', color: '#0f172a', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                  itemStyle={{ color: '#0f172a' }}
                />
                <Line type="monotone" dataKey="expected" stroke="#1dbf73" strokeWidth={3} dot={false} strokeOpacity={0.4} connectNulls />
                <Line type="monotone" dataKey="attendance" stroke="#1dbf73" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }} activeDot={{ r: 6, strokeWidth: 0, fill: '#1dbf73' }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Branch Locations Accordion/List */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#1dbf73]/5 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 relative z-10">Branch Status</h2>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[320px] scrollbar-thin scrollbar-thumb-slate-300 relative z-10 pr-2">
            {branches.map(b => {
              const branchName = b.name || b.branch_name || 'Unnamed Branch';
              const presentCount = b.present_today || 0;
              const staffCount = b.total_staff || 0;
              return (
              <div 
                key={b.branch_id} 
                onClick={() => router.push(`/admin/branches/${b.branch_id}`)}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between cursor-pointer hover:border-[#1dbf73]/40 hover:bg-[#1dbf73]/5 hover:shadow-sm transition-all duration-300 group/item"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900 tracking-tight group-hover/item:text-[#1dbf73] transition-colors">{branchName}</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">{presentCount} Present / {staffCount} Staff</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-500 -rotate-90 group-hover/item:translate-x-1 transition-transform" />
              </div>
              );
            })}
          </div>
          <button 
            onClick={() => router.push('/admin/branches')}
            className="w-full py-3.5 mt-4 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-all border border-slate-200 rounded-2xl hover:bg-slate-100 hover:border-slate-200 relative z-10"
          >
            View All Branches
          </button>
        </div>

        {/* Middle Col: Area Chart */}
        <div 
          onClick={() => router.push('/admin/attendance?tab=all')}
          className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group cursor-pointer hover:border-[#1dbf73]/50 hover:shadow-md transition-all duration-300"
          title="Click to view all attendance check-ins"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#1dbf73]/10 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 group-hover:text-slate-900 transition-colors">Weekly Check-ins</h2>
              <p className="text-[10px] text-slate-500 font-medium">Last 10 days</p>
            </div>
            <span className="text-[10px] text-[#1dbf73] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">View Grid &rarr;</span>
          </div>
          
          <div className="h-[200px] w-full mt-4 relative z-10">
            {totalCheckins === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-slate-200 border-dashed p-4 text-center">
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">No Check-ins (Last 10 Days)</p>
                <p className="text-[10px] text-slate-500 font-medium mt-1">
                  Run the SQL demo seed or record check-ins to view dynamic trend area.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyTrendData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1dbf73" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#1dbf73" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', backdropFilter: 'blur(16px)', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                  />
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax, 5)]} />
                  <Area type="monotone" dataKey="val" stroke="#1dbf73" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" activeDot={{ r: 6, strokeWidth: 0, fill: '#1dbf73' }} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          
          <div className="flex items-center justify-between mt-4 relative z-10">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-900">Total Check-ins</div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight group-hover:text-[#1dbf73] transition-colors">{totalCheckins > 0 ? totalCheckins.toLocaleString() : '00'}</div>
          </div>
        </div>

        {/* Right Col: Feed & Notifications */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
          
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">System Feed</h2>
            <MoreVertical className="w-4 h-4 text-slate-500" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 max-h-[300px] relative z-10 scrollbar-thin scrollbar-thumb-slate-300 pr-2">
            {liveFeed.slice(0,4).map((feed) => (
              <div 
                key={feed.id} 
                onClick={() => router.push(`/admin/attendance?search=${encodeURIComponent(feed.full_name || '')}&tab=all`)}
                className="p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:border-[#1dbf73]/40 hover:bg-[#1dbf73]/5 cursor-pointer transition-all duration-300 flex items-start gap-3 group/item"
                title={`Click to view check-in details for ${feed.full_name || 'employee'}`}
              >
                <div className="mt-0.5 p-1.5 bg-slate-100 rounded-lg group-hover/item:bg-[#1dbf73]/10 transition-colors"><Bell className="w-3.5 h-3.5 text-slate-900 group-hover/item:text-[#1dbf73]" /></div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight group-hover/item:text-[#1dbf73] transition-colors">{feed.full_name || 'Unknown Employee'}</h3>
                  <p className="text-[10px] text-slate-900 mt-1 font-medium leading-relaxed">
                    {feed.type} recorded at {feed.branch_name}. Status: <span className={feed.status === 'late' ? 'text-amber-500 font-bold' : feed.status === 'absent' ? 'text-rose-500 font-bold' : 'text-[#1dbf73] font-bold'}>{feed.status}</span>.
                  </p>
                  <button 
                    onClick={(e) => { e.stopPropagation(); router.push(`/admin/attendance?search=${encodeURIComponent(feed.full_name || '')}&tab=all`); }}
                    className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-3 hover:text-[#1dbf73] flex items-center gap-1 transition-colors"
                  >
                    View details <ChevronDown className="w-3 h-3 -rotate-90" />
                  </button>
                </div>
              </div>
            ))}
            {liveFeed.length === 0 && (
              <div className="text-xs font-medium text-slate-500 text-center p-8 bg-slate-50/50 rounded-2xl border border-slate-200 border-dashed">No recent activity</div>
            )}
          </div>
          
          <button
            className="w-full py-3.5 mt-4 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-all border border-transparent rounded-2xl hover:bg-slate-100 hover:border-slate-200 relative z-10"
            onClick={() => router.push('/admin/reports')}
          >
            View All Activity
          </button>
        </div>

      </div>
    </div>
  );
}
