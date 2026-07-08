'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FaceCapture } from '@/components/attendance/FaceCapture';
import { Spinner } from '@/components/ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import { calculateDistance } from '@/lib/geo';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, CheckCircle2, WifiOff, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

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
function useGPS(branch: BranchProfile | null, loadingProfile: boolean) {
  const [status, setStatus]     = useState<GpsStatus>('locating');
  const [distance, setDistance] = useState<number | null>(null);
  const [coords, setCoords]     = useState<{ lat: number; lng: number } | null>(null);

  const check = useCallback(() => {
    if (loadingProfile) {
      setStatus('locating');
      return;
    }
    if (!branch) {
      setStatus('error');
      return;
    }
    if (branch.branch_lat === undefined || branch.branch_lng === undefined || branch.branch_lat === null || branch.branch_lng === null) {
      setStatus('error');
      return;
    }

    setStatus('locating');

    if (!navigator.geolocation) {
      setStatus('error');
      return;
    }

    const latTarget = branch.branch_lat;
    const lngTarget = branch.branch_lng;
    const radiusTarget = branch.branch_radius ?? 100;

    const handlePos = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      const d = Math.round(calculateDistance(latitude, longitude, latTarget, lngTarget));
      setCoords({ lat: latitude, lng: longitude });
      setDistance(d);
      setStatus(d <= radiusTarget ? 'inside' : d <= radiusTarget * 1.5 ? 'approaching' : 'outside');
    };

    navigator.geolocation.getCurrentPosition(
      handlePos,
      () => {
        // Fallback: if high accuracy times out/fails (common on desktop/indoor WiFi), retry with standard accuracy
        navigator.geolocation.getCurrentPosition(
          handlePos,
          () => setStatus('error'),
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  }, [branch, loadingProfile]);

  useEffect(() => {
    queueMicrotask(() => {
      check();
    });
  }, [check]);

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

  const gps = useGPS(profile, loading);
  const offline = useOfflineQueue();

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
            .select('*')
            .eq('id', prof.branch_id)
            .single();
          if (branch) {
            p.branch_lat    = branch.latitude    ? Number(branch.latitude)    : undefined;
            p.branch_lng    = branch.longitude   ? Number(branch.longitude)   : undefined;
            p.branch_radius = branch.geofence_radius_meters ?? branch.radius_meters ?? 100;
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
    if (!gps.verified) {
      throw new Error(`Check-in denied: You are ${gps.distance ?? 'too far'}m away from ${profile?.branch_name ?? 'the store'} geofence.`);
    }
    setSubmitting(true);
    setSubmitError(null);

    // ── Offline Mode: queue record locally ─────────────────
    if (!offline.isOnline) {
      await offline.enqueue(checkType === 'in' ? 'check_in' : 'check_out', {
        latitude: gps.coords.lat,
        longitude: gps.coords.lng,
        face_verified: true,
        faceDescriptor,
        liveness_passed: true,
        photo_url: base64Image,
        timestamp: new Date().toISOString(),
      });
      setSubmitting(false);
      // Show success message then redirect
      setTimeout(() => router.push('/employee'), 2200);
      return;
    }

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
  }, [gps.coords, gps.verified, gps.distance, profile?.branch_name, checkType, router, offline]);

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
    <div className="min-h-[100dvh] flex flex-col overflow-x-hidden bg-[#020810] relative" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ── Offline Banner ── */}
      <AnimatePresence>
        {!offline.isOnline && (
          <motion.div
            initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
            className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-amber-500/95 text-amber-950 font-semibold text-xs rounded-full px-4 py-2 shadow-xl"
          >
            <WifiOff className="w-4 h-4" /> Offline Mode — Check-in saved locally
          </motion.div>
        )}
        {offline.isOnline && offline.pendingCount > 0 && (
          <motion.div
            initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
            className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-blue-500/90 text-white text-xs rounded-full px-4 py-2 shadow-xl"
          >
            {offline.syncing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            {offline.syncing ? `Syncing ${offline.pendingCount} record(s)…` : `${offline.pendingCount} offline record(s) pending sync`}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Minimal Floating Back Button for Mobile View (since top bar is hidden) ── */}
      <button
        onClick={() => router.push('/employee')}
        className="sm:hidden absolute top-3.5 left-3.5 z-50 p-2.5 rounded-full bg-[#0A1628]/90 hover:bg-[#0A1628] border border-white/20 text-white backdrop-blur-xl shadow-2xl active:scale-95"
        style={{ top: 'max(0.8rem, env(safe-area-inset-top))' }}
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* ── Top Navigation Bar (Hidden on Mobile as requested) ── */}
      <div className="flex-none hidden sm:flex items-center justify-between px-4 pt-4 pb-3 bg-gradient-to-b from-[#020810]/95 to-transparent z-40 backdrop-blur-md" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <button
          onClick={() => router.push('/employee')}
          className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white transition-all active:scale-95 shadow-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-400 drop-shadow">
            Biometric Attendance
          </span>
          <span className="text-white font-extrabold text-base tracking-tight">{profile?.branch_name}</span>
        </div>

        {/* Live Clock */}
        <div className="flex items-center space-x-1.5 bg-white/10 border border-white/15 rounded-2xl px-3.5 py-2 shadow-lg">
          <Clock className="w-4 h-4 text-blue-400 animate-pulse shrink-0" />
          <span className="text-white font-extrabold text-xs tabular-nums">{time}</span>
        </div>
      </div>

      {/* ── Today's Status Banner (if already checked in) ── */}
      <AnimatePresence>
        {todayRecord && (
          <motion.div
            initial={{ opacity:0, y:-10 }}
            animate={{ opacity:1, y:0 }}
            className="flex-none mx-4 mb-1 mt-12 sm:mt-0 flex items-center justify-between bg-[#0A1628]/95 backdrop-blur-2xl border border-white/20 rounded-2xl px-4 py-3 z-30 shadow-2xl"
          >
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-[10px] sm:text-xs font-extrabold text-blue-300 uppercase tracking-widest">Today&apos;s Record</p>
                <p className="text-white text-xs sm:text-sm font-extrabold">
                  In: <span className="text-emerald-300">{todayRecord.check_in_time ? new Date(todayRecord.check_in_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '—'}</span>
                  {todayRecord.check_out_time && <> · Out: <span className="text-slate-300">{new Date(todayRecord.check_out_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></>}
                </p>
              </div>
            </div>

            {/* Check-in / Check-out Toggle */}
            <div className="flex bg-[#040A15] p-1 rounded-xl border border-white/15 shadow-inner">
              {(['in','out'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setCheckType(t)}
                  className={`px-3.5 py-1.5 rounded-[10px] text-xs font-extrabold transition-all ${
                    checkType === t
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 scale-[1.02]'
                      : 'text-slate-300 hover:text-white'
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
        <div className="flex-none flex justify-center px-4 z-30 mb-1 mt-12 sm:mt-0">
          <div className="flex bg-[#0A1628]/95 backdrop-blur-2xl p-1 rounded-2xl border border-white/20 shadow-2xl">
            {(['in','out'] as const).map(t => (
              <button
                key={t}
                onClick={() => setCheckType(t)}
                className={`px-7 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                  checkType === t
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/50 scale-[1.02]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {t === 'in' ? '▶ Check In' : '■ Check Out'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── FaceCapture fills remaining space ── */}
      <div className="flex-1 relative min-h-0 mt-2 flex flex-col">
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
