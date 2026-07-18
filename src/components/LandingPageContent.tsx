'use client';

import React, { useRef, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  ScanFace, MapPin, ShieldCheck, ArrowRight, 
  LayoutDashboard, Fingerprint, Activity, 
  ChevronRight, Lock, Sparkles, Globe,
  WifiOff, Calculator, ClipboardCheck, Building2, BarChart3, Users,
  MonitorSmartphone
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface LandingPageContentProps {
  isAuthenticated: boolean;
  role: string | null;
}

const customEase: [number, number, number, number] = [0.16, 1, 0.3, 1]; // Apple-like easing

export default function LandingPageContent({ isAuthenticated, role }: LandingPageContentProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  
  const faqs = [
    { q: "🌍 How does the GPS Geo-Fencing work?", a: "The system enforces a strict radius around your branch. Attendance is only logged when the device is physically within the authorized area, verified via real-time satellite tracking." },
    { q: "🤖 Is facial recognition safe and private?", a: "Yes. Biometric data is processed locally and securely encrypted. We use liveness detection to prevent spoofing using photos or videos." },
    { q: "🚀 Can I use the app without the internet?", a: "Absolutely. Our Offline engine queues your attendance payload and auto-syncs with the central server when connectivity returns." },
    { q: "📱 Do I need to download from an App Store?", a: "No! Anchor Fashion is a Progressive Web App (PWA). Install it directly from your browser to your Home Screen on iOS, Android, or Desktop for a native app experience." }
  ];

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 500], [1, 0.95]);
  const heroY = useTransform(scrollY, [0, 500], [0, 100]);

  const handleDashboardRedirect = () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (role === 'admin') router.push('/admin');
    else if (role === 'branch_manager') router.push('/branch-manager');
    else router.push('/employee');
  };

  return (
    <main ref={containerRef} className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden selection:bg-[#1dbf73]/30 selection:text-[#1dbf73]">
      
      {/* --- AMBIENT BACKGROUND GLOWS --- */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center bg-white/40">
        <motion.div 
          style={{ y: useTransform(scrollYProgress, [0, 1], ["0%", "30%"]) }}
          className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-[#1dbf73]/10 rounded-full blur-[120px]"
        />
        <motion.div 
          style={{ y: useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]) }}
          className="absolute bottom-[-20%] right-[-10%] w-[40vw] h-[40vw] bg-blue-500/5 rounded-full blur-[120px]"
        />
        {/* Subtle noise texture for premium feel */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-overlay" />
      </div>

      {/* --- GLASS NAVIGATION --- */}
      <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-2xl bg-white/70 border-b border-slate-200/50 shadow-sm shadow-slate-200/20">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: customEase }}
            className="flex items-center gap-2 select-none cursor-pointer"
          >
            <Image src="/logo.png" alt="Anchor Fashion Logo" width={140} height={40} className="object-contain" priority />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: customEase }}
          >
            {isAuthenticated ? (
              <button 
                onClick={handleDashboardRedirect}
                className="group relative px-5 py-2.5 rounded-full bg-white hover:bg-slate-50 border border-slate-200 shadow-sm transition-all flex items-center gap-2 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#1dbf73]/0 via-[#1dbf73]/10 to-[#1dbf73]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <LayoutDashboard className="w-4 h-4 text-[#1dbf73]" />
                <span className="text-sm font-semibold text-slate-700">Dashboard</span>
              </button>
            ) : (
              <Link href="/login" className="group relative px-5 py-2.5 rounded-full bg-[#1dbf73] text-white hover:bg-emerald-600 shadow-md shadow-[#1dbf73]/20 hover:shadow-xl hover:shadow-[#1dbf73]/30 transition-all flex items-center gap-2 hover:-translate-y-0.5">
                <span className="text-sm font-semibold">Portal Login</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </motion.div>
        </div>
      </header>

      {/* --- HERO SECTION --- */}
      <motion.section 
        style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
        className="relative z-10 pt-40 pb-20 md:pt-52 md:pb-32 px-6 min-h-[90vh] flex flex-col items-center justify-center text-center will-change-transform"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: customEase }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-slate-600 text-xs font-semibold uppercase tracking-widest mb-0 backdrop-blur-md relative z-20"
        >
          <Sparkles className="w-4 h-4 text-[#1dbf73]" />
          <span>Next-Gen Workforce Security</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: customEase }}
          className="mt-[-5px] mb-[-15px] md:mt-[-10px] md:mb-[-25px] relative w-[320px] h-[80px] md:w-[600px] md:h-[150px] z-10"
        >
          <Image 
            src="/logo.png" 
            alt="Anchor Fashion Logo" 
            fill
            className="object-contain drop-shadow-2xl"
            priority 
          />
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.1, ease: customEase }}
          className="text-6xl md:text-8xl lg:text-[7.5rem] font-black tracking-tighter leading-[1.05] max-w-5xl text-slate-900"
        >
          Next-Gen <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1dbf73] to-emerald-500">
            Attendance.
          </span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.2, ease: customEase }}
          className="mt-8 text-lg md:text-2xl text-slate-500 font-medium max-w-2xl leading-relaxed tracking-tight"
        >
          Military-grade biometric verification meets high-precision spatial tracking. A frictionless attendance experience designed for enterprise scale.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.3, ease: customEase }}
          className="mt-12 flex flex-col sm:flex-row gap-6 w-full sm:w-auto items-center"
        >
          <button 
            onClick={handleDashboardRedirect}
            className="group relative px-8 py-4 bg-slate-900 text-white rounded-full font-bold text-lg flex items-center justify-center gap-3 hover:bg-slate-800 hover:shadow-2xl hover:shadow-slate-900/20 hover:-translate-y-1 transition-all"
          >
            {isAuthenticated ? 'Enter Dashboard' : 'Authenticate Now'} 
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </motion.section>

      {/* --- BENTO GRID FEATURES --- */}
      <section className="relative z-10 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-100px" }}
            transition={{ duration: 1, ease: customEase }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900">
              Surgically Precise. <br/> Impossibly Fast.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[320px]">
            {/* Feature 1: Biometrics (Spans 2 cols on Desktop) */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.8, ease: customEase }}
              className="md:col-span-2 relative rounded-[2.5rem] bg-white border border-slate-200 shadow-sm p-10 overflow-hidden group hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(29,191,115,0.05),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#1dbf73]/10 flex items-center justify-center mb-6 border border-[#1dbf73]/20">
                    <ScanFace className="w-6 h-6 text-[#1dbf73]" />
                  </div>
                  <h3 className="text-3xl font-bold tracking-tight mb-3 text-slate-900">AI Facial Recognition</h3>
                  <p className="text-slate-500 text-lg leading-relaxed max-w-md font-medium">
                    Sub-second 3D mapping prevents spoofing. Authenticate your workforce with unparalleled accuracy and speed.
                  </p>
                </div>
                {/* Decorative Visual */}
                <div className="absolute -bottom-10 -right-10 w-72 h-72 border border-slate-100 rounded-full flex items-center justify-center opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700 bg-slate-50/50">
                  <div className="w-56 h-56 border border-[#1dbf73]/20 rounded-full flex items-center justify-center animate-[spin_10s_linear_infinite]">
                    <div className="w-40 h-40 border border-[#1dbf73]/40 rounded-full flex items-center justify-center bg-white/50" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Feature 2: Fingerprint */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.8, delay: 0.1, ease: customEase }}
              className="relative rounded-[2.5rem] bg-white border border-slate-200 shadow-sm p-10 overflow-hidden group hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.05),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-6 border border-blue-100">
                  <Fingerprint className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight mb-3 text-slate-900">WebAuthn Ready</h3>
                <p className="text-slate-500 text-base leading-relaxed font-medium">
                  Passwordless entry using native device biometrics. Secure, seamless, and instantly accessible.
                </p>
                <div className="mt-auto flex justify-end">
                  <Lock className="w-24 h-24 text-slate-50 group-hover:text-blue-50 transition-colors duration-700" />
                </div>
              </div>
            </motion.div>

            {/* Feature 3: Geo-Fencing */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.8, ease: customEase }}
              className="relative rounded-[2.5rem] bg-white border border-slate-200 shadow-sm p-10 overflow-hidden group hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.05),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center mb-6 border border-purple-100">
                  <Globe className="w-6 h-6 text-purple-500" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight mb-3 text-slate-900">Spatial Restraints</h3>
                <p className="text-slate-500 text-base leading-relaxed font-medium">
                  Strict GPS perimeters ensure attendance is only logged within authorized corporate bounds.
                </p>
                <div className="mt-auto flex justify-end">
                  <MapPin className="w-24 h-24 text-slate-50 group-hover:text-purple-50 transition-colors duration-700" />
                </div>
              </div>
            </motion.div>

            {/* Feature 4: Command Center (Spans 2 cols) */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.8, delay: 0.1, ease: customEase }}
              className="md:col-span-2 relative rounded-[2.5rem] bg-white border border-slate-200 shadow-sm p-10 overflow-hidden group hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.05),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative z-10 flex flex-col md:flex-row h-full gap-8 items-center">
                <div className="flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-6 border border-orange-100 shadow-sm">
                    <Activity className="w-6 h-6 text-orange-500" />
                  </div>
                  <h3 className="text-3xl font-bold tracking-tight mb-3 text-slate-900">📍 Real-Time GPS Map & Live Center</h3>
                  <p className="text-slate-500 text-lg leading-relaxed font-medium">
                    Monitor workforce presence on a live interactive map. Approve leaves, track late arrivals, and generate payroll-ready exports instantly.
                  </p>
                </div>
                <div className="flex-1 w-full h-full relative flex items-center justify-center">
                   <div className="w-full h-32 bg-slate-50 rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3 group-hover:scale-105 transition-transform duration-700">
                     <div className="w-1/3 h-2 bg-slate-200 rounded-full" />
                     <div className="flex gap-2">
                       <div className="w-1/2 h-12 bg-[#1dbf73]/10 rounded-xl border border-[#1dbf73]/20" />
                       <div className="w-1/2 h-12 bg-orange-500/10 rounded-xl border border-orange-500/20" />
                     </div>
                   </div>
                </div>
              </div>
            </motion.div>

            {/* Feature 5: Offline Resilience */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.8, ease: customEase }}
              className="relative rounded-[2.5rem] bg-white border border-slate-200 shadow-sm p-10 overflow-hidden group hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(239,68,68,0.05),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-6 border border-red-100">
                  <WifiOff className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight mb-3 text-slate-900">Offline Resilience</h3>
                <p className="text-slate-500 text-base leading-relaxed font-medium">
                  Network down? No problem. Biometric payloads queue locally and auto-sync when connectivity returns.
                </p>
              </div>
            </motion.div>

            {/* Feature 5.5: PWA Cross-Platform */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.8, delay: 0.1, ease: customEase }}
              className="relative rounded-[2.5rem] bg-white border border-slate-200 shadow-sm p-10 overflow-hidden group hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.05),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6 border border-emerald-100 shadow-sm">
                  <MonitorSmartphone className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight mb-3 text-slate-900">⚡ Cross-Platform PWA</h3>
                <p className="text-slate-500 text-base leading-relaxed font-medium">
                  Install natively on iOS, Android, and Desktop directly from your browser. No App Store required. 
                </p>
              </div>
            </motion.div>

            {/* Feature 6: Advanced Shift Engine (Spans 2 cols) */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.8, delay: 0.1, ease: customEase }}
              className="md:col-span-2 relative rounded-[2.5rem] bg-white border border-slate-200 shadow-sm p-10 overflow-hidden group hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.05),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative z-10 flex flex-col md:flex-row h-full gap-8 items-center">
                <div className="flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center mb-6 border border-sky-100">
                    <Calculator className="w-6 h-6 text-sky-500" />
                  </div>
                  <h3 className="text-3xl font-bold tracking-tight mb-3 text-slate-900">Intelligent Duty Engine</h3>
                  <p className="text-slate-500 text-lg leading-relaxed font-medium">
                    Automate complex payroll variables like holiday multipliers, dynamic overtime slots, and half-day thresholds effortlessly.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Feature 7: Multi-Branch Scalability (Spans 2 cols) */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.8, ease: customEase }}
              className="md:col-span-2 relative rounded-[2.5rem] bg-white border border-slate-200 shadow-sm p-10 overflow-hidden group hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.05),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative z-10 flex flex-col md:flex-row h-full gap-8 items-center">
                <div className="flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center mb-6 border border-pink-100">
                    <Building2 className="w-6 h-6 text-pink-500" />
                  </div>
                  <h3 className="text-3xl font-bold tracking-tight mb-3 text-slate-900">Multi-Branch Scalability</h3>
                  <p className="text-slate-500 text-lg leading-relaxed font-medium">
                    Manage 1 or 1,000 physical locations from a single pane of glass. Delegate localized control with localized GPS fences.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Feature 8: Approval Workflows */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.8, delay: 0.1, ease: customEase }}
              className="relative rounded-[2.5rem] bg-white border border-slate-200 shadow-sm p-10 overflow-hidden group hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.05),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mb-6 border border-green-100">
                  <ClipboardCheck className="w-6 h-6 text-green-500" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight mb-3 text-slate-900">Automated Workflows</h3>
                <p className="text-slate-500 text-base leading-relaxed font-medium">
                  Streamline operations with digital Gate Passes, Leaves, and Correction requests.
                </p>
              </div>
            </motion.div>

            {/* Feature 9: Analytics */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.8, ease: customEase }}
              className="relative rounded-[2.5rem] bg-white border border-slate-200 shadow-sm p-10 overflow-hidden group hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.05),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6 border border-indigo-100">
                  <BarChart3 className="w-6 h-6 text-indigo-500" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight mb-3 text-slate-900">Actionable Insights</h3>
                <p className="text-slate-500 text-base leading-relaxed font-medium">
                  Generate daily or monthly attendance heatmaps. Export data directly into payroll tools.
                </p>
              </div>
            </motion.div>

            {/* Feature 10: Role-Based Workspaces (Spans 2 cols) */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.8, delay: 0.1, ease: customEase }}
              className="md:col-span-2 relative rounded-[2.5rem] bg-white border border-slate-200 shadow-sm p-10 overflow-hidden group hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.05),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative z-10 flex flex-col md:flex-row h-full gap-8 items-center">
                <div className="flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-6 border border-orange-100">
                    <Users className="w-6 h-6 text-orange-500" />
                  </div>
                  <h3 className="text-3xl font-bold tracking-tight mb-3 text-slate-900">Role-Based Workspaces</h3>
                  <p className="text-slate-500 text-lg leading-relaxed font-medium">
                    Dedicated, secure portals for Employees, Branch Managers, and System Admins. Total data privacy and strict access control out-of-the-box.
                  </p>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* --- HOW IT WORKS (Apple-style structured list) --- */}
      <section className="relative z-10 py-32 px-6 border-t border-slate-200">
        <div className="max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-100px" }}
            transition={{ duration: 1, ease: customEase }}
            className="text-center mb-24"
          >
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900">Engineered for Simplicity.</h2>
          </motion.div>

          <div className="space-y-16">
            {[
              { num: "01", title: "Authenticate Identity", desc: "Login securely using your corporate credentials or passwordless WebAuthn (Fingerprint/FaceID)." },
              { num: "02", title: "Verify Coordinates", desc: "The system automatically validates your GPS location against the office's strict geo-fence parameters." },
              { num: "03", title: "Biometric Handshake", desc: "Look into the camera. Advanced AI confirms liveness and identity in under 800 milliseconds." }
            ].map((step, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, margin: "-100px" }}
                transition={{ duration: 0.8, delay: idx * 0.1, ease: customEase }}
                className="flex flex-col md:flex-row gap-8 md:items-center group"
              >
                <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-slate-200 to-transparent group-hover:from-[#1dbf73]/60 transition-colors duration-500">
                  {step.num}
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight mb-2 text-slate-900 group-hover:text-[#1dbf73] transition-colors">{step.title}</h3>
                  <p className="text-slate-500 text-lg leading-relaxed max-w-lg font-medium">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FAQ ACCORDION --- */}
      <section className="relative z-10 py-32 px-6 bg-slate-50 border-t border-slate-200">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-100px" }}
            transition={{ duration: 0.8, ease: customEase }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 mb-6">Frequently Asked Questions</h2>
            <p className="text-lg text-slate-500 font-medium">Everything you need to know about the product and billing.</p>
          </motion.div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:border-slate-300 transition-colors"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full px-8 py-6 text-left flex justify-between items-center focus:outline-none"
                  aria-expanded={openFaqIndex === index}
                >
                  <h3 className="text-xl font-bold text-slate-900 pr-8">{faq.q}</h3>
                  <div className={`w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 transition-transform duration-300 ${openFaqIndex === index ? 'rotate-180 bg-[#1dbf73]/10 text-[#1dbf73]' : 'text-slate-400'}`}>
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </button>
                <AnimatePresence>
                  {openFaqIndex === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="px-8 pb-6 text-slate-500 text-lg leading-relaxed font-medium">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="border-t border-slate-200 py-12 px-6 relative z-10 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start">
            <div className="text-xl font-bold tracking-tight flex items-center gap-2 mb-2 text-slate-900">
              <ShieldCheck className="w-5 h-5 text-[#1dbf73]" /> Anchor Fashion
            </div>
            <p className="text-xs text-slate-500 font-medium">Enterprise workforce management.</p>
          </div>
          
          <div className="flex items-center gap-8 text-sm font-semibold text-slate-500">
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 transition-colors">Terms</Link>
            <Link href="/support" className="hover:text-slate-900 transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
