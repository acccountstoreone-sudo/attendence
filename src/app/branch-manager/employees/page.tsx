'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  ShieldAlert,
  FileText,
  MessageSquare,
  Building2,
  Phone,
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
  kyc_status?: string;
  photo_url?: string;
  whatsapp_number?: string;
}

export default function StoreEmployeesPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const openDutyReport = (emp: Employee) => router.push(`/branch-manager/employees/${emp.id}/duty-report`);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    // The API automatically filters by the branch manager's branch
    const res = await fetch('/api/employees?include_inactive=true');
    const json = await res.json();
    if (json.success) {
      const allEmps = json.data || [];
      // Filter out branch managers if we only want to manage staff, or keep all
      setEmployees(allEmps.filter((e: Employee) => e.role === 'employee'));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
      (e.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesActive = showInactive ? !e.is_active : e.is_active;
    return matchesSearch && matchesActive;
  });

  const activeCount = employees.filter((e) => e.is_active).length;
  const inactiveCount = employees.filter((e) => !e.is_active).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Sleek Minimal Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Store Employees</h1>
          <p className="text-sm text-slate-900 mt-1">Manage staff accounts and operational access for this branch.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-sm text-slate-900 bg-[#ffffff] border border-slate-200 px-4 py-2 rounded-xl">
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#1dbf73]"></div>{activeCount} Active</span>
            <div className="w-px h-4 bg-slate-100"></div>
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500"></div>{inactiveCount} Suspended</span>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
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

      {/* Action Bar */}
      <div className="flex flex-wrap gap-3 items-center justify-between bg-[#ffffff] p-3 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search staff by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-transparent border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-slate-500 transition-colors"
          />
        </div>

        <button
          onClick={() => setShowInactive(!showInactive)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            showInactive
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              : 'text-slate-900 hover:text-slate-700 border border-transparent hover:bg-slate-100/50'
          }`}
        >
          {showInactive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {showInactive ? `Viewing Suspended Staff` : 'Show Suspended Staff'}
        </button>
      </div>

      {/* Roster Table */}
      <div className="bg-[#ffffff] border border-slate-200 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-transparent text-slate-500 text-xs font-semibold uppercase border-b border-slate-200">
                  <th className="py-4 px-6">Staff Member</th>
                  <th className="py-4 px-6">ID / Contact</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Access Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-slate-500 text-sm">
                      <ShieldAlert className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                      {showInactive ? 'No suspended employees found.' : 'No active employees found matching criteria.'}
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-100/20 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className="relative w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-900 font-medium text-sm shrink-0 border border-slate-200 overflow-hidden">
                            {emp.photo_url ? (
                              <img src={emp.photo_url} alt={emp.full_name} className="w-full h-full object-cover" />
                            ) : (
                              emp.full_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{emp.full_name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="inline-flex items-center gap-1 bg-[#1dbf73]/10 text-[#1dbf73] px-2 py-0.5 rounded text-[11px] font-bold">
                                <Building2 className="w-3 h-3" />
                                {emp.branch_name || 'My Branch'}
                              </span>
                              <span className="text-xs text-slate-400">• {emp.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-xs font-mono text-slate-900 font-semibold mb-1">
                          ID: {emp.employee_id || 'PENDING-ID'}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#1dbf73] bg-[#1dbf73]/10 px-2 py-0.5 rounded w-fit">
                          <MessageSquare className="w-3.5 h-3.5 fill-current shrink-0" />
                          <span>WA: {emp.whatsapp_number || emp.phone || 'N/A'}</span>
                        </div>
                        {emp.phone && emp.phone !== (emp.whatsapp_number || emp.phone) && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                            <Phone className="w-3 h-3 text-slate-400" /> Phone: {emp.phone}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {emp.registration_step === 'pending_approval' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-amber-500/20 text-[11px] font-semibold text-amber-500 bg-amber-500/5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            KYC PENDING
                          </span>
                        ) : (
                          <Badge status={emp.is_active ? 'active' : 'inactive'} />
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold gap-1"
                            onClick={() => openDutyReport(emp)}
                            title="View & Export Month-wise Duty & Overtime Report"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Duty Report
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${emp.is_active ? 'text-slate-900 hover:text-rose-400 hover:bg-rose-500/10' : 'text-slate-900 hover:text-[#1dbf73] hover:bg-[#1dbf73]/10'}`}
                            onClick={() => toggleActive(emp)}
                            disabled={togglingId === emp.id || emp.registration_step === 'pending_approval'}
                            isLoading={togglingId === emp.id}
                          >
                            {emp.is_active ? 'Suspend Access' : 'Restore Access'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

