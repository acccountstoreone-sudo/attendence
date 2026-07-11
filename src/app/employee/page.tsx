'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Clock, Calendar, ShieldCheck, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ full_name: string; branch_name: string } | null>(null);
  const [todayRecord, setTodayRecord] = useState<{ check_in_time?: string; check_out_time?: string; status?: string; approval_status?: string; overtime_minutes?: number } | null>(null);
  // B6 fix: Store real leave balance
  const [leaveBalance, setLeaveBalance] = useState<{ available: number; total: number } | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, full_name, role, branch_id, branches!profiles_branch_id_fkey(name)')
        .eq('id', user.id)
        .single();

      if (prof) {
        setProfile({
          full_name: prof.full_name,
          branch_name: (prof as unknown as { branches?: { name?: string } }).branches?.name || 'Anchor Store',
        });
      }

      // B5 fix: /api/attendance/today returns an object, not an array
      try {
        const res = await fetch('/api/attendance/today');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && json.data.checked_in) {
            setTodayRecord(json.data);
          }
        }
      } catch {
        // Non-critical: dashboard still renders without today's status
      }

      // B6 fix: Fetch real leave balance for current year
      const currentYear = new Date().getFullYear();
      const { data: balances } = await supabase
        .from('leave_balances')
        .select('allocated_days, used_days')
        .eq('user_id', user.id)
        .eq('year', currentYear);

      if (balances && balances.length > 0) {
        const totalAllocated = balances.reduce((acc, b) => acc + (b.allocated_days || 0), 0);
        const totalUsed = balances.reduce((acc, b) => acc + (b.used_days || 0), 0);
        setLeaveBalance({ available: Math.max(0, totalAllocated - totalUsed), total: totalAllocated });
      } else {
        setLeaveBalance({ available: 0, total: 0 });
      }

      setLoading(false);
    }
    init();
  }, [supabase]);

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <Spinner size="lg" label="Loading Employee Dashboard..." />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Welcome Banner */}
      <div className="bg-white p-8 rounded-3xl border border-[#1dbf73]/20 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#1dbf73_1px,transparent_1px)] [background-size:40px_40px] mix-blend-overlay z-0" />
        <div className="relative z-10">
          <div className="flex items-center space-x-2 text-[#1dbf73] text-xs font-bold uppercase tracking-wider">
            <MapPin className="w-4 h-4" />
            <span>{profile?.branch_name}</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">
            Welcome, {profile?.full_name || 'Staff Member'}!
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Biometric facial verification and GPS geofenced attendance tracking portal.
          </p>
        </div>

        <Button
          size="lg"
          variant="primary"
          icon={<Clock className="w-5 h-5 text-[#ffffff]" />}
          className="relative z-10 shadow-xl shadow-[#1dbf73]/20 bg-[#1dbf73] text-[#ffffff] hover:bg-[#16965a] font-bold border-none disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={() => router.push('/employee/check-in')}
          disabled={!!(todayRecord?.check_in_time && todayRecord.check_out_time)}
        >
          {todayRecord?.check_in_time && todayRecord.check_out_time
            ? 'Shift Complete ✓'
            : todayRecord?.check_in_time && !todayRecord.check_out_time
            ? 'Check Out Now'
            : 'Biometric Check-In'}
        </Button>
      </div>

      {/* Today's Shift Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-slate-200 col-span-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-[#1dbf73]" />
                <h3 className="text-lg font-bold text-slate-900">Today&apos;s Attendance Status</h3>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  status={todayRecord?.status === 'late' ? 'late' : todayRecord?.status === 'present' ? 'present' : 'pending'}
                />
                {todayRecord?.approval_status === 'pending' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold animate-pulse">
                    ⏳ Awaiting BM Approval
                  </span>
                )}
                {todayRecord?.approval_status === 'approved' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1dbf73]/15 border border-emerald-500/30 text-[#1dbf73] text-xs font-bold">
                    ✅ Approved
                  </span>
                )}
                {todayRecord?.approval_status === 'rejected' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold">
                    ❌ Rejected by BM
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 text-center">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <p className="text-xs font-bold uppercase text-slate-400 mb-1">Check-In Timestamp</p>
                <p className="text-xl font-extrabold text-[#1dbf73]">
                  {todayRecord?.check_in_time
                    ? new Date(todayRecord.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <p className="text-xs font-bold uppercase text-slate-400 mb-1">Check-Out Timestamp</p>
                <p className="text-xl font-extrabold text-[#1dbf73]/70">
                  {todayRecord?.check_out_time
                    ? new Date(todayRecord.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </p>
              </div>

              {todayRecord?.overtime_minutes && todayRecord.overtime_minutes > 0 ? (
                <div className="col-span-2 bg-amber-950/30 p-3 rounded-2xl border border-amber-800/30">
                  <p className="text-xs font-bold uppercase text-amber-400/70 mb-0.5">Overtime</p>
                  <p className="text-lg font-extrabold text-amber-400">
                    {Math.floor(todayRecord.overtime_minutes / 60) > 0
                      ? `${Math.floor(todayRecord.overtime_minutes / 60)}h ${todayRecord.overtime_minutes % 60}m`
                      : `${todayRecord.overtime_minutes}m`}
                  </p>
                </div>
              ) : null}
            </div>
        </Card>

        {/* Leave Balance & Quick Action */}
        <Card className="bg-white border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-[#1dbf73] mb-2">
              <Calendar className="w-5 h-5" />
              <h3 className="text-lg font-bold text-slate-900">Leave Balance</h3>
            </div>
            <p className="text-xs text-slate-400">Annual Paid Leave Allocation</p>
            {leaveBalance?.total === 0 ? (
              <div className="mt-4 p-3 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                No leave allocations active.
              </div>
            ) : (
              <div className="mt-4 flex items-baseline space-x-2">
                <span className="text-4xl font-extrabold text-[#1dbf73]">{leaveBalance?.available || 0}</span>
                <span className="text-sm font-bold text-slate-500">/ {leaveBalance?.total || 0} Days Available</span>
              </div>
            )}
          </div>

          {/* Fix: Correct route to /employee/leaves */}
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-6 border-[#1dbf73]/30 text-[#1dbf73] hover:bg-[#1dbf73]/10"
            onClick={() => router.push('/employee/leaves')}
          >
            Request Leave
          </Button>
        </Card>
      </div>
    </div>
  );
}

