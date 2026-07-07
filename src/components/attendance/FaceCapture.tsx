'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import {
  CheckCircle2, AlertCircle, Eye, Smile,
  ArrowLeftRight, MapPin, RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface FaceCaptureProps {
  /** Called on successful liveness + capture. Throws on API failure. */
  onCapture: (image: string, descriptor: number[]) => Promise<void>;
  gpsVerified: boolean;
  gpsStatus: 'locating' | 'inside' | 'approaching' | 'outside' | 'error';
  gpsDistance: number | null;
  gpsRefresh: () => void;
  branchName?: string;
  isLoading?: boolean;
  checkType?: 'in' | 'out';
}

type Challenge = 'blink' | 'smile' | 'turn_right';
type Phase =
  | 'init'           // starting up
  | 'loading'        // loading face-api models
  | 'wait_gps'       // models ready, GPS not verified
  | 'challenge'      // running a liveness challenge
  | 'between'        // brief gap between challenge 1 and 2
  | 'motion'         // anti-spoofing motion entropy check
  | 'extract'        // extracting face descriptor
  | 'submit'         // calling onCapture()
  | 'success'        // done!
  | 'cam_err';       // camera permission denied

// ─────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────

function d2(a: {x:number;y:number}, b: {x:number;y:number}): number {
  return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);
}

/** Eye Aspect Ratio (s = first index of 6 eye landmarks) */
function ear(pts: {x:number;y:number}[], s: number): number {
  const h = d2(pts[s], pts[s+3]);
  return h < 1 ? 1 : (d2(pts[s+1], pts[s+5]) + d2(pts[s+2], pts[s+4])) / (2*h);
}

/** Returns true if the current face landmarks satisfy the given challenge */
function isMet(pts: {x:number;y:number}[], ch: Challenge): boolean {
  if (ch === 'blink')
    return (ear(pts,36) + ear(pts,42)) / 2 < 0.22;
  if (ch === 'smile')
    return d2(pts[48], pts[54]) / Math.max(d2(pts[0], pts[16]), 1) > 0.44;
  // turn_right: nose tip shifted right of face center
  return (pts[30].x - (pts[0].x + pts[16].x)/2) / Math.max(d2(pts[0], pts[16]), 1) > 0.10;
}

/** Capture a tiny frame for motion entropy comparison */
async function sampleFrame(v: HTMLVideoElement, sz=52): Promise<Uint8ClampedArray> {
  const c = document.createElement('canvas');
  c.width = sz; c.height = sz;
  c.getContext('2d')!.drawImage(v, 0, 0, sz, sz);
  return c.getContext('2d')!.getImageData(0, 0, sz, sz).data;
}

/** Average absolute pixel difference between two frames (red channel only) */
function motionScore(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let s = 0;
  for (let i=0; i<a.length; i+=4) s += Math.abs(a[i]-b[i]);
  return s / (a.length/4);
}

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

/** Pick 2 random unique challenges */
function pickTwo(): [Challenge, Challenge] {
  const all: Challenge[] = ['blink', 'smile', 'turn_right'];
  all.sort(() => Math.random() - 0.5);
  return [all[0], all[1]];
}

