import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-[#1dbf73]/30 selection:text-[#1dbf73]">
      <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-2xl bg-white/70 border-b border-slate-200/50 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-[#1dbf73] transition-colors font-medium">
            <ArrowLeft className="w-5 h-5" /> Back to Home
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#1dbf73]" />
            <span className="text-xl font-bold tracking-tight text-slate-900">Anchor<span className="text-slate-500 font-medium">Fashion</span></span>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-[2rem] p-10 md:p-16 shadow-sm">
          <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-8">Terms of Service</h1>
          <p className="text-slate-500 font-medium mb-8">Last updated: {new Date().toLocaleDateString()}</p>
          
          <div className="space-y-8 text-slate-600 font-medium leading-relaxed">
            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing and using the Anchor Fashion workforce management platform, you accept and agree to be bound by the terms and provision of this agreement.
              </p>
            </section>
            
            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Use of Application</h2>
              <p>
                This application is provided exclusively for the employees and administrators of Anchor Fashion. Unauthorized access, sharing of credentials, or attempts to spoof the biometric and GPS verification systems are strictly prohibited and may result in immediate termination of employment.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Accuracy of Data</h2>
              <p>
                You agree to provide accurate information when logging attendance, applying for leaves, or requesting corrections. The system relies on precise GPS and biometric data to function correctly.
              </p>
            </section>
            
            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Modifications to Service</h2>
              <p>
                Anchor Fashion reserves the right at any time to modify or discontinue, temporarily or permanently, the Service (or any part thereof) with or without notice.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
