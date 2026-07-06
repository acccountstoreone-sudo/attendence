'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/client';
import { Spinner } from '@/components/ui/Spinner';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    id: string;
    full_name: string;
    role: string;
    branch_id?: string | null;
    branch_name?: string;
  } | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, role, branch_id, branches!profiles_branch_id_fkey(name)')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        router.push('/login?error=unauthorized');
        return;
      }

      setUserProfile({
        id: profile.id,
        full_name: profile.full_name,
        role: profile.role,
        branch_id: profile.branch_id,
        branch_name: (profile as unknown as { branches?: { name?: string } }).branches?.name || 'Headquarters',
      });
      setLoading(false);
    }

    checkAuth();
  }, [router, supabase]);

  if (loading || !userProfile) {
    return (
      <div className="min-h-screen bg-[#040A15] flex items-center justify-center">
        <Spinner size="lg" label="Loading HQ Dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#040A15] flex">
      <Sidebar
        role="admin"
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        <Header
          user={userProfile}
          onOpenMobileSidebar={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-[#040A15] to-[#061224] relative scrollbar-thin scrollbar-thumb-[#1E293B] scrollbar-track-transparent">
          <div className="absolute top-0 left-0 w-full h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(210,160,42,0.05),transparent_70%)] pointer-events-none" />
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(5px)' }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="p-4 md:p-6 lg:p-8 max-w-[1920px] mx-auto min-h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
