'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { GpsIndicator } from '@/components/attendance/GpsIndicator';
import { FaceCapture } from '@/components/attendance/FaceCapture';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Clock, CheckCircle2, History, AlertTriangle, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EmployeeCheckInPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [userProfile, setUserProfile] = useState<{ id: string; branch_id?: string; branch_name?: string } | null>(null);
  
  // Geolocation state from GpsIndicator
  const [locationState, setLocationState] = useState<{
    latitude: number;
    longitude: number;
    isWithinGeofence: boolean;
    distance: number;
  } | null>(null);

  // Today's status
  const [todayRecord, setTodayRecord] = useState<{
    id?: string;
    check_in_time?: string;
    check_out_time?: string;
    status?: string;
  } | null>(null);

  const [checkType, setCheckType] = useState<'in' | 'out'>('in');

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, branch_id, branches!profiles_branch_id_fkey(name)')
        .eq('id', user.id)
        .single();

      if (prof) {
        setUserProfile({
          id: prof.id,
          branch_id: prof.branch_id,
          branch_name: (prof as unknown as { branches?: { name?: string } }).branches?.name || 'Anchor Store',
        });
      }

      // B5 fix: /api/attendance/today returns an object, not an array
      const res = await fetch('/api/attendance/today');
      const json = await res.json();
      if (json.success && json.data && json.data.checked_in) {
        setTodayRecord(json.data);
        if (json.data.check_in_time && !json.data.check_out_time) {
          setCheckType('out');
        }
      }
      setLoading(false);
    }
    loadData();
  }, [supabase]);

  const handleBiometricSubmit = async (base64Image: string) => {
    if (!locationState || !userProfile) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const endpoint = checkType === 'in' ? '/api/attendance/check-in' : '/api/attendance/check-out';
      const payload =
        checkType === 'in'
          ? {
              latitude: locationState.latitude,
              longitude: locationState.longitude,
              photo_url: base64Image, // In production, upload blob to bucket and pass URL
              face_verified: true,
            }
          : {
              latitude: locationState.latitude,
              longitude: locationState.longitude,
              face_verified: true,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.success) {
        setFeedback({ type: 'success', message: `Successfully Checked ${checkType === 'in' ? 'In' : 'Out'}!` });
        setTimeout(() => router.push('/employee'), 1500);
      } else {
        setFeedback({ type: 'error', message: `Check-In Failed: ${result.error?.message || 'Geofence or verification error'}` });
      }
    } catch (err) {
      console.error('Submit error:', err);
      setFeedback({ type: 'error', message: 'Network error occurred during submission.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <Spinner size="lg" label="Initializing Biometric & GPS Modules..." />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-[#061224] p-6 rounded-3xl border border-[#1E293B] shadow-xl">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/employee')}
            className="p-2.5 rounded-2xl bg-[#040A15]/80 hover:bg-[#1E293B] text-slate-300 hover:text-[#D2A02A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <Badge status="active">Biometric + GPS Active</Badge>
              <span className="text-xs text-slate-400 font-medium">{userProfile?.branch_name}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white mt-1">Shift Attendance Check-In</h1>
          </div>
        </div>

        {/* Check Type Toggle */}
        <div className="flex bg-[#040A15] p-1 rounded-2xl border border-[#1E293B]">
          <button
            onClick={() => setCheckType('in')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              checkType === 'in' ? 'bg-[#D2A02A] text-[#040A15] shadow-md' : 'text-slate-400 hover:text-[#D2A02A]'
            }`}
          >
            Check In
          </button>
          <button
            onClick={() => setCheckType('out')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              checkType === 'out' ? 'bg-[#D2A02A] text-[#040A15] shadow-md' : 'text-slate-400 hover:text-[#D2A02A]'
            }`}
          >
            Check Out
          </button>
        </div>
      </div>

      {/* B1 fix: Inline feedback message instead of alert() */}
      <AnimatePresence mode="wait">
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl border flex items-center space-x-3 shadow-lg ${
              feedback.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/80 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
            <span className="text-sm font-semibold">{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Today's Status Banner */}
      {todayRecord && (
        <Card className="bg-[#061224] border-[#D2A02A]/20 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-6 h-6 text-[#D2A02A] shrink-0" />
            <div>
              <p className="text-sm font-bold text-white">Today&apos;s Attendance Recorded</p>
              <p className="text-xs text-slate-300">
                Check-In: <strong className="text-[#D2A02A]">{todayRecord.check_in_time ? new Date(todayRecord.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</strong>
                {todayRecord.check_out_time && (
                  <> | Check-Out: <strong className="text-[#D2A02A]/70">{new Date(todayRecord.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></>
                )}
              </p>
            </div>
          </div>
          <Badge status={todayRecord.status as 'present' | 'late' | 'absent'} />
        </Card>
      )}

      {/* GPS Geofence Module (Spec P29) */}
      <GpsIndicator
        branchName={userProfile?.branch_name}
        geofenceRadius={100}
        onLocationVerified={(coords) => setLocationState(coords)}
      />

      {/* Biometric Camera Module (Spec P28) */}
      <FaceCapture
        onCapture={handleBiometricSubmit}
        isGpsVerified={locationState?.isWithinGeofence ?? false}
        gpsDistance={locationState?.distance}
        isLoading={submitting}
      />
    </div>
  );
}
