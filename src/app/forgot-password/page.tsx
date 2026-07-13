'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, Mail, Lock, Eye, EyeOff, Check, AlertTriangle, ArrowLeft, ShieldCheck, RefreshCw, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Abstract3DBackground from '@/components/Abstract3DBackground';

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<'email' | 'otp' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }
  }, [searchParams]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim()) {
      setFeedback({ type: 'error', message: 'Please enter your corporate email address.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setFeedback({ type: 'error', message: data.error || 'Failed to send verification code.' });
        setLoading(false);
        return;
      }

      setFeedback({ type: 'success', message: `Verification code sent to ${email.trim()} via Resend.` });
      setStep('otp');
      setResendCooldown(30);
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Network error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setFeedback({ type: 'error', message: 'Please enter the 6-digit verification code.' });
      return;
    }
    if (newPassword.length < 6) {
      setFeedback({ type: 'error', message: 'New password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', message: 'Passwords do not match. Please re-enter.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
          newPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setFeedback({ type: 'error', message: data.error || 'Failed to update password.' });
        setLoading(false);
        return;
      }

      setStep('success');
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Network error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row relative bg-white overflow-x-hidden font-sans">
      
      {/* LEFT PANEL: BRANDING */}
      <div className="w-full md:w-[45%] flex flex-col justify-between p-8 md:p-14 relative bg-white border-b md:border-b-0 md:border-r border-slate-200/50 order-1 z-10 overflow-hidden">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#1dbf73_1px,transparent_1px)] [background-size:40px_40px] mix-blend-overlay z-0" />
        <div className="absolute top-[30%] left-[20%] w-[50%] h-[50%] bg-[#1dbf73]/10 rounded-full filter blur-[120px] pointer-events-none z-0" />

        <Abstract3DBackground />

        {/* LOGO */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-start select-none w-full cursor-pointer"
          onClick={() => router.push('/login')}
        >
          <div className="text-4xl md:text-5xl font-serif tracking-widest flex items-baseline">
            <span className="text-[#1dbf73] font-bold text-5xl md:text-6xl mr-1">A</span>
            <span className="text-slate-700 font-semibold">NCHOR</span>
          </div>
          <div className="text-slate-500 tracking-[0.6em] text-[10px] md:text-xs font-light uppercase flex items-center gap-3 opacity-70 mt-1 ml-1">
            FASHION &bull; RECOVERY
          </div>
        </motion.div>

        {/* CENTER INFO */}
        <div className="relative z-10 flex-1 flex flex-col justify-center mt-12 md:mt-0">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="flex items-center gap-6 mb-8"
          >
            <div className="relative w-20 h-20 flex items-center justify-center rounded-2xl bg-slate-100/80 backdrop-blur-md border border-slate-200 shadow-[0_0_30px_rgba(0,68,23,0.2)]">
              <KeyRound className="w-10 h-10 text-[#1dbf73] z-10 animate-pulse" />
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="max-w-md"
          >
            <h2 className="text-2xl md:text-3xl font-light text-slate-900 mb-4 leading-snug">
              Instant & Secure <br/>
              <span className="font-bold text-[#1dbf73]">Password Recovery</span>
            </h2>
            <p className="text-slate-600 leading-relaxed text-[13px] md:text-sm font-light opacity-90">
              Recover access to your account using our encrypted verification protocol. A one-time verification code is dispatched instantly to your corporate email via Resend.
            </p>
          </motion.div>
        </div>

        {/* FOOTER */}
        <div className="relative z-10 pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>© Anchor Fashion HQ</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#1dbf73]" /> Identity Verified</span>
        </div>
      </div>

      {/* RIGHT PANEL: RECOVERY FORM */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative bg-slate-50 text-slate-900 order-2">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#1dbf73]/10 rounded-full filter blur-[150px] pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md relative z-10"
        >
          {/* Back button */}
          <button 
            type="button"
            onClick={() => router.push('/login')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Portal Sign In
          </button>

          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-xl mb-4 text-[#1dbf73]">
              {step === 'email' && <Mail className="w-7 h-7" />}
              {step === 'otp' && <Lock className="w-7 h-7" />}
              {step === 'success' && <Check className="w-7 h-7" />}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {step === 'email' && 'Reset Account Password'}
              {step === 'otp' && 'Verify & Update Password'}
              {step === 'success' && 'Password Updated!'}
            </h2>
            <p className="text-[13px] text-[#64748B] mt-1.5">
              {step === 'email' && 'Enter your corporate email to receive a verification OTP code.'}
              {step === 'otp' && `Enter the 6-digit verification code sent via Resend to ${email}`}
              {step === 'success' && 'Your credentials have been securely updated.'}
            </p>
          </div>

          {/* Feedback Alerts */}
          <AnimatePresence mode="wait">
            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-4 rounded-xl border mb-6 flex gap-3 text-sm ${
                  feedback.type === 'success'
                    ? 'bg-[#1dbf73]/10 border-emerald-500/20 text-[#1dbf73]'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}
              >
                {feedback.type === 'success' ? <Check className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
                <span>{feedback.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* STEP 1: EMAIL */}
          {step === 'email' && (
            <form onSubmit={handleSendOtp} className="space-y-5 bg-white border border-slate-200 p-6 sm:p-8 rounded-2xl shadow-2xl">
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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#1dbf73] to-[#16965a] hover:from-[#18a864] hover:to-[#12784a] hover:shadow-lg hover:shadow-[#1dbf73]/30 transition-all text-slate-900 font-bold py-3.5 rounded-xl text-[13px] tracking-wider uppercase mt-4 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55 active:scale-95"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Send Verification Code <Sparkles className="w-4 h-4" /></>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: OTP AND NEW PASSWORD */}
          {step === 'otp' && (
            <form onSubmit={handleResetPassword} className="space-y-4 bg-white border border-slate-200 p-6 sm:p-8 rounded-2xl shadow-2xl">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[11px] font-semibold text-[#94A3B8] tracking-widest uppercase">6-Digit Verification Code</label>
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={loading || resendCooldown > 0}
                    className="text-[11px] text-[#1dbf73] hover:text-slate-900 font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                  </button>
                </div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  disabled={loading}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                  className="w-full text-center tracking-[0.5em] font-mono font-bold text-xl bg-slate-50 border border-slate-200 hover:border-[#1dbf73]/50 rounded-xl py-3 text-slate-900 placeholder-slate-300 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#94A3B8] tracking-widest uppercase mb-1.5">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={loading}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
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

              <div>
                <label className="block text-[11px] font-semibold text-[#94A3B8] tracking-widest uppercase mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={loading}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full bg-white border border-slate-200 hover:border-[#1dbf73]/50 rounded-xl py-3 pl-11 pr-11 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#1dbf73] to-[#16965a] hover:from-[#18a864] hover:to-[#12784a] hover:shadow-lg hover:shadow-[#1dbf73]/30 transition-all text-slate-900 font-bold py-3.5 rounded-xl text-[13px] tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55 active:scale-95"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : 'Verify Code & Update Password'}
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => { setStep('email'); setFeedback(null); }}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-900 py-2 font-medium transition-colors"
                >
                  Change Corporate Email Address
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: SUCCESS */}
          {step === 'success' && (
            <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-2xl text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-[#1dbf73]">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Password Successfully Changed!</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Your new password is now active. You can log into your dashboard immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="w-full bg-gradient-to-r from-[#1dbf73] to-[#16965a] hover:from-[#18a864] hover:to-[#12784a] text-slate-900 font-bold py-3.5 rounded-xl text-[13px] tracking-wider uppercase shadow-lg shadow-[#1dbf73]/20 transition-all cursor-pointer active:scale-95"
              >
                Proceed to Portal Sign In &rarr;
              </button>
            </div>
          )}

        </motion.div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900 font-sans">Loading Password Recovery...</div>}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
