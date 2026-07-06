'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  Plus,
  Users,
  Search,
  Pencil,
  Phone,
  Mail,
  Building2,
  User,
  Shield,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface Employee {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: 'employee' | 'branch_manager';
  branch_id?: string;
  branch_name?: string;
  employee_id?: string;
  is_active: boolean;
  created_at: string;
  registration_step?: string;
  nid_front_url?: string;
  nid_back_url?: string;
  nid?: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

export default function AdminEmployeesPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'employee' | 'branch_manager'>('all');
  // Bug 17 fix: Allow toggling between active/inactive view
  const [showInactive, setShowInactive] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Bug 19 fix: Wrapped in useCallback
  const loadData = useCallback(async () => {
    setLoading(true);
    // Bug 17 fix: Fetch both active and inactive employees
    const res = await fetch('/api/employees?include_inactive=true');
    const json = await res.json();
    if (json.success) setEmployees(json.data || []);

    const { data: br } = await supabase.from('branches').select('id, name, code').eq('is_active', true).order('name');
    if (br) setBranches(br);
    setLoading(false);
  }, [supabase]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData(); }, [loadData]);

  const openAddModal = () => router.push('/admin/employees/new');
  const openEditModal = (emp: Employee) => router.push(`/admin/employees/${emp.id}/edit`);

  // Bug 10 fix: Handle API errors, show feedback toast, track loading state per row
  const toggleActive = async (emp: Employee) => {
    setTogglingId(emp.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/employees/${emp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !emp.is_active }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to update employee status.');
      }
      setFeedback({
        type: 'success',
        text: `${emp.full_name} has been ${!emp.is_active ? 'restored' : 'suspended'} successfully.`,
      });
      await loadData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: (err as Error).message || 'Failed to update status.' });
    } finally {
      setTogglingId(null);
    }
  };

  const filteredEmployees = employees.filter((e) => {
    const matchesSearch =
      e.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || e.role === roleFilter;
    // Bug 17 fix: Filter by active/inactive based on toggle
    const matchesActive = showInactive ? !e.is_active : e.is_active;
    return matchesSearch && matchesRole && matchesActive;
  });

  const activeCount = employees.filter((e) => e.is_active).length;
  const inactiveCount = employees.filter((e) => !e.is_active).length;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#061224] via-blue-950/20 to-[#061224] p-6 rounded-3xl border border-[#1E293B] shadow-2xl">
        <div>
          <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Users className="w-4 h-4" />
            <span>HR — Staff Registry</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Employee Management</h1>
          <p className="text-sm text-slate-400 mt-1">Manage all Anchor Fashion staff accounts, roles, and branch assignments.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 bg-[#040A15] border border-[#1E293B] px-3 py-1.5 rounded-xl font-semibold">
            {activeCount} Active
          </span>
          {inactiveCount > 0 && (
            <span className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl font-semibold">
              {inactiveCount} Suspended
            </span>
          )}
          <Button variant="primary" size="md" icon={<Plus className="w-5 h-5" />} onClick={openAddModal}>
            Onboard Employee
          </Button>
        </div>
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
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
            <span>{feedback.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <Card className="bg-[#061224] border-[#1E293B] p-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center flex-1">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search staff name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#040A15] border border-[#1E293B] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#D2A02A] transition-colors"
              />
            </div>

            <div className="flex bg-[#040A15] p-1 rounded-xl border border-[#1E293B] text-xs font-bold">
              {(['all', 'employee', 'branch_manager'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1.5 rounded-lg transition-all capitalize ${roleFilter === r ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  {r === 'all' ? 'All Roles' : r === 'branch_manager' ? 'Managers' : 'Employees'}
                </button>
              ))}
            </div>
          </div>

          {/* Bug 17 fix: Toggle to show suspended employees */}
          <button
            onClick={() => setShowInactive(!showInactive)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              showInactive
                ? 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                : 'bg-[#040A15] border-[#1E293B] text-slate-400 hover:text-white'
            }`}
          >
            {showInactive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showInactive ? `Viewing Suspended (${inactiveCount})` : 'Show Suspended'}
          </button>
        </div>
      </Card>

      {/* Employee Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" label="Loading Staff Registry..." />
        </div>
      ) : (
        <Card className="p-0 overflow-hidden border-[#1E293B] bg-[#061224]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#040A15] text-slate-400 text-[11px] font-extrabold uppercase tracking-wider border-b border-[#1E293B]">
                  <th className="py-4 px-5">Employee</th>
                  <th className="py-4 px-5">Role</th>
                  <th className="py-4 px-5">Branch</th>
                  <th className="py-4 px-5">Employee ID</th>
                  <th className="py-4 px-5 text-center">Status</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/60">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-500 text-sm">
                      {showInactive ? 'No suspended employees found.' : 'No employees found matching your criteria.'}
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-[#1E293B]/30 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center space-x-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${emp.is_active ? 'bg-gradient-to-tr from-indigo-800 to-purple-800' : 'bg-slate-700'}`}>
                            {emp.full_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm">{emp.full_name}</p>
                            <div className="flex items-center space-x-2 text-xs text-slate-400">
                              <Mail className="w-3 h-3" /><span>{emp.email}</span>
                              {emp.phone && <><Phone className="w-3 h-3 ml-1" /><span>{emp.phone}</span></>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center space-x-1.5">
                          {emp.role === 'branch_manager' ? (
                            <Shield className="w-4 h-4 text-purple-400" />
                          ) : (
                            <User className="w-4 h-4 text-blue-400" />
                          )}
                          <span className="text-xs font-bold text-slate-300 capitalize">
                            {emp.role.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-300">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{emp.branch_name || <span className="text-slate-500 italic">Unassigned</span>}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-xs font-mono text-slate-400">
                        {emp.employee_id || '—'}
                      </td>
                      <td className="py-4 px-5 text-center">
                        {emp.registration_step === 'pending_approval' ? (
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mb-1">Pending KYC</span>
                            <div className="flex gap-1 mt-1">
                              {emp.nid_front_url && <a href={emp.nid_front_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline">Front</a>}
                              {emp.nid_back_url && <a href={emp.nid_back_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline">Back</a>}
                            </div>
                          </div>
                        ) : (
                          <Badge status={emp.is_active ? 'active' : 'inactive'} />
                        )}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Button size="sm" variant="ghost" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openEditModal(emp)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={
                              togglingId === emp.id
                                ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                                : emp.is_active
                                  ? <Lock className="w-3.5 h-3.5 text-rose-400" />
                                  : <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                            }
                            onClick={() => toggleActive(emp)}
                            disabled={togglingId === emp.id}
                          >
                            {emp.is_active ? 'Suspend' : 'Restore'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
