import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Mail, Phone, MapPin } from 'lucide-react';

export default function SupportPage() {
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
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-[2rem] p-10 md:p-16 shadow-sm text-center">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-8 border border-blue-100">
            <Mail className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-4">Need Assistance?</h1>
          <p className="text-slate-500 font-medium mb-12 text-lg">
            If you are experiencing issues with attendance logging, facial recognition, or account access, please reach out to our system administration team.
          </p>
          
          <div className="space-y-6 text-left">
            <div className="flex items-center gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-[#1dbf73]" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Email Administrator</h3>
                <a href="mailto:admin@anchorfashion.com" className="text-slate-500 hover:text-[#1dbf73] transition-colors font-medium">admin@anchorfashion.com</a>
              </div>
            </div>

            <div className="flex items-center gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0">
                <Phone className="w-6 h-6 text-[#1dbf73]" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">HR Helpdesk</h3>
                <a href="tel:+8801700000000" className="text-slate-500 hover:text-[#1dbf73] transition-colors font-medium">+880 1700-000000</a>
              </div>
            </div>

            <div className="flex items-center gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0">
                <MapPin className="w-6 h-6 text-[#1dbf73]" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Head Office</h3>
                <p className="text-slate-500 font-medium">Dhaka, Bangladesh</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
