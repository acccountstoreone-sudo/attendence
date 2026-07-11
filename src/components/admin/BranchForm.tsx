'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MapPin, Phone, Globe, Lock, Unlock, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LocationMapPicker } from '@/components/admin/LocationMapPicker';

interface BranchFormProps {
  initialData?: {
    id: string;
    name: string;
    code: string;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    geofence_radius_meters: number;
    is_active: boolean;
  };
}

export function BranchForm({ initialData }: BranchFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    name: initialData?.name || '',
    code: initialData?.code || '',
    address: initialData?.address || '',
    city: initialData?.city || '',
    phone: initialData?.phone || '',
    latitude: initialData?.latitude !== undefined && initialData?.latitude !== null ? String(initialData.latitude) : '',
    longitude: initialData?.longitude !== undefined && initialData?.longitude !== null ? String(initialData.longitude) : '',
    geofence_radius_meters: initialData?.geofence_radius_meters ? String(initialData.geofence_radius_meters) : '100',
    is_active: initialData ? initialData.is_active : true,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        name: form.name,
        code: form.code.toUpperCase(),
        address: form.address || null,
        city: form.city || null,
        phone: form.phone || null,
        latitude: form.latitude !== '' && form.latitude !== null ? Number(form.latitude) : null,
        longitude: form.longitude !== '' && form.longitude !== null ? Number(form.longitude) : null,
        geofence_radius_meters: Math.round(Number(form.geofence_radius_meters)) || 100,
        is_active: form.is_active,
      };

      if (initialData) {
        const res = await fetch(`/api/branches/${initialData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
           const errData = await res.json().catch(() => null);
           let msg = errData?.error?.message || errData?.message || 'Update failed';
           if (errData?.error?.details) {
             msg += '\n' + errData.error.details.map((d: { path: string; message: string }) => `- ${d.path}: ${d.message}`).join('\n');
           }
           throw new Error(msg);
        }
      } else {
        const res = await fetch('/api/branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
           const errData = await res.json().catch(() => null);
           let msg = errData?.error?.message || errData?.message || 'Create failed';
           if (errData?.error?.details) {
             msg += '\n' + errData.error.details.map((d: { path: string; message: string }) => `- ${d.path}: ${d.message}`).join('\n');
           }
           throw new Error(msg);
        }
      }

      setFeedback({ type: 'success', text: 'Branch location and details saved successfully!' });
      setTimeout(() => {
        router.refresh();
        router.push('/admin/branches');
      }, 1500);
    } catch (err: unknown) {
      console.error('Save error:', err);
      setFeedback({ type: 'error', text: `Failed to save branch: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-4xl mx-auto bg-white border-slate-200 p-6 sm:p-8 shadow-2xl">
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`mb-6 p-4 rounded-xl border text-sm font-medium ${
              feedback.type === 'success' ? 'bg-[#1dbf73]/10 border-emerald-500/20 text-[#1dbf73]' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            <div className="flex items-center gap-3">
              {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
              <span>{feedback.text}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Store Name *</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g., Anchor Fashion Mirpur" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Branch Code *</label>
            <input required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="e.g., AF-MIR-01" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Full Address</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
            <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="House, Road, Area..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">City</label>
            <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="e.g., Dhaka" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Store Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+880 1xxx-xxxxxx" className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all" />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Globe className="w-5 h-5 text-[#1dbf73]" />
              <p className="text-sm font-bold text-[#1dbf73] uppercase tracking-wider">GPS Geofence & Map Selection</p>
            </div>
          </div>

          {/* Interactive Map Picker Component */}
          <LocationMapPicker
            latitude={form.latitude ? Number(form.latitude) : null}
            longitude={form.longitude ? Number(form.longitude) : null}
            radiusMeters={Number(form.geofence_radius_meters) || 100}
            onLocationChange={(lat, lng) => {
              setForm((f) => ({ ...f, latitude: String(lat), longitude: String(lng) }));
            }}
          />

          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Fine-Tune Coordinates or Radius Manually
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Latitude</label>
                <input value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                  type="number" step="any" placeholder="23.8103" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Longitude</label>
                <input value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                  type="number" step="any" placeholder="90.4125" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Radius (m)</label>
                <input value={form.geofence_radius_meters} onChange={(e) => setForm((f) => ({ ...f, geofence_radius_meters: e.target.value }))}
                  type="number" min="10" max="2000" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all font-mono" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 pt-2 bg-white p-4 rounded-xl border border-slate-200">
          <input
            type="checkbox"
            id="is_active_branch"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            className="w-5 h-5 rounded border-slate-200 text-[#1dbf73] focus:ring-[#1dbf73]"
          />
          <label htmlFor="is_active_branch" className="text-sm font-medium text-slate-900 flex items-center cursor-pointer">
            {form.is_active ? <Unlock className="w-4 h-4 mr-2 text-[#1dbf73]" /> : <Lock className="w-4 h-4 mr-2 text-rose-400" />}
            Branch is currently {form.is_active ? 'Active' : 'Inactive'}
          </label>
        </div>

        <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={() => router.push('/admin/branches')}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving...' : initialData ? 'Update Branch' : 'Create Branch'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

