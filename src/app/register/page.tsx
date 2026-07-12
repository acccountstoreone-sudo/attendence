'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Lock, Mail, User, IdCard, AlertTriangle, Check, ShieldCheck, ScanFace, MapPin, Orbit, Camera, ArrowRight, RefreshCw, Upload, X, Fingerprint } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Abstract3DBackground from '@/components/Abstract3DBackground';
import Webcam from 'react-webcam';
import { startRegistration } from '@simplewebauthn/browser';

type Step = 'basic_info' | 'otp' | 'kyc' | 'face_scan' | 'fingerprint_scan' | 'pending';

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>('basic_info');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [nidFront, setNidFront] = useState<string | null>(null);
  const [nidBack, setNidBack] = useState<string | null>(null);
  const [nidFrontName, setNidFrontName] = useState<string>('');
  const [nidBackName, setNidBackName] = useState<string>('');

  // Sync step from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlStep = params.get('step') as Step;
      if (urlStep && ['basic_info', 'otp', 'kyc', 'face_scan', 'fingerprint_scan', 'pending'].includes(urlStep)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStep(urlStep);
      }
    }
  }, []);

  // Update URL when step changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('step', step);
      window.history.replaceState({}, '', url.toString());
    }
  }, [step]);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    otp: '',
    nid: '',
    branchId: ''
  });

  // Branch Selection State
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  // Fetch branches on mount
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await fetch('/api/branches?public=true');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            setBranches(data.data);
          }
        }
      } catch (err) {
        console.error('Error fetching branches:', err);
      }
    };
    fetchBranches();
  }, []);

  // Hydrate formData from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('anchor_register_form');
      if (saved) {
        try {
        } catch { }
      }
    }
  }, []);

  // Save formData to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('anchor_register_form', JSON.stringify(formData));
    }
  }, [formData]);


  // Face Scan State
  const webcamRef = useRef<Webcam>(null);
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceMessage, setFaceMessage] = useState('Initializing Scanner...');
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);

  // Load Face API Models when step changes to face_scan
  useEffect(() => {
    if (step === 'face_scan') {
      const loadModels = async () => {
        try {
          const faceapi = await import('@vladmandic/face-api');
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('/models')
          ]);
          setModelsLoaded(true);
          setFaceMessage('Please center your face in the frame');
        } catch (e) {
          console.error("Model loading error", e);
          setFaceMessage('Failed to load Face AI. Please refresh.');
        }
      };
      loadModels();
    }
  }, [step]);

  // Face Detection Loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'face_scan' && modelsLoaded && !faceImage) {
      interval = setInterval(async () => {
        if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4) {
          const faceapi = await import('@vladmandic/face-api');
          const video = webcamRef.current.video;
          const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }));
          
          if (detection) {
             const box = detection.box;
             const videoWidth = video.videoWidth;
             const videoHeight = video.videoHeight;
             
             // Ensure face is large enough (at least 20% of width)
             const isLargeEnough = box.width > (videoWidth * 0.20);
             
             // Ensure face is somewhat centered
             const centerX = box.x + (box.width / 2);
             const centerY = box.y + (box.height / 2);
             const isCenteredX = Math.abs(centerX - (videoWidth / 2)) < (videoWidth * 0.2);
             const isCenteredY = Math.abs(centerY - (videoHeight / 2)) < (videoHeight * 0.2);
             
             if (!isLargeEnough) {
               setFaceDetected(false);
               setFaceMessage('Come closer to the camera');
             } else if (!isCenteredX || !isCenteredY) {
               setFaceDetected(false);
               setFaceMessage('Center your face in the circle');
             } else {
               setFaceDetected(true);
               setFaceMessage('Perfect! Hold still.');
             }
          } else {
             setFaceDetected(false);
             setFaceMessage('No face detected. Look directly at the camera.');
          }
        }
      }, 300); // Check every 300ms
    }
    return () => clearInterval(interval);
  }, [step, modelsLoaded, faceImage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBasicInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    if (formData.password !== formData.confirmPassword) {
      setFeedback({ type: 'error', message: 'Passwords do not match.' });
      setLoading(false);
      return;
    }

    try {
      // 1. Sign up user via Supabase Auth
      const { error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            branch_id: formData.branchId,
          }
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          // If already registered, gracefully proceed to send OTP so they can resume onboarding.
          console.log('User already registered. Proceeding to send OTP...');
        } else {
          throw authError;
        }
      }

      // 2. Trigger OTP API
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });

      let otpRes;
      try {
        otpRes = await res.json();
      } catch {
        throw new Error(`Server returned an invalid response (${res.status} ${res.statusText}). Please check server logs.`);
      }

      if (!res.ok) throw new Error(otpRes?.error || 'Failed to send OTP.');

      setFeedback({ type: 'success', message: 'Verification code sent to your email.' });
      setStep('otp');

    } catch (err: unknown) {
      console.error('Registration Error:', err);
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setFeedback({ type: 'error', message: typeof msg === 'object' ? JSON.stringify(msg) : msg });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, code: formData.otp }),
      });

      const otpRes = await res.json();
      if (!res.ok) throw new Error(otpRes.error);

      setFeedback({ type: 'success', message: 'Email verified successfully.' });
      setStep('kyc');

    } catch (err: unknown) {
      console.error('OTP Verify Error:', err);
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setFeedback({ type: 'error', message: typeof msg === 'object' ? JSON.stringify(msg) : msg });
    } finally {
      setLoading(false);
    }
  };

