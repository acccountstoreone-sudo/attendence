'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import {
  CheckCircle2, AlertCircle, MapPin, RefreshCw, Fingerprint
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { preloadHumanModels, getHumanInstance } from '@/lib/human-preload';
import type { Human } from '@vladmandic/human';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface FaceCaptureProps {
  /** Called on successful face capture + descriptor extract. Throws on API failure. */
  onCapture: (image: string, descriptor: number[], isManualCapture?: boolean) => Promise<void>;
  onUseFingerprint?: () => Promise<void>;
  gpsVerified: boolean;
  gpsStatus: 'locating' | 'inside' | 'approaching' | 'outside' | 'error' | 'not_configured' | 'permission_denied' | 'timeout' | 'not_supported' | 'position_unavailable';
  gpsDistance: number | null;
  gpsRefresh: () => void;
  branchName?: string;
  isLoading?: boolean;
  checkType?: 'in' | 'out';
  gpsErrorMsg?: string;
  isEnrollment?: boolean;
  uploadProgress?: number;
}

type Phase =
  | 'init'           // starting up
  | 'loading'        // loading face-api models
  | 'wait_gps'       // models ready, GPS not verified
  | 'ready'          // GPS verified, camera live — waiting to auto-scan
  | 'scanning'       // actively scanning for face
  | 'extract'        // extracting descriptor
  | 'review_enroll'  // enrollment review step
  | 'submit'         // calling onCapture()
  | 'success'        // done!
  | 'cam_err';       // camera error

// ─────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────

/** Speak via Web Speech API – non-blocking, safe */
function say(text: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.speechSynthesis?.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92; u.volume = 1;
    window.speechSynthesis?.speak(u);
  } catch { /* ignore */ }
}

