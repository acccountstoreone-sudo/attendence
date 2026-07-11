'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState('');

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
            <p className="text-sm text-slate-400">{data?.month_label ?? 'Loading…'} — Powered by database analytics, no AI cost.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button id="refresh-analytics-btn" variant="secondary" onClick={load} disabled={loading}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : !data ? (
        <Card className="p-12 text-center"><p className="text-slate-400">Failed to load analytics.</p></Card>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Chronic Latecomers', value: data.chronic_late.length, icon: <AlertTriangle className="w-5 h-5 text-amber-400" />, color: 'border-amber-500/30 bg-amber-500/5' },
              { label: 'Absent Today', value: data.absent_today.length, icon: <UserX className="w-5 h-5 text-red-400" />, color: 'border-red-500/30 bg-red-500/5' },
              { label: 'Branches Ranked', value: data.branch_leaderboard.length, icon: <Trophy className="w-5 h-5 text-[#1dbf73]" />, color: 'border-emerald-500/30 bg-[#1dbf73]/5' },
              { label: 'Top Punctuality', value: data.branch_leaderboard[0] ? `${data.branch_leaderboard[0].punctuality_rate}%` : '—', icon: <TrendingUp className="w-5 h-5 text-indigo-400" />, color: 'border-indigo-500/30 bg-indigo-500/5' },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} custom={i} variants={cardVariant} initial="hidden" animate="visible">
                <Card className={`p-4 border ${kpi.color}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-slate-400">{kpi.label}</p>
                    {kpi.icon}
                  </div>
                  <p className="text-3xl font-bold text-slate-900">{kpi.value}</p>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Month-over-Month Trend Chart */}
          <motion.div custom={4} variants={cardVariant} initial="hidden" animate="visible">
            <Card className="p-5 bg-slate-800/60">
              <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" /> 6-Month Attendance Trend
              </h2>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.monthly_trend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0a3a1e" />
                  <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#012410', border: '1px solid #0a3a1e', borderRadius: 8 }} labelStyle={{ color: '#F8FAFC' }} />
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
              <Card className="p-5 bg-slate-800/60">
                <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#1dbf73]" /> Branch Leaderboard — {data.month_label}
                </h2>
                {data.branch_leaderboard.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-6">No branch data for this period.</p>
                ) : (
                  <div className="space-y-2">
                    {data.branch_leaderboard.map((b, idx) => (
                      <div key={b.branch_id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-700/40">
                        <span className={`text-sm font-bold w-6 text-center ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-orange-400' : 'text-slate-500'}`}>
                          #{idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-900 text-sm font-medium truncate">{b.branch_name}</p>
                          <p className="text-slate-500 text-xs">{b.total} records · {b.late} late · {b.absent} absent</p>
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
              <Card className="p-5 bg-slate-800/60">
                <h2 className="text-base font-semibold text-slate-900 mb-1 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Chronic Latecomers
                </h2>
                <p className="text-xs text-slate-500 mb-4">Employees late 3+ times this month</p>
                {data.chronic_late.length === 0 ? (
                  <p className="text-[#1dbf73] text-sm text-center py-6">🎉 No chronic latecomers this month!</p>
                ) : (
                  <div className="space-y-2">
                    {data.chronic_late.map((emp) => (
                      <div key={emp.employee_id} className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <div>
                          <p className="text-slate-900 text-sm font-medium">{emp.name}</p>
                          <p className="text-slate-400 text-xs">{emp.branch}</p>
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
            <Card className="p-5 bg-slate-800/60">
              <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <UserX className="w-4 h-4 text-red-400" /> Not Checked In Today ({data.absent_today.length})
              </h2>
              {data.absent_today.length === 0 ? (
                <p className="text-[#1dbf73] text-sm text-center py-4">✅ All active employees have checked in today!</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {data.absent_today.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                      <UserX className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-slate-900 text-sm font-medium truncate">{e.full_name}</p>
                        <p className="text-slate-400 text-xs">{e.branch}{e.employee_id ? ` · ${e.employee_id}` : ''}</p>
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

