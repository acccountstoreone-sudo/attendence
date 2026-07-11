'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Lock, Mail, Eye, EyeOff, AlertTriangle, Check, ShieldCheck, ScanFace, MapPin, Orbit } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Abstract3DBackground from '@/components/Abstract3DBackground';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'account_deactivated') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFeedback({ type: 'error', message: 'Your account is pending approval or deactivated. Please contact your manager.' });
      supabase.auth.signOut();
    }
  }, [searchParams, supabase.auth]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    if (!email || !password) {
      setFeedback({ type: 'error', message: 'Please enter both email and password.' });
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setFeedback({ type: 'error', message: error.message });
        setLoading(false);
        return;
      }

      if (!data.user) {
        setFeedback({ type: 'error', message: 'Authentication failed. Please try again.' });
        setLoading(false);
        return;
      }

      setFeedback({ type: 'success', message: 'Authentication successful! Verifying role & branch...' });

      const { data: profile, error: profError } = await supabase
        .from('profiles')
        .select('role, is_active, full_name')
        .eq('id', data.user.id)
        .single();

      if (profError || !profile) {
        setFeedback({ type: 'error', message: 'Profile not found. Please contact Anchor Fashion IT support.' });
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      if (!profile.is_active && profile.role !== 'admin') {
        setFeedback({ type: 'error', message: 'Your employee account is currently inactive or offboarded.' });
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      const redirectTo = searchParams.get('redirectTo');
      // B3 fix: Only allow relative internal paths — reject external URLs (open redirect prevention)
      const isSafeRedirect = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') && !redirectTo.startsWith('/login');
      if (isSafeRedirect) {
        router.push(redirectTo);
        return;
      }

      if (profile.role === 'admin') {
        router.push('/admin');
      } else if (profile.role === 'branch_manager') {
        router.push('/branch-manager');
      } else {
        router.push('/employee');
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'An unexpected network error occurred.' });
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setFeedback({ type: 'error', message: 'Enter your email address above, then click Forgot.' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    setLoading(false);
    if (error) {
      setFeedback({ type: 'error', message: error.message });
    } else {
      setFeedback({ type: 'success', message: `Password reset link sent to ${email.trim()}. Check your inbox.` });
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row relative bg-white overflow-x-hidden font-sans" suppressHydrationWarning={true}>
      
      {/* LEFT PANEL: BRANDING (Navy Blue Background with 3D animation) */}
      <div className="w-full md:w-[45%] flex flex-col justify-between p-8 md:p-14 relative bg-white border-b md:border-b-0 md:border-r border-slate-200/50 order-1 z-10 overflow-hidden">
        
        {/* Subtle Background Glow */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#1dbf73_1px,transparent_1px)] [background-size:40px_40px] mix-blend-overlay z-0" />
        <div className="absolute top-[30%] left-[20%] w-[50%] h-[50%] bg-[#1dbf73]/10 rounded-full filter blur-[120px] pointer-events-none z-0" />

        {/* 3D Canvas rendering premium abstract gold particles/globe */}
        <Abstract3DBackground />

        {/* TOP: LOGO */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-start select-none w-full"
        >
           <div className="text-4xl md:text-5xl font-serif tracking-widest flex items-baseline">
             <span className="text-[#1dbf73] font-bold text-5xl md:text-6xl mr-1">A</span>
              <span className="text-slate-700 font-semibold">NCHOR</span>
           </div>
           <div className="text-slate-500 tracking-[0.6em] text-[10px] md:text-xs font-light uppercase flex items-center gap-3 opacity-70 mt-1 ml-1">
              FASHION
           </div>
        </motion.div>

        {/* CENTER: CORE TECHNOLOGY (Face & GPS) */}
        <div className="relative z-10 flex-1 flex flex-col justify-center mt-12 md:mt-0">
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="flex items-center gap-6 mb-8"
          >
            {/* Holographic Icon HUD */}
            <div className="relative w-20 h-20 flex items-center justify-center rounded-2xl bg-slate-100/80 backdrop-blur-md border border-slate-200 shadow-[0_0_30px_rgba(0,68,23,0.2)] overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1dbf73]/20 to-transparent opacity-50" />
              <ScanFace className="w-10 h-10 text-[#1dbf73] z-10" />
              <div className="absolute top-0 left-0 w-full h-[2px] bg-[#1dbf73] opacity-50 animate-[scan_2s_ease-in-out_infinite]" />
            </div>
            
            <div className="relative w-20 h-20 flex items-center justify-center rounded-2xl bg-slate-100/80 backdrop-blur-md border border-slate-200 shadow-[0_0_30px_rgba(0,68,23,0.2)]">
              <Orbit className="absolute w-16 h-16 text-[#64748B]/30 animate-[spin_10s_linear_infinite]" />
              <MapPin className="w-10 h-10 text-slate-700 z-10" />
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
            className="max-w-md"
          >
            <h2 className="text-2xl md:text-3xl font-light text-slate-900 mb-4 leading-snug">
              Precision Tracking with <br/>
              <span className="font-bold text-[#1dbf73]">AI Face ID & Geo-fencing</span>
            </h2>
            <p className="text-slate-600 leading-relaxed text-[13px] md:text-sm font-light opacity-90">
              Anchor Fashion&apos;s advanced attendance grid exclusively verifies identities via 3D facial recognition, synchronized instantly with military-grade GPS positioning.
            </p>
          </motion.div>
        </div>

        {/* BOTTOM: FOOTER */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="relative z-10 pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500"
        >
          <span>© Anchor Fashion HQ</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#1dbf73]" /> Enterprise Secured</span>
        </motion.div>
      </div>

      {/* RIGHT PANEL: AUTH FORM (Darker Navy Background) */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative bg-slate-50 text-slate-900 order-2">
        
        {/* Glow Backdrops */}
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#1dbf73]/10 rounded-full filter blur-[150px] pointer-events-none" />
        
        {/* Auth Container */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="w-full max-w-md relative z-10"
        >
          <div className="mb-10 text-center">
            <motion.div 
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.4, type: 'spring' }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white backdrop-blur-md border border-slate-200 shadow-2xl mb-6 text-[#1dbf73] relative overflow-hidden"
            >
               <ScanFace className="w-8 h-8 relative z-10" />
               {/* Scan line effect inside the icon box */}
               <div className="absolute top-0 left-0 w-full h-[1px] bg-[#1dbf73]/60 shadow-[0_0_8px_#4ade80] animate-[scan_3s_ease-in-out_infinite]" />
            </motion.div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">Portal Access</h2>
            <p className="text-[13px] text-[#64748B]">Authenticate to manage workforce and locations.</p>
          </div>

          {/* Alert messages */}
          <AnimatePresence mode="wait">
            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-4 rounded-xl border mb-6 flex gap-3 text-sm ${feedback.type === 'success'
                  ? 'bg-[#1dbf73]/10 border-emerald-500/20 text-[#1dbf73]'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  }`}
              >
                {feedback.type === 'success' ? <Check className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
                <span>{feedback.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* FORM */}
          <form onSubmit={handleLogin} className="space-y-5 bg-white backdrop-blur-sm border border-slate-200 p-6 sm:p-8 rounded-2xl shadow-2xl">
            <div>
              <label className="block text-[11px] font-semibold text-[#94A3B8] tracking-widest uppercase mb-2">Corporate Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                <input
                  type="email"
                  required
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@anchorfashion.com"
                  className="w-full bg-white border border-slate-200 hover:border-[#1dbf73]/50 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[11px] font-semibold text-[#94A3B8] tracking-widest uppercase">Password</label>
                <button type="button" onClick={handleForgotPassword} className="text-[11px] text-[#1dbf73] hover:text-slate-900 transition-colors">Forgot?</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-white border border-slate-200 hover:border-[#1dbf73]/50 rounded-xl py-3 pl-11 pr-11 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-slate-900 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#1dbf73] to-[#16965a] hover:from-[#18a864] hover:to-[#12784a] hover:shadow-lg hover:shadow-[#1dbf73]/30 transition-all text-slate-900 font-bold py-3.5 rounded-xl text-[13px] tracking-wider uppercase mt-4 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55 active:scale-95"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : 'Access Dashboard'}
            </button>
            
            <div className="mt-6 text-center text-[12px] text-[#94A3B8] pt-2">
              New employee?{' '}
              <a href="/register" className="text-[#1dbf73] hover:text-slate-900 font-bold transition-colors">
                Enroll Identity & Biometrics
              </a>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900 font-sans">Loading Portal...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}

