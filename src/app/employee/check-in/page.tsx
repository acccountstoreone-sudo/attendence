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
import { startAuthentication } from '@simplewebauthn/browser';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type GpsStatus = 'locating' | 'inside' | 'approaching' | 'outside' | 'error' | 'not_configured' | 'permission_denied' | 'timeout' | 'not_supported' | 'position_unavailable';

interface BranchProfile {
  id: string;
  role?: string;
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
  const [errorMsg, setErrorMsg] = useState<string>('');

  const check = useCallback(() => {
    if (loadingProfile) {
      setStatus('locating');
      return;
    }
    const isAdminOrManager = branch?.role === 'admin' || branch?.role === 'branch_manager';

    if (!branch) {
      setStatus('error');
      setErrorMsg('User profile or store location could not be loaded.');
      return;
    }
    if (branch.branch_lat === undefined || branch.branch_lng === undefined || branch.branch_lat === null || branch.branch_lng === null) {
      setStatus(isAdminOrManager ? 'inside' : 'not_configured');
      return;
    }

    setStatus('locating');

    if (!navigator.geolocation) {
      setStatus(isAdminOrManager ? 'inside' : 'not_supported');
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
      if (d <= radiusTarget || isAdminOrManager) {
        setStatus('inside');
      } else if (d <= radiusTarget * 1.5) {
        setStatus('approaching');
      } else {
        setStatus('outside');
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      if (isAdminOrManager) {
        setStatus('inside');
        return;
      }
      if (err.code === err.PERMISSION_DENIED) {
        setStatus('permission_denied');
        setErrorMsg('Permission denied.');
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        setStatus('position_unavailable');
        setErrorMsg(`Position unavailable (Code 2). ${err.message}`);
      } else if (err.code === err.TIMEOUT) {
        setStatus('timeout');
        setErrorMsg('Location request timed out.');
      } else {
        setStatus('error');
        setErrorMsg(`GPS Error (Code ${err.code}): ${err.message || 'Unknown error'}`);
      }
    };

    navigator.geolocation.getCurrentPosition(
      handlePos,
      () => {
        // Fallback: if high accuracy times out/fails, retry with standard accuracy
        navigator.geolocation.getCurrentPosition(
          handlePos,
          (err2) => handleError(err2),
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

  const isAdminOrManager = branch?.role === 'admin' || branch?.role === 'branch_manager';

  return {
    status,
    distance,
    coords,
    errorMsg,
    refresh: check,
    verified: status === 'inside' || isAdminOrManager,
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
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isReverifyMode, setIsReverifyMode] = useState(false);

  const gps = useGPS(profile, loading);
  const offline = useOfflineQueue();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('reverify=true')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsReverifyMode(true);
    }
  }, []);

  // ── Load profile + today's record ──────────────────────
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('id, branch_id, role')
        .eq('id', user.id)
        .single();

      let bList: Array<{ id: string; name: string; latitude: number | null; longitude: number | null; geofence_radius_meters: number | null }> = [];
      const { data: allB } = await supabase
        .from('branches')
        .select('id, name, latitude, longitude, geofence_radius_meters')
        .eq('is_active', true)
        .order('name');
      if (allB) {
        bList = allB;
      }

      if (prof) {
        let detectedBranchName = 'Store';
        if (prof.branch_id && bList) {
          const matchingBranch = bList.find(b => b.id === prof.branch_id);
          if (matchingBranch) detectedBranchName = matchingBranch.name;
        }

        const p: BranchProfile = {
          id: prof.id,
          role: prof.role,
          branch_id: prof.branch_id ?? undefined,
          branch_name: detectedBranchName,
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
            p.branch_radius = branch.geofence_radius_meters ?? 100;
          }
        } else if (bList && bList.length > 0) {
          // Auto detect closest branch
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              if (!navigator.geolocation) reject(new Error('no geo'));
              navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 5000 });
            });
            const { latitude, longitude } = pos.coords;
            let closest = bList[0];
            let minD = Infinity;
            for (const b of bList) {
              if (b.latitude && b.longitude) {
                const d = calculateDistance(latitude, longitude, Number(b.latitude), Number(b.longitude));
                if (d < minD) { minD = d; closest = b; }
              }
            }
            if (closest) {
              p.branch_id = closest.id;
              p.branch_name = `${closest.name}`;
              p.branch_lat = closest.latitude ? Number(closest.latitude) : undefined;
              p.branch_lng = closest.longitude ? Number(closest.longitude) : undefined;
              p.branch_radius = closest.geofence_radius_meters ?? 100;
            }
          } catch {
            // Fallback if GPS fails during auto-detect
            const firstBranch = bList.find(b => b.latitude !== null && b.longitude !== null) || bList[0];
            if (firstBranch) {
              p.branch_id = firstBranch.id;
              p.branch_name = `${firstBranch.name}`;
              p.branch_lat = firstBranch.latitude ? Number(firstBranch.latitude) : undefined;
              p.branch_lng = firstBranch.longitude ? Number(firstBranch.longitude) : undefined;
              p.branch_radius = firstBranch.geofence_radius_meters ?? 100;
            }
          }
        }

        setProfile(p);
      } else {
        setFeedback({ type: 'error', text: `Failed to load your profile. ${profErr ? profErr.message : 'No profile found in database.'}` });
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
    const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'branch_manager';
    if (!gps.coords && !isAdminOrManager) throw new Error('GPS coordinates unavailable. Please retry.');
    if (!gps.verified && !isAdminOrManager) {
      throw new Error(`Check-in denied: You are ${gps.distance ?? 'too far'}m away from ${profile?.branch_name ?? 'the store'} geofence.`);
    }
    setSubmitting(true);
    setFeedback(null);

    // ── Re-Verification Mode ────────────────────────────────
    if (isReverifyMode) {
      try {
        const res = await fetch('/api/employees/enroll-face', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            faceDescriptor,
            selfieUrl: base64Image,
            latitude: gps.coords?.lat ?? 0,
            longitude: gps.coords?.lng ?? 0,
          })
        });
        const result = await res.json();
        setSubmitting(false);
        if (!result.success) {
          setIsReverifyMode(false);
          setFeedback({ type: 'error', text: result.error?.message ?? 'Face re-enrollment failed' });
          throw new Error(result.error?.message ?? 'Face re-enrollment failed');
        }
        
        setFeedback({ type: 'success', text: 'Face Reverification Successful! You can now check in normally.' });
        setIsReverifyMode(false);
        if (typeof window !== 'undefined') window.history.replaceState({}, '', '/employee/check-in');
        return;
      } catch (err: unknown) {
        setSubmitting(false);
        setIsReverifyMode(false);
        const errMsg = err instanceof Error ? err.message : 'Face re-enrollment failed';
        setFeedback({ type: 'error', text: errMsg });
        throw err;
      }
    }

    // ── Offline Mode: queue record locally ─────────────────
    if (!offline.isOnline) {
      await offline.enqueue(checkType === 'in' ? 'check_in' : 'check_out', {
        latitude: gps.coords?.lat ?? 0,
        longitude: gps.coords?.lng ?? 0,
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
          latitude: gps.coords?.lat ?? 0,
          longitude: gps.coords?.lng ?? 0,
          branch_id: profile?.branch_id,
          is_manual_override: isAdminOrManager || !gps.verified,
          photo_url: base64Image,
          face_verified: true,
          faceDescriptor,
          liveness_passed: true,
        }
      : {
          latitude: gps.coords?.lat ?? 0,
          longitude: gps.coords?.lng ?? 0,
          branch_id: profile?.branch_id,
          is_manual_override: isAdminOrManager || !gps.verified,
          face_verified: true,
          faceDescriptor,
          liveness_passed: true,
        };

    const res    = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await res.json();

    setSubmitting(false);

    if (!result.success) {
      if (result.error?.code === 'BIOMETRIC_REVERIFICATION_REQUIRED') {
        setIsReverifyMode(true);
        throw new Error('Admin requested reverification. The system is now in Re-Enrollment mode. Please scan your face again to save your new reference biometrics.');
      }
      throw new Error(result.error?.message ?? `Check-${checkType === 'in' ? 'In' : 'Out'} failed`);
    }

    setTimeout(() => router.push('/employee'), 2200);
  }, [gps.coords, gps.verified, gps.distance, profile, checkType, router, offline, isReverifyMode]);

  const handleFingerprintSubmit = useCallback(async () => {
    try {
      const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'branch_manager';
      
      setSubmitting(true);
      setFeedback(null);
      
      if (!gps.coords && !isAdminOrManager) throw new Error('GPS coordinates unavailable. Please retry.');
      if (!gps.verified && !isAdminOrManager) {
        throw new Error(`Check-in denied: You are ${gps.distance ?? 'too far'}m away from ${profile?.branch_name ?? 'the store'} geofence.`);
      }

      // 1. Get Authentication Options
      const resp = await fetch('/api/auth/webauthn/authenticate/generate', { method: 'POST' });
      if (!resp.ok) {
         const d = await resp.json();
         throw new Error(d.error || 'Fingerprint authentication is not set up. Please go to your profile to register.');
      }
      const options = await resp.json();

      // 2. Start browser authentication
      let asseResp;
      try {
        asseResp = await startAuthentication({ optionsJSON: options });
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'NotAllowedError') throw new Error('Authentication cancelled.');
        throw e;
      }

      // 3. Verify on server
      const verifyResp = await fetch('/api/auth/webauthn/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(asseResp),
      });

      if (!verifyResp.ok) {
         const d = await verifyResp.json();
         throw new Error(d.error || 'Fingerprint verification failed.');
      }

      const verifyData = await verifyResp.json();
      if (!verifyData.verified) throw new Error('Invalid fingerprint.');

      // 4. Record Check-in (Offline queueing is not fully supported for fingerprint since it requires server for challenge. We just bypass face matching.)
      const endpoint = checkType === 'in' ? '/api/attendance/check-in' : '/api/attendance/check-out';
      const payload  = {
          latitude: gps.coords?.lat ?? 0,
          longitude: gps.coords?.lng ?? 0,
          branch_id: profile?.branch_id,
          is_manual_override: isAdminOrManager || !gps.verified,
          face_verified: true,
          webauthn_verified: true, // Special flag indicating fingerprint was used
      };

      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await res.json();

      setSubmitting(false);

      if (!result.success) {
        throw new Error(result.error?.message ?? `Check-${checkType === 'in' ? 'In' : 'Out'} failed`);
      }

      setTimeout(() => router.push('/employee'), 2200);
    } catch (err: unknown) {
      setSubmitting(false);
      if (err instanceof Error) {
        setFeedback({ type: 'error', text: err.message || 'Fingerprint check-in failed' });
      } else {
        setFeedback({ type: 'error', text: 'Fingerprint check-in failed' });
      }
    }
  }, [gps.coords, gps.verified, gps.distance, profile, checkType, router]);

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
            className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-blue-500/90 text-slate-900 text-xs rounded-full px-4 py-2 shadow-xl"
          >
            {offline.syncing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            {offline.syncing ? `Syncing ${offline.pendingCount} record(s)…` : `${offline.pendingCount} offline record(s) pending sync`}
          </motion.div>
        )}
      </AnimatePresence>

      {isReverifyMode && (
        <div className="flex-none px-4 py-3 bg-rose-500 text-slate-900 z-40 shadow-lg mt-14 sm:mt-0 flex flex-col items-center justify-center text-center font-bold text-sm relative">
          <span className="text-lg mb-1">⚠️</span>
          Admin has reset your Face Biometrics. 
          <span className="text-xs font-normal opacity-90 mt-0.5">Please scan your face to re-enroll now!</span>
        </div>
      )}

      {/* ── Minimal Floating Back Button for Mobile View (since top bar is hidden) ── */}
      <button
        onClick={() => router.push('/employee')}
        className="sm:hidden absolute top-3.5 left-3.5 z-50 p-2.5 rounded-full bg-[#0A1628]/90 hover:bg-[#0A1628] border border-slate-300 text-slate-900 backdrop-blur-sm shadow-2xl active:scale-95"
        style={{ top: 'max(0.8rem, env(safe-area-inset-top))' }}
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* ── Top Navigation Bar (Hidden on Mobile as requested) ── */}
      <div className="flex-none hidden sm:flex items-center justify-between px-4 pt-4 pb-3 bg-gradient-to-b from-[#020810]/95 to-transparent z-40 backdrop-blur-md" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <button
          onClick={() => router.push('/employee')}
          className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-900 transition-all active:scale-95 shadow-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-400 drop-shadow">
            Biometric Attendance
          </span>
          <span className="text-slate-900 font-extrabold text-base tracking-tight">{profile?.branch_name}</span>
        </div>

        {/* Live Clock */}
        <div className="flex items-center space-x-1.5 bg-white/10 border border-white/15 rounded-2xl px-3.5 py-2 shadow-lg">
          <Clock className="w-4 h-4 text-blue-400 animate-pulse shrink-0" />
          <span className="text-slate-900 font-extrabold text-xs tabular-nums">{time}</span>
        </div>
      </div>

      {/* ── Admin / Manager Branch Switcher removed as per user request ── */}

      {/* ── Today's Status Banner (if already checked in) ── */}
      <AnimatePresence>
        {todayRecord && (
          <motion.div
            initial={{ opacity:0, y:-10 }}
            animate={{ opacity:1, y:0 }}
            className="flex-none mx-4 mb-1 mt-12 sm:mt-0 flex items-center justify-between bg-[#0A1628]/95 backdrop-blur-sm border border-slate-300 rounded-2xl px-4 py-3 z-30 shadow-2xl"
          >
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-[#1dbf73] shrink-0" />
              <div>
                <p className="text-[10px] sm:text-xs font-extrabold text-blue-300 uppercase tracking-widest">Today&apos;s Record</p>
                <p className="text-slate-900 text-xs sm:text-sm font-extrabold">
                  In: <span className="text-[#1dbf73]">{todayRecord.check_in_time ? new Date(todayRecord.check_in_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '—'}</span>
                  {todayRecord.check_out_time && <> · Out: <span className="text-slate-300">{new Date(todayRecord.check_out_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></>}
                </p>
              </div>
            </div>

            {/* Check-in / Check-out Toggle */}
            <div className="flex bg-white p-1 rounded-xl border border-white/15 shadow-inner">
              {(['in','out'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setCheckType(t)}
                  className={`px-3.5 py-1.5 rounded-[10px] text-xs font-extrabold transition-all ${
                    checkType === t
                      ? 'bg-blue-600 text-slate-900 shadow-lg shadow-blue-900/50 scale-[1.02]'
                      : 'text-slate-300 hover:text-slate-900'
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
          <div className="flex bg-[#0A1628]/95 backdrop-blur-sm p-1 rounded-2xl border border-slate-300 shadow-2xl">
            {(['in','out'] as const).map(t => (
              <button
                key={t}
                onClick={() => setCheckType(t)}
                className={`px-7 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                  checkType === t
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-slate-900 shadow-lg shadow-blue-900/50 scale-[1.02]'
                    : 'text-slate-300 hover:text-slate-900'
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
          checkType={checkType}
          onCapture={handleBiometricSubmit}
          onUseFingerprint={handleFingerprintSubmit}
          gpsVerified={gps.verified}
          gpsStatus={gps.status}
          gpsDistance={gps.distance}
          gpsRefresh={gps.refresh}
          branchName={profile?.branch_name}
          isLoading={submitting}
          gpsErrorMsg={gps.errorMsg}
        />
      </div>

      {/* ── Feedback Banner ── */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity:0, y:10 }}
            animate={{ opacity:1, y:0 }}
            exit={{ opacity:0 }}
            className={`flex-none mx-4 mb-4 p-3 rounded-2xl border backdrop-blur-sm text-xs font-semibold text-center z-40 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
                : 'bg-rose-950/90 border-rose-500/30 text-rose-200'
            }`}
          >
            {feedback.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