// Helper to compress image down to max dimensions and JPEG quality
const compressDataUrl = async (dataUrl: string, maxDim = 1200, quality = 0.8): Promise<string> => {
  return new Promise((resolve) => {
    if (!dataUrl.startsWith('data:image/')) {
      resolve(dataUrl); // e.g., PDF document
      return;
    }
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

// Helper to safely parse API responses without throwing 'Unexpected token R... is not valid JSON'
async function parseJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (res.status === 413 || text.includes('Request Entity Too Large') || text.startsWith('R')) {
      throw new Error('Uploaded images or face scan are too large. Please upload smaller files or retake your photo.');
    }
    throw new Error(`Server returned non-JSON response (${res.status}): ${text.slice(0, 100)}`);
  }
}

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    setFeedback(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Max size 5MB (Spec requirement: max size 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', message: `File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds the 5MB limit. Please upload a smaller file.` });
      e.target.value = '';
      return;
    }

    // Must be Image or PDF (no text)
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setFeedback({ type: 'error', message: 'Invalid format. Only Image (PNG/JPG/WEBP) or PDF documents are permitted.' });
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      if (typeof reader.result === 'string') {
        let compressed = reader.result;
        if (file.type.startsWith('image/')) {
          compressed = await compressDataUrl(reader.result, 1200, 0.8);
        }
        if (side === 'front') {
          setNidFront(compressed);
          setNidFrontName(file.name);
        } else {
          setNidBack(compressed);
          setNidBackName(file.name);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nid) {
      setFeedback({ type: 'error', message: 'Please enter your National ID Number.' });
      return;
    }
    if (!nidFront || !nidBack) {
      setFeedback({ type: 'error', message: 'Please upload both NID Front Side and NID Back Side copies.' });
      return;
    }
    setFeedback(null);
    setStep('face_scan');
  };

  const captureFace = useCallback(async () => {
    setScanning(true);
    setFaceMessage('Extracting biometric vectors...');
    try {
      if (webcamRef.current && webcamRef.current.video) {
        const video = webcamRef.current.video;
        const faceapi = await import('@vladmandic/face-api');
        
        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          const imageSrc = webcamRef.current.getScreenshot({ width: 640, height: 480 });
          if (imageSrc) {
            const compressedFace = await compressDataUrl(imageSrc, 640, 0.82);
            setFaceImage(compressedFace);
          }
          setFaceDescriptor(Array.from(detection.descriptor));
          setFaceMessage('Biometric enrollment successful!');
        } else {
          setFeedback({ type: 'error', message: 'Failed to extract facial features. Try again.' });
          setFaceMessage('Please center your face in the frame');
        }
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Biometric extraction failed.' });
    } finally {
      setScanning(false);
    }
  }, [webcamRef]);

  const handleFinalSubmit = async () => {
    if (!nidFront || !nidBack) {
      setFeedback({ type: 'error', message: 'NID document copies are missing due to a page refresh. Please re-upload them.' });
      setStep('kyc');
      return;
    }

    if (!faceImage || !faceDescriptor) {
      setFeedback({ type: 'error', message: 'Please complete the face scan properly.' });
      return;
    }
    
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/auth/kyc-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nid: formData.nid,
          nidFrontDataUrl: nidFront, 
          nidBackDataUrl: nidBack, 
          facePhotoDataUrl: faceImage,
          faceDescriptor: faceDescriptor 
        }),
      });

      const data = await parseJsonResponse(res);
      if (!res.ok) throw data.error || data.message || data;

      setStep('fingerprint_scan');

    } catch (err: unknown) {
      console.error('KYC Submit Error:', err);
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setFeedback({ type: 'error', message: typeof msg === 'object' ? JSON.stringify(msg) : msg });
    } finally {
      setLoading(false);
    }
  };

  const handleFingerprintSetup = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      // 1. Get options from server
      const resp = await fetch('/api/auth/webauthn/register/generate', { method: 'POST' });
      const options = await parseJsonResponse(resp);
      if (!resp.ok) {
        throw new Error(options.error || 'Failed to generate fingerprint options.');
      }

      // 2. Pass options to browser authenticator
      let asseResp;
      try {
        asseResp = await startRegistration({ optionsJSON: options });
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'NotAllowedError') {
           throw new Error('Registration cancelled. You can skip this step for now.');
        }
        throw e;
      }

      // 3. Verify on server
      const verifyResp = await fetch('/api/auth/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(asseResp),
      });

      const verifyData = await parseJsonResponse(verifyResp);
      if (!verifyResp.ok) {
         throw new Error(verifyData.error || 'Fingerprint verification failed.');
      }
      if (!verifyData.verified) throw new Error('Invalid fingerprint registration.');

      // Clear local storage so next user starts fresh
      localStorage.removeItem('anchor_register_form');
      setStep('pending');
    } catch (err: unknown) {
      console.error('Fingerprint setup error:', err);
      const msg = err instanceof Error ? err.message : 'Fingerprint setup failed.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const skipFingerprint = () => {
    localStorage.removeItem('anchor_register_form');
    setStep('pending');
  };


  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row relative bg-white overflow-x-hidden font-sans" suppressHydrationWarning={true}>
      
      {/* LEFT PANEL: BRANDING */}
      <div className="w-full md:w-[45%] flex flex-col justify-between p-8 md:p-14 relative bg-white border-b md:border-b-0 md:border-r border-slate-200/50 order-1 z-10 overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#1dbf73_1px,transparent_1px)] [background-size:40px_40px] mix-blend-overlay z-0" />
        <div className="absolute top-[30%] left-[20%] w-[50%] h-[50%] bg-[#1dbf73]/10 rounded-full filter blur-[120px] pointer-events-none z-0" />
        <Abstract3DBackground />

        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex flex-col items-start select-none w-full"
        >
           <div className="text-4xl md:text-5xl font-serif tracking-widest flex items-baseline">
             <span className="text-[#1dbf73] font-bold text-5xl md:text-6xl mr-1">A</span>
             <span className="text-slate-900 font-semibold">NCHOR</span>
           </div>
           <div className="text-slate-900 tracking-[0.6em] text-[10px] md:text-xs font-light uppercase flex items-center gap-3 opacity-70 mt-1 ml-1">
              FASHION
           </div>
        </motion.div>

        <div className="relative z-10 flex-1 flex flex-col justify-center mt-12 md:mt-0">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="flex items-center gap-6 mb-8"
          >
            <div className="relative w-20 h-20 flex items-center justify-center rounded-2xl bg-slate-100/80 backdrop-blur-md border border-slate-200 shadow-[0_0_30px_rgba(210,160,42,0.15)] overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1dbf73]/20 to-transparent opacity-50" />
              <ScanFace className="w-10 h-10 text-[#1dbf73] z-10 drop-shadow-[0_0_10px_rgba(210,160,42,0.8)]" />
              <div className="absolute top-0 left-0 w-full h-[2px] bg-[#1dbf73] opacity-50 animate-[scan_2s_ease-in-out_infinite]" />
            </div>
            <div className="relative w-20 h-20 flex items-center justify-center rounded-2xl bg-slate-100/80 backdrop-blur-md border border-slate-200 shadow-[0_0_30px_rgba(12,43,106,0.3)]">
              <Orbit className="absolute w-16 h-16 text-[#64748B]/30 animate-[spin_10s_linear_infinite]" />
              <MapPin className="w-10 h-10 text-slate-900 z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.5 }} className="max-w-md">
            <h2 className="text-2xl md:text-3xl font-light text-slate-900 mb-4 leading-snug">
              Employee Onboarding & <br/>
              <span className="font-bold text-[#1dbf73]">Identity Enrollment</span>
            </h2>
            <p className="text-slate-900 leading-relaxed text-[13px] md:text-sm font-light opacity-90">
              Anchor Fashion requires all employees to securely enroll their NID and 3D facial biometrics to access the enterprise attendance grid.
            </p>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.8 }} className="relative z-10 pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-[#475569]">
          <span>© Anchor Fashion HQ</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#1dbf73]" /> Enterprise Secured</span>
        </motion.div>
      </div>

      {/* RIGHT PANEL: FORM */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative bg-white text-slate-900 order-2">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#1dbf73]/10 rounded-full filter blur-[150px] pointer-events-none" />
        
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md relative z-10">
          
          <div className="mb-8 flex flex-col items-center">
            {/* Step Indicators */}
            <div className="flex gap-2 mb-6">
              {['basic_info', 'otp', 'kyc', 'face_scan', 'fingerprint_scan'].map((s) => (
                 <div key={s} className={`h-1.5 w-10 sm:w-12 rounded-full transition-colors duration-500 ${step === s ? 'bg-[#1dbf73]' : 'bg-slate-100'}`} />
              ))}
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">
              {step === 'basic_info' && 'Corporate Registration'}
              {step === 'otp' && 'Email Verification'}
              {step === 'kyc' && 'KYC Setup'}
              {step === 'face_scan' && 'Biometric Enrollment'}
              {step === 'fingerprint_scan' && 'Passkey Setup'}
              {step === 'pending' && 'Registration Complete'}
            </h2>
            <p className="text-[13px] text-[#64748B] text-center max-w-[80%]">
              {step === 'basic_info' && 'Enter your official details to begin onboarding.'}
              {step === 'otp' && `We sent a 6-digit code to ${formData.email}`}
              {step === 'kyc' && 'Provide your National Identity number for background checks.'}
              {step === 'face_scan' && 'Look directly at the camera to capture your 3D facial matrix.'}
              {step === 'fingerprint_scan' && 'Set up your device fingerprint or face ID for faster check-ins.'}
              {step === 'pending' && 'Your profile is awaiting Branch Manager approval.'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {feedback && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className={`p-4 rounded-xl border mb-6 flex gap-3 text-sm ${feedback.type === 'success' ? 'bg-[#1dbf73]/10 border-emerald-500/20 text-[#1dbf73]' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}
              >
                {feedback.type === 'success' ? <Check className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
                <span>{feedback.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-white backdrop-blur-sm border border-slate-200 p-6 sm:p-8 rounded-2xl shadow-2xl relative overflow-hidden">
            
            {/* STEP 1: Basic Info */}
            {step === 'basic_info' && (
              <form onSubmit={handleBasicInfoSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[#94A3B8] tracking-widest uppercase mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                    <input type="text" name="fullName" required value={formData.fullName} onChange={handleInputChange} className="w-full bg-white/50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:border-[#1dbf73] focus:outline-none text-slate-900" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#94A3B8] tracking-widest uppercase mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                    <input type="email" name="email" required value={formData.email} onChange={handleInputChange} className="w-full bg-white/50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:border-[#1dbf73] focus:outline-none text-slate-900" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#94A3B8] tracking-widest uppercase mb-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                    <input type="password" name="password" required value={formData.password} onChange={handleInputChange} className="w-full bg-white/50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:border-[#1dbf73] focus:outline-none text-slate-900" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#94A3B8] tracking-widest uppercase mb-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                    <input type="password" name="confirmPassword" required value={formData.confirmPassword} onChange={handleInputChange} className="w-full bg-white/50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:border-[#1dbf73] focus:outline-none text-slate-900" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#94A3B8] tracking-widest uppercase mb-1">Branch</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                    <select name="branchId" required value={formData.branchId} onChange={(e) => setFormData({ ...formData, branchId: e.target.value })} className="w-full bg-white/50 border border-slate-200 rounded-xl py-3 pl-11 pr-10 text-sm focus:border-[#1dbf73] focus:outline-none text-slate-900 appearance-none">
                      <option value="" disabled className="bg-white text-slate-900">Select your branch</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id} className="bg-white text-slate-900">{b.name}</option>
                      ))}
                    </select>
                    {/* Custom chevron to indicate dropdown since appearance-none removes it */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#64748B]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-[#1dbf73] hover:bg-[#16965a] text-[#ffffff] font-bold py-3.5 rounded-xl mt-4 flex items-center justify-center gap-2">
                  {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"/> : 'Continue Registration'}
                </button>
              </form>
            )}

            {/* STEP 2: OTP */}
            {step === 'otp' && (
              <form onSubmit={handleOtpSubmit} className="space-y-6">
                <div>
                  <label className="block text-[11px] font-semibold text-[#94A3B8] tracking-widest uppercase mb-2 text-center">Enter 6-Digit Code</label>
                  <input type="text" name="otp" required maxLength={6} value={formData.otp} onChange={handleInputChange} className="w-full bg-white/50 border border-slate-200 rounded-xl py-4 text-center text-2xl tracking-[1em] focus:border-[#1dbf73] focus:outline-none text-slate-900" />
                </div>
                <button type="submit" disabled={loading} className="w-full bg-[#1dbf73] hover:bg-[#16965a] text-[#ffffff] font-bold py-3.5 rounded-xl flex items-center justify-center">
                  {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"/> : 'Verify Email'}
                </button>
              </form>
            )}

            {/* STEP 3: KYC Document Upload */}
            {step === 'kyc' && (
              <form onSubmit={handleKycSubmit} className="space-y-6">
                <div className="bg-white border border-slate-200 p-4 rounded-xl text-xs text-slate-600 leading-relaxed">
                  <p className="font-bold text-[#1dbf73] mb-1">Government Identity Verification</p>
                  <p>Please upload clear copies of both the Front and Back sides of your National ID (NID). Accepted formats: Image (JPG, PNG) or PDF. Maximum size: 5MB per file.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#94A3B8] tracking-widest uppercase mb-1">National ID Number (NID) *</label>
                  <div className="relative">
                    <IdCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                    <input type="text" name="nid" required value={formData.nid} onChange={handleInputChange} placeholder="e.g. 1990123456789" className="w-full bg-white/50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:border-[#1dbf73] focus:outline-none text-slate-900" />
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Front Copy */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#94A3B8] tracking-widest uppercase mb-2">NID Front Side Copy *</label>
                    <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${nidFront ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-200 hover:border-[#1dbf73]/50 bg-white/50'}`}>
                      <input
                        type="file"
                        required={!nidFront}
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileUpload(e, 'front')}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="flex items-center space-x-3">
                        <div className={`p-2.5 rounded-lg ${nidFront ? 'bg-[#1dbf73]/20 text-[#1dbf73]' : 'bg-slate-100 text-slate-600'}`}>
                          {nidFront ? <Check className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{nidFront ? nidFrontName : 'Click or drag to upload NID Front'}</p>
                          <p className="text-[11px] text-slate-600">{nidFront ? 'File uploaded and ready' : 'Image or PDF (Max 5MB)'}</p>
                        </div>
                        {nidFront && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); setNidFront(null); setNidFrontName(''); }} className="p-1.5 hover:bg-rose-950/40 text-rose-400 rounded-lg relative z-20">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Back Copy */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#94A3B8] tracking-widest uppercase mb-2">NID Back Side Copy *</label>
                    <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${nidBack ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-200 hover:border-[#1dbf73]/50 bg-white/50'}`}>
                      <input
                        type="file"
                        required={!nidBack}
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileUpload(e, 'back')}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="flex items-center space-x-3">
                        <div className={`p-2.5 rounded-lg ${nidBack ? 'bg-[#1dbf73]/20 text-[#1dbf73]' : 'bg-slate-100 text-slate-600'}`}>
                          {nidBack ? <Check className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{nidBack ? nidBackName : 'Click or drag to upload NID Back'}</p>
                          <p className="text-[11px] text-slate-600">{nidBack ? 'File uploaded and ready' : 'Image or PDF (Max 5MB)'}</p>
                        </div>
                        {nidBack && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); setNidBack(null); setNidBackName(''); }} className="p-1.5 hover:bg-rose-950/40 text-rose-400 rounded-lg relative z-20">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={!nidFront || !nidBack} className={`w-full font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all ${(!nidFront || !nidBack) ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-[#1dbf73] hover:bg-[#16965a] text-[#ffffff] shadow-lg shadow-[#1dbf73]/20'}`}>
                  Proceed to Biometrics <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* STEP 4: Face Scan */}
            {step === 'face_scan' && (
              <div className="space-y-6 flex flex-col items-center">
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden border-2 border-slate-200 bg-black">
                  {!faceImage ? (
                     <>
                        <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" screenshotQuality={0.82} videoConstraints={{ width: 640, height: 480, facingMode: 'user' }} className="w-full h-full object-cover" mirrored />
                        {/* Overlay Scanning HUD */}
                        <div className={`absolute inset-0 border-4 rounded-2xl transition-colors duration-300 ${faceDetected ? 'border-green-500' : 'border-[#1dbf73]'}`} />
                        
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-slate-900 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap z-10 shadow-xl">
                          {faceDetected ? <span className="text-[#1dbf73] font-bold tracking-wider">{faceMessage}</span> : <span className="text-yellow-400 animate-pulse">{faceMessage}</span>}
                        </div>

                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] border transition-colors duration-300 rounded-full ${faceDetected ? 'border-green-500 shadow-[0_0_20px_#22c55e]' : 'border-[#1dbf73]/40'}`} />
                        
                        {scanning && (
                          <div className="absolute inset-0 bg-[#1dbf73]/10">
                             <div className="w-full h-1 bg-[#1dbf73] shadow-[0_0_15px_#1dbf73] animate-[scan_2s_ease-in-out_infinite]" />
                          </div>
                        )}
                     </>
                  ) : (
                    <img src={faceImage} alt="Captured Face" className="w-full h-full object-cover" />
                  )}
                </div>

                {!faceImage ? (
                  <button onClick={captureFace} disabled={scanning || !faceDetected} className={`w-full font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 ${(!faceDetected || scanning) ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : 'bg-[#1dbf73] hover:bg-[#16965a] text-slate-900 shadow-[0_0_20px_rgba(34,197,94,0.4)]'}`}>
                    {scanning ? <><RefreshCw className="w-4 h-4 animate-spin"/> Processing...</> : <><Camera className="w-4 h-4"/> {faceDetected ? 'Capture Face ID' : 'Searching for Face...'}</>}
                  </button>
                ) : (
                  <div className="flex gap-3 w-full">
                     <button onClick={() => setFaceImage(null)} className="flex-1 bg-transparent border border-slate-200 text-slate-900 hover:bg-slate-100 font-bold py-3.5 rounded-xl">Retake</button>
                     <button onClick={handleFinalSubmit} disabled={loading} className="flex-1 bg-[#1dbf73] hover:bg-[#16965a] text-[#ffffff] font-bold py-3.5 rounded-xl flex justify-center items-center">
                       {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"/> : 'Continue'}
                     </button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4b: Fingerprint Scan */}
            {step === 'fingerprint_scan' && (
              <div className="flex flex-col items-center text-center py-6">
                <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20 mb-6 relative">
                   <Fingerprint className="w-10 h-10 text-blue-400" />
                   <div className="absolute inset-0 border-2 border-blue-500/30 rounded-full animate-ping" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Enable Quick Check-in</h3>
                <p className="text-sm text-[#94A3B8] mb-8">
                  Set up your device fingerprint or face recognition. This will allow you to quickly check-in and check-out every day without always needing a camera scan.
                </p>
                <button onClick={handleFingerprintSetup} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-slate-900 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 mb-4">
                  {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <><Fingerprint className="w-4 h-4" /> Set Up Device Biometrics</>}
                </button>
                <button onClick={skipFingerprint} disabled={loading} className="w-full bg-transparent text-slate-600 hover:text-slate-900 font-bold py-3 rounded-xl transition-all text-sm">
                  Skip for now
                </button>
              </div>
            )}

            {/* STEP 5: PENDING APPROVAL */}
            {step === 'pending' && (
              <div className="flex flex-col items-center text-center py-6">
                <div className="w-20 h-20 bg-[#1dbf73]/10 rounded-full flex items-center justify-center border border-emerald-500/20 mb-6">
                   <ShieldCheck className="w-10 h-10 text-[#1dbf73]" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Enrollment Submitted</h3>
                <p className="text-sm text-[#94A3B8] mb-8">
                  Your identity documents and biometric scan have been securely transmitted. You will be able to log in once your Branch Manager approves your request.
                </p>
                <button onClick={() => router.push('/login')} className="w-full bg-transparent border border-slate-200 hover:border-[#1dbf73] text-slate-900 font-bold py-3.5 rounded-xl transition-all">
                  Return to Login
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

