'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';

const FaceCapture = dynamic(() => import('@/components/attendance/FaceCapture').then(mod => mod.FaceCapture), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-sm h-64 bg-slate-900/50 rounded-[2rem] border border-white/10 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#1dbf73] border-t-transparent rounded-full animate-spin" />
    </div>
  )
});
import { Spinner } from '@/components/ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import { calculateDistance } from '@/lib/geo';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Clock, MapPin, CheckCircle2, WifiOff, RefreshCcw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { startAuthentication } from '@simplewebauthn/browser';

async function parseJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (res.status === 413 || text.includes('Request Entity Too Large') || text.startsWith('R')) {
      throw new Error('Payload size too large. Please retry with smaller biometric data.');
    }
    throw new Error(`Server returned error (${res.status}): ${text.slice(0, 100)}`);
  }
}

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

  // Bug 5 fix: 'approaching' (100-150m) must NOT be treated as verified.
  // Setting verified=true here would cause is_manual_override=false in the
  // payload for someone who is outside the geofence, producing bad audit data.
  // Only 'inside' counts as verified for regular employees.
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
  const [selectedMethod, setSelectedMethod] = useState<'face' | 'fingerprint' | 'selector' | 'none'>('selector');
  const isWebAuthnSupported = typeof window !== 'undefined' && !!window.PublicKeyCredential;

  // Bug 6 fix: Pre-fetch WebAuthn options so startAuthentication can be the
  // very first async call inside the click handler (iOS Safari gesture-chain fix).
  const cachedWebAuthnOptionsRef = useRef<Record<string, unknown> | null>(null);
  const prefetchingWebAuthnRef   = useRef(false);

  const prefetchWebAuthnOptions = useCallback(async () => {
    if (cachedWebAuthnOptionsRef.current || prefetchingWebAuthnRef.current) return;
    prefetchingWebAuthnRef.current = true;
    try {
      const resp = await fetch('/api/auth/webauthn/authenticate/generate', { method: 'POST' });
      if (resp.ok) {
        const opts = await parseJsonResponse(resp);
        cachedWebAuthnOptionsRef.current = opts;
      }
    } catch { /* non-critical prefetch — ignore */ }
    prefetchingWebAuthnRef.current = false;
  }, []);

  const gps = useGPS(profile, loading);
  const offline = useOfflineQueue();

  // ── Load profile + today's record ──────────────────────
  useEffect(() => {
    async function loadData() {
      // Detect reverify mode from URL so we don't need it as a dep of this effect
      const reverify = typeof window !== 'undefined' && window.location.search.includes('reverify=true');
      if (reverify) setIsReverifyMode(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('id, branch_id, role, face_enrolled, fingerprint_enrolled')
        .eq('id', user.id)
        .single();

      if (prof) {
        if (reverify) {
          setSelectedMethod('face');
        } else if (prof.face_enrolled && prof.fingerprint_enrolled) {
          setSelectedMethod('selector');
        } else if (prof.face_enrolled) {
          setSelectedMethod('face');
        } else if (prof.fingerprint_enrolled) {
          setSelectedMethod('fingerprint');
        } else {
          setSelectedMethod('none');
        }
      }

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

        // Bug 8 fix: reuse data already in bList — no second DB round-trip needed.
        if (prof.branch_id) {
          const branch = bList.find(b => b.id === prof.branch_id);
          if (branch) {
            p.branch_lat    = branch.latitude    != null ? Number(branch.latitude)    : undefined;
            p.branch_lng    = branch.longitude   != null ? Number(branch.longitude)   : undefined;
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
  const handleBiometricSubmit = useCallback(async (base64Image: string, faceDescriptor: number[], isManualCapture = false) => {
    const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'branch_manager';
    if (!gps.coords && !isAdminOrManager) throw new Error('GPS coordinates unavailable. Please retry.');
    // Let the server be the final arbiter of the geofence. Only hard-block the
    // client if GPS completely failed to detect a position (status 'outside' means
    // a position was obtained but is beyond the radius).
    if (gps.status === 'outside' && !isAdminOrManager) {
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
        const text = await res.text();
        let result: Record<string, unknown>;
        try { result = JSON.parse(text); }
        catch { throw new Error(res.status === 413 || text.startsWith('R') ? 'Captured image too large. Please retry.' : `Server error (${res.status}): ${text.slice(0, 100)}`); }
        setSubmitting(false);
        if (!result.success) {
          setIsReverifyMode(false);
          setFeedback({ type: 'error', text: (result.error as { message?: string })?.message ?? 'Face re-enrollment failed' });
          throw new Error((result.error as { message?: string })?.message ?? 'Face re-enrollment failed');
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
        // Omit photo_url to prevent local storage quota exhaustion for offline records
        // photo_url: base64Image,
        timestamp: new Date().toISOString(),
      });
      setSubmitting(false);
      // Show success message then redirect
      // Fix S5: 1200ms redirect (was 2200ms) — success animation completes in ~600ms,
      // no need to wait 2.2 seconds before going back to dashboard.
      setTimeout(() => router.push('/employee'), 1200);
      return;
    }

    const endpoint = checkType === 'in' ? '/api/attendance/check-in' : '/api/attendance/check-out';
    const payload  = checkType === 'in'
        ? {
          latitude: gps.coords?.lat ?? 0,
          longitude: gps.coords?.lng ?? 0,
          branch_id: profile?.branch_id,
          is_manual_override: !gps.verified || isManualCapture,
          // photo_url intentionally omitted — sending raw base64 in the JSON
          // body risks 413 payload errors. Upload to storage separately if needed.
          face_verified: true,
          faceDescriptor,
          liveness_passed: true,
        }
      : {
          latitude: gps.coords?.lat ?? 0,
          longitude: gps.coords?.lng ?? 0,
          branch_id: profile?.branch_id,
          is_manual_override: !gps.verified || isManualCapture,
          face_verified: true,
          faceDescriptor,
          liveness_passed: true,
        };

    const res    = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const text   = await res.text();
    let result: Record<string, unknown>;
    try { result = JSON.parse(text); }
    catch { throw new Error(res.status === 413 || text.startsWith('R') ? 'Check-in payload too large. Please try again.' : `Server error (${res.status}): ${text.slice(0, 100)}`); }

    setSubmitting(false);

    if (!result.success) {
      if ((result.error as { code?: string })?.code === 'BIOMETRIC_REVERIFICATION_REQUIRED') {
        setIsReverifyMode(true);
        throw new Error('Admin requested reverification. The system is now in Re-Enrollment mode. Please scan your face again to save your new reference biometrics.');
      }
      throw new Error((result.error as { message?: string })?.message ?? `Check-${checkType === 'in' ? 'In' : 'Out'} failed`);
    }

    // Fix S5: 1200ms redirect (was 2200ms)
    setTimeout(() => {
      setSubmitting(false);
      router.push('/employee');
    }, 1200);
  }, [gps.coords, gps.verified, gps.distance, gps.status, profile, checkType, router, offline, isReverifyMode]);

  const isSubmittingRef = useRef(false);

  const handleFingerprintSubmit = useCallback(async () => {
    if (isSubmittingRef.current) return;
    try {
      isSubmittingRef.current = true;
      const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'branch_manager';

      setSubmitting(true);
      setFeedback(null);

      if (!gps.coords && !isAdminOrManager) throw new Error('GPS coordinates unavailable. Please retry.');
      if (gps.status === 'outside' && !isAdminOrManager) {
        throw new Error(`Check-in denied: You are ${gps.distance ?? 'too far'}m away from ${profile?.branch_name ?? 'the store'} geofence.`);
      }

      // Bug 6 fix: iOS Safari WebAuthn gesture-chain requirement.
      // startAuthentication MUST be called as close to the user-gesture (click) as
      // possible — any await fetch() before it breaks the gesture chain on iPhone,
      // resulting in NotAllowedError. Strategy:
      //   1. Use pre-fetched options if available (cached by prefetchWebAuthnOptions).
      //   2. If not yet cached, fetch now AND call startAuthentication immediately
      //      after (single await before the WebAuthn prompt).
      let webAuthnOptions = cachedWebAuthnOptionsRef.current;
      if (!webAuthnOptions) {
        // Only one fetch before startAuthentication — acceptable on all browsers.
        const resp = await fetch('/api/auth/webauthn/authenticate/generate', { method: 'POST' });
        webAuthnOptions = await parseJsonResponse(resp);
        if (!resp.ok) {
          const errMsg = (webAuthnOptions as any)?.error;
          const msg = typeof errMsg === 'object' ? (errMsg.message || JSON.stringify(errMsg)) : errMsg;
          throw new Error(msg || 'Fingerprint authentication is not set up. Please go to your profile to register.');
        }
      }
      // Clear cache so we get a fresh challenge next time
      cachedWebAuthnOptionsRef.current = null;

      // ★ startAuthentication is now the FIRST async call after options are ready.
      // This satisfies iOS Safari's gesture activation requirement.
      let asseResp;
      try {
        asseResp = await startAuthentication({ optionsJSON: webAuthnOptions as any });
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'NotAllowedError') throw new Error('Authentication cancelled or timed out. Please try again.');
        throw e;
      }

      // Verify on server
      const verifyResp = await fetch('/api/auth/webauthn/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(asseResp),
      });

      const verifyData = await parseJsonResponse(verifyResp);
      if (!verifyResp.ok) {
        const errMsg = verifyData.error;
        const msg = typeof errMsg === 'object' ? (errMsg.message || JSON.stringify(errMsg)) : errMsg;
        throw new Error(msg || 'Fingerprint verification failed.');
      }
      if (!verifyData.verified) throw new Error('Invalid fingerprint.');

      // Record Check-in
      const endpoint = checkType === 'in' ? '/api/attendance/check-in' : '/api/attendance/check-out';
      const payload  = {
        latitude: gps.coords?.lat ?? 0,
        longitude: gps.coords?.lng ?? 0,
        branch_id: profile?.branch_id,
        is_manual_override: !gps.verified,
        face_verified: true,
        webauthn_verified: true, // Special flag indicating fingerprint was used
      };

      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await parseJsonResponse(res);

      setSubmitting(false);

      if (!result.success) {
        const errMsg = result.error;
        const msg = typeof errMsg === 'object' ? (errMsg.message || JSON.stringify(errMsg)) : errMsg;
        throw new Error(msg || `Check-${checkType === 'in' ? 'In' : 'Out'} failed`);
      }

      setTimeout(() => router.push('/employee'), 1200);
    } catch (err: unknown) {
      setSubmitting(false);
      if (err instanceof Error) {
        setFeedback({ type: 'error', text: err.message || 'Fingerprint check-in failed' });
      } else {
        setFeedback({ type: 'error', text: 'Fingerprint check-in failed' });
      }
    } finally {
      isSubmittingRef.current = false;
    }
  }, [gps.coords, gps.verified, gps.distance, profile, checkType, router, cachedWebAuthnOptionsRef]);

  // ─────────────────────────────────────────────────────────
  // Render: Loading screen
  // ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-50">
        <Spinner size="lg" label="Initializing Biometric System..." />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Render: Full-screen check-in
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] flex flex-col overflow-x-hidden bg-[#050505] relative text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
      
      {/* Ambient Background Glows */}
      <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none translate-x-1/3 translate-y-1/3" />
      
      {/* ── Offline Banner ── */}
      <AnimatePresence>
        {!offline.isOnline && (
          <motion.div
            initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
            className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold text-xs rounded-2xl px-5 py-3 shadow-[0_0_30px_rgba(245,158,11,0.15)] backdrop-blur-xl"
          >
            <WifiOff className="w-4 h-4" /> Offline Mode — Check-in saved locally
          </motion.div>
        )}
        {offline.isOnline && offline.pendingCount > 0 && (
          <motion.div
            initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
            className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold rounded-2xl px-5 py-3 shadow-[0_0_30px_rgba(59,130,246,0.15)] backdrop-blur-xl"
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
        className="sm:hidden absolute top-3.5 left-3.5 z-50 p-2.5 rounded-full bg-white/90 hover:bg-white border border-slate-200 text-slate-700 backdrop-blur-sm shadow-lg active:scale-95"
        style={{ top: 'max(0.8rem, env(safe-area-inset-top))' }}
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* ── Top Navigation Bar (Hidden on Mobile as requested) ── */}
      <div className="flex-none hidden sm:flex items-center justify-between px-6 pt-6 pb-4 z-40" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
        <button
          onClick={() => router.push('/employee')}
          className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all active:scale-95 shadow-lg backdrop-blur-md"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400/80 mb-0.5">
            Biometric Attendance
          </span>
          <span className="text-white font-medium text-lg tracking-tight">{profile?.branch_name || 'Loading...'}</span>
        </div>

        {/* Live Clock */}
        <div className="flex items-center space-x-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 shadow-lg backdrop-blur-md">
          <Clock className="w-4 h-4 text-blue-400" />
          <span className="text-white font-medium text-sm tabular-nums tracking-wide">{time}</span>
        </div>
      </div>

      {/* ── Today's Status Banner (if already checked in) ── */}
      <AnimatePresence>
        {todayRecord && (
          <motion.div
            initial={{ opacity:0, y:-10 }}
            animate={{ opacity:1, y:0 }}
            className="flex-none mx-4 mb-2 mt-16 sm:mt-2 flex items-center justify-between bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl px-5 py-4 z-30 shadow-2xl"
          >
            <div className="flex items-center space-x-4">
              <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Today&apos;s Record</p>
                <p className="text-white text-sm sm:text-base font-medium">
                  In: <span className="text-emerald-400">{todayRecord.check_in_time ? new Date(todayRecord.check_in_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '—'}</span>
                  {todayRecord.check_out_time && <> <span className="text-slate-900 mx-1">·</span> Out: <span className="text-slate-300">{new Date(todayRecord.check_out_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></>}
                </p>
              </div>
            </div>

            {/* Check-in / Check-out Toggle */}
            <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5 shadow-inner">
              {(['in','out'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setCheckType(t)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                    checkType === t
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] scale-[1.02]'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
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
        <div className="flex-none flex justify-center px-4 z-30 mb-2 mt-16 sm:mt-2">
          <div className="flex bg-white/5 backdrop-blur-xl p-1.5 rounded-3xl border border-white/10 shadow-2xl">
            {(['in','out'] as const).map(t => (
              <button
                key={t}
                onClick={() => setCheckType(t)}
                className={`px-8 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${
                  checkType === t
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-[0_0_30px_rgba(59,130,246,0.4)] scale-[1.02]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {t === 'in' ? 'Check In' : 'Check Out'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Dynamic Biometric Verification Area ── */}
      <div className="flex-1 relative min-h-0 mt-4 flex flex-col justify-center items-center">
        {selectedMethod === 'selector' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-2xl flex flex-col items-center space-y-6"
          >
            <div className="text-center">
              <h2 className="text-white text-xl font-bold tracking-tight mb-1">Select Verification</h2>
              <p className="text-slate-400 text-sm">Choose how you want to verify your identity today.</p>
            </div>
            <div className="w-full space-y-4">
              <Button
                onClick={() => setSelectedMethod('face')}
                className="w-full h-16 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-500/30 hover:border-transparent rounded-2xl shadow-lg hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] flex items-center justify-center space-x-3 transition-all duration-300 group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform duration-300">📷</span>
                <span className="font-bold text-lg tracking-wide">Face Match</span>
              </Button>
              <Button
                onClick={() => {
                  if (!isWebAuthnSupported) {
                    setFeedback({ type: 'error', text: 'Fingerprint is not supported in this browser. Please use Face Match or switch to Chrome/Edge.' });
                    return;
                  }
                  setSelectedMethod('fingerprint');
                }}
                className={`w-full h-16 ${!isWebAuthnSupported ? 'bg-slate-800/50 text-slate-500 border-slate-700/50' : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500 hover:to-pink-500 text-white border-purple-500/30 hover:border-transparent shadow-lg hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]'} border rounded-2xl flex items-center justify-center space-x-3 transition-all duration-300 group`}
              >
                <span className="text-2xl group-hover:scale-110 transition-transform duration-300">👆</span>
                <div className="flex flex-col items-start">
                  <span className="font-bold text-lg tracking-wide">Fingerprint</span>
                  {!isWebAuthnSupported && <span className="text-[10px] text-rose-400 font-medium">Not supported here</span>}
                </div>
              </Button>
            </div>
          </motion.div>
        )}

        {selectedMethod === 'none' && (
          <div className="w-full max-w-sm p-6 bg-amber-500/10 border border-amber-500/20 backdrop-blur-xl rounded-[2rem] text-center shadow-2xl">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-amber-400 text-lg font-bold mb-2 tracking-tight">No Biometrics Set Up</h3>
            <p className="text-amber-200/70 text-sm mb-6 leading-relaxed">You have not enrolled any biometric verification methods (Face or Fingerprint). Please configure this in your profile to check in.</p>
            <Button onClick={() => router.push('/employee/profile')} className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold rounded-xl">
              Go to Profile Setup
            </Button>
          </div>
        )}

        {selectedMethod === 'face' && (
          <FaceCapture
            checkType={checkType}
            onCapture={handleBiometricSubmit}
            onUseFingerprint={profile?.role !== 'admin' ? handleFingerprintSubmit : undefined}
            gpsVerified={gps.verified}
            gpsStatus={gps.status}
            gpsDistance={gps.distance}
            gpsRefresh={gps.refresh}
            branchName={profile?.branch_name}
            isLoading={submitting}
            gpsErrorMsg={gps.errorMsg}
          />
        )}

        {selectedMethod === 'fingerprint' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-2xl flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden"
          >
            {/* Ambient Background Glow for Fingerprint */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-purple-500/20 rounded-full blur-[60px] pointer-events-none" />

            <div className="p-5 bg-purple-500/10 border border-purple-500/20 rounded-3xl relative z-10 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
              <span className="text-5xl drop-shadow-lg">👆</span>
            </div>
            <div className="relative z-10">
              <h2 className="text-white text-xl font-bold tracking-tight mb-2">Fingerprint Verification</h2>
              <p className="text-slate-400 text-sm leading-relaxed px-4">Please verify your identity using your device&apos;s fingerprint scanner or passkey.</p>
            </div>
            <Button
              onClick={handleFingerprintSubmit}
              // Bug 6 fix: also pre-fetch WebAuthn options on hover/focus so they are
              // already cached when the user taps the button (minimizes awaits in handler)
              onMouseEnter={prefetchWebAuthnOptions}
              onFocus={prefetchWebAuthnOptions}
              onTouchStart={prefetchWebAuthnOptions}
              disabled={submitting || (gps.status === 'outside' && profile?.role !== 'admin' && profile?.role !== 'branch_manager')}
              isLoading={submitting}
              className="w-full h-14 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-300 relative z-10"
            >
              Scan Fingerprint
            </Button>

            {(gps.status === 'outside' && profile?.role !== 'admin' && profile?.role !== 'branch_manager') && (
              <p className="text-rose-300 text-xs font-medium mt-4 bg-rose-500/10 px-4 py-2.5 rounded-xl border border-rose-500/20 relative z-10 shadow-inner">
                {gps.status === 'locating' ? 'Locating...' : 'You must be inside or approaching the store to check in.'}
              </p>
            )}

            <button
              onClick={gps.refresh}
              className="text-slate-500 hover:text-white text-xs font-semibold uppercase tracking-wider mt-2 transition-colors relative z-10"
            >
              Refresh Location
            </button>
          </motion.div>
        )}
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

