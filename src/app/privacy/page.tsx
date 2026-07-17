import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-8">Privacy Policy</h1>
          <p className="text-slate-500 font-medium mb-8">Last updated: {new Date().toLocaleDateString()}</p>
          
          <div className="space-y-8 text-slate-600 font-medium leading-relaxed">
            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Information We Collect</h2>
              <p>
                We collect information you provide directly to us, including biometric data (such as facial recognition maps and fingerprint data via WebAuthn), GPS location data during attendance logging, and general profile information. All biometric data is processed securely.
              </p>
            </section>
            
            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">2. How We Use Your Information</h2>
              <p>
                Your information is strictly used for workforce management and attendance verification purposes. GPS and biometric data are used solely to verify your identity and authorized location during check-ins and check-outs. We do not sell your personal data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Data Security</h2>
              <p>
                We implement state-of-the-art security measures, including military-grade encryption for biometric payloads and strict access controls via Role-Based Workspaces. Only authorized branch managers and administrators have access to attendance records.
              </p>
            </section>
            
            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Your Rights</h2>
              <p>
                You have the right to request access to, correction of, or deletion of your personal data. To exercise these rights, please contact your system administrator or reach out to our support team.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
