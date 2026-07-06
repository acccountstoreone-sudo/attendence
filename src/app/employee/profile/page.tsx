'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  User,
  Mail,
  Phone,
  Building2,
  ShieldCheck,
  Calendar,
  Key,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface ProfileData {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  branch_name: string;
  created_at: string;
}

export default function EmployeeProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, role, is_active, created_at, branches!profiles_branch_id_fkey(name)')
        .eq('id', user.id)
        .single();

      if (prof) {
        setProfile({
          id: prof.id,
          full_name: prof.full_name,
          email: prof.email,
          phone: prof.phone,
          role: prof.role,
          is_active: prof.is_active,
          created_at: prof.created_at,
          branch_name: (prof as unknown as { branches?: { name?: string } }).branches?.name || 'Headquarters',
        });
      }
      setLoading(false);
    }
    loadProfile();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <Spinner size="lg" label="Loading Profile..." />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">My Profile</h1>
          <p className="text-sm text-slate-400 mt-1">
            View your personal information and account settings.
          </p>
        </div>
        <Badge status={profile.is_active ? 'active' : 'suspended'}>
          {profile.is_active ? 'Account Active' : 'Account Suspended'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Avatar & Summary */}
        <Card className="bg-[#0A101C] border-[#1E293B] p-6 col-span-1 flex flex-col items-center text-center shadow-lg">
          <div className="w-24 h-24 rounded-full bg-[#1E293B] flex items-center justify-center border-4 border-[#040A15] shadow-xl mb-4">
            <span className="text-3xl font-bold text-slate-300">
              {profile.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white">{profile.full_name}</h2>
          <p className="text-sm text-amber-500 font-medium capitalize mt-1">
            {profile.role.replace('_', ' ')}
          </p>
          <div className="w-full h-px bg-[#1E293B] my-6" />
          <div className="w-full space-y-3 text-left">
            <div className="flex items-center space-x-3 text-sm text-slate-300">
              <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="truncate">{profile.branch_name}</span>
            </div>
            <div className="flex items-center space-x-3 text-sm text-slate-300">
              <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Joined {new Date(profile.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </Card>

        {/* Right Column: Details & Settings */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          <Card className="bg-[#0A101C] border-[#1E293B] p-6 shadow-lg">
            <div className="flex items-center space-x-2 text-slate-100 mb-6 pb-4 border-b border-[#1E293B]">
              <User className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-base">Personal Information</h3>
            </div>
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <span className="text-sm font-medium text-slate-500">Full Name</span>
                <span className="text-sm text-slate-200 sm:col-span-2 font-medium">{profile.full_name}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <span className="text-sm font-medium text-slate-500">Email Address</span>
                <div className="sm:col-span-2 flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-200">{profile.email}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <span className="text-sm font-medium text-slate-500">Phone Number</span>
                <div className="sm:col-span-2 flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-200">{profile.phone || 'Not provided'}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-[#0A101C] border-[#1E293B] p-6 shadow-lg">
            <div className="flex items-center space-x-2 text-slate-100 mb-6 pb-4 border-b border-[#1E293B]">
              <ShieldCheck className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-base">Account Security</h3>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                To update your password or edit your personal details, please contact your Branch Manager or HQ Administrator. This ensures all employee records remain verified and secure.
              </p>
              <div className="pt-2">
                <Button variant="outline" size="sm" className="border-[#1E293B] text-slate-300 cursor-not-allowed opacity-50" icon={<Key className="w-4 h-4" />}>
                  Change Password (Locked)
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