/** Wait for video element to be ready to play (readyState >= 3) */
function waitForVideoReady(video: HTMLVideoElement, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 3) { resolve(); return; }
    const timer = setTimeout(() => {
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('loadeddata', onReady);
      // Don't hard reject — resolve anyway so the scan loop can still try
      resolve();
    }, timeoutMs);
    function onReady() {
      clearTimeout(timer);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('loadeddata', onReady);
      resolve();
    }
    video.addEventListener('canplay', onReady);
    video.addEventListener('loadeddata', onReady);
  });
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export const FaceCapture: React.FC<FaceCaptureProps> = ({
  onCapture, onUseFingerprint, gpsVerified, gpsStatus, gpsDistance, gpsRefresh,
  branchName, checkType = 'in', gpsErrorMsg, isEnrollment = false, uploadProgress
}) => {
  // ── Refs ──────────────────────────────────────────────
  const videoRef       = useRef<HTMLVideoElement | null>(null);
  const canvasRef      = useRef<HTMLCanvasElement | null>(null);
  const scanTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef     = useRef(true);
  const isCapturingRef = useRef(false);
  const phRef          = useRef<Phase>('init');
  const runCaptureRef  = useRef<((isManual: boolean) => Promise<void>) | undefined>(undefined);

  // ── State ─────────────────────────────────────────────
  const [phase, _setPhase]  = useState<Phase>('init');
  const [progress, setPr]   = useState(0);
  const [msg, setMsg]       = useState('Initializing...');
  const [msgType, setMT]    = useState<'info' | 'success' | 'error' | 'warn'>('info');
  const [camErr, setCamErr] = useState('');
  const [faceDetected, setFaceDetected] = useState(false);
  const [showManualBtn, setShowManualBtn] = useState(false);
  const lastFaceDescriptorRef = useRef<number[] | null>(null);
  const manualBtnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPhase = useCallback((p: Phase) => {
    if (!mountedRef.current) return;
    phRef.current = p;
    _setPhase(p);
  }, []);

  const announce = useCallback((text: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
    if (!mountedRef.current) return;
    setMsg(text); setMT(type); say(text);
  }, []);

  const stopScan = useCallback(() => {
    if (scanTimerRef.current) { cancelAnimationFrame(scanTimerRef.current as any); scanTimerRef.current = null; }
    if (manualBtnTimerRef.current) { clearTimeout(manualBtnTimerRef.current); manualBtnTimerRef.current = null; }
  }, []);

  // ── Camera ────────────────────────────────────────────
  const startCam = useCallback(async (): Promise<boolean> => {
    try {
      if (videoRef.current?.srcObject)
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } }, audio: false,
      });
      if (videoRef.current && mountedRef.current) {
        videoRef.current.srcObject = stream;
        // Ensure playback starts (needed on some Android browsers)
        videoRef.current.play().catch(() => {/* ignore autoplay policy errors */});
      }
      return true;
    } catch {
      setCamErr('Camera access denied. Please allow camera permissions in your browser settings, then tap "Try Again".');
      setPhase('cam_err');
      return false;
    }
  }, [setPhase]);

  const loadModels = useCallback(async () => {
    setPhase('loading');
    setPr(10);
    announce('Loading Face AI Models...', 'info');

    try {
      // Use the global preloader to avoid redundant loads
      const human = await preloadHumanModels();
      if (mountedRef.current) setPr(100);
      announce('Face AI Models Ready.', 'success');
      return human;
    } catch (err: any) {
      console.error(err);
      announce('Face AI Load Error: Failed to download model files. Check your internet connection.', 'error');
      return null;
    }
  }, [setPhase, announce]);

  // ── Face Scan Loop — auto detects when face appears ──
  const startScan = useCallback(() => {
    stopScan();
    setPhase('scanning');
    setFaceDetected(false);
    setShowManualBtn(false);
    lastFaceDescriptorRef.current = null;
    announce('Camera ready. Align your face in the frame.', 'info');

    if (manualBtnTimerRef.current) clearTimeout(manualBtnTimerRef.current);
    if (isEnrollment) {
      setShowManualBtn(true);
    } else {
      manualBtnTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setShowManualBtn(true);
      }, 3000);
    }

    let consecutiveFaceFrames = 0;

    // Start background loop
    const runBackgroundDetection = async () => {
      if (!mountedRef.current || phRef.current !== 'scanning') return;

      const v = videoRef.current;
      if (v && v.readyState >= 3 && !v.paused) {
        const human = getHumanInstance();
        if (human) {
          try {
            const res = await human.detect(v) as any;
            if (res && res.face && res.face.length > 0 && phRef.current === 'scanning') {
              setFaceDetected(true);
              lastFaceDescriptorRef.current = Array.from(res.face[0].embedding || []);
              consecutiveFaceFrames++;

              if (consecutiveFaceFrames >= 1) {
                if (!isCapturingRef.current) {
                  isCapturingRef.current = true;
                  stopScan();
                  if (runCaptureRef.current) {
                    runCaptureRef.current(false);
                  }
                  return;
                }
              }
            } else if (phRef.current === 'scanning') {
              setFaceDetected(false);
              consecutiveFaceFrames = 0;
            }
          } catch (e) {
            console.error('Background detection error:', e);
          }
        }
      }

      // Schedule next check using requestAnimationFrame for smoother performance
      if (mountedRef.current && phRef.current === 'scanning') {
        scanTimerRef.current = requestAnimationFrame(runBackgroundDetection) as any;
      }
    };

    scanTimerRef.current = requestAnimationFrame(runBackgroundDetection) as any;
  }, [stopScan, setPhase, announce, isEnrollment]);

  // ── Enrollment submit (Bug 1 fix: moved OUT of runCapture scope) ──────────
  const submitEnrollment = useCallback(async () => {
    setPhase('extract');
    announce('Processing image...', 'info');

    const c = canvasRef.current;
    if (!c) return;

    try {
      if (lastFaceDescriptorRef.current) {
        setPhase('submit');
        await onCapture(c.toDataURL('image/jpeg', 0.5), lastFaceDescriptorRef.current, false);
        return;
      }

      let human = getHumanInstance();
      if (!human) human = await preloadHumanModels();
      if (human) {
        const res = await human.detect(c) as any;
        if (res && res.face && res.face.length > 0 && res.face[0].embedding) {
          setPhase('submit');
          await onCapture(c.toDataURL('image/jpeg', 0.5), Array.from(res.face[0].embedding), false);
          return;
        }
      }

      // If AI fails on the captured frame
      announce('Face not clear in the photo. Please retake.', 'error');
      setPhase('review_enroll'); // Let them see it failed and they can hit retake
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Enrollment failed. Please try again.';
      announce(errMsg, 'error');
      isCapturingRef.current = false;
      setTimeout(() => { if (mountedRef.current) { videoRef.current?.play(); setPhase('scanning'); } }, 1500);
    }
  }, [onCapture, announce, setPhase]);

  // ── Capture + Extract Descriptor ──────────────────────
  // Bug 7 fix: added `isEnrollment` and `startScan` to dependency array.
  const runCapture = useCallback(async (isManual: boolean = false) => {
    const v  = videoRef.current;
    const c  = canvasRef.current;
    if (!v || !c) { isCapturingRef.current = false; return; }

    try {
      setPhase('extract');
      v.pause(); // Freeze video instantly so user knows photo is taken!

      const targetW = Math.min(v.videoWidth || 320, 320);
      const targetH = Math.round(targetW / (v.videoWidth / v.videoHeight || 1));
      c.width  = targetW;
      c.height = targetH;
      const ctx = c.getContext('2d');
      if (ctx) ctx.drawImage(v, 0, 0, targetW, targetH);
      // Reduce quality to 0.5 (super small) for fast upload
      const dataUrl = c.toDataURL('image/jpeg', 0.5);

      if (isEnrollment) {
        setPhase('review_enroll');
        announce('Review your photo and tap Submit to enroll.', 'success');
        return;
      }

      if (isManual) {
        // Nano-second Manual Capture: Completely bypass face-api extraction.
        // Return a zero array. The backend will accept this if manual capture is used
        // and route the check-in to the manager for manual approval.
        setPhase('submit');
        let captureError: unknown = null;
        try {
          // Bug 5 fix: pass `true` as isManualCapture so the parent sets
          // is_manual_override=true in the attendance payload.
          await onCapture(dataUrl, Array.from({ length: 1024 }, () => 0), true);
        } catch (err) {
          captureError = err;
        }

        if (captureError) {
          const errMsg = captureError instanceof Error ? captureError.message : 'Capture failed. Please try again.';
          announce(errMsg, 'error');
          isCapturingRef.current = false;
          setTimeout(() => { if (mountedRef.current) startScan(); }, 600);
        } else {
          setPhase('success');
          announce(
            checkType === 'in' ? 'Manual Check-in recorded!'
            : checkType === 'out' ? 'Manual Check-out recorded!'
            : 'Face captured successfully!',
            'success'
          );
        }
        return;
      }

      announce('Processing image...', 'info');

      // Use the pre-computed descriptor from our background loop
      let descriptor = lastFaceDescriptorRef.current;

      // Fallback: If not computed yet, run detection on canvas
      if (!descriptor) {
        // Wait for AI model if it's still loading in the background
        let human = getHumanInstance();
        if (!human) {
          announce('Loading AI...', 'info');
          human = await preloadHumanModels();
        }
        if (human) {
          const res = await human.detect(c) as any;
          if (res && res.face && res.face.length > 0 && res.face[0].embedding) {
            descriptor = Array.from(res.face[0].embedding);
          }
        }
      }

      if (!descriptor) {
        // Fallback to manual check-in if AI fails on a low quality photo
        announce('Face not clear. Sending to manager for manual review...', 'warn');
        setPhase('submit');
        let captureError: unknown = null;
        try {
          await onCapture(dataUrl, Array.from({ length: 1024 }, () => 0), true);
        } catch (err) {
          captureError = err;
        }

        if (captureError) {
          const errMsg = captureError instanceof Error ? captureError.message : 'Capture failed. Please try again.';
          announce(errMsg, 'error');
          isCapturingRef.current = false;
          setTimeout(() => { if (mountedRef.current) { v.play(); setPhase('scanning'); } }, 1000);
        } else {
          setPhase('success');
          announce(
            checkType === 'in' ? 'Manual Check-in recorded!'
            : checkType === 'out' ? 'Manual Check-out recorded!'
            : 'Manual capture recorded!',
            'success'
          );
        }
        return;
      }

      setPhase('submit');
      let captureError: unknown = null;
      try {
        await onCapture(dataUrl, descriptor, false);
      } catch (err) {
        captureError = err;
      }

      if (captureError) {
        const errMsg = captureError instanceof Error ? captureError.message : 'Enrollment failed. Please try again.';
        announce(errMsg, 'error');
        isCapturingRef.current = false;
        setTimeout(() => { if (mountedRef.current) { v.play(); setPhase('scanning'); } }, 1000);
      } else {
        // Success
        setPhase('success');
        announce(
          checkType === 'in' ? 'Identity confirmed. Check-in recorded!'
          : checkType === 'out' ? 'Identity confirmed. Check-out recorded!'
          : 'Face enrolled successfully!',
          'success'
        );
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unexpected error. Please try again.';
      announce(errMsg, 'error');
      isCapturingRef.current = false;
      setTimeout(() => { if (mountedRef.current) { v?.play(); setPhase('scanning'); } }, 1000);
    }
  // Bug 7 fix: include isEnrollment and startScan in deps
  }, [announce, setPhase, onCapture, checkType, isEnrollment, startScan]);

  useEffect(() => {
    runCaptureRef.current = runCapture;
  }, [runCapture]);

  // ── GPS change: start scan when verified ─────────────
  useEffect(() => {
    if (phRef.current !== 'wait_gps' && phase !== 'wait_gps') return;

    if (gpsVerified) {
      announce('Location verified! Starting face scan.', 'success');
      setTimeout(() => { if (mountedRef.current) startScan(); }, 300);
    } else {
      if (gpsStatus === 'not_configured') {
        announce('Store GPS not configured. Ask Admin to set branch location.', 'warn');
      } else if (gpsStatus === 'permission_denied') {
        announce('Location permission denied. Please allow location access.', 'error');
      } else if (gpsStatus === 'timeout') {
        announce('Location request timed out. Move to a clearer area and refresh.', 'warn');
      } else if (gpsStatus === 'not_supported') {
        announce('GPS not supported on this browser (requires HTTPS).', 'error');
      } else if (gpsStatus === 'position_unavailable') {
        announce(`Location unavailable: ${gpsErrorMsg || 'Please enable device location services.'}`, 'error');
      } else if (gpsStatus === 'error') {
        announce(`GPS error: ${gpsErrorMsg || 'Please tap refresh.'}`, 'warn');
      } else if (gpsStatus === 'locating') {
        announce('Detecting location...', 'info');
      } else {
        announce(`You are ${gpsDistance ?? '—'}m away. Move closer to the store.`, 'warn');
      }
    }
  }, [phase, gpsVerified, gpsStatus, gpsDistance, gpsErrorMsg, announce, startScan]);

  // ── Mount / Unmount ───────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    async function init() {
      const camOk = await startCam();
      if (!camOk) return;

      // Bug 4 fix: wait for the video element to be ready before proceeding.
      // On iPhone Safari, the camera stream may take 1–3s to buffer. If we call
      // startScan() immediately the readyState check inside the loop always fails
      // so no faces are ever detected.
      if (videoRef.current) {
        await waitForVideoReady(videoRef.current);
      }

      // Wait for models to load so user sees loading state
      await loadModels();

      if (!mountedRef.current) return;

      if (gpsVerified) {
        announce('Camera ready. Frame your face and capture.', 'info');
        startScan();
      } else {
        setPhase('wait_gps');
        if (gpsStatus === 'not_configured') {
          announce('Store GPS not configured. Ask Admin to set branch location.', 'warn');
        } else if (gpsStatus === 'permission_denied') {
          announce('Location permission denied. Please allow location access.', 'error');
        } else if (gpsStatus === 'locating') {
          announce('Detecting location...', 'info');
        } else {
          announce('You are outside the store geofence. Move closer.', 'warn');
        }
      }
    }

    init();

    const videoEl = videoRef.current;
    return () => {
      mountedRef.current = false;
      stopScan();
      if (videoEl?.srcObject) {
        (videoEl.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived state ─────────────────────────────────────
  const gpsOk        = gpsStatus === 'inside';
  const isProcessing = ['extract', 'submit', 'loading'].includes(phase);

  // ─────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between overflow-y-auto overflow-x-hidden min-h-0 py-2 bg-gradient-to-b from-[#020810] via-[#040D1A] to-[#020810] select-none">

      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-blue-600/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-[#16965a]/15 rounded-full blur-[90px] pointer-events-none" />

      {/* === GPS Status Pill === */}
      <div className="flex-none w-full flex items-center justify-center pt-4 pb-2 z-30 pointer-events-none px-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-full text-xs font-bold backdrop-blur-xl border pointer-events-auto shadow-2xl transition-colors duration-300
            ${gpsOk
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
              : gpsStatus === 'locating'
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-300 animate-pulse shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
            }`}
        >
          <MapPin className="w-4 h-4 shrink-0" />
          <span className="tracking-wide">
            {gpsOk ? `✓ Inside Zone (${branchName ?? 'Store'})`
              : gpsStatus === 'locating'           ? 'Locating Store GPS...'
              : gpsStatus === 'not_configured'     ? 'Store GPS not configured — Ask Admin'
              : gpsStatus === 'permission_denied'  ? 'Location Access Denied — Allow & Refresh'
              : gpsStatus === 'timeout'            ? 'Location Timeout — Tap refresh'
              : gpsStatus === 'not_supported'      ? 'GPS requires HTTPS'
              : gpsStatus === 'position_unavailable' ? `Location Unavailable: ${gpsErrorMsg || 'Turn on device GPS'}`
              : gpsStatus === 'error'              ? `GPS Error: ${gpsErrorMsg || 'Tap refresh'}`
              : `${gpsDistance ?? '—'}m away from ${branchName ?? 'store'}`}
          </span>
          {(!gpsOk && gpsStatus !== 'locating') && (
            <button onClick={gpsRefresh} className="ml-2 p-1.5 hover:bg-white/10 rounded-full transition-colors focus:outline-none">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </motion.div>
      </div>

      {/* === Camera Pod === */}
      <div className="flex-1 flex flex-col items-center justify-center my-auto z-20 w-full px-4">

        {/* Camera box with animated border based on face detection */}
        <div
          className="relative w-[76%] sm:w-[320px] max-w-[340px] max-h-[38vh] aspect-[1/1] sm:aspect-[3/4] rounded-[2rem] sm:rounded-[2.5rem] p-1.5 transition-all duration-500 shadow-2xl flex items-center justify-center shrink-0 my-1"
          style={{
            background: phase === 'success'
              ? 'linear-gradient(135deg, #10B981, #059669)'
              : phase === 'cam_err'
              ? 'linear-gradient(135deg, #F43F5E, #E11D48)'
              : isProcessing
              ? 'linear-gradient(135deg, #10B981, #3B82F6)'
              : 'linear-gradient(135deg, #3B82F6, #1E3A5F)',
            boxShadow: phase === 'success'
              ? '0 0 55px rgba(16, 185, 129, 0.5)'
              : isProcessing
              ? '0 0 50px rgba(16,185,129,0.45)'
              : '0 0 45px rgba(59, 130, 246, 0.35)'
          }}
        >
          {/* Inner bezel */}
          <div className="relative w-full h-full rounded-[1.8rem] sm:rounded-[2.1rem] overflow-hidden bg-white shadow-inner">

            {/* Live camera feed */}
            <video
              ref={videoRef}
              autoPlay playsInline muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />

            {/* Model loading progress overlay */}
            {phase === 'loading' && (
              <div className="absolute inset-0 bg-[#020810]/90 backdrop-blur-sm flex flex-col items-center justify-center z-20 gap-4 px-6">
                <div className="w-10 h-10 border-[3px] border-white/20 border-t-blue-400 rounded-full animate-spin" />
                <p className="text-white font-bold text-sm tracking-wide text-center">{msg}</p>
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-slate-400 text-xs">{progress}%</p>
              </div>
            )}

            {/* Scanning laser line — active during scanning and processing */}
            {(isProcessing || phase === 'scanning') && phase !== 'loading' && (
              <motion.div
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                className={`absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent ${faceDetected ? 'via-emerald-400' : 'via-blue-400'} to-transparent shadow-[0_0_16px_${faceDetected ? '#34D399' : '#60A5FA'}] z-20 pointer-events-none`}
              />
            )}

            {/* Futuristic Face Detection HUD */}
            <AnimatePresence>
              {phase === 'scanning' && faceDetected && (
                <motion.div 
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-8 border border-emerald-400/50 rounded-2xl z-20 pointer-events-none flex items-center justify-center shadow-[inset_0_0_30px_rgba(52,211,153,0.2)]"
                >
                  {/* Crosshairs */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  
                  {/* Central focus ring */}
                  <div className="w-24 h-24 border border-emerald-400/40 rounded-full flex items-center justify-center">
                    <div className="w-20 h-20 border border-emerald-400/20 rounded-full animate-ping" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Corner brackets */}
            {['tl', 'tr', 'bl', 'br'].map(pos => (
              <div key={pos} className={`absolute w-7 h-7 z-10 pointer-events-none drop-shadow
                ${phase === 'success' ? 'border-[#1dbf73]' : 'border-white/80'}
                ${pos === 'tl' ? 'top-5 left-5 border-t-2 border-l-2 rounded-tl-xl'
                : pos === 'tr' ? 'top-5 right-5 border-t-2 border-r-2 rounded-tr-xl'
                : pos === 'bl' ? 'bottom-5 left-5 border-b-2 border-l-2 rounded-bl-xl'
                               : 'bottom-5 right-5 border-b-2 border-r-2 rounded-br-xl'}`}
              />
            ))}

            {/* Success overlay */}
            {phase === 'success' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-emerald-950/85 backdrop-blur-md flex flex-col items-center justify-center z-30"
              >
                <motion.div
                  initial={{ scale: 0.5 }}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6 }}
                >
                  <CheckCircle2 className="w-24 h-24 text-emerald-400 drop-shadow-[0_0_24px_rgba(52,211,153,0.9)]" />
                </motion.div>
                <p className="text-white font-extrabold text-xl mt-4 tracking-tight drop-shadow">Identity Verified!</p>
              </motion.div>
            )}

            {/* Camera error overlay */}
            {phase === 'cam_err' && (
              <div className="absolute inset-0 bg-[#020810]/95 backdrop-blur-xl flex flex-col items-center justify-center z-30 p-6 text-center">
                <AlertCircle className="w-14 h-14 text-rose-500 mb-3 drop-shadow-[0_0_16px_rgba(244,63,94,0.6)]" />
                <p className="text-white font-bold text-base mb-1">Camera Required</p>
                <p className="text-rose-200/80 text-xs mb-4 leading-relaxed px-4">{camErr}</p>
                <Button size="sm" onClick={startCam} className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.4)]" icon={<RefreshCw className="w-3.5 h-3.5" />}>
                  Retry Access
                </Button>
              </div>
            )}
          </div>
        </div>

        {phase === 'review_enroll' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex w-full gap-3 mt-4 px-6"
          >
            <button
              onClick={() => {
                isCapturingRef.current = false;
                if (videoRef.current) videoRef.current.play();
                startScan();
              }}
              className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition-all"
            >
              Retake
            </button>
            <button
              onClick={submitEnrollment}
              className="flex-[2] py-3.5 bg-[#1dbf73] hover:bg-[#16965a] text-white font-extrabold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              Submit
            </button>
          </motion.div>
        )}

        {/* Manual Capture Button */}
        {phase === 'scanning' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center mt-3 space-y-2"
          >
            <p className="text-blue-300 text-xs font-medium text-center px-4">
              {!showManualBtn
                ? (faceDetected ? 'Face detected! Hold still for auto-capture...' : 'Align your face in the frame for auto-capture.')
                : (!isEnrollment
                  ? (faceDetected
                    ? 'Face detected! Tap "Capture Face" to submit.'
                    : 'Align your face in the frame to capture, or use Instant Capture.')
                  : (faceDetected
                    ? 'Face detected! Tap "Capture" to take a photo.'
                    : 'Align your face in the frame.'))}
            </p>
            <div className="flex gap-4">
              {!showManualBtn ? (
                <div className="px-6 py-3 bg-slate-900/60 text-slate-400 font-bold text-sm rounded-xl flex items-center space-x-2 border border-slate-800">
                  <span className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-emerald-500' : 'bg-blue-500'} animate-ping`} />
                  <span className={faceDetected ? 'text-emerald-400' : ''}>{faceDetected ? 'Capturing...' : 'Auto-scanning...'}</span>
                </div>
              ) : (
                <>
                  {faceDetected ? (
                    <button
                      onClick={() => {
                        if (isCapturingRef.current) return;
                        isCapturingRef.current = true;
                        stopScan();
                        runCapture(false); // Run real face extraction
                      }}
                      className="px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white font-extrabold text-sm rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all active:scale-95 flex items-center space-x-2 animate-pulse"
                    >
                      <span className="text-lg">📸</span>
                      <span>{isEnrollment ? 'Capture' : 'Capture Face'}</span>
                    </button>
                  ) : (
                    <button
                      disabled
                      type="button"
                      className="px-6 py-3 bg-slate-900/60 text-slate-400 font-bold text-sm rounded-xl cursor-not-allowed flex items-center space-x-2 border border-slate-800"
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <span>Looking for face...</span>
                    </button>
                  )}
                  {!isEnrollment && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isCapturingRef.current) return;
                        isCapturingRef.current = true;
                        stopScan();
                        runCapture(true); // Run manual bypass capture
                      }}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all active:scale-95 flex items-center space-x-2"
                    >
                      <span className="text-lg">⚡</span>
                      <span>Instant Capture</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* === Bottom Status UI === */}
      <div className="flex-none w-full flex flex-col items-center z-30 pb-4 px-6 shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>

        {/* GPS out-of-zone warning */}
        {!gpsOk && phase !== 'loading' && phase !== 'cam_err' && phase !== 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm mb-3 flex items-start space-x-3 bg-rose-500/10 border border-rose-500/20 backdrop-blur-xl px-5 py-4 rounded-[1.5rem] shadow-[0_0_30px_rgba(244,63,94,0.1)]"
          >
            <div className="p-2 bg-rose-500/20 rounded-full shrink-0">
              <AlertCircle className="w-5 h-5 text-rose-400" />
            </div>
            <span className="text-rose-200 text-sm font-medium leading-relaxed mt-1">
              {gpsStatus === 'not_configured'
                ? 'Store GPS location not configured. Ask Admin to set it.'
                : gpsStatus === 'permission_denied'
                ? 'Location permission denied. Please allow access in browser and refresh.'
                : gpsStatus === 'timeout'
                ? 'Location request timed out. Tap refresh to try again.'
                : gpsStatus === 'not_supported'
                ? 'GPS is not supported by your browser. Please use HTTPS.'
                : gpsStatus === 'position_unavailable'
                ? `Location Unavailable: ${gpsErrorMsg || 'Please turn on your device location services.'}`
                : gpsStatus === 'error'
                ? `GPS Error: ${gpsErrorMsg || 'Please tap refresh.'}`
                : gpsStatus === 'locating'
                  ? 'Detecting your location...'
                  : `You are ${gpsDistance}m from ${branchName}. Move inside the store.`}
            </span>
          </motion.div>
        )}

        {/* Processing state */}
        {isProcessing && phase !== 'loading' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm flex flex-col space-y-3 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] px-6 py-5 mb-3 shadow-[0_0_40px_rgba(59,130,246,0.15)] relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10" />
            <div className="flex items-center space-x-4 relative z-10">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-6 h-6 border-2 border-white/20 border-t-blue-400 rounded-full shrink-0"
              />
              <p className="text-white font-bold text-base tracking-wide">{msg}</p>
            </div>
            {uploadProgress !== undefined && uploadProgress > 0 && uploadProgress <= 100 && (
              <div className="relative z-10 w-full mt-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-blue-200 font-medium">Uploading...</span>
                  <span className="text-xs text-blue-200 font-bold">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden shadow-inner">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* General status message */}
        {!isProcessing && phase !== 'success' && phase !== 'cam_err' && phase !== 'loading' && (
          <AnimatePresence mode="wait">
            <motion.p
              key={msg}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`w-full max-w-sm text-center text-sm font-bold px-6 py-4 rounded-[1.5rem] mb-3 border backdrop-blur-xl shadow-2xl tracking-wide transition-colors duration-300
                ${msgType === 'error'   ? 'bg-rose-500/10 border-rose-500/20 text-rose-200 shadow-[0_0_30px_rgba(244,63,94,0.15)]'
                : msgType === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.15)]'
                : msgType === 'warn'    ? 'bg-amber-500/10 border-amber-500/20 text-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.15)]'
                : 'bg-white/5 border-white/10 text-white'}`}
            >
              {msg}
            </motion.p>
          </AnimatePresence>
        )}

        {/* Fingerprint option */}
        {onUseFingerprint && phase !== 'success' && phase !== 'loading' && (
          <button
            onClick={onUseFingerprint}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold transition-all duration-300 mt-1 px-5 py-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10"
          >
            <Fingerprint className="w-4 h-4" />
            Use Fingerprint Instead
          </button>
        )}

        {/* Security badge */}
        {!['cam_err', 'loading', 'success'].includes(phase) && (
          <p className="text-slate-500 text-[10px] uppercase tracking-[0.15em] text-center mt-3 font-bold flex items-center justify-center space-x-2">
            <span>🔒 Biometric Match</span>
            <span className="opacity-50">•</span>
            <span>Local AI</span>
          </p>
        )}
      </div>

      {/* Hidden canvas for snapshot */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
