'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/client';
import { Spinner } from '@/components/ui/Spinner';

import { BottomNav } from '@/components/layout/BottomNav';

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
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

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, role, branch_id, branch:branches!profiles_branch_id_fkey(name)')
          .eq('id', user.id)
          .single();

        if (!profile) {
          router.push('/login?error=unauthorized');
          return;
        }

        if (!['employee', 'branch_manager'].includes(profile.role)) {
          router.push('/unauthorized');
          return;
        }

        const branchData = (profile as any).branch || (profile as any).branches;
        const bName = Array.isArray(branchData) ? branchData[0]?.name : branchData?.name;
        setUserProfile({
          id: profile.id,
          full_name: profile.full_name,
          role: profile.role,
          branch_id: profile.branch_id,
          branch_name: bName || 'Anchor Fashion Store',
        });
        setLoading(false);
      } catch (err) {
        console.error('Failed auth verification in EmployeeLayout:', err);
        router.push('/login?error=session_error');
      }
    }

    checkAuth();
  }, [router, supabase]);

  if (loading || !userProfile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" suppressHydrationWarning>
        <Spinner size="lg" label="Loading Staff Dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex" suppressHydrationWarning>
      {/* Sidebar hidden logic is now handled internally by Sidebar component */}
      <div>
        <Sidebar
          role="employee"
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

      <BottomNav role="employee" />
    </div>
  );
}

