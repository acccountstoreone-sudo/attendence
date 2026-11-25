'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import {
  X,
  AlertCircle,
  CalendarPlus,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';

export interface ManualEntryEmployee {
  id: string;
  full_name: string;
  employee_id?: string;
  branch_id?: string;
  branch_name?: string;
  role?: string;
}

export interface ManualAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  defaultEmployee?: ManualEntryEmployee | null;
  defaultDates?: string[];
  defaultWorkStart?: string;
  defaultWorkEnd?: string;
  branchId?: string;
}

const REASON_PRESETS = [
  'App issue — employee was present on duty',
  'Biometric / GPS error during check-in',
  'Verified via store manager & CCTV',
  'Forgot to punch in/out on time',
];

function getTodayDhaka(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function toHHMM(timeStr?: string, fallback = '09:00'): string {
  if (!timeStr) return fallback;
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return fallback;
}

function enumerateDateRange(startStr: string, endStr: string): string[] {
  if (!startStr || !endStr || startStr > endStr) return [];
  const dates: string[] = [];
  const start = new Date(`${startStr}T12:00:00Z`);
  const end = new Date(`${endStr}T12:00:00Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

  const cursor = new Date(start);
  let guard = 0;
  while (cursor <= end && guard < 31) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard++;
  }
  return dates;
}

function formatDateChip(dateStr: string): { short: string; weekday: string; isFriday: boolean } {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const short = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return { short, weekday, isFriday: d.getUTCDay() === 5 };
}

export const ManualAttendanceModal: React.FC<ManualAttendanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultEmployee = null,
  defaultDates,
  defaultWorkStart = '09:00',
  defaultWorkEnd = '18:00',
  branchId,
}) => {
  const todayStr = useMemo(() => getTodayDhaka(), []);

  // Employee selection state
  const [employees, setEmployees] = useState<ManualEntryEmployee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  // Date selection state
  const [dateMode, setDateMode] = useState<'range' | 'custom'>('range');
  const [rangeStart, setRangeStart] = useState<string>(todayStr);
  const [rangeEnd, setRangeEnd] = useState<string>(todayStr);
  const [excludedDates, setExcludedDates] = useState<Set<string>>(new Set());
  const [customDates, setCustomDates] = useState<string[]>([]);
  const [dateToAdd, setDateToAdd] = useState<string>(todayStr);

  // Attendance details state
  const [checkInTime, setCheckInTime] = useState<string>(toHHMM(defaultWorkStart, '09:00'));
  const [checkOutTime, setCheckOutTime] = useState<string>(toHHMM(defaultWorkEnd, '18:00'));
  const [includeCheckOut, setIncludeCheckOut] = useState<boolean>(true);
  const [status, setStatus] = useState<'present' | 'late' | 'half_day' | 'absent'>('present');
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(true);
  const [reason, setReason] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // Initialize state whenever modal opens
  useEffect(() => {
    if (!isOpen) return;

    setError('');
    setReason('');
    setStatus('present');
    setOverwriteExisting(true);
    setCheckInTime(toHHMM(defaultWorkStart, '09:00'));
    setCheckOutTime(toHHMM(defaultWorkEnd, '18:00'));
    setIncludeCheckOut(true);
    setExcludedDates(new Set());
    setEmployeeSearch('');

    if (defaultEmployee?.id) {
      setSelectedEmployeeId(defaultEmployee.id);
    } else {
      setSelectedEmployeeId('');
    }

    if (defaultDates && defaultDates.length > 0) {
      const sorted = Array.from(new Set(defaultDates)).sort();
      setDateMode('custom');
      setCustomDates(sorted);
      setRangeStart(sorted[0]);
      setRangeEnd(sorted[sorted.length - 1]);
      setDateToAdd(sorted[sorted.length - 1]);
    } else {
      setDateMode('range');
      setRangeStart(todayStr);
      setRangeEnd(todayStr);
      setCustomDates([todayStr]);
      setDateToAdd(todayStr);
    }
  }, [isOpen, defaultEmployee, defaultDates, defaultWorkStart, defaultWorkEnd, todayStr]);

  // Load employees when picker is needed
  useEffect(() => {
    if (!isOpen || defaultEmployee?.id) return;
    let active = true;

    async function loadEmployees() {
      setLoadingEmployees(true);
      try {
        const params = new URLSearchParams({ limit: '500' });
        if (branchId && branchId !== 'all') params.set('branch_id', branchId);
        const res = await fetch(`/api/employees?${params.toString()}`);
        const json = await res.json();
        if (active && res.ok && json.success) {
          setEmployees(json.data || []);
        }
      } catch (err) {
        console.error('Failed to load employees for manual attendance:', err);
      } finally {
        if (active) setLoadingEmployees(false);
      }
    }

    loadEmployees();
    return () => {
      active = false;
    };
  }, [isOpen, defaultEmployee, branchId]);

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return employees;
    const q = employeeSearch.toLowerCase();
    return employees.filter(
      (e) =>
        (e.full_name || '').toLowerCase().includes(q) ||
        (e.employee_id || '').toLowerCase().includes(q) ||
        (e.branch_name || '').toLowerCase().includes(q)
    );
  }, [employees, employeeSearch]);

  const selectedEmployeeObj = useMemo(() => {
    if (defaultEmployee?.id) return defaultEmployee;
    return employees.find((e) => e.id === selectedEmployeeId) || null;
  }, [defaultEmployee, employees, selectedEmployeeId]);

  const rangeDates = useMemo(() => enumerateDateRange(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

  const activeDates = useMemo(() => {
    if (dateMode === 'range') {
      return rangeDates.filter((d) => !excludedDates.has(d));
    }
    return Array.from(new Set(customDates)).sort();
  }, [dateMode, rangeDates, excludedDates, customDates]);

  const toggleRangeDate = (dateStr: string) => {
    setExcludedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  const handleAddCustomDate = () => {
    if (!dateToAdd) return;
    if (customDates.includes(dateToAdd)) return;
    if (customDates.length >= 31) {
      setError('You can select up to 31 dates at a time.');
      return;
    }
    setCustomDates((prev) => [...prev, dateToAdd].sort());
    setError('');
  };

  const handleRemoveCustomDate = (dateStr: string) => {
    setCustomDates((prev) => prev.filter((d) => d !== dateStr));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const targetEmployeeId = defaultEmployee?.id || selectedEmployeeId;
    if (!targetEmployeeId) {
      setError('Please select an employee.');
      return;
    }
    if (activeDates.length === 0) {
      setError('Please select at least one date.');
      return;
    }
    if (activeDates.length > 31) {
      setError('Maximum 31 days can be updated in a single request.');
      return;
    }
    if (!checkInTime) {
      setError('Check-in time is required.');
      return;
    }
    if (includeCheckOut && checkOutTime && checkOutTime <= checkInTime) {
      setError('Check-out time must be after check-in time.');
      return;
    }
    if (reason.trim().length < 3) {
      setError('Please provide a reason (at least 3 characters) for the audit log.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/attendance/manual-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'upsert_days',
          employee_id: targetEmployeeId,
          branch_id: selectedEmployeeObj?.branch_id || (branchId && branchId !== 'all' ? branchId : undefined),
          dates: activeDates,
          check_in_time: checkInTime,
          check_out_time: includeCheckOut && checkOutTime ? checkOutTime : null,
          status,
          overwrite_existing: overwriteExisting,
          reason: reason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.error || 'Failed to save manual attendance.');
      }

      onSuccess(json.message);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-[#1dbf73]/10 via-emerald-50/40 to-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1dbf73] text-white flex items-center justify-center shadow-sm">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Manual Attendance Entry</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Add or update missing attendance days (single day or multiple days at once)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-full transition-colors border border-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 text-rose-700 text-sm rounded-xl border border-rose-200 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Employee Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
              <Users className="w-3.5 h-3.5 text-[#1dbf73]" />
              Employee
            </label>
            {defaultEmployee ? (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <p className="font-bold text-slate-900 text-sm">{defaultEmployee.full_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {defaultEmployee.branch_name || 'Assigned Branch'}
                    {defaultEmployee.employee_id ? ` • ID: ${defaultEmployee.employee_id}` : ''}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#1dbf73]/15 text-[#16965a] text-xs font-bold">
                  Selected
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search employee by name, ID, or branch..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    disabled={isSubmitting || loadingEmployees}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dbf73] focus:bg-white transition-colors"
                  />
                </div>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  required
                  disabled={isSubmitting || loadingEmployees}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73]"
                >
                  <option value="">
                    {loadingEmployees
                      ? 'Loading employees...'
                      : `— Choose employee (${filteredEmployees.length} available) —`}
                  </option>
                  {filteredEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                      {emp.employee_id ? ` (#${emp.employee_id})` : ''}
                      {emp.branch_name ? ` — ${emp.branch_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 2. Date Selection (Date Range OR Individual Dates) */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5 text-[#1dbf73]" />
                Select Date(s)
              </label>
              <div className="inline-flex bg-white border border-slate-200 rounded-xl p-0.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setDateMode('range')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    dateMode === 'range'
                      ? 'bg-[#1dbf73] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Date Range (Multi-Day)
                </button>
                <button
                  type="button"
                  onClick={() => setDateMode('custom')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    dateMode === 'custom'
                      ? 'bg-[#1dbf73] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Specific Dates ({customDates.length})
                </button>
              </div>
            </div>

            {dateMode === 'range' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">From Date</label>
                    <input
                      type="date"
                      value={rangeStart}
                      max={todayStr}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRangeStart(val);
                        if (val > rangeEnd) setRangeEnd(val);
                      }}
                      disabled={isSubmitting}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">To Date</label>
                    <input
                      type="date"
                      value={rangeEnd}
                      min={rangeStart}
                      max={todayStr}
                      onChange={(e) => setRangeEnd(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73]"
                    />
                  </div>
                </div>

                {rangeDates.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-slate-500 font-medium">
                      Click any date below to include/exclude it (e.g., uncheck weekly off-days):
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-0.5">
                      {rangeDates.map((d) => {
                        const isIncluded = !excludedDates.has(d);
                        const chip = formatDateChip(d);
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => toggleRangeDate(d)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${
                              isIncluded
                                ? chip.isFriday
                                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                                  : 'bg-[#1dbf73]/15 border-[#1dbf73]/40 text-[#16965a]'
                                : 'bg-white border-slate-200 text-slate-400 line-through'
                            }`}
                          >
                            <span>{chip.weekday}</span>
                            <span>{chip.short}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateToAdd}
                    max={todayStr}
                    onChange={(e) => setDateToAdd(e.target.value)}
                    disabled={isSubmitting}
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73]"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddCustomDate}
                    disabled={isSubmitting || !dateToAdd}
                    className="border-[#1dbf73]/40 text-[#16965a] hover:bg-[#1dbf73]/10"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Date
                  </Button>
                </div>

                {customDates.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No dates selected yet. Pick a date and click Add Date.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {customDates.map((d) => {
                      const chip = formatDateChip(d);
                      return (
                        <span
                          key={d}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1dbf73]/15 border border-[#1dbf73]/40 text-[#16965a] text-xs font-bold"
                        >
                          {chip.weekday}, {d}
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomDate(d)}
                            className="hover:text-rose-600 ml-0.5"
                            title="Remove date"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="font-bold text-[#16965a]">
                {activeDates.length} day{activeDates.length !== 1 ? 's' : ''} selected
              </span>
              <label className="flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                  disabled={isSubmitting}
                  className="rounded border-slate-300 text-[#1dbf73] focus:ring-[#1dbf73]"
                />
                Overwrite if record already exists
              </label>
            </div>
          </div>

          {/* 3. Time & Status */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-[#1dbf73]" />
                Shift Timing (Bangladesh Time)
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setCheckInTime(toHHMM(defaultWorkStart, '09:00'));
                    setCheckOutTime(toHHMM(defaultWorkEnd, '18:00'));
                    setIncludeCheckOut(true);
                    setStatus('present');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold transition-colors"
                >
                  Full Shift ({toHHMM(defaultWorkStart, '09:00')}–{toHHMM(defaultWorkEnd, '18:00')})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCheckInTime(toHHMM(defaultWorkStart, '09:00'));
                    setCheckOutTime('13:00');
                    setIncludeCheckOut(true);
                    setStatus('half_day');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[11px] font-bold transition-colors"
                >
                  Half Day
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Check-In Time *</label>
                <input
                  type="time"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-600">Check-Out Time</label>
                  <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeCheckOut}
                      onChange={(e) => setIncludeCheckOut(e.target.checked)}
                      disabled={isSubmitting}
                      className="rounded border-slate-300 text-[#1dbf73] focus:ring-[#1dbf73]"
                    />
                    Include
                  </label>
                </div>
                <input
                  type="time"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  disabled={isSubmitting || !includeCheckOut}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>

            {/* Attendance Status Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Attendance Status
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { value: 'present', label: 'Present', activeClass: 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500/30' },
                    { value: 'late', label: 'Late', activeClass: 'bg-amber-50 border-amber-500 text-amber-700 ring-1 ring-amber-500/30' },
                    { value: 'half_day', label: 'Half Day', activeClass: 'bg-sky-50 border-sky-500 text-sky-700 ring-1 ring-sky-500/30' },
                    { value: 'absent', label: 'Absent', activeClass: 'bg-rose-50 border-rose-500 text-rose-700 ring-1 ring-rose-500/30' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    disabled={isSubmitting}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                      status === opt.value
                        ? opt.activeClass
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Reason & Audit Note */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
              Reason / Audit Note *
            </label>
            <div className="flex flex-wrap gap-1.5">
              {REASON_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#1dbf73]/15 hover:text-[#16965a] text-slate-700 text-[11px] font-medium transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  {preset}
                </button>
              ))}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why attendance is being added/edited (required for audit log)..."
              required
              minLength={3}
              rows={2}
              disabled={isSubmitting}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all resize-none"
            />
          </div>

          {/* Summary Preview Banner */}
          {activeDates.length > 0 && selectedEmployeeObj && (
            <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#1dbf73] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Summary:</span> Will mark{' '}
                <strong className="font-extrabold">{activeDates.length} day(s)</strong> as{' '}
                <strong className="uppercase">{status.replace('_', ' ')}</strong> (
                {checkInTime}
                {includeCheckOut && checkOutTime ? ` – ${checkOutTime}` : ', no check-out'}) for{' '}
                <strong>{selectedEmployeeObj.full_name}</strong>. Records will be auto-approved and immediately counted in Duty Reports & Payroll.
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="bg-[#1dbf73] hover:bg-[#16965a] text-white font-bold px-5"
              disabled={isSubmitting || activeDates.length === 0}
              isLoading={isSubmitting}
            >
              Save Attendance ({activeDates.length} {activeDates.length === 1 ? 'Day' : 'Days'})
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

