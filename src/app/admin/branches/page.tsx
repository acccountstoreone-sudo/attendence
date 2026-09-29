'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  Plus,
  Store,
  MapPin,
  Users,
  Pencil,
  CheckCircle2,
  Building2,
  Phone,
  Globe,
  Lock,
  Unlock,
  Search,
  Eye,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  phone?: string;
  is_active: boolean;
  latitude?: number;
  longitude?: number;
  geofence_radius_meters: number;
  created_at: string;
  _staff_count?: number;
}

export default function AdminBranchesPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  // Bug 10 & 20 fix: Use state feedback instead of alert()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('branches')
      .select('*, profiles!profiles_branch_id_fkey(count)')
      .order('name');
    if (!error && data) {
      const mapped = data.map((b: unknown) => {
        const branch = b as Branch & { profiles?: [{ count: number }] };
        return {
          ...branch,
          _staff_count: branch.profiles?.[0]?.count || 0,
        };
      });
      setBranches(mapped);
    } else if (error) {
      // Bug 20 fix: Replace alert() with state feedback
      console.error('Failed to load branches:', error);
      setFeedback({ type: 'error', text: `Failed to load branches: ${error.message}` });
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  // View Details -> Navigate to /admin/branches/[id]
  const openDetailsModal = (branch: Branch) => {
    router.push(`/admin/branches/${branch.id}`);
  };

  // Edit Branch -> Navigate to /admin/branches/[id]/edit
  const openEditModal = (branch: Branch) => {
    router.push(`/admin/branches/${branch.id}/edit`);
  };

  const toggleActive = async (branch: Branch) => {
    setTogglingId(branch.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/branches/${branch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !branch.is_active }),
      });
      const json = await res.json();
      // Bug 10 fix: Check API response for errors
      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to update branch status.');
      }
      setFeedback({
        type: 'success',
        text: `${branch.name} has been ${!branch.is_active ? 'activated' : 'deactivated'} successfully.`,
      });
      await loadBranches();
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: (err as Error).message || 'Failed to update branch status.' });
    } finally {
      setTogglingId(null);
    }
  };

  const filtered = branches.filter(
    (b) =>
      (b.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.code ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-white via-blue-950/20 to-slate-50 p-6 rounded-3xl border border-slate-200 shadow-2xl">
        <div>
          <div className="flex items-center space-x-2 text-blue-600 text-xs font-bold uppercase tracking-widest mb-1">
            <Store className="w-4 h-4" />
            <span>Retail Network Management</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Anchor Fashion Branch Directory
          </h1>
          <p className="text-sm text-slate-900 mt-1">
            Manage store branches, GPS geofence settings, and staff allocations.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4 text-slate-900" />}
          onClick={() => router.push('/admin/branches/new')}
        >
          Add New Branch
        </Button>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex items-center gap-3 p-4 rounded-xl border text-sm font-medium ${
              feedback.type === 'success'
                ? 'bg-[#1dbf73]/10 border-emerald-500/20 text-[#1dbf73]'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
            <span>{feedback.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <Card className="bg-white border-slate-200 p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-900 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search branches by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </Card>

      {/* Branch Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" label="Loading Branch Network..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((branch) => (
            <Card key={branch.id} variant="interactive" className="flex flex-col justify-between">
              {/* Branch Header */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md tracking-wider">
                        {branch.code}
                      </span>
                      <Badge status={branch.is_active ? 'active' : 'inactive'} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{branch.name}</h3>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => openDetailsModal(branch)}
                      className="p-2 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(branch)}
                      className="p-2 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-700 transition-colors"
                      title="Edit Branch"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleActive(branch)}
                      disabled={togglingId === branch.id}
                      className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${branch.is_active ? 'bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700' : 'bg-slate-100 hover:bg-emerald-50 hover:text-[#1dbf73] text-slate-700'}`}
                      title={branch.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {togglingId === branch.id
                        ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                        : branch.is_active ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-900">
                  {branch.address && (
                    <div className="flex items-start space-x-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span>{branch.address}{branch.city ? `, ${branch.city}` : ''}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{branch.phone}</span>
                    </div>
                  )}
                  {branch.latitude && branch.longitude && (
                    <div className="flex items-center space-x-2">
                      <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>
                        GPS: {Number(branch.latitude).toFixed(4)}, {Number(branch.longitude).toFixed(4)}
                        <span className="ml-2 text-blue-600 font-semibold">({branch.geofence_radius_meters}m radius)</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Stats */}
              <div className="mt-4 pt-4 border-t border-slate-200/80 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5 text-slate-900">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span><strong className="text-slate-700">{branch._staff_count || 0}</strong> Staff Assigned</span>
                </div>
                <div className="flex items-center space-x-1 text-slate-500">
                  <CheckCircle2 className="w-3 h-3 text-[#1dbf73]" />
                  <span>Geofence {(branch.latitude != null && branch.longitude != null) ? 'Configured' : 'Not Set'}</span>
                </div>
              </div>
            </Card>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-3 py-16 text-center text-slate-500">
              <Building2 className="w-16 h-16 text-slate-400 mx-auto mb-3" />
              <p className="font-semibold">No branches found. Add your first store to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

