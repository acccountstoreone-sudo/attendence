'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Share, ShieldCheck } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already running as an installed PWA
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    if (standalone) {
      setTimeout(() => setIsStandalone(true), 0);
      return;
    }

    // Check if user dismissed recently (within 3 days)
    const dismissed = localStorage.getItem('pwa_prompt_dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 3 * 24 * 60 * 60 * 1000) {
      return;
    }

    // Detect iOS Safari
    const iosDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream &&
      !standalone;

    if (iosDevice) {
      setTimeout(() => setIsIOS(true), 0);
      // Show iOS prompt after a short delay
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Listen for standard Android/Desktop beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      (window as any).pwaInstallPrompt = promptEvent;
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show native installation prompt
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa_prompt_dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-[420px] z-50 pointer-events-auto"
      >
        <div className="bg-[#ffffff]/95 backdrop-blur-sm border border-blue-500/30 rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.7)] text-slate-900 relative overflow-hidden">
          {/* Subtle glowing ambient light */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-900 hover:text-slate-900 transition-all active:scale-95"
            aria-label="Close install banner"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start space-x-4">
            {/* App Icon Box */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/50 border border-slate-200">
              <ShieldCheck className="w-8 h-8 text-slate-900" />
            </div>

            {/* Text content */}
            <div className="flex-1 pr-6">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-400">
                  Official Mobile App
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#1dbf73] animate-pulse" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Install Attendance Portal
              </h3>
              <p className="text-xs text-slate-900 mt-1 leading-relaxed">
                Add to your phone Home Screen for instant 1-tap biometric face check-in & offline geofence sync!
              </p>
            </div>
          </div>

          {/* Action Area */}
          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
            {isIOS ? (
              <div className="w-full bg-blue-950/60 border border-blue-500/30 rounded-xl py-2 px-3 flex items-center justify-center space-x-2 text-xs font-semibold text-blue-200">
                <span>To install: Tap</span>
                <Share className="w-4 h-4 text-blue-400 shrink-0 inline" />
                <span>below & select</span>
                <span className="font-bold text-slate-900 bg-white/15 px-1.5 py-0.5 rounded">
                  Add to Home Screen ➕
                </span>
              </div>
            ) : (
              <>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-900 hover:text-slate-900 transition-colors"
                >
                  Not Now
                </button>
                <button
                  onClick={handleInstallClick}
                  className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-slate-900 font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-blue-900/50 transition-all active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>Install App Now</span>
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

