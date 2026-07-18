'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Clock, Calendar, ShieldCheck, MapPin, MessageSquare, User, Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ full_name: string; branch_name: string; photo_url?: string; whatsapp_number?: string; phone?: string } | null>(null);
  const [todayRecord, setTodayRecord] = useState<{ check_in_time?: string; check_out_time?: string; status?: string; approval_status?: string; overtime_minutes?: number; is_holiday_duty?: boolean } | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<{ type: string; available: number; total: number }[]>([]);
  const [liveOvertimeMinutes, setLiveOvertimeMinutes] = useState(0);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, full_name, role, branch_id, photo_url, phone, whatsapp_number, branches!profiles_branch_id_fkey(name)')
        .eq('id', user.id)
        .single();

      if (prof) {
        setProfile({
          full_name: prof.full_name,
          branch_name: (prof as unknown as { branches?: { name?: string } }).branches?.name || 'Anchor Store',
          photo_url: prof.photo_url || undefined,
          whatsapp_number: prof.whatsapp_number || undefined,
          phone: prof.phone || undefined,
        });
      }

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

      const currentYear = new Date().getFullYear();
      const { data: balances } = await supabase
        .from('leave_balances')
        .select('allocated_days, used_days, leave_types(name)')
        .eq('user_id', user.id)
        .eq('year', currentYear);

      if (balances && balances.length > 0) {
        const mappedBalances = balances.map((b: any) => ({
          type: b.leave_types?.name || 'Leave',
          available: Math.max(0, (b.allocated_days || 0) - (b.used_days || 0)),
          total: b.allocated_days || 0
        }));
        setLeaveBalances(mappedBalances);
      } else {
        setLeaveBalances([]);
      }

      setLoading(false);
    }
    init();
  }, [supabase]);

  // Live Overtime Counter Effect
  useEffect(() => {
    if (!todayRecord || !todayRecord.check_in_time || todayRecord.check_out_time) {
      setLiveOvertimeMinutes(0);
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      let otMinutes = 0;

      if (todayRecord.is_holiday_duty) {
        // Entire shift is overtime
        const checkInTime = new Date(todayRecord.check_in_time!);
        otMinutes = Math.floor((now.getTime() - checkInTime.getTime()) / 60000);
      } else {
        // Calculate based on default 18:00:00 end time (can be fetched dynamically if needed)
        const checkInDate = new Date(todayRecord.check_in_time!);
        const shiftEnd = new Date(checkInDate);
        shiftEnd.setHours(18, 0, 0, 0); // 6:00 PM Default end time

        if (now > shiftEnd) {
          otMinutes = Math.floor((now.getTime() - shiftEnd.getTime()) / 60000);
        }
      }

      setLiveOvertimeMinutes(otMinutes > 0 ? otMinutes : 0);
    }, 60000); // update every minute

    // Initial calculation
    const now = new Date();
    let initialOt = 0;
    if (todayRecord.is_holiday_duty) {
      initialOt = Math.floor((now.getTime() - new Date(todayRecord.check_in_time!).getTime()) / 60000);
    } else {
      const shiftEnd = new Date(todayRecord.check_in_time!);
      shiftEnd.setHours(18, 0, 0, 0);
      if (now > shiftEnd) initialOt = Math.floor((now.getTime() - shiftEnd.getTime()) / 60000);
    }
    setLiveOvertimeMinutes(initialOt > 0 ? initialOt : 0);

    return () => clearInterval(interval);
  }, [todayRecord]);

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
        <div className="relative z-10 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-[#1dbf73] overflow-hidden flex items-center justify-center shrink-0 shadow-md">
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-slate-400" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#1dbf73] bg-[#1dbf73]/10 px-2.5 py-1 rounded-md uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5" />
                <span>{profile?.branch_name || 'Assigned Branch'}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md">
                <MessageSquare className="w-3.5 h-3.5 fill-current text-[#1dbf73]" />
                <span>WA: {profile?.whatsapp_number || profile?.phone || 'N/A'}</span>
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome, {profile?.full_name || 'Staff Member'}!
            </h1>
            <p className="text-sm text-slate-900 mt-0.5">
              Biometric facial verification and GPS geofenced attendance tracking portal.
            </p>
          </div>
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
            : 'GPS Check-In'}
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
                <p className="text-xs font-bold uppercase text-slate-900 mb-1">Check-In Timestamp</p>
                <p className="text-xl font-extrabold text-[#1dbf73]">
                  {todayRecord?.check_in_time
                    ? new Date(todayRecord.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <p className="text-xs font-bold uppercase text-slate-900 mb-1">Check-Out Timestamp</p>
                <p className="text-xl font-extrabold text-[#1dbf73]/70">
                  {todayRecord?.check_out_time
                    ? new Date(todayRecord.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </p>
              </div>

              {(todayRecord?.overtime_minutes && todayRecord.overtime_minutes > 0) || liveOvertimeMinutes > 0 ? (
                <div className="col-span-2 bg-amber-50 p-3 rounded-2xl border border-amber-200 shadow-sm">
                  <div className="flex items-center justify-center gap-2 mb-0.5">
                    <p className="text-xs font-bold uppercase text-amber-800 tracking-wider">Overtime</p>
                    {(!todayRecord?.check_out_time && liveOvertimeMinutes > 0) && (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600"></span>
                      </span>
                    )}
                  </div>
                  <p className="text-xl font-extrabold text-amber-700">
                    {todayRecord?.check_out_time && todayRecord.overtime_minutes 
                      ? (Math.floor(todayRecord.overtime_minutes / 60) > 0
                        ? `${Math.floor(todayRecord.overtime_minutes / 60)}h ${todayRecord.overtime_minutes % 60}m`
                        : `${todayRecord.overtime_minutes}m`)
                      : (Math.floor(liveOvertimeMinutes / 60) > 0
                        ? `${Math.floor(liveOvertimeMinutes / 60)}h ${liveOvertimeMinutes % 60}m (Live)`
                        : `${liveOvertimeMinutes}m (Live)`)}
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
            <p className="text-xs text-slate-900">Yearly Allocations</p>
            {leaveBalances.length === 0 ? (
              <div className="mt-4 p-3 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                No leave allocations active.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {leaveBalances.map((bal, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-sm font-bold text-slate-700">{bal.type}</span>
                    <div className="flex items-baseline space-x-1">
                      <span className="text-lg font-extrabold text-[#1dbf73]">{bal.available}</span>
                      <span className="text-xs font-medium text-slate-500">/ {bal.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fix: Correct route to /employee/leaves */}
          <div className="flex gap-2 mt-6">
            <Button
              size="sm"
              variant="outline"
              className="w-full border-[#1dbf73]/30 text-[#1dbf73] hover:bg-[#1dbf73]/10"
              onClick={() => router.push('/employee/leaves')}
            >
              Request Leave
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
              onClick={() => router.push('/employee/gate-pass')}
            >
              Gate Pass
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

