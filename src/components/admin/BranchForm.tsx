'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Store, MapPin, Phone, Globe, Lock, Unlock } from 'lucide-react';

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
  const [form, setForm] = useState({
    name: initialData?.name || '',
    code: initialData?.code || '',
    address: initialData?.address || '',
    city: initialData?.city || '',
    phone: initialData?.phone || '',
    latitude: initialData?.latitude ? String(initialData.latitude) : '',
    longitude: initialData?.longitude ? String(initialData.longitude) : '',
    geofence_radius_meters: initialData?.geofence_radius_meters ? String(initialData.geofence_radius_meters) : '100',
    is_active: initialData ? initialData.is_active : true,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code.toUpperCase(),
        address: form.address || null,
        city: form.city || null,
        phone: form.phone || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        geofence_radius_meters: Number(form.geofence_radius_meters) || 100,
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
             msg += '\n' + errData.error.details.map((d: any) => `- ${d.path}: ${d.message}`).join('\n');
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
             msg += '\n' + errData.error.details.map((d: any) => `- ${d.path}: ${d.message}`).join('\n');
           }
           throw new Error(msg);
        }
      }

      router.push('/admin/branches');
      router.refresh();
    } catch (err: any) {
      console.error('Save error:', err);
      alert(`Failed to save branch: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl bg-[#061224] border-[#1E293B] p-6 shadow-2xl">
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Store Name *</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g., Anchor Fashion Mirpur" className="w-full px-4 py-3 bg-[#040A15] border border-[#1E293B] rounded-xl text-sm text-white focus:outline-none focus:border-[#D2A02A] focus:ring-1 focus:ring-[#D2A02A] transition-all" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Branch Code *</label>
            <input required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="e.g., AF-MIR-01" className="w-full px-4 py-3 bg-[#040A15] border border-[#1E293B] rounded-xl text-sm text-white focus:outline-none focus:border-[#D2A02A] focus:ring-1 focus:ring-[#D2A02A] transition-all" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Full Address</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
            <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="House, Road, Area..." className="w-full pl-10 pr-4 py-3 bg-[#040A15] border border-[#1E293B] rounded-xl text-sm text-white focus:outline-none focus:border-[#D2A02A] focus:ring-1 focus:ring-[#D2A02A] transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">City</label>
            <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="e.g., Dhaka" className="w-full px-4 py-3 bg-[#040A15] border border-[#1E293B] rounded-xl text-sm text-white focus:outline-none focus:border-[#D2A02A] focus:ring-1 focus:ring-[#D2A02A] transition-all" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Store Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+880 1xxx-xxxxxx" className="w-full pl-10 pr-4 py-3 bg-[#040A15] border border-[#1E293B] rounded-xl text-sm text-white focus:outline-none focus:border-[#D2A02A] focus:ring-1 focus:ring-[#D2A02A] transition-all" />
            </div>
          </div>
        </div>

        <div className="border-t border-[#1E293B] pt-5 space-y-4">
          <div className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-[#D2A02A]" />
            <p className="text-sm font-bold text-[#D2A02A] uppercase tracking-wider">GPS Geofence Configuration</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Latitude</label>
              <input value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                type="number" step="any" placeholder="23.8103" className="w-full px-4 py-3 bg-[#040A15] border border-[#1E293B] rounded-xl text-sm text-white focus:outline-none focus:border-[#D2A02A] focus:ring-1 focus:ring-[#D2A02A] transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Longitude</label>
              <input value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                type="number" step="any" placeholder="90.4125" className="w-full px-4 py-3 bg-[#040A15] border border-[#1E293B] rounded-xl text-sm text-white focus:outline-none focus:border-[#D2A02A] focus:ring-1 focus:ring-[#D2A02A] transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Radius (m)</label>
              <input value={form.geofence_radius_meters} onChange={(e) => setForm((f) => ({ ...f, geofence_radius_meters: e.target.value }))}
                type="number" min="10" max="1000" className="w-full px-4 py-3 bg-[#040A15] border border-[#1E293B] rounded-xl text-sm text-white focus:outline-none focus:border-[#D2A02A] focus:ring-1 focus:ring-[#D2A02A] transition-all" />
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 pt-2 bg-[#040A15] p-4 rounded-xl border border-[#1E293B]">
          <input
            type="checkbox"
            id="is_active_branch"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            className="w-5 h-5 rounded border-[#1E293B] text-[#D2A02A] focus:ring-[#D2A02A]"
          />
          <label htmlFor="is_active_branch" className="text-sm font-medium text-white flex items-center cursor-pointer">
            {form.is_active ? <Unlock className="w-4 h-4 mr-2 text-emerald-400" /> : <Lock className="w-4 h-4 mr-2 text-rose-400" />}
            Branch is currently {form.is_active ? 'Active' : 'Inactive'}
          </label>
        </div>

        <div className="flex justify-end space-x-3 pt-6 border-t border-[#1E293B]">
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
