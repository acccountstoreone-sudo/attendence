'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Lock, Mail, User, IdCard, AlertTriangle, Check, ShieldCheck, ScanFace, MapPin, Orbit, Camera, ArrowRight, RefreshCw, Upload, X, Fingerprint, Sparkles, CheckCircle2, FileText, Smartphone } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import Webcam from 'react-webcam';
import { startRegistration } from '@simplewebauthn/browser';

const Abstract3DBackground = dynamic(() => import('@/components/Abstract3DBackground'), {
  ssr: false,
});

type Step = 'basic_info' | 'otp' | 'kyc' | 'biometrics' | 'pending';

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlStep = params.get('step');
      if (urlStep === 'face_scan' || urlStep === 'fingerprint_scan') return 'biometrics';
      if (urlStep && ['basic_info', 'otp', 'kyc', 'biometrics', 'pending'].includes(urlStep)) {
        return urlStep as Step;
      }
    }
    return 'basic_info';
  });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [nidFront, setNidFront] = useState<string | null>(null);
  const [nidBack, setNidBack] = useState<string | null>(null);
  const [nidFrontName, setNidFrontName] = useState<string>('');
  const [nidBackName, setNidBackName] = useState<string>('');

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
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            setFormData(prev => ({ ...prev, ...parsed }));
          }
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


  // Biometric Scan State
  const webcamRef = useRef<Webcam>(null);
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceMessage, setFaceMessage] = useState('Initializing Scanner...');
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [fingerprintEnrolled, setFingerprintEnrolled] = useState(false);

  // Load Face API Models when step changes to biometrics or camera modal is opened
  useEffect(() => {
    if (step === 'biometrics' || showCameraModal) {
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
  }, [step, showCameraModal]);

  // Face Detection Loop inside camera modal
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showCameraModal && modelsLoaded && !faceImage) {
      interval = setInterval(async () => {
        if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4) {
          const faceapi = await import('@vladmandic/face-api');
          const video = webcamRef.current.video;
          const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }));
          
          if (!showCameraModal || !webcamRef.current || !webcamRef.current.video) return;

          if (detection) {
             const box = detection.box;
             const videoWidth = video.videoWidth;
             const videoHeight = video.videoHeight;
             
             const isLargeEnough = box.width > (videoWidth * 0.20);
             const centerX = box.x + (box.width / 2);
             const centerY = box.y + (box.height / 2);
             const isCentered = (
               centerX > videoWidth * 0.35 && centerX < videoWidth * 0.65 &&
               centerY > videoHeight * 0.35 && centerY < videoHeight * 0.65
             );

             if (isLargeEnough && isCentered) {
               setFaceDetected(true);
               setFaceMessage('Perfect positioning! Click Capture now.');
             } else if (!isLargeEnough) {
               setFaceDetected(false);
               setFaceMessage('Please move closer to the camera');
             } else {
               setFaceDetected(false);
               setFaceMessage('Center your face directly in the frame');
             }
          } else {
             setFaceDetected(false);
             setFaceMessage('Looking for your face...');
          }
        }
      }, 400);
    }
    return () => clearInterval(interval);
  }, [showCameraModal, modelsLoaded, faceImage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFeedback(null);
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBasicInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setFeedback({ type: 'error', message: 'Passwords do not match.' });
      return;
    }
    if (formData.password.length < 6) {
      setFeedback({ type: 'error', message: 'Password must be at least 6 characters long.' });
      return;
    }
    if (!formData.branchId) {
      setFeedback({ type: 'error', message: 'Please select your designated branch.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          phone: formData.phone,
          branchId: formData.branchId
        }),
      });

      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      setFeedback({ type: 'success', message: 'Verification code sent to your email address.' });
      setStep('otp');

    } catch (err: unknown) {
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
        body: JSON.stringify({ email: formData.email, otp: formData.otp }),
      });

      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'OTP Verification failed');

      // Sign the user in to establish a session for subsequent steps (WebAuthn & KYC)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (signInError) {
        throw new Error('Failed to establish session after OTP verification: ' + signInError.message);
      }

      setFeedback({ type: 'success', message: 'Email verified successfully! Now upload your NID document copies.' });
      setStep('kyc');

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setFeedback({ type: 'error', message: typeof msg === 'object' ? JSON.stringify(msg) : msg });
    } finally {
      setLoading(false);
    }
  };

  // Helper to compress image down to max dimensions and JPEG quality (ensures payload is well below Vercel/Next.js 4MB body size limit)
  const compressDataUrl = async (dataUrl: string, maxDim = 800, quality = 0.65): Promise<string> => {
    return new Promise((resolve) => {
      if (!dataUrl.startsWith('data:image/')) {
        resolve(dataUrl);
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

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', message: `File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds the 5MB limit. Please upload a smaller file.` });
      e.target.value = '';
      return;
    }

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
          compressed = await compressDataUrl(reader.result, 800, 0.65);
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

  const handleDocumentProceed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nidFront || !nidBack) {
      setFeedback({ type: 'error', message: 'Please upload both NID Front Side and NID Back Side copies.' });
      return;
    }
    setFeedback(null);
    setStep('biometrics');
  };

  const captureFace = useCallback(async () => {
    setScanning(true);
    setFaceMessage('Extracting 3D biometric vector...');
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
            const compressedFace = await compressDataUrl(imageSrc, 500, 0.65);
            setFaceImage(compressedFace);
          }
          setFaceDescriptor(Array.from(detection.descriptor));
          setFaceMessage('Biometric enrollment successful!');
          setShowCameraModal(false);
          setFeedback({ type: 'success', message: '3D Facial vector captured and enrolled successfully!' });
        } else {
          setFeedback({ type: 'error', message: 'Failed to extract facial features. Ensure good lighting and try again.' });
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

  const handleFingerprintSetup = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const resp = await fetch('/api/auth/webauthn/register/generate', { method: 'POST', headers });
      const options = await parseJsonResponse(resp);
      if (!resp.ok) {
        throw new Error(options.error || 'Failed to generate fingerprint options.');
      }

      let asseResp;
      try {
        asseResp = await startRegistration({ optionsJSON: options });
      } catch (e: unknown) {
        if (e instanceof Error && (e.name === 'NotAllowedError' || e.message.includes('cancelled'))) {
           throw new Error('Sensor scan cancelled by user. You can try again or enroll Face scan.');
        }
        throw e;
      }

      const verifyResp = await fetch('/api/auth/webauthn/register/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify(asseResp),
      });

      const verifyData = await parseJsonResponse(verifyResp);
      if (!verifyResp.ok) {
         throw new Error(verifyData.error || 'Fingerprint verification failed.');
      }
      if (!verifyData.verified) throw new Error('Invalid fingerprint registration.');

      setFingerprintEnrolled(true);
      setFeedback({ type: 'success', message: 'Fingerprint sensor registered and verified successfully!' });
    } catch (err: unknown) {
      console.error('Fingerprint setup error:', err);
      const msg = err instanceof Error ? err.message : 'Fingerprint setup failed.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!nidFront || !nidBack) {
      setFeedback({ type: 'error', message: 'NID document copies are missing due to a page refresh. Please re-upload them.' });
      setStep('kyc');
      return;
    }

    if (!faceImage && !fingerprintEnrolled) {
      setFeedback({ type: 'error', message: 'Please enroll at least one biometric verification method (Face Scan OR Fingerprint) before submitting.' });
      return;
    }
    
    setLoading(true);
    setFeedback(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/auth/kyc-submit', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          nidFrontDataUrl: nidFront, 
          nidBackDataUrl: nidBack, 
          facePhotoDataUrl: faceImage || null,
          faceDescriptor: faceDescriptor || null,
          fingerprintEnrolled,
        }),
      });

      const data = await parseJsonResponse(res);
      if (!res.ok) throw data.error || data.message || data;

      localStorage.removeItem('anchor_register_form');
      setStep('pending');

    } catch (err: unknown) {
      console.error('KYC Submit Error:', err);
      const msg = err instanceof Error ? err.message : (typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : JSON.stringify(err));
      setFeedback({ type: 'error', message: typeof msg === 'object' ? JSON.stringify(msg) : msg });
    } finally {
      setLoading(false);
    }
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
             <span className="text-slate-900 font-extralight tracking-[0.25em]">NCHOR</span>
           </div>
           <span className="text-[11px] font-sans font-semibold tracking-[0.4em] text-slate-900 uppercase mt-1 pl-1">
             Fashion & Commerce
           </span>
           <div className="w-12 h-[2px] bg-[#1dbf73] mt-3 pl-1" />
        </motion.div>

        <div className="relative z-10 my-10 md:my-0 select-none">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="flex items-center gap-6 mb-8"
          >
            <div className="relative w-20 h-20 flex items-center justify-center rounded-2xl bg-slate-100/80 backdrop-blur-md border border-slate-200 shadow-[0_0_30px_rgba(29,191,115,0.15)] overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1dbf73]/20 to-transparent opacity-50" />
              <ScanFace className="w-10 h-10 text-[#1dbf73] z-10 drop-shadow-[0_0_10px_rgba(29,191,115,0.8)]" />
              <div className="absolute top-0 left-0 w-full h-[2px] bg-[#1dbf73] opacity-50 animate-[scan_2s_ease-in-out_infinite]" />
            </div>
            <div className="relative w-20 h-20 flex items-center justify-center rounded-2xl bg-slate-100/80 backdrop-blur-md border border-slate-200 shadow-[0_0_30px_rgba(12,43,106,0.15)]">
              <Orbit className="absolute w-16 h-16 text-[#64748B]/30 animate-[spin_10s_linear_infinite]" />
              <MapPin className="w-10 h-10 text-slate-900 z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.5 }} className="max-w-md">
            <h2 className="text-2xl md:text-3xl font-light text-slate-900 mb-4 leading-snug">
              Employee Onboarding & <br/>
              <span className="font-bold text-[#1dbf73]">Biometric Enrollment</span>
            </h2>
            <p className="text-slate-900 leading-relaxed text-[13px] md:text-sm font-light opacity-90">
              Anchor Fashion requires employees to upload identity documents and verify via facial AI or device fingerprint for secure enterprise attendance tracking.
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
        
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg relative z-10">
          
          <div className="mb-8 flex flex-col items-center">
            {/* Step Indicators */}
            <div className="flex gap-2 mb-6">
              {['basic_info', 'otp', 'kyc', 'biometrics'].map((s) => (
                 <div key={s} className={`h-1.5 w-12 sm:w-16 rounded-full transition-colors duration-500 ${step === s ? 'bg-[#1dbf73]' : 'bg-slate-100'}`} />
              ))}
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">
              {step === 'basic_info' && 'Corporate Registration'}
              {step === 'otp' && 'Email Verification'}
              {step === 'kyc' && 'NID Document Copies'}
              {step === 'biometrics' && 'Biometric Verification Suite'}
              {step === 'pending' && 'Registration Complete'}
            </h2>
            <p className="text-[13px] text-[#64748B] text-center max-w-[85%]">
              {step === 'basic_info' && 'Enter your official details to begin onboarding.'}
              {step === 'otp' && `We sent a 6-digit code to ${formData.email}`}
              {step === 'kyc' && 'Upload clear photos of both sides of your National ID card.'}
              {step === 'biometrics' && 'Choose to verify your identity using Face Scan, Fingerprint Sensor, or both.'}
              {step === 'pending' && 'Your profile is awaiting Branch Manager review and approval.'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {feedback && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className={`p-4 rounded-xl border mb-6 flex gap-3 text-sm ${feedback.type === 'success' ? 'bg-[#1dbf73]/10 border-emerald-500/20 text-[#1dbf73]' : 'bg-rose-500/10 border-rose-500/20 text-rose-600 font-medium'}`}
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
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#64748B]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-[#1dbf73] hover:bg-[#16965a] text-[#ffffff] font-bold py-3.5 rounded-xl mt-4 flex items-center justify-center gap-2 shadow-lg shadow-[#1dbf73]/20">
                  {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"/> : 'Continue Registration'}
                </button>
              </form>
            )}

            {/* STEP 2: OTP */}
            {step === 'otp' && (
              <form onSubmit={handleOtpSubmit} className="space-y-6">
                <div>
                  <label className="block text-[11px] font-semibold text-[#94A3B8] tracking-widest uppercase mb-2 text-center">Enter 6-Digit Code</label>
                  <input type="text" name="otp" required maxLength={6} value={formData.otp} onChange={handleInputChange} className="w-full bg-white/50 border border-slate-200 rounded-xl py-4 text-center text-2xl tracking-[1em] focus:border-[#1dbf73] focus:outline-none text-slate-900 font-mono font-bold" />
                </div>
                <button type="submit" disabled={loading} className="w-full bg-[#1dbf73] hover:bg-[#16965a] text-[#ffffff] font-bold py-3.5 rounded-xl flex items-center justify-center shadow-lg shadow-[#1dbf73]/20">
                  {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"/> : 'Verify Email Address'}
                </button>
              </form>
            )}

            {/* STEP 3: KYC Document Upload (NO NID Number Input!) */}
            {step === 'kyc' && (
              <form onSubmit={handleDocumentProceed} className="space-y-6">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs text-slate-700 leading-relaxed flex gap-3">
                  <FileText className="w-5 h-5 text-[#1dbf73] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-slate-900 mb-1">Government Document Verification</p>
                    <p>Please upload clear images (PNG/JPG) or PDFs of both the Front and Back sides of your National ID card. Maximum size: 5MB per file.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Front Copy */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#94A3B8] tracking-widest uppercase mb-2">NID Front Side Copy *</label>
                    <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${nidFront ? 'border-emerald-500/50 bg-emerald-50/60' : 'border-slate-200 hover:border-[#1dbf73]/50 bg-white/50'}`}>
                      <input
                        type="file"
                        required={!nidFront}
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileUpload(e, 'front')}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="flex items-center space-x-3">
                        <div className={`p-2.5 rounded-lg ${nidFront ? 'bg-[#1dbf73]/20 text-[#1dbf73]' : 'bg-slate-100 text-slate-900'}`}>
                          {nidFront ? <CheckCircle2 className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{nidFront ? nidFrontName : 'Click or drag to upload NID Front'}</p>
                          <p className="text-[11px] text-slate-900">{nidFront ? 'File uploaded and ready' : 'Image or PDF (Max 5MB)'}</p>
                        </div>
                        {nidFront && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); setNidFront(null); setNidFrontName(''); }} className="p-1.5 hover:bg-rose-100 text-rose-500 rounded-lg relative z-20">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Back Copy */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#94A3B8] tracking-widest uppercase mb-2">NID Back Side Copy *</label>
                    <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${nidBack ? 'border-emerald-500/50 bg-emerald-50/60' : 'border-slate-200 hover:border-[#1dbf73]/50 bg-white/50'}`}>
                      <input
                        type="file"
                        required={!nidBack}
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileUpload(e, 'back')}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="flex items-center space-x-3">
                        <div className={`p-2.5 rounded-lg ${nidBack ? 'bg-[#1dbf73]/20 text-[#1dbf73]' : 'bg-slate-100 text-slate-900'}`}>
                          {nidBack ? <CheckCircle2 className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{nidBack ? nidBackName : 'Click or drag to upload NID Back'}</p>
                          <p className="text-[11px] text-slate-900">{nidBack ? 'File uploaded and ready' : 'Image or PDF (Max 5MB)'}</p>
                        </div>
                        {nidBack && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); setNidBack(null); setNidBackName(''); }} className="p-1.5 hover:bg-rose-100 text-rose-500 rounded-lg relative z-20">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={!nidFront || !nidBack} className={`w-full font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all ${(!nidFront || !nidBack) ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#1dbf73] hover:bg-[#16965a] text-[#ffffff] shadow-lg shadow-[#1dbf73]/20'}`}>
                  Proceed to Biometrics Suite <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* STEP 4: Unified Biometric Choice Suite */}
            {step === 'biometrics' && (
              <div className="space-y-6">
                
                {/* Camera Modal Overlay if active */}
                {showCameraModal && (
                  <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 flex flex-col items-center">
                      <div className="flex justify-between items-center w-full mb-4">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2"><ScanFace className="w-5 h-5 text-[#1dbf73]"/> 3D Facial AI Capture</h3>
                        <button onClick={() => setShowCameraModal(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-900"><X className="w-5 h-5"/></button>
                      </div>

                      <div className="relative w-full aspect-square rounded-2xl overflow-hidden border-2 border-slate-200 bg-black mb-4">
                        <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" screenshotQuality={0.82} videoConstraints={{ width: 640, height: 480, facingMode: 'user' }} className="w-full h-full object-cover" mirrored />
                        <div className={`absolute inset-0 border-4 rounded-2xl transition-colors duration-300 ${faceDetected ? 'border-green-500' : 'border-[#1dbf73]'}`} />
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/75 text-white px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap z-10 shadow-xl">
                          {faceDetected ? <span className="text-[#1dbf73]">{faceMessage}</span> : <span className="text-yellow-400 animate-pulse">{faceMessage}</span>}
                        </div>
                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] border transition-colors duration-300 rounded-full ${faceDetected ? 'border-green-500 shadow-[0_0_20px_#22c55e]' : 'border-[#1dbf73]/40'}`} />
                      </div>

                      <button onClick={captureFace} disabled={scanning || !faceDetected} className={`w-full font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 ${(!faceDetected || scanning) ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-[#1dbf73] hover:bg-[#16965a] text-white shadow-lg shadow-[#1dbf73]/30'}`}>
                        {scanning ? <><RefreshCw className="w-4 h-4 animate-spin"/> Processing Vector...</> : <><Camera className="w-4 h-4"/> Capture & Enroll Vector</>}
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs text-slate-700 leading-relaxed">
                  <p className="font-bold text-slate-900 mb-1">Flexible Biometric Security</p>
                  <p>Enroll either <strong>Facial Recognition</strong>, <strong>Device Fingerprint / Sensor</strong>, or <strong>both</strong>. At least one method must be registered to finalize your onboarding package.</p>
                </div>

                {/* Option Card 1: Facial Recognition */}
                <div className={`p-5 rounded-2xl border-2 transition-all ${faceImage ? 'border-emerald-500/50 bg-emerald-50/40' : 'border-slate-200 bg-white hover:border-[#1dbf73]/40'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className={`p-3 rounded-xl ${faceImage ? 'bg-[#1dbf73] text-white' : 'bg-slate-100 text-slate-700'}`}>
                        <ScanFace className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Facial Recognition AI</h4>
                        <p className="text-xs text-slate-900">Fast, touchless camera verification on check-in</p>
                      </div>
                    </div>
                    {faceImage && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled
                      </span>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                    {faceImage ? (
                      <div className="flex items-center gap-3">
                        <img src={faceImage} alt="Face miniature" className="w-9 h-9 rounded-lg object-cover border border-emerald-400" />
                        <span className="text-xs font-semibold text-slate-700">3D Matrix Active</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 italic">Not scanned yet</span>
                    )}
                    <button type="button" onClick={() => { setFaceDetected(false); setShowCameraModal(true); }} className={`text-xs font-bold py-2 px-4 rounded-xl transition-all ${faceImage ? 'bg-slate-100 hover:bg-slate-200 text-slate-800' : 'bg-[#1dbf73] hover:bg-[#16965a] text-white shadow-md shadow-[#1dbf73]/20'}`}>
                      {faceImage ? 'Retake Photo' : 'Scan Face Now'}
                    </button>
                  </div>
                </div>

                {/* Option Card 2: Fingerprint Sensor */}
                <div className={`p-5 rounded-2xl border-2 transition-all ${fingerprintEnrolled ? 'border-emerald-500/50 bg-emerald-50/40' : 'border-slate-200 bg-white hover:border-[#1dbf73]/40'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className={`p-3 rounded-xl ${fingerprintEnrolled ? 'bg-[#1dbf73] text-white' : 'bg-slate-100 text-slate-700'}`}>
                        <Fingerprint className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Fingerprint & Device Passkey</h4>
                        <p className="text-xs text-slate-900">Hardware Touch ID, Face ID, or Windows Hello</p>
                      </div>
                    </div>
                    {fingerprintEnrolled && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled
                      </span>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-xs text-slate-900">{fingerprintEnrolled ? 'Device sensor linked securely' : 'Quick one-tap biometric enrollment'}</span>
                    <button type="button" onClick={handleFingerprintSetup} disabled={loading || fingerprintEnrolled} className={`text-xs font-bold py-2 px-4 rounded-xl transition-all ${fingerprintEnrolled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 text-white shadow-md'}`}>
                      {loading ? 'Registering...' : fingerprintEnrolled ? 'Registered' : 'Register Sensor'}
                    </button>
                  </div>
                </div>

                {/* Final Submit Bar */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    disabled={(!faceImage && !fingerprintEnrolled) || loading}
                    className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 ${(!faceImage && !fingerprintEnrolled) ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' : 'bg-[#1dbf73] hover:bg-[#16965a] text-white shadow-xl shadow-[#1dbf73]/30 text-base'}`}
                  >
                    {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <><Sparkles className="w-5 h-5"/> Complete & Submit Onboarding Package</>}
                  </button>
                  {(!faceImage && !fingerprintEnrolled) && (
                    <p className="text-[11px] text-center text-rose-500 font-semibold mt-2">
                      ⚠️ Please enroll at least one biometric method (Face OR Fingerprint) above to submit.
                    </p>
                  )}
                </div>

              </div>
            )}

            {/* STEP 5: PENDING APPROVAL */}
            {step === 'pending' && (
              <div className="flex flex-col items-center text-center py-8">
                <div className="w-20 h-20 bg-[#1dbf73]/10 rounded-full flex items-center justify-center border border-emerald-500/20 mb-6 shadow-inner">
                   <ShieldCheck className="w-10 h-10 text-[#1dbf73]" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Onboarding Package Submitted</h3>
                <p className="text-sm text-slate-900 mb-8 leading-relaxed max-w-md">
                  Your identity document copies and biometric vectors have been securely transmitted to the Anchor Fashion secure vault. You will be granted login access immediately once your Branch Manager approves your profile.
                </p>
                <button onClick={() => router.push('/login')} className="w-full bg-[#1dbf73] hover:bg-[#16965a] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#1dbf73]/20">
                  Return to Login Portal
                </button>
              </div>
            )}

          </div>
        </motion.div>
      </div>
    </div>
  );
}
