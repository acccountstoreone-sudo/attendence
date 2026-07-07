'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FaceCapture } from '@/components/attendance/FaceCapture';
import { Spinner } from '@/components/ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import { calculateDistance } from '@/lib/geo';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type GpsStatus = 'locating' | 'inside' | 'approaching' | 'outside' | 'error';

interface BranchProfile {
  id: string;
  branch_id?: string;
  branch_name?: string;
  branch_lat?: number;
  branch_lng?: number;
  branch_radius?: number;
}

// ─────────────────────────────────────────────────────────────
// Custom GPS Hook
// ─────────────────────────────────────────────────────────────
function useGPS(branch: BranchProfile | null) {
  const [status, setStatus]     = useState<GpsStatus>('locating');
  const [distance, setDistance] = useState<number | null>(null);
  const [coords, setCoords]     = useState<{ lat: number; lng: number } | null>(null);

  const check = useCallback(() => {
    if (!branch?.branch_lat || !branch?.branch_lng) return;
    setStatus('locating');

    if (!navigator.geolocation) { setStatus('error'); return; }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const d = Math.round(calculateDistance(latitude, longitude, branch.branch_lat!, branch.branch_lng!));
        const r = branch.branch_radius ?? 100;
        setCoords({ lat: latitude, lng: longitude });
        setDistance(d);
        setStatus(d <= r ? 'inside' : d <= r * 1.5 ? 'approaching' : 'outside');
      },
      () => setStatus('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [branch]);

  useEffect(() => { check(); }, [check]);

  return {
    status,
    distance,
    coords,
    refresh: check,
    verified: status === 'inside',
  };
}

// ─────────────────────────────────────────────────────────────
// Live Clock
// ─────────────────────────────────────────────────────────────
function useLiveClock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  useEffect(() => {
    const id = setInterval(() =>
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })),
      1000
    );
    return () => clearInterval(id);
  }, []);
  return time;
}

