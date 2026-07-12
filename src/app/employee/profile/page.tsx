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
  Pencil,
  MapPin,
  MessageSquare
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { WebAuthnRegister } from '@/components/auth/WebAuthnRegister';
import { EditProfileModal } from '@/components/employee/EditProfileModal';

interface ProfileData {
  id: string;
  employee_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  branch_name: string;
  created_at: string;
  address: string | null;
  whatsapp_number: string | null;
  photo_url: string | null;
}

export default function EmployeeProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  // BUG-NEW-07 fix: password reset state
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);

  const handlePasswordReset = async () => {
    if (!profile?.email) return;
    setResetLoading(true);
    setResetMsg(null);
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setResetLoading(false);
    if (resetErr) {
      setResetMsg({ type: 'error', text: `Failed: ${resetErr.message}` });
    } else {
      setResetMsg({ type: 'success', text: 'Password reset email sent! Check your inbox.' });
    }
  };

  useEffect(() => {
    loadProfile();
  }, [supabase, router]);

  const loadProfile = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push('/login');
          return;
        }

        // Use select('*') so it never fails if a column like 'email' hasn't been migrated yet
        const { data: prof, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError && !prof) {
          throw new Error(`Failed to load profile data: ${profileError.message}`);
        }

        let branchName = 'Headquarters';
        if (prof?.branch_id) {
          const { data: bData } = await supabase
            .from('branches')
            .select('name')
            .eq('id', prof.branch_id)
            .single();
          if (bData?.name) branchName = bData.name;
        }

        const fullName = prof?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Employee';
        const role = prof?.role || user.user_metadata?.role || 'employee';

        setProfile({
          id: user.id,
          employee_id: prof?.employee_id ?? null,
          full_name: fullName,
          email: prof?.email ?? user.email ?? null,
          phone: prof?.phone ?? user.phone ?? null,
          role: role,
          is_active: prof?.is_active ?? true,
          created_at: prof?.created_at ?? user.created_at ?? new Date().toISOString(),
          branch_name: branchName,
          address: prof?.address ?? null,
          whatsapp_number: prof?.whatsapp_number ?? null,
          photo_url: prof?.photo_url ?? null,
        });
      } catch (err: unknown) {
        console.error('Error loading profile:', err);
        if (err instanceof Error) {
          setError(err.message || 'An unexpected error occurred.');
        } else {
          setError('An unexpected error occurred.');
        }
      } finally {
        setLoading(false);
      }
    };

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <Spinner size="lg" label="Loading Profile..." />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-[600px] flex flex-col items-center justify-center text-center space-y-4">
        <div className="text-rose-500 font-semibold text-lg">Failed to load profile</div>
        <p className="text-slate-600 text-sm max-w-md">{error || 'Could not retrieve employee profile records.'}</p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">My Profile</h1>
          <p className="text-sm text-slate-600 mt-1">
            View your personal information and account settings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            icon={<Pencil className="w-4 h-4" />}
            onClick={() => setEditModalOpen(true)}
          >
            Edit Profile
          </Button>
          <Badge status={profile.is_active ? 'active' : 'inactive'}>
            {profile.is_active ? 'Account Active' : 'Account Suspended'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Avatar & Summary */}
        <Card className="bg-[#ffffff] border-slate-200 p-6 col-span-1 flex flex-col items-center text-center shadow-lg">
          <div className="relative w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center border-4 border-[#ffffff] shadow-xl mb-4 overflow-hidden">
            {profile.photo_url ? (
              <img src={profile.photo_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-slate-600">
                {(profile.full_name || '?').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-900">{profile.full_name}</h2>
          <p className="text-sm text-amber-500 font-medium capitalize mt-1">
            {(profile.role || '').replace(/_/g, ' ')}
          </p>
          <div className="w-full h-px bg-slate-100 my-6" />
          <div className="w-full space-y-3 text-left">
            <div className="flex items-center space-x-3 text-sm text-slate-600">
              <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="truncate">{profile.branch_name}</span>
            </div>
            <div className="flex items-center space-x-3 text-sm text-slate-600">
              <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Joined {new Date(profile.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </Card>

        {/* Right Column: Details & Settings */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          <Card className="bg-[#ffffff] border-slate-200 p-6 shadow-lg">
            <div className="flex items-center space-x-2 text-slate-900 mb-6 pb-4 border-b border-slate-200">
              <User className="w-5 h-5 text-slate-600" />
              <h3 className="font-semibold text-base">Personal Information</h3>
            </div>
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <span className="text-sm font-medium text-slate-500">Employee ID</span>
                <span className="text-sm text-slate-700 sm:col-span-2 font-medium">{profile.employee_id || 'Not assigned'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <span className="text-sm font-medium text-slate-500">Full Name</span>
                <span className="text-sm text-slate-700 sm:col-span-2 font-medium">{profile.full_name}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <span className="text-sm font-medium text-slate-500">Email Address</span>
                <div className="sm:col-span-2 flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-slate-600" />
                  <span className="text-sm text-slate-700">{profile.email || 'Not available'}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <span className="text-sm font-medium text-slate-500">Phone Number</span>
                <div className="sm:col-span-2 flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-slate-600" />
                  <span className="text-sm text-slate-700">{profile.phone || 'Not provided'}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <span className="text-sm font-medium text-slate-500">WhatsApp Number</span>
                <div className="sm:col-span-2 flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4 text-slate-600" />
                  <span className="text-sm text-slate-700">{profile.whatsapp_number || 'Not provided'}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <span className="text-sm font-medium text-slate-500">Address</span>
                <div className="sm:col-span-2 flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-700">{profile.address || 'Not provided'}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-[#ffffff] border-slate-200 p-6 shadow-lg">
            <div className="flex items-center space-x-2 text-slate-900 mb-6 pb-4 border-b border-slate-200">
              <ShieldCheck className="w-5 h-5 text-slate-600" />
              <h3 className="font-semibold text-base">Account Security</h3>
            </div>
              <div className="space-y-4">
              <p className="text-sm text-slate-600">
                You can request a password reset link to be sent to your email address below.
              </p>
              <div className="pt-2 flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-200 text-slate-700 hover:border-[#1dbf73] hover:text-[#1dbf73]"
                  icon={<Key className="w-4 h-4" />}
                  onClick={handlePasswordReset}
                  disabled={resetLoading || !profile?.email}
                >
                  {resetLoading ? 'Sending...' : 'Send Password Reset Email'}
                </Button>
                {resetMsg && (
                  <p className={`text-xs px-2 py-1 rounded ${resetMsg.type === 'success' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                    {resetMsg.text}
                  </p>
                )}
              </div>

              <div className="w-full h-px bg-slate-100 my-6" />

              <WebAuthnRegister />
            </div>
          </Card>
        </div>
      </div>
      
      <EditProfileModal 
        isOpen={editModalOpen} 
        onClose={() => setEditModalOpen(false)}
        currentAddress={profile.address}
        currentWhatsapp={profile.whatsapp_number}
        currentPhotoUrl={profile.photo_url}
        onSuccess={() => {
          // Re-load profile to reflect new updates immediately
          setLoading(true);
          loadProfile();
        }}
      />
    </div>
  );
}

