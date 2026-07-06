'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  Plus,
  Users,
  Search,
  Pencil,
  UserCheck,
  Phone,
  Mail,
  Building2,
  ChevronDown,
  User,
  Shield,
  Lock,
  Unlock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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

  const loadData = async () => {
    setLoading(true);
    const res = await fetch('/api/employees');
    const json = await res.json();
    if (json.success) setEmployees(json.data || []);

    const { data: br } = await supabase.from('branches').select('id, name, code').eq('is_active', true).order('name');
    if (br) setBranches(br);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // No longer using modal logic, just navigation
  const openAddModal = () => {
    router.push('/admin/employees/new');
  };

  const openEditModal = (emp: Employee) => {
    router.push(`/admin/employees/${emp.id}/edit`);
  };

  const toggleActive = async (emp: Employee) => {
    await fetch(`/api/employees/${emp.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !emp.is_active }),
    });
    await loadData();
  };

  const filteredEmployees = employees.filter((e) => {
    const matchesSearch =
      e.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || e.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-blue-950/30 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl">
        <div>
          <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Users className="w-4 h-4" />
            <span>HR — Staff Registry</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Employee Management</h1>
          <p className="text-sm text-slate-400 mt-1">Manage all Anchor Fashion staff accounts, roles, and branch assignments.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl font-semibold">
            {employees.filter((e) => e.is_active).length} Active Staff
          </span>
          <Button variant="primary" size="md" icon={<Plus className="w-5 h-5" />} onClick={openAddModal}>
            Onboard Employee
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-800 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search staff name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
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
      </Card>

      {/* Employee Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" label="Loading Staff Registry..." />
        </div>
      ) : (
        <Card className="p-0 overflow-hidden border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/80 text-slate-400 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-800">
                  <th className="py-4 px-5">Employee</th>
                  <th className="py-4 px-5">Role</th>
                  <th className="py-4 px-5">Branch</th>
                  <th className="py-4 px-5">Employee ID</th>
                  <th className="py-4 px-5 text-center">Status</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-500 text-sm">
                      No employees found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-800 to-purple-800 flex items-center justify-center text-white font-bold text-sm shrink-0">
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
                        <Badge status={emp.is_active ? 'active' : 'inactive'} />
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Button size="sm" variant="ghost" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openEditModal(emp)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={emp.is_active ? <Lock className="w-3.5 h-3.5 text-rose-400" /> : <Unlock className="w-3.5 h-3.5 text-emerald-400" />}
                            onClick={() => toggleActive(emp)}
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
