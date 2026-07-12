'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { motion } from 'framer-motion';
import { DollarSign, Save, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Employee {
  id: string;
  full_name: string;
  employee_id?: string;
}

interface SalarySetting {
  id?: string;
  user_id: string;
  base_salary: number;
  hourly_rate?: number;
  currency?: string;
}

/**
 * MISS-N1 fix: Branch Manager Salary Settings page
 * Allows BMs to view and set base salary for employees in their branch.
 */
export default function BranchManagerSalaryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaries, setSalaries] = useState<Record<string, SalarySetting>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string; userId?: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch employees in branch (BM is scoped by RLS)
      const empRes = await fetch('/api/employees');
      if (empRes.ok) {
        const json = await empRes.json();
        const emps: Employee[] = (json.data || []).filter((e: Employee & { role?: string }) => e.id);
        setEmployees(emps);

        // Fetch salary settings for all employees
        const salRes = await fetch('/api/salary-settings');
        if (salRes.ok) {
          const salJson = await salRes.json();
          const salMap: Record<string, SalarySetting> = {};
          (salJson.data || []).forEach((s: SalarySetting) => {
            salMap[s.user_id] = s;
          });
          setSalaries(salMap);
        }
      }
    } catch (err) {
      console.error('Failed to load salary data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async (emp: Employee) => {
    const current = salaries[emp.id];
    if (!current) return;
    setSaving(emp.id);
    setFeedback(null);

    try {
      const res = await fetch('/api/salary-settings', {
        method: current.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: emp.id,
          base_salary: current.base_salary,
          hourly_rate: current.hourly_rate,
          currency: current.currency || 'BDT',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedback({ type: 'success', text: `Salary saved for ${emp.full_name}.`, userId: emp.id });
        setSalaries(prev => ({ ...prev, [emp.id]: { ...current, ...json.data } }));
      } else {
        setFeedback({ type: 'error', text: json.error?.message || 'Save failed.', userId: emp.id });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Network error.', userId: emp.id });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Spinner size="lg" label="Loading salary settings..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <div className="w-2 h-8 bg-[#1dbf73] rounded-full" />
        <h1 className="text-2xl font-bold text-slate-900">Salary Settings</h1>
      </div>
      <p className="text-sm text-slate-500 -mt-3 ml-5">
        Set base salary and hourly rates for employees in your branch.
      </p>

      {employees.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No employees found in your branch.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {employees.map(emp => {
            const sal = salaries[emp.id] ?? { user_id: emp.id, base_salary: 0, hourly_rate: 0, currency: 'BDT' };
            const isSaving = saving === emp.id;
            const fb = feedback?.userId === emp.id ? feedback : null;
            return (
              <motion.div
                key={emp.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="p-5 bg-white border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-800">{emp.full_name}</p>
                      {emp.employee_id && (
                        <p className="text-xs text-slate-400">ID: {emp.employee_id}</p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-[#1dbf73]" />
                        <label className="text-xs text-slate-500 font-medium">Base Salary (BDT)</label>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={sal.base_salary || ''}
                          onChange={e => setSalaries(prev => ({
                            ...prev,
                            [emp.id]: { ...sal, base_salary: Number(e.target.value) },
                          }))}
                          className="w-32 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-[#1dbf73]"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 font-medium">Hourly Rate</label>
                        <input
                          type="number"
                          min={0}
                          step={10}
                          value={sal.hourly_rate || ''}
                          onChange={e => setSalaries(prev => ({
                            ...prev,
                            [emp.id]: { ...sal, hourly_rate: Number(e.target.value) },
                          }))}
                          className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-[#1dbf73]"
                          placeholder="0"
                        />
                      </div>
                      <Button
                        size="sm"
                        icon={<Save className="w-3.5 h-3.5" />}
                        onClick={() => handleSave(emp)}
                        disabled={isSaving}
                        className="bg-[#1dbf73] hover:bg-[#16965a] text-slate-900 border-none"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                  {fb && (
                    <div className={`mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                      fb.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}>
                      {fb.type === 'success'
                        ? <CheckCircle2 className="w-3.5 h-3.5" />
                        : <AlertTriangle className="w-3.5 h-3.5" />}
                      {fb.text}
                    </div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
