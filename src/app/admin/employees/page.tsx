'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Upload,
  FileText,
  Clock,
  Fingerprint,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { KYCReviewModal } from '@/components/admin/KYCReviewModal';
import { BulkImportModal } from '@/components/admin/BulkImportModal';

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
  kyc_status?: string;
  nid_back_url?: string;
  nid?: string;
  photo_url?: string;
  whatsapp_number?: string;
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
  const [pendingApprovals, setPendingApprovals] = useState<Employee[]>([]);
  const [reviewingEmployee, setReviewingEmployee] = useState<Employee | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  // Bug 19 fix: Wrapped in useCallback
  const loadData = useCallback(async () => {
    setLoading(true);
    // Bug 17 fix: Fetch both active and inactive employees
    const res = await fetch('/api/employees?include_inactive=true');
    const json = await res.json();
    if (json.success) {
      const allEmps = json.data || [];
      setEmployees(allEmps);
      setPendingApprovals(allEmps.filter((e: Employee) => e.kyc_status === 'pending'));
    }

    const { data: br } = await supabase.from('branches').select('id, name, code').eq('is_active', true).order('name');
    if (br) setBranches(br);
    setLoading(false);
  }, [supabase]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const searchParam = params.get('search');
      if (searchParam) {
        setSearchTerm(searchParam);
      }
    }
  }, []);

  const openAddModal = () => router.push('/admin/employees/new');
  const openEditModal = (emp: Employee) => router.push(`/admin/employees/${emp.id}/edit`);
  const openDutyReport = (emp: Employee) => router.push(`/admin/employees/${emp.id}/duty-report`);
  const openBiometrics = (emp: Employee) => router.push(`/admin/employees/${emp.id}/biometrics`);

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
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, is_active: !e.is_active } : e));
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: (err as Error).message || 'Failed to update status.' });
    } finally {
      setTogglingId(null);
    }
  };

  const handleApprove = async (userId: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/auth/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setFeedback({ type: 'success', text: action === 'approve' ? 'Employee Approved & Enrolled' : 'Employee Rejected' });
      setReviewingEmployee(null);
      loadData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Action failed' });
    }
  };

  const filteredEmployees = employees.filter((e) => {
    const matchesSearch =
      (e.full_name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.email ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || e.role === roleFilter;
    // Bug 17 fix: Filter by active/inactive based on toggle
    const matchesActive = showInactive ? !e.is_active : e.is_active;
    return matchesSearch && matchesRole && matchesActive;
  });

  const activeCount = employees.filter((e) => e.is_active).length;
  const inactiveCount = employees.filter((e) => !e.is_active).length;

  return (
    <div className="space-y-8 pb-12">
      {/* Minimal Professional Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Staff Registry</h1>
          <p className="text-sm text-slate-600 mt-1">Manage employee accounts, roles, and branch assignments.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-sm text-slate-600 mr-2">
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#1dbf73]"></div>{activeCount} Active</span>
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500"></div>{inactiveCount} Suspended</span>
          </div>
          <Button 
            variant="secondary" 
            icon={<Upload className="w-4 h-4" />} 
            onClick={() => setBulkModalOpen(true)}
            className="bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors font-medium border border-slate-200"
          >
            Bulk Import (CSV)
          </Button>
          <Button 
            variant="primary" 
            icon={<Plus className="w-4 h-4" />} 
            onClick={openAddModal}
            className="bg-white text-black hover:bg-slate-200 transition-colors font-medium border-0"
          >
            Onboard Employee
          </Button>
        </div>
      </div>

      {/* Pending Identity Enrollments */}
      {pendingApprovals.length > 0 && (
        <div className="bg-[#ffffff] border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-500">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-medium">Action Required: {pendingApprovals.length} Pending KYC Verification{pendingApprovals.length > 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="divide-y divide-slate-200">
             {pendingApprovals.map(emp => (
               <div key={emp.id} className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-4 hover:bg-slate-100/30 transition-colors">
                 <div className="flex gap-4 items-center">
                    <div className="relative w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 font-medium text-sm shrink-0 overflow-hidden border border-slate-200">
                      {emp.photo_url ? (
                        <img src={emp.photo_url} alt={emp.full_name} className="w-full h-full object-cover" />
                      ) : (
                        emp.full_name.charAt(0)
                      )}
                    </div>
                   <div>
                     <p className="text-slate-700 font-medium text-sm">{emp.full_name}</p>
                     <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                       <span>{emp.email}</span>
                       <span className="text-slate-700">•</span>
                       <span>{emp.branch_name || 'Global'}</span>
                       {emp.nid && !emp.nid.startsWith('doc_') && (
                         <>
                           <span className="text-slate-700">•</span>
                           <span>NID: ****{emp.nid.slice(-4)}</span>
                         </>
                       )}
                     </div>
                   </div>
                 </div>
                 <div className="shrink-0">
                   <Button size="sm" variant="outline" className="text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900" onClick={() => setReviewingEmployee(emp)}>
                     Review Application
                   </Button>
                 </div>
               </div>
             ))}
          </div>
        </div>
      )}

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
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
            <span>{feedback.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <KYCReviewModal 
        isOpen={!!reviewingEmployee}
        onClose={() => setReviewingEmployee(null)}
        employee={reviewingEmployee}
        onApprove={handleApprove}
      />

      {/* Minimal Filters */}
      <div className="flex flex-wrap gap-3 items-center justify-between bg-white p-2 rounded-xl border border-slate-200">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-transparent border-none text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-0"
            />
          </div>

          <div className="h-6 w-px bg-slate-100" />

          <div className="flex gap-1">
            {(['all', 'employee', 'branch_manager'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg transition-colors text-xs font-medium capitalize ${roleFilter === r ? 'bg-slate-100 text-slate-700' : 'text-slate-500 hover:text-slate-600'}`}
              >
                {r === 'all' ? 'All' : r === 'branch_manager' ? 'Managers' : 'Staff'}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setShowInactive(!showInactive)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            showInactive
              ? 'bg-rose-500/10 text-rose-400'
              : 'text-slate-500 hover:text-slate-600 hover:bg-slate-100/50'
          }`}
        >
          {showInactive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {showInactive ? `Viewing Suspended` : 'Show Suspended'}
        </button>
      </div>

      {/* Minimal Employee Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 border border-slate-200 rounded-xl bg-white">
          <Spinner size="md" />
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#ffffff] text-slate-500 text-xs border-b border-slate-200">
                  <th className="py-3 px-5 font-medium">Name</th>
                  <th className="py-3 px-5 font-medium">Role</th>
                  <th className="py-3 px-5 font-medium">Branch</th>
                  <th className="py-3 px-5 font-medium">Staff ID</th>
                  <th className="py-3 px-5 font-medium text-center">Status</th>
                  <th className="py-3 px-5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                      {showInactive ? 'No suspended employees found.' : 'No employees found matching criteria.'}
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-100/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="relative w-9 h-9 rounded-full bg-[#1dbf73]/10 flex items-center justify-center text-[#1dbf73] font-medium text-sm shrink-0 overflow-hidden border border-[#1dbf73]/20">
                            {emp.photo_url ? (
                              <img src={emp.photo_url} alt={emp.full_name} className="w-full h-full object-cover" />
                            ) : (
                              emp.full_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 text-sm">{emp.full_name}</div>
                            <div className="text-xs text-slate-500">{emp.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700 capitalize flex items-center gap-2">
                          {emp.role.replace('_', ' ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-sm text-slate-600">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            {emp.branch_name || 'Global'}
                          </div>
                          {(emp.phone || emp.whatsapp_number) && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                              {emp.whatsapp_number ? (
                                <span className="flex items-center gap-1"><span className="text-[#1dbf73] font-medium text-[10px] bg-[#1dbf73]/10 px-1 rounded">WA</span> {emp.whatsapp_number}</span>
                              ) : (
                                <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {emp.phone}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <span className="text-xs font-mono text-slate-500">
                          {emp.employee_id || 'PENDING'}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-center">
                        {emp.registration_step === 'pending_approval' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-amber-500/20 text-[11px] text-amber-500 bg-amber-500/5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            KYC
                          </span>
                        ) : (
                          <Badge status={emp.is_active ? 'active' : 'inactive'} />
                        )}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10 px-2.5 text-xs gap-1"
                            onClick={() => openDutyReport(emp)}
                            title="View & Export Month-wise Duty & Overtime Report"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Duty Report
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10 px-2.5 text-xs gap-1"
                            onClick={() => openBiometrics(emp)}
                            title="Manage Biometrics"
                          >
                            <Fingerprint className="w-3.5 h-3.5" />
                            Biometrics
                          </Button>
                          <Button size="sm" variant="ghost" className="text-slate-600 hover:text-slate-700 px-2" onClick={() => openEditModal(emp)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`px-2 ${emp.is_active ? 'text-slate-500 hover:text-rose-400' : 'text-slate-500 hover:text-[#1dbf73]'}`}
                            onClick={() => toggleActive(emp)}
                            disabled={togglingId === emp.id}
                          >
                            {togglingId === emp.id ? '...' : emp.is_active ? 'Suspend' : 'Restore'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BulkImportModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        onSuccess={() => {
          setBulkModalOpen(false);
          loadData();
        }}
      />
    </div>
  );
}