// ─────────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────────
export default function EmployeeCheckInPage() {
  const router   = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const time     = useLiveClock();

  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile]       = useState<BranchProfile | null>(null);
  const [checkType, setCheckType]   = useState<'in' | 'out'>('in');
  const [todayRecord, setTodayRecord] = useState<{
    check_in_time?: string;
    check_out_time?: string;
    status?: string;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const gps = useGPS(profile);

  // ── Load profile + today's record ──────────────────────
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, branch_id, branches(name)')
        .eq('id', user.id)
        .single();

      if (prof) {
        const p: BranchProfile = {
          id: prof.id,
          branch_id: prof.branch_id ?? undefined,
          branch_name: (prof as unknown as { branches?: { name?: string } }).branches?.name ?? 'Store',
        };

        if (prof.branch_id) {
          const { data: branch } = await supabase
            .from('branches')
            .select('latitude, longitude, geofence_radius_meters')
            .eq('id', prof.branch_id)
            .single();
          if (branch) {
            p.branch_lat    = branch.latitude    ? Number(branch.latitude)    : undefined;
            p.branch_lng    = branch.longitude   ? Number(branch.longitude)   : undefined;
            p.branch_radius = branch.geofence_radius_meters ?? 100;
          }
        }

        setProfile(p);
      }

      try {
        const res = await fetch('/api/attendance/today');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.checked_in) {
            setTodayRecord(json.data);
            if (json.data.check_in_time && !json.data.check_out_time) setCheckType('out');
          }
        }
      } catch { /* non-critical */ }

      setLoading(false);
    }
    loadData();
  }, [supabase, router]);

  // ── API submission ──────────────────────────────────────
  // This function throws on failure so FaceCapture can handle it.
  const handleBiometricSubmit = useCallback(async (base64Image: string, faceDescriptor: number[]) => {
    if (!gps.coords) throw new Error('GPS coordinates unavailable. Please retry.');
    setSubmitting(true);
    setSubmitError(null);

    const endpoint = checkType === 'in' ? '/api/attendance/check-in' : '/api/attendance/check-out';
    const payload  = checkType === 'in'
      ? {
          latitude: gps.coords.lat,
          longitude: gps.coords.lng,
          photo_url: base64Image,
          face_verified: true,
          faceDescriptor,
          liveness_passed: true,
        }
      : {
          latitude: gps.coords.lat,
          longitude: gps.coords.lng,
          face_verified: true,
          faceDescriptor,
          liveness_passed: true,
        };

    const res    = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await res.json();

    setSubmitting(false);

    if (!result.success) {
      throw new Error(result.error?.message ?? `Check-${checkType === 'in' ? 'In' : 'Out'} failed`);
    }

    // Redirect to dashboard after short delay
    setTimeout(() => router.push('/employee'), 2200);
  }, [gps.coords, checkType, router]);

  // ─────────────────────────────────────────────────────────
  // Render: Loading screen
  // ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#020810]">
        <Spinner size="lg" label="Initializing Biometric System..." />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Render: Full-screen check-in
  // ─────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#020810]" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ── Top Navigation Bar ── */}
      <div className="flex-none flex items-center justify-between px-4 pt-4 pb-3 bg-gradient-to-b from-[#020810]/90 to-transparent z-40 backdrop-blur-sm" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <button
          onClick={() => router.push('/employee')}
          className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
            Biometric Attendance
          </span>
          <span className="text-white font-extrabold text-sm">{profile?.branch_name}</span>
        </div>

        {/* Live Clock */}
        <div className="flex items-center space-x-1.5 bg-white/5 border border-white/10 rounded-2xl px-3 py-2">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-white font-bold text-xs tabular-nums">{time}</span>
        </div>
      </div>

      {/* ── Today's Status Banner (if already checked in) ── */}
      <AnimatePresence>
        {todayRecord && (
          <motion.div
            initial={{ opacity:0, y:-10 }}
            animate={{ opacity:1, y:0 }}
            className="flex-none mx-4 mb-0 flex items-center justify-between bg-blue-950/80 backdrop-blur-xl border border-blue-500/30 rounded-2xl px-4 py-2.5 z-30"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">Today's Record</p>
                <p className="text-white text-xs font-semibold">
                  In: <span className="text-blue-300">{todayRecord.check_in_time ? new Date(todayRecord.check_in_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '—'}</span>
                  {todayRecord.check_out_time && <> · Out: <span className="text-slate-400">{new Date(todayRecord.check_out_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></>}
                </p>
              </div>
            </div>

            {/* Check-in / Check-out Toggle */}
            <div className="flex bg-[#040A15] p-0.5 rounded-xl border border-slate-800">
              {(['in','out'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setCheckType(t)}
                  className={`px-3 py-1.5 rounded-[10px] text-[11px] font-bold transition-all ${
                    checkType === t
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t === 'in' ? 'Check In' : 'Check Out'}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Check-in/out toggle when no record exists ── */}
      {!todayRecord && (
        <div className="flex-none flex justify-center px-4 z-30">
          <div className="flex bg-[#040A15]/80 backdrop-blur-xl p-0.5 rounded-2xl border border-slate-800/80">
            {(['in','out'] as const).map(t => (
              <button
                key={t}
                onClick={() => setCheckType(t)}
                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                  checkType === t
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'in' ? '▶ Check In' : '■ Check Out'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── FaceCapture fills remaining space ── */}
      <div className="flex-1 relative min-h-0 mt-2">
        <FaceCapture
          onCapture={handleBiometricSubmit}
          gpsVerified={gps.verified}
          gpsStatus={gps.status}
          gpsDistance={gps.distance}
          gpsRefresh={gps.refresh}
          branchName={profile?.branch_name}
          isLoading={submitting}
          checkType={checkType}
        />
      </div>

      {/* ── Error Banner (for API errors) ── */}
      <AnimatePresence>
        {submitError && (
          <motion.div
            initial={{ opacity:0, y:10 }}
            animate={{ opacity:1, y:0 }}
            exit={{ opacity:0 }}
            className="flex-none mx-4 mb-4 p-3 rounded-2xl bg-rose-950/90 border border-rose-500/30 backdrop-blur-xl text-rose-200 text-xs font-semibold text-center z-40"
          >
            {submitError}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
