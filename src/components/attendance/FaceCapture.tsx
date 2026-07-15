'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import {
  CheckCircle2, AlertCircle, MapPin, RefreshCw, Fingerprint
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface FaceCaptureProps {
  /** Called on successful face capture + descriptor extract. Throws on API failure. */
  onCapture: (image: string, descriptor: number[]) => Promise<void>;
  onUseFingerprint?: () => Promise<void>;
  gpsVerified: boolean;
  gpsStatus: 'locating' | 'inside' | 'approaching' | 'outside' | 'error' | 'not_configured' | 'permission_denied' | 'timeout' | 'not_supported' | 'position_unavailable';
  gpsDistance: number | null;
  gpsRefresh: () => void;
  branchName?: string;
  isLoading?: boolean;
  checkType?: 'in' | 'out';
  gpsErrorMsg?: string;
}

type Phase =
  | 'init'      // starting up
  | 'loading'   // loading face-api models
  | 'wait_gps'  // models ready, GPS not verified
  | 'ready'     // GPS verified, camera live — waiting to auto-scan
  | 'scanning'  // actively scanning for face
  | 'extract'   // extracting descriptor
  | 'submit'    // calling onCapture()
  | 'success'   // done!
  | 'cam_err';  // camera error

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

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export const FaceCapture: React.FC<FaceCaptureProps> = ({
  onCapture, onUseFingerprint, gpsVerified, gpsStatus, gpsDistance, gpsRefresh,
  branchName, checkType = 'in', gpsErrorMsg
}) => {
  // ── Refs ──────────────────────────────────────────────
  const videoRef       = useRef<HTMLVideoElement | null>(null);
  const canvasRef      = useRef<HTMLCanvasElement | null>(null);
  const faRef          = useRef<typeof import('@vladmandic/face-api') | null>(null);
  const scanTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef     = useRef(true);
  const isCapturingRef = useRef(false);
  const phRef          = useRef<Phase>('init');
  const runCaptureRef  = useRef<(() => Promise<void>) | undefined>(undefined);

  // ── State ─────────────────────────────────────────────
  const [phase, _setPhase]  = useState<Phase>('init');
  const [progress, setPr]   = useState(0);
  const [msg, setMsg]       = useState('Initializing...');
  const [msgType, setMT]    = useState<'info' | 'success' | 'error' | 'warn'>('info');
  const [camErr, setCamErr] = useState('');
  const [faceDetected, setFaceDetected] = useState(false);

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
    if (scanTimerRef.current) { clearTimeout(scanTimerRef.current); scanTimerRef.current = null; }
  }, []);

  // ── Camera ────────────────────────────────────────────
  const startCam = useCallback(async (): Promise<boolean> => {
    try {
      if (videoRef.current?.srcObject)
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }, audio: false,
      });
      if (videoRef.current && mountedRef.current) {
        videoRef.current.srcObject = stream;
      }
      return true;
    } catch {
      setCamErr('Camera access denied. Please allow camera permissions in your browser settings, then tap "Try Again".');
      setPhase('cam_err');
      return false;
    }
  }, [setPhase]);

  // ── Model loading ─────────────────────────────────────
  const loadModels = useCallback(async () => {
    setPhase('loading');
    setPr(5);
    try {
      const fa = await import('@vladmandic/face-api');
      await Promise.all([
        fa.nets.tinyFaceDetector.loadFromUri('/models').then(() => { if (mountedRef.current) setPr(p => p + 30); }),
        fa.nets.faceLandmark68Net.loadFromUri('/models').then(() => { if (mountedRef.current) setPr(p => p + 30); }),
        fa.nets.faceRecognitionNet.loadFromUri('/models').then(() => { if (mountedRef.current) setPr(p => p + 35); }),
      ]);
      faRef.current = fa;
      setPr(100);
      return fa;
    } catch {
      announce('Failed to load biometric system. Please refresh.', 'error');
      return null;
    }
  }, [setPhase, announce]);

  // ── Face Scan Loop — auto detects when face appears ──
  const startScan = useCallback(() => {
    stopScan();
    setPhase('scanning');
    setFaceDetected(false);
    announce('Look straight at the camera...', 'info');

    const loop = async () => {
      const fa = faRef.current;
      const v  = videoRef.current;
      const ph = phRef.current;

      if (ph === 'cam_err' || !mountedRef.current) { stopScan(); return; }
      if (ph !== 'scanning') return;
      if (!fa || !v || v.readyState < 3) {
        scanTimerRef.current = setTimeout(loop, 150) as any;
        return;
      }
      if (isCapturingRef.current) return;

      try {
        const det = await fa
          .detectSingleFace(v, new fa.TinyFaceDetectorOptions({ scoreThreshold: 0.55 }))
          .withFaceLandmarks();

        if (!det) {
          if (mountedRef.current) {
            setFaceDetected(false);
            setMsg('No face detected. Look directly at the camera.');
          }
        } else {
          // Face must be large enough (at least 8% of frame) to ensure it's not too far
          const { width: fw, height: fh } = det.detection.box;
          const frameArea = (v.videoWidth || 640) * (v.videoHeight || 640);
          if ((fw * fh) / frameArea < 0.08) {
            if (mountedRef.current) {
              setFaceDetected(false);
              setMsg('Move closer to the camera.');
            }
          } else {
            // Face detected — auto-capture immediately
            setFaceDetected(true);
            isCapturingRef.current = true;
            stopScan();
            if (runCaptureRef.current) await runCaptureRef.current();
            return; // stop loop since we captured
          }
        }
      } catch { /* silently continue */ }

      // Schedule next frame only after current processing finishes
      scanTimerRef.current = setTimeout(loop, 150) as any;
    };

    loop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopScan, setPhase, announce]);

  // ── Capture + Extract Descriptor ──────────────────────
  const runCapture = useCallback(async () => {
    const fa = faRef.current;
    const v  = videoRef.current;
    const c  = canvasRef.current;
    if (!fa || !v || !c) { isCapturingRef.current = false; return; }

    try {
      setPhase('extract');
      announce('Analyzing biometric signature...', 'info');

      // Capture frame preserving exact aspect ratio to prevent facial squashing
      const videoAspectRatio = v.videoWidth / v.videoHeight || 1;
      const targetW = Math.min(v.videoWidth || 640, 640);
      const targetH = Math.round(targetW / videoAspectRatio);
      
      c.width  = targetW;
      c.height = targetH;
      const ctx = c.getContext('2d');
      if (!ctx) { isCapturingRef.current = false; return; }
      ctx.drawImage(v, 0, 0, targetW, targetH);
      // Reduce JPEG quality significantly to prevent offline storage bloat and payload limits
      const dataUrl = c.toDataURL('image/jpeg', 0.6);

      // Extract descriptor from captured frame
      const img = new Image(); img.src = dataUrl;
      await new Promise<void>(r => { img.onload = () => r(); });

      const allFaces = await fa
        .detectAllFaces(img, new fa.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (!allFaces || allFaces.length === 0) {
        announce('Face not clear. Please try again.', 'error');
        isCapturingRef.current = false;
        setTimeout(() => { if (mountedRef.current) startScan(); }, 1500);
        return;
      }

      if (allFaces.length > 1) {
        announce('Multiple faces detected. Please be alone in front of the camera.', 'error');
        isCapturingRef.current = false;
        setTimeout(() => { if (mountedRef.current) startScan(); }, 2000);
        return;
      }

      // Submit to parent (server will do the actual face match comparison)
      setPhase('submit');
      announce('Matching your identity. Please wait.', 'info');
      await onCapture(dataUrl, Array.from(allFaces[0].descriptor));

      // Success
      setPhase('success');
      announce(`Identity confirmed. Check-${checkType} recorded!`, 'success');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Verification failed. Please try again.';
      announce(errMsg, 'error');
      isCapturingRef.current = false;
      setTimeout(() => { if (mountedRef.current) startScan(); }, 3000);
    }
  }, [announce, setPhase, onCapture, checkType, startScan]);

  useEffect(() => {
    runCaptureRef.current = runCapture;
  }, [runCapture]);

  // ── GPS change: start scan when verified ─────────────
  useEffect(() => {
    if (phRef.current !== 'wait_gps' && phase !== 'wait_gps') return;

    if (gpsVerified) {
      announce('Location verified! Starting face scan.', 'success');
      setTimeout(() => { if (mountedRef.current) startScan(); }, 800);
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

      const fa = await loadModels();
      if (!fa) return;

      if (gpsVerified) {
        announce('Camera ready. Look straight at the camera.', 'info');
        setTimeout(() => { if (mountedRef.current) startScan(); }, 600);
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
  const isProcessing = ['extract', 'submit'].includes(phase);

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
              : faceDetected || isProcessing
              ? 'linear-gradient(135deg, #10B981, #3B82F6)'
              : 'linear-gradient(135deg, #3B82F6, #1E3A5F)',
            boxShadow: phase === 'success'
              ? '0 0 55px rgba(16, 185, 129, 0.5)'
              : faceDetected || isProcessing
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

            {/* Scanning laser line — when actively scanning */}
            {(phase === 'scanning' || isProcessing) && (
              <motion.div
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_16px_#60A5FA] z-20 pointer-events-none"
              />
            )}

            {/* Corner brackets */}
            {['tl', 'tr', 'bl', 'br'].map(pos => (
              <div key={pos} className={`absolute w-7 h-7 z-10 pointer-events-none drop-shadow
                ${faceDetected || phase === 'success' ? 'border-[#1dbf73]' : 'border-white/80'}
                ${pos === 'tl' ? 'top-5 left-5 border-t-2 border-l-2 rounded-tl-xl'
                : pos === 'tr' ? 'top-5 right-5 border-t-2 border-r-2 rounded-tr-xl'
                : pos === 'bl' ? 'bottom-5 left-5 border-b-2 border-l-2 rounded-bl-xl'
                               : 'bottom-5 right-5 border-b-2 border-r-2 rounded-br-xl'}`}
              />
            ))}

            {/* Face detected pulse ring */}
            {faceDetected && phase === 'scanning' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="absolute inset-8 border-2 border-emerald-400 rounded-full pointer-events-none z-10"
              />
            )}

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

            {/* Model loading overlay */}
            {phase === 'loading' && (
              <div className="absolute inset-0 bg-[#020810]/95 backdrop-blur-xl flex flex-col items-center justify-center z-30 p-6 text-center">
                <div className="w-40 h-2 bg-white/10 rounded-full overflow-hidden shadow-inner mb-4">
                  <motion.div
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.35 }}
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-400 to-blue-400 rounded-full shadow-[0_0_10px_rgba(96,165,250,0.5)]"
                  />
                </div>
                <p className="text-white text-sm font-bold tracking-wide">Loading Biometrics</p>
                <p className="text-slate-400 text-xs mt-1 font-medium">{progress}%</p>
              </div>
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

        {/* Face detection indicator dot */}
        {phase === 'scanning' && (
          <div className="flex items-center space-x-2 mt-4 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
            <motion.div
              animate={faceDetected
                ? { scale: [1, 1.4, 1], backgroundColor: ['#34D399', '#10B981', '#34D399'] }
                : { scale: [1, 1.2, 1] }
              }
              transition={{ repeat: Infinity, duration: faceDetected ? 0.8 : 1.5 }}
              className={`w-2.5 h-2.5 rounded-full ${faceDetected ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)]'}`}
            />
            <span className={`text-xs font-bold tracking-wide uppercase ${faceDetected ? 'text-emerald-400' : 'text-blue-300'}`}>
              {faceDetected ? 'Face Detected' : 'Scanning...'}
            </span>
          </div>
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
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm flex items-center space-x-4 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] px-6 py-5 mb-3 shadow-[0_0_40px_rgba(59,130,246,0.15)] relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10" />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-6 h-6 border-2 border-white/20 border-t-blue-400 rounded-full shrink-0 relative z-10"
            />
            <p className="text-white font-bold text-base tracking-wide relative z-10">{msg}</p>
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

