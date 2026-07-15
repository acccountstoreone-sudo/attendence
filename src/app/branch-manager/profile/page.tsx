'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  User,
  Mail,
  Phone,
  Building2,
  ShieldCheck,
  Calendar,
  Key,
  Save,
  CheckCircle2,
  AlertCircle,
  Store,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ProfileAnnouncements } from '@/components/profile/ProfileAnnouncements';

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
}

export default function BranchManagerProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  // Edit states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Password states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push('/login');
          return;
        }

        const { data: prof, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError && !prof) {
          throw new Error(`Failed to load profile data: ${profileError.message}`);
        }

        let branchName = 'Assigned Store';
        if (prof?.branch_id) {
          const { data: bData } = await supabase
            .from('branches')
            .select('name')
            .eq('id', prof.branch_id)
            .single();
          if (bData?.name) branchName = bData.name;
        }

        const loadedFullName = prof?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Branch Manager';
        const loadedPhone = prof?.phone ?? user.phone ?? '';

        setProfile({
          id: user.id,
          employee_id: prof?.employee_id ?? 'BM-STORE',
          full_name: loadedFullName,
          email: prof?.email ?? user.email ?? null,
          phone: loadedPhone,
          role: prof?.role ?? 'branch_manager',
          is_active: prof?.is_active ?? true,
          created_at: prof?.created_at ?? user.created_at ?? new Date().toISOString(),
          branch_name: branchName,
        });

        setFullName(loadedFullName);
        setPhone(loadedPhone || '');
      } catch (err: unknown) {
        console.error('Error loading branch manager profile:', err);
        if (err instanceof Error) {
          setError(err.message || 'An unexpected error occurred.');
        } else {
          setError('An unexpected error occurred.');
        }
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [supabase, router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setProfileSuccess(null);
    setError(null);

    try {
      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
        })
        .eq('id', profile.id);

      if (dbError) throw dbError;

      await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });

      setProfile((prev) => prev ? { ...prev, full_name: fullName.trim(), phone: phone.trim() || null } : null);
      setProfileSuccess('Profile details updated successfully!');
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: unknown) {
      console.error('Error updating profile:', err);
      if (err instanceof Error) {
        setError(err.message || 'Failed to update profile.');
      } else {
        setError('Failed to update profile.');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setChangingPassword(true);
    try {
      const { error: pwError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (pwError) throw pwError;

      setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMessage(null), 4000);
    } catch (err: unknown) {
      console.error('Error changing password:', err);
      if (err instanceof Error) {
        setPasswordMessage({ type: 'error', text: err.message || 'Failed to update password.' });
      } else {
        setPasswordMessage({ type: 'error', text: 'Failed to update password.' });
      }
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <Spinner size="lg" label="Loading Store Manager Profile..." />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-[600px] flex flex-col items-center justify-center text-center space-y-4">
        <div className="text-rose-500 font-semibold text-lg">Failed to load profile</div>
        <p className="text-slate-600 text-sm max-w-md">{error || 'Could not retrieve branch manager profile records.'}</p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center space-x-2.5">
            <Store className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Store Manager Profile</h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Manage your store management profile, contact numbers, and security credentials.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge status="active" variant="subtle" className="px-3 py-1 text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            ★ Branch Manager
          </Badge>
          <Badge status={profile.is_active ? 'active' : 'inactive'}>
            {profile.is_active ? 'Account Active' : 'Account Suspended'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Avatar & Summary */}
        <Card className="bg-[#ffffff] border-slate-200 p-6 col-span-1 flex flex-col items-center text-center shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center border-4 border-[#ffffff] shadow-2xl mb-4">
            <span className="text-3xl font-extrabold text-slate-900">
              {(profile.full_name || 'M').charAt(0).toUpperCase()}
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">{profile.full_name}</h2>
          <p className="text-xs text-blue-400 font-extrabold uppercase tracking-widest mt-1">
            Branch Manager
          </p>
          <div className="w-full h-px bg-slate-100 my-6" />
          <div className="w-full space-y-3.5 text-left">
            <div className="flex items-center space-x-3 text-sm text-slate-600">
              <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="font-semibold">{profile.branch_name}</span>
            </div>
            <div className="flex items-center space-x-3 text-sm text-slate-600">
              <Mail className="w-4 h-4 text-slate-600 shrink-0" />
              <span className="truncate text-slate-600">{profile.email || 'No email registered'}</span>
            </div>
            <div className="flex items-center space-x-3 text-sm text-slate-600">
              <Phone className="w-4 h-4 text-slate-600 shrink-0" />
              <span>{profile.phone || 'No phone set'}</span>
            </div>
            <div className="flex items-center space-x-3 text-sm text-slate-600">
              <Calendar className="w-4 h-4 text-slate-600 shrink-0" />
              <span>Joined {new Date(profile.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </Card>

        {/* Right Column: Edit Details & Security */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          
          {/* Form 1: Edit Profile */}
          <Card className="bg-[#ffffff] border-slate-200 p-6 shadow-lg">
            <div className="flex items-center space-x-2 text-slate-900 mb-6 pb-4 border-b border-slate-200">
              <User className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-base">Personal Information</h3>
            </div>

            <AnimatePresence>
              {profileSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-6 p-4 bg-emerald-950/80 border border-emerald-500/50 rounded-xl flex items-center space-x-3 text-emerald-200 text-sm font-semibold shadow-lg"
                >
                  <CheckCircle2 className="w-5 h-5 text-[#1dbf73] shrink-0" />
                  <span>{profileSuccess}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Manager ID / Employee Code
                  </label>
                  <Input
                    value={profile.employee_id || 'BM-STORE'}
                    disabled
                    className="bg-slate-50 border-slate-200 text-slate-600 font-mono cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <Input
                    value={profile.email || ''}
                    disabled
                    className="bg-slate-50 border-slate-200 text-slate-600 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter full name"
                    required
                    className="bg-white border-slate-200 text-slate-900 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Phone Number
                  </label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+880 1XXX-XXXXXX"
                    className="bg-white border-slate-200 text-slate-900 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={savingProfile}
                  variant="primary"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-slate-900 font-bold px-6 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                  icon={savingProfile ? undefined : <Save className="w-4 h-4" />}
                >
                  {savingProfile ? 'Saving Changes...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Form 2: Change Password */}
          <Card className="bg-[#ffffff] border-slate-200 p-6 shadow-lg">
            <div className="flex items-center space-x-2 text-slate-900 mb-6 pb-4 border-b border-slate-200">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-base">Account Security & Password</h3>
            </div>

            <AnimatePresence>
              {passwordMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`mb-6 p-4 rounded-xl flex items-center space-x-3 text-sm font-semibold shadow-lg border ${
                    passwordMessage.type === 'success'
                      ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                  }`}
                >
                  {passwordMessage.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-[#1dbf73] shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                  <span>{passwordMessage.text}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    New Password
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="bg-white border-slate-200 text-slate-900 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Confirm New Password
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="bg-white border-slate-200 text-slate-900 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={changingPassword || !newPassword}
                  variant="outline"
                  className="border-slate-200 hover:border-blue-500 text-slate-700 hover:text-blue-400 font-bold"
                  icon={changingPassword ? undefined : <Key className="w-4 h-4" />}
                >
                  {changingPassword ? 'Updating Password...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </Card>

          <ProfileAnnouncements userId={profile.id} role={profile.role} />
        </div>
      </div>
    </div>
  );
}

