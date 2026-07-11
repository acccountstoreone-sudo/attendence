'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Settings, Clock, CalendarDays, CheckCircle2, AlertTriangle, Info, MapPin, Store, Navigation, Phone, Building2, ShieldCheck, Sparkles, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LocationMapPicker } from '@/components/admin/LocationMapPicker';

interface BranchData {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_meters: number;
}

interface BranchSettings {
  work_start_time: string;
  work_end_time: string;
  late_grace_minutes: number;
  overtime_after_minutes: number;
  half_day_hours: number;
  weekly_off_days: number[];
}

const DEFAULT_SETTINGS: BranchSettings = {
  work_start_time: '09:00:00',
  work_end_time: '18:00:00',
  late_grace_minutes: 15,
  overtime_after_minutes: 30,
  half_day_hours: 4,
  weekly_off_days: [5], // Friday
};

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function StoreSettingsPage() {
  const [activeTab, setActiveTab] = useState<'location' | 'duty'>('location');
  const [loading, setLoading] = useState(true);
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingDuty, setSavingDuty] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);

  const [branchData, setBranchData] = useState<BranchData | null>(null);
  const [settings, setSettings] = useState<BranchSettings>(DEFAULT_SETTINGS);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Load Branch Profile & Geofence
      const branchRes = await fetch('/api/branches');
      const branchJson = await branchRes.json();
      if (branchJson.success && branchJson.data && branchJson.data.length > 0) {
        const b = branchJson.data[0];
        setBranchData({
          id: b.id,
          name: b.name || '',
          code: b.code || '',
          address: b.address || '',
          city: b.city || '',
          phone: b.phone || '',
          latitude: b.latitude !== undefined && b.latitude !== null ? Number(b.latitude) : null,
          longitude: b.longitude !== undefined && b.longitude !== null ? Number(b.longitude) : null,
          geofence_radius_meters: b.geofence_radius_meters ? Number(b.geofence_radius_meters) : 100,
        });
      }

      // 2. Load Branch Duty Settings
      const settingsRes = await fetch('/api/branch-settings');
      const settingsJson = await settingsRes.json();
      if (settingsJson.success && settingsJson.data) {
        setSettings(settingsJson.data);
      }
    } catch (err) {
      console.error('Failed to load store data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadAllData();
    });
  }, [loadAllData]);

  // Handle GPS location detection
  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      setFeedback({ type: 'error', message: 'Geolocation is not supported by your browser.' });
      return;
    }
    setDetectingGps(true);
    setFeedback(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (branchData) {
          setBranchData({
            ...branchData,
            latitude: Number(latitude.toFixed(6)),
            longitude: Number(longitude.toFixed(6)),
          });
        }
        setFeedback({
          type: 'success',
          message: `GPS Detected! Updated coordinates to (${latitude.toFixed(5)}, ${longitude.toFixed(5)}) with ±${Math.round(accuracy)}m accuracy. Click 'Save Store Location & Profile' to apply.`,
        });
        setDetectingGps(false);
      },
      (err) => {
        setDetectingGps(false);
        setFeedback({ type: 'error', message: `GPS Error: ${err.message}. Please check browser location permissions.` });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchData) return;
    setSavingLocation(true);
    setFeedback(null);
    try {
      const payload = {
        name: branchData.name,
        address: branchData.address || null,
        city: branchData.city || null,
        phone: branchData.phone || null,
        latitude: branchData.latitude !== null ? Number(branchData.latitude) : null,
        longitude: branchData.longitude !== null ? Number(branchData.longitude) : null,
        geofence_radius_meters: Number(branchData.geofence_radius_meters) || 100,
      };

      const res = await fetch(`/api/branches/${branchData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Failed to update store profile and location.');
      }
      setFeedback({ type: 'success', message: `Store location and profile updated successfully!` });
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSavingLocation(false);
    }
  };

  const handleSaveDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDuty(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/branch-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Failed to update duty settings.');
      }
      setFeedback({ type: 'success', message: 'Duty hours and shift policies updated successfully.' });
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSavingDuty(false);
    }
  };

  const toggleOffDay = (day: number) => {
    setSettings((prev) => {
      const isSelected = prev.weekly_off_days.includes(day);
      const newOffDays = isSelected
        ? prev.weekly_off_days.filter((d) => d !== day)
        : [...prev.weekly_off_days, day];
      return { ...prev, weekly_off_days: newOffDays };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" label="Loading Store Profile & Duty Settings..." />
      </div>
    );
  }

  if (!branchData) {
    return (
      <Card className="bg-[#ffffff] border border-slate-200 p-8 text-center text-slate-600">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">No Assigned Store Found</h2>
        <p className="text-sm text-slate-600">
          You are currently not linked to a specific retail store branch. Please contact HR Headquarters or Admin to assign you to your branch.
        </p>
      </Card>
    );
  }

  return (
    <div className="max-w-5xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              Store Profile, Location & Duty Timings
            </h1>
            <span className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-xs font-bold">
              {branchData.code}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Manage your store&apos;s geographical geofence coordinates, contact profile, operating duty hours, and grace allowances.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 bg-white p-1.5 rounded-xl border border-slate-200 max-w-md shadow-md">
        <button
          type="button"
          onClick={() => { setActiveTab('location'); setFeedback(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'location'
              ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-slate-900 shadow-lg shadow-amber-600/20'
              : 'text-slate-600 hover:text-slate-700 hover:bg-slate-50/50'
          }`}
        >
          <MapPin className="w-4 h-4 shrink-0" />
          <span>Location & Geofence</span>
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('duty'); setFeedback(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'duty'
              ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-slate-900 shadow-lg shadow-amber-600/20'
              : 'text-slate-600 hover:text-slate-700 hover:bg-slate-50/50'
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span>Duty Hours & Rules</span>
        </button>
      </div>

      {/* Feedback Banner */}
      <AnimatePresence mode="wait">
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl border flex items-start space-x-3 shadow-lg ${
              feedback.type === 'success'
                ? 'bg-[#1dbf73]/10 border-emerald-500/20 text-[#1dbf73]'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
            <span className="text-sm font-medium leading-relaxed">{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TAB 1: LOCATION & GEOFENCE */}
      {activeTab === 'location' && (
        <form onSubmit={handleSaveLocation} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Store Profile Card */}
            <Card className="bg-[#ffffff] border border-slate-200 p-6 rounded-xl shadow-md space-y-5">
              <div className="flex items-center space-x-3 border-b border-slate-200 pb-4">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Store Identity & Contact</h2>
                  <p className="text-xs text-slate-600">Basic branch contact and display details</p>
                </div>
              </div>

              <Input
                label="Store Name"
                required
                value={branchData.name}
                onChange={(e) => setBranchData({ ...branchData, name: e.target.value })}
                className="bg-white border-slate-200 focus:border-amber-500 text-slate-700"
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Branch Code (Read Only)"
                  disabled
                  value={branchData.code}
                  className="bg-white/80 border-slate-200 text-slate-600 font-mono cursor-not-allowed"
                />
                <Input
                  label="Contact Phone"
                  placeholder="e.g. 01712-345678"
                  value={branchData.phone}
                  onChange={(e) => setBranchData({ ...branchData, phone: e.target.value })}
                  className="bg-white border-slate-200 focus:border-amber-500 text-slate-700"
                />
              </div>

              <Input
                label="Address / Street Location"
                placeholder="e.g. Plot 12, Road 5, Dhanmondi"
                value={branchData.address}
                onChange={(e) => setBranchData({ ...branchData, address: e.target.value })}
                className="bg-white border-slate-200 focus:border-amber-500 text-slate-700"
              />

              <Input
                label="City / Region"
                placeholder="e.g. Dhaka"
                value={branchData.city}
                onChange={(e) => setBranchData({ ...branchData, city: e.target.value })}
                className="bg-white border-slate-200 focus:border-amber-500 text-slate-700"
              />
            </Card>

            {/* Geofence Settings Card */}
            <Card className="bg-[#ffffff] border border-slate-200 p-6 rounded-xl shadow-md space-y-5 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-[#1dbf73]/10 rounded-lg text-[#1dbf73]">
                      <Navigation className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">GPS Coordinates & Radius</h2>
                      <p className="text-xs text-slate-600">Controls biometric check-in boundary</p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDetectGps}
                    isLoading={detectingGps}
                    className="border-emerald-500/30 text-[#1dbf73] hover:bg-[#1dbf73]/10 text-xs font-semibold gap-1.5 py-1.5 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Use Current GPS
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Latitude"
                    type="number"
                    step="0.000001"
                    placeholder="23.810300"
                    value={branchData.latitude !== null ? branchData.latitude : ''}
                    onChange={(e) =>
                      setBranchData({
                        ...branchData,
                        latitude: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="bg-white border-slate-200 focus:border-amber-500 text-slate-700 font-mono text-sm"
                  />
                  <Input
                    label="Longitude"
                    type="number"
                    step="0.000001"
                    placeholder="90.412500"
                    value={branchData.longitude !== null ? branchData.longitude : ''}
                    onChange={(e) =>
                      setBranchData({
                        ...branchData,
                        longitude: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="bg-white border-slate-200 focus:border-amber-500 text-slate-700 font-mono text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                    <span className="font-semibold flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      Geofence Radius (Meters)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono font-bold text-xs border border-amber-500/20">
                      {branchData.geofence_radius_meters}m
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="1000"
                    step="10"
                    value={branchData.geofence_radius_meters}
                    onChange={(e) =>
                      setBranchData({ ...branchData, geofence_radius_meters: Number(e.target.value) || 100 })
                    }
                    className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-50 rounded-lg"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
                    <span>10m (Strict Retail)</span>
                    <span>100m (Standard)</span>
                    <span>1000m (Large Campus)</span>
                  </div>
                </div>
              </div>

              <div className="bg-white/60 rounded-xl p-3.5 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span>
                  Staff must physically be within <strong className="text-slate-700 font-semibold">{branchData.geofence_radius_meters} meters</strong> of these coordinates to successfully submit biometric check-ins.
                </span>
              </div>
            </Card>
          </div>

          {/* Map Picker Card */}
          <Card className="bg-[#ffffff] border border-slate-200 p-6 rounded-xl shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-md font-semibold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                Interactive Map & Geofence Boundary Preview
              </h3>
              <span className="text-xs text-slate-600">
                Click or drag the gold pin on the map to pinpoint your exact storefront door
              </span>
            </div>

            <div className="h-[380px] w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner relative">
              <LocationMapPicker
                latitude={branchData.latitude}
                longitude={branchData.longitude}
                radiusMeters={branchData.geofence_radius_meters}
                onLocationChange={(lat, lng) =>
                  setBranchData({
                    ...branchData,
                    latitude: Number(lat.toFixed(6)),
                    longitude: Number(lng.toFixed(6)),
                  })
                }
              />
            </div>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              isLoading={savingLocation}
              className="bg-amber-600 hover:bg-amber-500 text-slate-900 font-semibold shadow-[0_0_20px_rgba(217,119,6,0.4)] px-8 py-3 rounded-xl gap-2"
            >
              <ShieldCheck className="w-5 h-5" />
              Save Store Location & Profile
            </Button>
          </div>
        </form>
      )}

      {/* TAB 2: DUTY HOURS & RULES */}
      {activeTab === 'duty' && (
        <form onSubmit={handleSaveDuty} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Shift Timings */}
            <Card className="bg-[#ffffff] border border-slate-200 p-6 rounded-xl shadow-md space-y-5">
              <div className="flex items-center space-x-3 border-b border-slate-200 pb-4">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Daily Shift Timings</h2>
                  <p className="text-xs text-slate-600">Standard working schedule for store staff</p>
                </div>
              </div>

              <Input
                label="Standard Work Start Time"
                type="time"
                step="1"
                required
                value={settings.work_start_time}
                onChange={(e) => setSettings({ ...settings, work_start_time: e.target.value })}
                className="bg-white border-slate-200 focus:border-amber-500 text-slate-700"
              />
              <Input
                label="Standard Work End Time"
                type="time"
                step="1"
                required
                value={settings.work_end_time}
                onChange={(e) => setSettings({ ...settings, work_end_time: e.target.value })}
                className="bg-white border-slate-200 focus:border-amber-500 text-slate-700"
              />

              <div className="pt-2">
                <p className="text-xs text-slate-600 bg-white/60 p-3 rounded-lg border border-slate-200 flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>
                    Staff checking in after <strong className="text-slate-700 font-semibold">{settings.work_start_time}</strong> plus the Late Grace Period below will automatically be marked as <strong className="text-rose-400 font-semibold">Late</strong>.
                  </span>
                </p>
              </div>
            </Card>

            {/* Grace Periods & Overtime */}
            <Card className="bg-[#ffffff] border border-slate-200 p-6 rounded-xl shadow-md space-y-5">
              <div className="flex items-center space-x-3 border-b border-slate-200 pb-4">
                <div className="p-2 bg-[#1dbf73]/10 rounded-lg text-[#1dbf73]">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Policies & Allowances</h2>
                  <p className="text-xs text-slate-600">Grace buffers and half-day thresholds</p>
                </div>
              </div>

              <Input
                label="Late Check-in Grace Period (Minutes)"
                type="number"
                min="0"
                max="120"
                required
                value={settings.late_grace_minutes}
                onChange={(e) => setSettings({ ...settings, late_grace_minutes: parseInt(e.target.value) || 0 })}
                className="bg-white border-slate-200 focus:border-amber-500 text-slate-700"
              />
              <Input
                label="Overtime Trigger Threshold (Minutes)"
                type="number"
                min="0"
                required
                value={settings.overtime_after_minutes}
                onChange={(e) => setSettings({ ...settings, overtime_after_minutes: parseInt(e.target.value) || 0 })}
                className="bg-white border-slate-200 focus:border-amber-500 text-slate-700"
              />
              <Input
                label="Half-Day Qualification Minimum (Hours)"
                type="number"
                min="1"
                max="8"
                step="0.5"
                required
                value={settings.half_day_hours}
                onChange={(e) => setSettings({ ...settings, half_day_hours: parseFloat(e.target.value) || 4 })}
                className="bg-white border-slate-200 focus:border-amber-500 text-slate-700"
              />
            </Card>
          </div>

          {/* Weekly Off Days */}
          <Card className="bg-[#ffffff] border border-slate-200 p-6 rounded-xl shadow-md space-y-4">
            <div className="flex items-center space-x-3 border-b border-slate-200 pb-4">
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Weekly Rest Days</h2>
                <p className="text-xs text-slate-600">Standard non-working days for this store</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = settings.weekly_off_days.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleOffDay(day.value)}
                    className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border text-sm font-semibold transition-all ${
                      isSelected
                        ? 'bg-blue-500/15 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-600 hover:text-slate-700'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-400" />}
                    {day.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Employees are not penalized for absenteeism on these designated off days.
            </p>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              isLoading={savingDuty}
              className="bg-amber-600 hover:bg-amber-500 text-slate-900 font-semibold shadow-[0_0_20px_rgba(217,119,6,0.4)] px-8 py-3 rounded-xl gap-2"
            >
              <ShieldCheck className="w-5 h-5" />
              Save Duty Hours & Settings
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

