'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/client';
import { Spinner } from '@/components/ui/Spinner';

import { BottomNav } from '@/components/layout/BottomNav';

export default function BranchManagerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  
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
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push('/login');
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, full_name, role, branch_id, branches!profiles_branch_id_fkey(name)')
          .eq('id', user.id)
          .single();

        if (error || !profile || (profile.role !== 'branch_manager' && profile.role !== 'admin')) {
          router.push('/login?error=unauthorized');
          return;
        }

        setUserProfile({
          id: profile.id,
          full_name: profile.full_name,
          role: profile.role,
          branch_id: profile.branch_id,
          branch_name: (profile as unknown as { branches?: { name?: string } }).branches?.name || 'Assigned Branch',
        });
        setLoading(false);
      } catch (err) {
        console.error('Failed auth verification in BranchManagerLayout:', err);
        router.push('/login?error=session_error');
      }
    }

    checkAuth();
  }, [router, supabase]);

  if (loading || !userProfile) {
    return (
      <div className="min-h-screen bg-[#010e05] flex items-center justify-center">
        <Spinner size="lg" label="Loading Store Dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#010e05] flex">
      {/* Sidebar hidden on mobile for branch manager */}
      <div className="hidden md:block">
        <Sidebar
          role="branch_manager"
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
      </div>

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        <Header
          user={userProfile}
          onOpenMobileSidebar={() => setMobileOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto pb-24 md:pb-6">
          {children}
        </main>
      </div>

      <BottomNav role="branch_manager" />
    </div>
  );
}

