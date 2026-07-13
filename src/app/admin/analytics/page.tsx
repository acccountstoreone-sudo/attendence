'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, AlertTriangle, Trophy, UserX, RefreshCcw, Filter,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface ChronicEmployee {
  employee_id: string;
  name: string;
  branch: string;
  count: number;
}

interface BranchRank {
  branch_id: string;
  branch_name: string;
  branch_code: string;
  total: number;
  late: number;
  absent: number;
  punctuality_rate: number;
}

interface MonthTrend {
  month: string;
  present: number;
  late: number;
  absent: number;
}

interface AbsentEmployee {
  id: string;
  full_name: string;
  employee_id?: string;
  branch: string;
}

interface AnalyticsData {
  chronic_late: ChronicEmployee[];
  branch_leaderboard: BranchRank[];
  monthly_trend: MonthTrend[];
  absent_today: AbsentEmployee[];
  month_label: string;
}

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    fetch('/api/branches')
      .then(res => res.json())
      .then(json => {
        if (json.success) setBranches(json.data);
      })
      .catch(console.error);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const url = branchId ? `/api/reports/analytics?branch_id=${branchId}` : '/api/reports/analytics';
    const res = await fetch(url);
    const json = await res.json();
    if (json.success) setData(json.data);
    setLoading(false);
  }, [branchId]);

  useEffect(() => { setTimeout(() => load(), 0); }, [load]);

  const cardVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07 } }),
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-7 h-7 text-indigo-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Attendance Analytics</h1>
            <p className="text-sm text-slate-600">{data?.month_label ?? 'Loading…'} — Powered by database analytics, no AI cost.</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <Button id="refresh-analytics-btn" variant="secondary" onClick={load} disabled={loading}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : !data ? (
        <Card className="p-12 text-center"><p className="text-slate-600">Failed to load analytics.</p></Card>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Chronic Latecomers', value: data.chronic_late.length, icon: <AlertTriangle className="w-5 h-5 text-amber-400" />, color: 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60', href: '/admin/attendance?status=late&tab=all', title: 'Click to view late records' },
              { label: 'Absent Today', value: data.absent_today.length, icon: <UserX className="w-5 h-5 text-red-400" />, color: 'border-red-500/30 bg-red-500/5 hover:border-red-500/60', href: '/admin/attendance?status=absent&tab=all', title: 'Click to view absent records' },
              { label: 'Branches Ranked', value: data.branch_leaderboard.length, icon: <Trophy className="w-5 h-5 text-[#1dbf73]" />, color: 'border-emerald-500/30 bg-[#1dbf73]/5 hover:border-[#1dbf73]/60', href: '/admin/branches', title: 'Click to manage branches' },
              { label: 'Top Punctuality', value: data.branch_leaderboard[0] ? `${data.branch_leaderboard[0].punctuality_rate}%` : '—', icon: <TrendingUp className="w-5 h-5 text-indigo-400" />, color: 'border-indigo-500/30 bg-indigo-500/5 hover:border-indigo-500/60', href: data.branch_leaderboard[0] ? `/admin/branches/${data.branch_leaderboard[0].branch_id}` : '/admin/branches', title: 'Click to view top branch details' },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} custom={i} variants={cardVariant} initial="hidden" animate="visible">
                <Card 
                  onClick={() => router.push(kpi.href)}
                  className={`p-4 border ${kpi.color} cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all duration-300 group`}
                  title={kpi.title}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-slate-600 group-hover:text-slate-900 font-medium transition-colors">{kpi.label}</p>
                    {kpi.icon}
                  </div>
                  <div className="flex items-end justify-between">
                    <p className="text-3xl font-bold text-slate-900 group-hover:scale-105 transition-transform">{kpi.value}</p>
                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-700 transition-colors">View &rarr;</span>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Month-over-Month Trend Chart */}
          <motion.div custom={4} variants={cardVariant} initial="hidden" animate="visible">
            <Card 
              onClick={() => router.push('/admin/reports')}
              className="p-5 bg-slate-50/60 border border-slate-200/80 hover:border-indigo-500/50 hover:shadow-md cursor-pointer transition-all duration-300 group"
              title="Click to open full Reports and Trends section"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
                  <TrendingUp className="w-4 h-4 text-indigo-400" /> 6-Month Attendance Trend
                </h2>
                <span className="text-[11px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">View Full Reports &rarr;</span>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.monthly_trend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#f1f5f9', border: '1px solid #f1f5f9', borderRadius: 8 }} labelStyle={{ color: '#F8FAFC' }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
                  <Line type="monotone" dataKey="present" stroke="#22C55E" strokeWidth={2} dot={false} name="Present" />
                  <Line type="monotone" dataKey="late" stroke="#F59E0B" strokeWidth={2} dot={false} name="Late" />
                  <Line type="monotone" dataKey="absent" stroke="#EF4444" strokeWidth={2} dot={false} name="Absent" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Branch Leaderboard */}
            <motion.div custom={5} variants={cardVariant} initial="hidden" animate="visible">
              <Card 
                onClick={() => router.push('/admin/branches')}
                className="p-5 bg-slate-50/60 border border-slate-200/80 hover:border-[#1dbf73]/50 hover:shadow-md transition-all duration-300 group cursor-pointer"
                title="Click to manage all branches"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 group-hover:text-[#1dbf73] transition-colors">
                    <Trophy className="w-4 h-4 text-[#1dbf73]" /> Branch Leaderboard — {data.month_label}
                  </h2>
                  <span className="text-[11px] font-bold text-[#1dbf73] opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">Manage Branches &rarr;</span>
                </div>
                {data.branch_leaderboard.length === 0 ? (
                  <p className="text-slate-600 text-sm text-center py-6">No branch data for this period.</p>
                ) : (
                  <div className="space-y-2">
                    {data.branch_leaderboard.map((b, idx) => (
                      <div 
                        key={b.branch_id} 
                        onClick={(e) => { e.stopPropagation(); router.push(`/admin/branches/${b.branch_id}`); }}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-100/60 border border-transparent hover:border-[#1dbf73]/40 hover:bg-[#1dbf73]/10 cursor-pointer transition-all duration-200 group/item"
                        title={`Click to open ${b.branch_name} details page`}
                      >
                        <span className={`text-sm font-bold w-6 text-center ${idx === 0 ? 'text-amber-500 font-extrabold' : idx === 1 ? 'text-slate-600 font-extrabold' : idx === 2 ? 'text-orange-500 font-extrabold' : 'text-slate-500'}`}>
                          #{idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-900 text-sm font-bold truncate group-hover/item:text-[#1dbf73] transition-colors">{b.branch_name}</p>
                          <p className="text-slate-500 text-xs mt-0.5">{b.total} records · {b.late} late · {b.absent} absent</p>
                        </div>
                        <Badge variant={b.punctuality_rate >= 90 ? 'success' : b.punctuality_rate >= 70 ? 'warning' : 'error'}>
                          {b.punctuality_rate}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>

            {/* Chronic Latecomers */}
            <motion.div custom={6} variants={cardVariant} initial="hidden" animate="visible">
              <Card 
                onClick={() => router.push('/admin/attendance?status=late&tab=all')}
                className="p-5 bg-slate-50/60 border border-slate-200/80 hover:border-amber-500/50 hover:shadow-md transition-all duration-300 group cursor-pointer"
                title="Click to review all late arrival records"
              >
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 group-hover:text-amber-600 transition-colors">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Chronic Latecomers
                  </h2>
                  <span className="text-[11px] font-bold text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">View Late Logs &rarr;</span>
                </div>
                <p className="text-xs text-slate-500 mb-4">Employees late 3+ times this month</p>
                {data.chronic_late.length === 0 ? (
                  <p className="text-[#1dbf73] text-sm text-center py-6">🎉 No chronic latecomers this month!</p>
                ) : (
                  <div className="space-y-2">
                    {data.chronic_late.map((emp) => (
                      <div 
                        key={emp.employee_id} 
                        onClick={(e) => { e.stopPropagation(); router.push(`/admin/attendance?search=${encodeURIComponent(emp.name)}&tab=all`); }}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 cursor-pointer transition-all duration-200 group/item"
                        title={`Click to view check-in logs for ${emp.name}`}
                      >
                        <div>
                          <p className="text-slate-900 text-sm font-bold group-hover/item:text-amber-700 transition-colors">{emp.name}</p>
                          <p className="text-slate-600 text-xs mt-0.5">{emp.branch}</p>
                        </div>
                        <Badge variant="warning">{emp.count}× late</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          </div>

          {/* Absent Today */}
          <motion.div custom={7} variants={cardVariant} initial="hidden" animate="visible">
            <Card 
              onClick={() => router.push('/admin/attendance?status=absent&tab=all')}
              className="p-5 bg-slate-50/60 border border-slate-200/80 hover:border-red-500/50 hover:shadow-md transition-all duration-300 group cursor-pointer"
              title="Click to view all absent records today"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 group-hover:text-red-600 transition-colors">
                  <UserX className="w-4 h-4 text-red-500" /> Not Checked In Today ({data.absent_today.length})
                </h2>
                <span className="text-[11px] font-bold text-red-600 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">View Absent Logs &rarr;</span>
              </div>
              {data.absent_today.length === 0 ? (
                <p className="text-[#1dbf73] text-sm text-center py-4 font-medium">✅ All active employees have checked in today!</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {data.absent_today.map((e) => (
                    <div 
                      key={e.id} 
                      onClick={(ev) => { ev.stopPropagation(); router.push(`/admin/attendance?search=${encodeURIComponent(e.full_name)}&tab=all`); }}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 cursor-pointer transition-all duration-200 group/item"
                      title={`Click to check attendance logs for ${e.full_name}`}
                    >
                      <div className="p-1.5 bg-red-500/10 rounded-lg group-hover/item:bg-red-500/20 transition-colors"><UserX className="w-4 h-4 text-red-500 flex-shrink-0" /></div>
                      <div className="min-w-0">
                        <p className="text-slate-900 text-sm font-bold truncate group-hover/item:text-red-700 transition-colors">{e.full_name}</p>
                        <p className="text-slate-600 text-xs mt-0.5">{e.branch}{e.employee_id ? ` · ${e.employee_id}` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        </>
      )}
    </div>
  );
}

