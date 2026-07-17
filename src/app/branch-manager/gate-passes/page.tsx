'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Spinner } from '@/components/ui/Spinner';
import { BranchGatePassTab } from '@/components/admin/branch/BranchGatePassTab';
import { Branch } from '@/components/admin/branch/types';

export default function BranchManagerGatePassesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState<Branch | null>(null);

  useEffect(() => {
    async function loadBranch() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('branch_id')
        .eq('id', user.id)
        .single();

      if (profile?.branch_id) {
        const { data: branchData } = await supabase
          .from('branches')
          .select('*')
          .eq('id', profile.branch_id)
          .single();

        if (branchData) {
          setBranch(branchData as Branch);
        }
      }
      setLoading(false);
    }
    loadBranch();
  }, [supabase]);

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <Spinner size="lg" label="Loading Store Gate Passes..." />
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="p-12 text-center text-slate-500 font-medium">
        No assigned branch found. You cannot manage gate passes without an assigned store.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gate Passes & Breaks</h1>
        <p className="text-sm text-slate-900 mt-1">
          Monitor temporary store exits and issue new gate passes for {branch.name}.
        </p>
      </div>

      <BranchGatePassTab branch={branch} />
    </div>
  );
}