const CONF: Record<Challenge, {
  label: string; spoken: string;
  icon: React.ReactNode; color: string;
}> = {
  blink:      { label: 'Slowly blink your eyes',     spoken: 'Please slowly blink your eyes',        icon: <Eye className="w-8 h-8"/>,            color: '#60A5FA' },
  smile:      { label: 'Smile naturally',             spoken: 'Please smile naturally',               icon: <Smile className="w-8 h-8"/>,          color: '#FBBF24' },
  turn_right: { label: 'Turn head slightly to right', spoken: 'Please turn your head to the right',   icon: <ArrowLeftRight className="w-8 h-8"/>, color: '#A78BFA' },
};

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export const FaceCapture: React.FC<FaceCaptureProps> = ({
  onCapture, gpsVerified, gpsStatus, gpsDistance, gpsRefresh,
  branchName, isLoading=false, checkType='in'
}) => {
  // ── Refs (mutable, no re-render needed) ──────────────
  const videoRef   = useRef<HTMLVideoElement|null>(null);
  const canvasRef  = useRef<HTMLCanvasElement|null>(null);
  const faRef      = useRef<typeof import('@vladmandic/face-api')|null>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval>|null>(null);
  const okCntRef   = useRef(0);
  const chsRef     = useRef<[Challenge,Challenge]>(['blink','smile']);
  const chIdxRef   = useRef<0|1>(0);
  const phRef      = useRef<Phase>('init');
  const mountedRef = useRef(true);

  // ── State (triggers re-renders) ──────────────────────
  const [phase, _setPhase]  = useState<Phase>('init');
  const [progress, setPr]   = useState(0);
  const [msg, setMsg]       = useState('Initializing...');
  const [msgType, setMT]    = useState<'info'|'success'|'error'|'warn'>('info');
  const [camErr, setCamErr] = useState('');
  const [hasCam, setHasCam] = useState<boolean|null>(null);
  // Track challenge index for rendering (ref alone doesn't trigger re-render)
  const [chIdx, setChIdx]   = useState<0|1>(0);

  // Synced phase setter keeps ref + state in sync
  const setPhase = useCallback((p: Phase) => {
    if (!mountedRef.current) return;
    phRef.current = p;
    _setPhase(p);
  }, []);

  // Announce + speak
  const announce = useCallback((text: string, type: 'info'|'success'|'error'|'warn'='info') => {
    if (!mountedRef.current) return;
    setMsg(text); setMT(type); say(text);
  }, []);

  const stopLoop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── Camera ───────────────────────────────────────────
  const startCam = useCallback(async (): Promise<boolean> => {
    try {
      if (videoRef.current?.srcObject)
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t=>t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode:'user', width:{ideal:640}, height:{ideal:640} }, audio:false,
      });
      if (videoRef.current && mountedRef.current) {
        videoRef.current.srcObject = stream;
        setHasCam(true);
      }
      return true;
    } catch {
      setHasCam(false);
      setCamErr('Camera access denied. Please allow camera permissions in your browser settings, then tap "Try Again".');
      setPhase('cam_err');
      return false;
    }
  }, [setPhase]);

  // ── Model loading ────────────────────────────────────
  const loadModels = useCallback(async () => {
    setPhase('loading');
    setPr(5);
    try {
      const fa = await import('@vladmandic/face-api');
      await Promise.all([
        fa.nets.tinyFaceDetector.loadFromUri('/models').then(()=>{ if(mountedRef.current) setPr(p=>p+30); }),
        fa.nets.faceLandmark68Net.loadFromUri('/models').then(()=>{ if(mountedRef.current) setPr(p=>p+30); }),
        fa.nets.faceRecognitionNet.loadFromUri('/models').then(()=>{ if(mountedRef.current) setPr(p=>p+35); }),
      ]);
      faRef.current = fa;
      setPr(100);
      return fa;
    } catch {
      announce('Failed to load biometric system. Please refresh.','error');
      return null;
    }
  }, [setPhase, announce]);

  // ── Liveness loop ────────────────────────────────────
  const startLiveness = useCallback(() => {
    stopLoop();
    const challenges = pickTwo();
    chsRef.current   = challenges;
    chIdxRef.current = 0;
    okCntRef.current = 0;
    setChIdx(0);

    setPhase('challenge');
    announce(CONF[challenges[0]].spoken, 'info');

    timerRef.current = setInterval(async () => {
      const fa  = faRef.current;
      const v   = videoRef.current;
      const ph  = phRef.current;
      if (!fa || !v || v.readyState < 3) return;
      // Only run during active challenge phase
      if (ph !== 'challenge') return;

      try {
        const det = await fa
          .detectSingleFace(v, new fa.TinyFaceDetectorOptions({ scoreThreshold: 0.75 }))
          .withFaceLandmarks();

        if (!det) {
          if (mountedRef.current) setMsg('No face detected. Look directly at the camera.');
          say('No face detected. Look at the camera.');
          return;
        }

        // Anti-spoofing: face area must be at least 8% of frame
        const { width:fw, height:fh } = det.detection.box;
        const frameArea = (v.videoWidth||640) * (v.videoHeight||640);
        if ((fw*fh)/frameArea < 0.08) {
          if (mountedRef.current) setMsg('Move closer to the camera.');
          return;
        }

        const idx = chIdxRef.current;
        const ch  = chsRef.current[idx];
        const pts = det.landmarks.positions as {x:number;y:number}[];

        if (isMet(pts, ch)) {
          okCntRef.current++;
          if (okCntRef.current >= 3) {
            // Challenge passed
            okCntRef.current = 0;

            if (idx === 0) {
              // Move to challenge 2
              chIdxRef.current = 1;
              setChIdx(1);
              phRef.current = 'between';
              _setPhase('between');
              const next = chsRef.current[1];
              say(`Well done! Now, ${CONF[next].spoken.toLowerCase()}`);
              if (mountedRef.current) setMsg(`✓ Done! Now: ${CONF[next].label}`);

              setTimeout(() => {
                if (!mountedRef.current) return;
                phRef.current = 'challenge';
                _setPhase('challenge');
                announce(CONF[next].spoken, 'info');
              }, 1600);
            } else {
              // Both challenges passed → motion check
              stopLoop();
              setPhase('motion');
            }
          }
        } else {
          okCntRef.current = 0;
          if (mountedRef.current) setMsg(CONF[ch].label);
        }
      } catch { /* silently continue */ }
    }, 280);
  }, [stopLoop, setPhase, announce]);

  // ── Anti-spoofing + capture + extract ───────────────
  const runCapture = useCallback(async () => {
    const fa = faRef.current;
    const v  = videoRef.current;
    const c  = canvasRef.current;
    if (!fa || !v || !c) return;

    announce('Anti-spoofing check...', 'info');

    try {
      // 1. Motion entropy: compare 2 frames 750ms apart
      const f1 = await sampleFrame(v);
      await new Promise(r => setTimeout(r, 750));
      const f2 = await sampleFrame(v);
      const score = motionScore(f1, f2);

      if (score < 1.8) {
        // Near-zero motion = static photo attempt
        announce('Static image detected! Please use a live camera.', 'error');
        setTimeout(() => { if (mountedRef.current) startLiveness(); }, 2500);
        return;
      }

      // 2. Capture full-res frame
      c.width  = v.videoWidth  || 640;
      c.height = v.videoHeight || 640;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(v, 0, 0);
      const dataUrl = c.toDataURL('image/jpeg', 0.92);

      // 3. Extract face descriptor
      setPhase('extract');
      announce('Analyzing biometric signature...', 'info');

      const img = new Image(); img.src = dataUrl;
      await new Promise<void>(r => { img.onload = () => r(); });

      const result = await fa
        .detectSingleFace(img, new fa.TinyFaceDetectorOptions({ scoreThreshold: 0.75 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!result) {
        announce('Face not clear. Restarting verification.', 'error');
        setTimeout(() => { if (mountedRef.current) startLiveness(); }, 2000);
        return;
      }

      // 4. Single face check (anti-spoofing: no group photos)
      const allFaces = await fa.detectAllFaces(img, new fa.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }));
      if (allFaces.length > 1) {
        announce('Multiple faces detected. Please be alone in front of the camera.', 'error');
        setTimeout(() => { if (mountedRef.current) startLiveness(); }, 2500);
        return;
      }

      // 5. Submit to parent
      setPhase('submit');
      announce('Matching your identity. Please wait.', 'info');
      await onCapture(dataUrl, Array.from(result.descriptor));

      // 6. Success
      setPhase('success');
      announce(`Identity confirmed. Check-${checkType} recorded successfully.`, 'success');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Verification failed. Please try again.';
      announce(errMsg, 'error');
      setTimeout(() => { if (mountedRef.current) startLiveness(); }, 3000);
    }
  }, [announce, setPhase, startLiveness, onCapture, checkType]);

  // ── Phase side-effects ───────────────────────────────
  useEffect(() => {
    if (phase === 'motion') runCapture();
  }, [phase, runCapture]);

  // When GPS becomes verified while waiting, start liveness
  useEffect(() => {
    if (gpsVerified && phRef.current === 'wait_gps') {
      announce('Location verified! Starting face verification.', 'success');
      setTimeout(() => { if (mountedRef.current) startLiveness(); }, 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsVerified]);

  // ── Mount / Unmount ──────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    async function init() {
      const camOk = await startCam();
      if (!camOk) return;

      const fa = await loadModels();
      if (!fa) return;

      if (gpsVerified) {
        announce('Starting verification. Follow the on-screen instructions.', 'info');
        setTimeout(() => { if (mountedRef.current) startLiveness(); }, 800);
      } else {
        setPhase('wait_gps');
        announce('Please enable location services to continue.', 'warn');
      }
    }

    init();

    return () => {
      mountedRef.current = false;
      stopLoop();
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived state for rendering ──────────────────────
  const gpsOk         = gpsStatus === 'inside';
  const isProcessing  = ['motion','extract','submit'].includes(phase);
  const isRunning     = ['challenge','between'].includes(phase);
  const currentChConf = (isRunning || phase==='between') ? CONF[chsRef.current[chIdx]] : null;

  // ─────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-[#020810] via-[#040D1A] to-[#020810] select-none">
      
      {/* Subtle background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-blue-600/10 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-emerald-600/10 rounded-full blur-[80px] pointer-events-none" />

      {/* === GPS Status Pill === */}
      <div className="flex-none w-full flex items-center justify-center pt-2 pb-1 z-30 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-bold backdrop-blur-xl border pointer-events-auto shadow-lg
            ${gpsOk
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300 shadow-emerald-950/50'
              : gpsStatus === 'locating'
                ? 'bg-slate-900/80 border-slate-600/40 text-slate-300 animate-pulse'
                : 'bg-rose-950/80 border-rose-500/40 text-rose-300 shadow-rose-950/50'
            }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>
            {gpsOk ? `✓ Inside Zone (${branchName ?? 'Store'})`
              : gpsStatus === 'locating'  ? 'Locating Store...'
              : gpsStatus === 'error'     ? 'GPS Error — tap to retry'
              : `${gpsDistance ?? '—'}m away from ${branchName ?? 'store'}`}
          </span>
          {(gpsStatus === 'error' || !gpsOk) && (
            <button onClick={gpsRefresh} className="ml-1 p-0.5 hover:bg-white/10 rounded-full transition-colors">
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </motion.div>
      </div>

      {/* === Center Biometric Pod (Sleek Rounded Oval/Pill) === */}
      <div className="flex-1 flex flex-col items-center justify-center my-auto z-20 w-full px-4">
        
        {/* The Rounded Camera Box */}
        <div className="relative w-[260px] h-[340px] sm:w-[290px] sm:h-[380px] rounded-[130px] sm:rounded-[145px] p-1.5 transition-all duration-500 shadow-2xl flex items-center justify-center"
          style={{
            background: phase === 'success' ? 'linear-gradient(135deg, #10B981, #059669)'
                      : phase === 'cam_err' ? 'linear-gradient(135deg, #F43F5E, #E11D48)'
                      : isRunning && currentChConf ? `linear-gradient(135deg, ${currentChConf.color}, #3B82F6)`
                      : 'linear-gradient(135deg, #3B82F6, #10B981)',
            boxShadow: phase === 'success' ? '0 0 45px rgba(16, 185, 129, 0.4)'
                     : isRunning && currentChConf ? `0 0 40px ${currentChConf.color}40`
                     : '0 0 35px rgba(59, 130, 246, 0.25)'
          }}
        >
          {/* Inner dark bezel */}
          <div className="relative w-full h-full rounded-[124px] sm:rounded-[139px] overflow-hidden bg-[#040A15] shadow-inner">
            
            {/* Live camera feed inside the rounded bezel */}
            <video
              ref={videoRef}
              autoPlay playsInline muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />

            {/* Scanning Laser Line */}
            {(isRunning || isProcessing) && (
              <motion.div
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_15px_#60A5FA] z-20 pointer-events-none"
              />
            )}

            {/* Corner brackets inside pod for high-tech look */}
            {['tl','tr','bl','br'].map(pos => (
              <div key={pos} className={`absolute w-6 h-6 border-white/60 z-10 pointer-events-none
                ${pos==='tl' ? 'top-6 left-6 border-t-2 border-l-2 rounded-tl-xl'
                : pos==='tr' ? 'top-6 right-6 border-t-2 border-r-2 rounded-tr-xl'
                : pos==='bl' ? 'bottom-6 left-6 border-b-2 border-l-2 rounded-bl-xl'
                             : 'bottom-6 right-6 border-b-2 border-r-2 rounded-br-xl'}`}
              />
            ))}

            {/* Success Overlay inside Pod */}
            {phase === 'success' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-emerald-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-30"
              >
                <motion.div
                  initial={{ scale: 0.5 }}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6 }}
                >
                  <CheckCircle2 className="w-20 h-20 text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.8)]" />
                </motion.div>
                <p className="text-white font-extrabold text-lg mt-3 tracking-tight">Verified!</p>
              </motion.div>
            )}

            {/* Model Loading Overlay inside Pod */}
            {phase === 'loading' && (
              <div className="absolute inset-0 bg-[#020810]/90 backdrop-blur-md flex flex-col items-center justify-center z-30 p-6 text-center">
                <div className="w-36 h-1.5 bg-slate-800 rounded-full overflow-hidden shadow-inner mb-3">
                  <motion.div
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.35 }}
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full"
                  />
                </div>
                <p className="text-slate-200 text-xs font-bold">Loading Biometrics</p>
                <p className="text-slate-500 text-[10px] mt-0.5">{progress}%</p>
              </div>
            )}

            {/* Camera Error Overlay inside Pod */}
            {phase === 'cam_err' && (
              <div className="absolute inset-0 bg-[#020810]/95 backdrop-blur-md flex flex-col items-center justify-center z-30 p-6 text-center">
                <AlertCircle className="w-12 h-12 text-rose-500 mb-2 drop-shadow-[0_0_12px_rgba(244,63,94,0.5)]" />
                <p className="text-white font-bold text-sm mb-1">Camera Off</p>
                <Button size="sm" variant="outline" onClick={startCam} icon={<RefreshCw className="w-3.5 h-3.5" />}>
                  Retry
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Challenge Progress Dots Below Pod */}
        {isRunning && (
          <div className="flex space-x-2.5 mt-5">
            <motion.div
              animate={{ scale: chIdx === 0 ? [1,1.3,1] : 1 }}
              transition={{ repeat: chIdx===0 ? Infinity : 0, duration: 1.2 }}
              className={`w-2.5 h-2.5 rounded-full ${chIdx === 0 ? 'bg-emerald-400 shadow-[0_0_8px_#34D399]' : 'bg-slate-700'}`}
            />
            <motion.div
              animate={{ scale: chIdx === 1 ? [1,1.3,1] : 1 }}
              transition={{ repeat: chIdx===1 ? Infinity : 0, duration: 1.2 }}
              className={`w-2.5 h-2.5 rounded-full ${chIdx === 1 ? 'bg-blue-400 shadow-[0_0_8px_#60A5FA]' : 'bg-slate-700'}`}
            />
          </div>
        )}
      </div>

      {/* === Bottom Challenge / Status UI === */}
      <div className="flex-none w-full flex flex-col items-center z-30 pb-4 px-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>

        {/* GPS out-of-zone warning */}
        {!gpsOk && phase !== 'loading' && phase !== 'cam_err' && phase !== 'success' && (
          <motion.div
            initial={{ opacity:0, y:8 }}
            animate={{ opacity:1, y:0 }}
            className="w-full max-w-sm mb-3 flex items-start space-x-2.5 bg-rose-950/90 border border-rose-500/40 backdrop-blur-xl px-4 py-3 rounded-2xl shadow-xl"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="text-rose-200 text-xs font-semibold leading-snug">
              {gpsStatus === 'error'
                ? 'GPS unavailable. Please enable location access to check in.'
                : gpsStatus === 'locating'
                  ? 'Detecting your location...'
                  : `You are ${gpsDistance}m from ${branchName}. Move inside the store.`}
            </span>
          </motion.div>
        )}

        {/* Challenge instruction card */}
        <AnimatePresence mode="wait">
          {isRunning && currentChConf && (
            <motion.div
              key={`ch-${chIdx}`}
              initial={{ opacity:0, y:16, scale:0.95 }}
              animate={{ opacity:1, y:0, scale:1 }}
              exit={{ opacity:0, scale:0.92 }}
              transition={{ type:'spring', damping:20 }}
              className="w-full max-w-sm flex items-center space-x-4 bg-[#061224]/95 backdrop-blur-2xl rounded-3xl px-5 py-4 mb-2 shadow-2xl"
              style={{ borderWidth:1.5, borderStyle:'solid', borderColor: `${currentChConf.color}50` }}
            >
              <div className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${currentChConf.color}20` }}>
                <span style={{ color: currentChConf.color }}>{currentChConf.icon}</span>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-0.5">
                  Step {chIdx + 1} of 2 — Live Verification
                </p>
                <p className="text-white font-bold text-sm leading-snug">{currentChConf.label}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Processing state */}
        {isProcessing && (
          <motion.div
            initial={{ opacity:0, y:10 }}
            animate={{ opacity:1, y:0 }}
            className="w-full max-w-sm flex items-center space-x-3 bg-blue-950/90 backdrop-blur-xl border border-blue-500/30 rounded-2xl px-5 py-3.5 mb-2 shadow-xl"
          >
            <motion.div
              animate={{ rotate:360 }}
              transition={{ repeat:Infinity, duration:1, ease:'linear' }}
              className="w-5 h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full shrink-0"
            />
            <p className="text-blue-100 font-semibold text-sm">{msg}</p>
          </motion.div>
        )}

        {/* General status message */}
        {!isProcessing && !isRunning && phase !== 'success' && phase !== 'cam_err' && phase !== 'loading' && (
          <AnimatePresence mode="wait">
            <motion.p
              key={msg}
              initial={{ opacity:0, y:4 }}
              animate={{ opacity:1, y:0 }}
              className={`w-full max-w-sm text-center text-xs font-semibold px-4 py-3 rounded-2xl mb-2 border shadow-lg
                ${msgType==='error'   ? 'bg-rose-950/90 border-rose-500/40 text-rose-200 shadow-rose-950/50'
                : msgType==='success' ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200 shadow-emerald-950/50'
                : msgType==='warn'    ? 'bg-amber-950/90 border-amber-500/40 text-amber-200 shadow-amber-950/50'
                : 'bg-slate-900/80 border-slate-700/40 text-slate-300'}`}
            >
              {msg}
            </motion.p>
          </AnimatePresence>
        )}

        {/* Security badge */}
        {!['cam_err','loading','success'].includes(phase) && (
          <p className="text-slate-500 text-[11px] text-center mt-1 font-medium flex items-center justify-center space-x-1.5">
            <span>🔒 End-to-end Biometric</span>
            <span>•</span>
            <span>Anti-Spoofing Active</span>
          </p>
        )}
      </div>

      {/* Hidden canvas for snapshot */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
