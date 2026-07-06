'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function UnauthorizedPage() {
  const router = useRouter();

  const handleReturn = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        if (profile.role === 'admin') router.push('/admin');
        else if (profile.role === 'branch_manager') router.push('/branch-manager');
        else router.push('/employee');
        return;
      }
    }
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-[#040A15] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#D2A02A]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-rose-900/10 rounded-full blur-[100px] pointer-events-none" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-[#061224] border border-[#1E293B] rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-[#D2A02A]/10">
            <ShieldAlert className="w-8 h-8 text-rose-500" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            Access <span className="text-[#D2A02A]">Restricted</span>
          </h1>
          <p className="text-slate-400 text-sm">
            403 - You don&apos;t have permission to view this resource.
          </p>
        </div>

        <Card className="bg-[#061224] border-[#1E293B] p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#D2A02A_1px,transparent_1px)] [background-size:20px_20px] mix-blend-overlay z-0" />
          
          <div className="relative z-10 space-y-4">
            <p className="text-slate-300 text-sm text-center font-medium">
              This area is restricted to authorized personnel. Attempting to access permalinks outside of your role clearance is logged.
            </p>

            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-center">
              <span className="text-rose-400 text-xs font-bold uppercase tracking-widest block mb-1">
                Security Policy
              </span>
              <span className="text-rose-300/80 text-xs">
                Anchor Fashion Management System strictly enforces role-based access control.
              </span>
            </div>

            <Button
              variant="primary"
              className="w-full bg-[#D2A02A] text-[#040A15] hover:bg-[#C08F1E] font-bold border-none"
              onClick={handleReturn}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Return to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
