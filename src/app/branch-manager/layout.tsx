'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/client';
import { Spinner } from '@/components/ui/Spinner';

export default function BranchManagerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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

      if (!profile || (profile.role !== 'branch_manager' && profile.role !== 'admin')) {
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
    }

    checkAuth();
  }, [router, supabase]);

  if (loading || !userProfile) {
    return (
      <div className="min-h-screen bg-[#040A15] flex items-center justify-center">
        <Spinner size="lg" label="Loading Store Dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#040A15] flex">
      <Sidebar
        role="branch_manager"
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
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
