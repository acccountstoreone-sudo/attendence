'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  History,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Camera,
  AlertCircle,
  Edit3,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface AttendanceRecord {
  id: string;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  status: string;
  check_in_method?: string;
  branch_name?: string;
  worked_minutes?: number;
}

export default function EmployeeHistoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  // BUG FIX #4: Added error state so failures are surfaced to the user.
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [searchDate, setSearchDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PER_PAGE = 10;

  // Correction Modal State
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [correctionType, setCorrectionType] = useState<'check_in' | 'check_out'>('check_in');
  const [requestedTime, setRequestedTime] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [correctionSuccess, setCorrectionSuccess] = useState('');

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('You must be logged in to view attendance history.');
          return;
        }

        // BUG FIX #6: searchDate is now passed to the API so filtering is
        // server-side and covers all records — not just the current page.
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PER_PAGE),
        });
        if (searchDate) params.set('date', searchDate);

        const res = await fetch(`/api/attendance/history?${params.toString()}`);

        // BUG FIX #5: Check res.ok before calling res.json() to avoid crashing
        // on non-JSON error responses (e.g. 401/500 HTML error pages).
        if (!res.ok) {
          const text = await res.text();
          let message = `Request failed (${res.status})`;
          try {
            const errJson = JSON.parse(text);
            if (errJson?.error) message = errJson.error;
          } catch {
            // non-JSON body — use status text
          }
          setError(message);
          return;
        }

        const json = await res.json();
        if (json.success) {
          setRecords(json.data || []);
          setTotalPages(json.meta?.total_pages ?? 1);
        } else {
          setError(json.error || 'Failed to load attendance history.');
        }
      } catch (err) {
        console.error('History load error:', err);
        // BUG FIX #4: Surface network errors to the user.
        setError('A network error occurred. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [page, searchDate, supabase]);

  // BUG FIX #7: Reset page to 1 when the date filter changes so the user
  // doesn't get stuck on an out-of-range page for the filtered result set.
  function handleDateChange(value: string) {
    setSearchDate(value);
    setPage(1);
  }

  function handleClearFilter() {
    setSearchDate('');
    setPage(1);
  }

  const openCorrectionModal = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setCorrectionType('check_in');
    setRequestedTime('');
    setCorrectionReason('');
    setCorrectionSuccess('');
    setError(null);
    setIsCorrectionModalOpen(true);
  };

  const submitCorrectionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !requestedTime || correctionReason.length < 5) {
      setError('Please provide a valid time and reason (min 5 characters).');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setCorrectionSuccess('');

    try {
      // Assemble datetime correctly with Dhaka offset (+06:00) — BUG-NEW-09 fix
      const dateStr = selectedRecord.date || selectedRecord.check_in_time?.slice(0, 10) || new Date().toISOString().slice(0, 10);
      const requestedDateTime = `${dateStr}T${requestedTime}:00+06:00`;
      const originalTime = correctionType === 'check_in' ? selectedRecord.check_in_time : selectedRecord.check_out_time;

      // MISS-N2 fix: use correct API endpoint /api/corrections/apply
      const res = await fetch('/api/corrections/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: selectedRecord.id,
          date: dateStr,
          type: correctionType,
          original_time: originalTime,
          requested_time: requestedDateTime,
          reason: correctionReason,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.error || 'Failed to submit request');
      }
      setCorrectionSuccess('Correction request submitted successfully and is pending manager approval.');
      setTimeout(() => {
        setIsCorrectionModalOpen(false);
      }, 2500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-white via-blue-950/30 to-slate-50 p-6 rounded-3xl border border-slate-200 shadow-2xl">
        <div>
          <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">
            <History className="w-4 h-4" />
            <span>Personal Attendance Ledger</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">My Attendance History</h1>
          <p className="text-sm text-slate-600 mt-1">Full record of your check-in/out timestamps and daily status.</p>
        </div>
      </div>

      {/* Date Filter */}
      <Card className="bg-white border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-600 absolute left-3 top-2.5" />
            <input
              type="date"
              value={searchDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          {searchDate && (
            <Button size="sm" variant="ghost" onClick={handleClearFilter}>
              Clear Filter
            </Button>
          )}
        </div>
      </Card>

      {/* BUG FIX #4: Error banner shown to user when API fails */}
      {error && (
        <div className="flex items-center gap-3 bg-red-950/40 border border-red-800/60 text-red-300 rounded-2xl p-4 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Records Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" label="Fetching Attendance History..." />
        </div>
      ) : !error && (
        <Card className="p-0 overflow-hidden border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/80 text-slate-600 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-4 px-5">Date</th>
                  <th className="py-4 px-5 text-center">Status</th>
                  <th className="py-4 px-5">Check-In</th>
                  <th className="py-4 px-5">Check-Out</th>
                  <th className="py-4 px-5">Hours Worked</th>
                  <th className="py-4 px-5">Method</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-500 text-sm">
                      {/* BUG FIX #8: Context-aware empty-state message */}
                      {searchDate
                        ? 'No attendance records found for the selected date.'
                        : 'No attendance records found.'}
                    </td>
                  </tr>
                ) : (
                  records.map((rec) => {
                    // BUG FIX #9: worked_minutes is not a DB column returned by
                    // the API query. Use the check_in/out time fallback directly.
                    const hoursWorked = rec.check_in_time && rec.check_out_time
                      ? (() => {
                          const mins = Math.round(
                            (new Date(rec.check_out_time).getTime() - new Date(rec.check_in_time).getTime()) / 60000
                          );
                          return `${Math.floor(mins / 60)}h ${mins % 60}m`;
                        })()
                      : '—';

                    // BUG FIX #10: Use the `date` DB field (plain YYYY-MM-DD) for
                    // display so absent/no-checkin records show a proper date
                    // instead of 'Unknown Date'. Append T00:00:00 to avoid UTC-shift.
                    const displayDate = rec.date
                      ? new Date(rec.date + 'T00:00:00').toLocaleDateString('en-BD', {
                          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                        })
                      : rec.check_in_time
                        ? new Date(rec.check_in_time).toLocaleDateString('en-BD', {
                            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                          })
                        : 'Unknown Date';

                    return (
                      <tr key={rec.id} className="hover:bg-white/40 transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                            <div>
                              <p className="font-bold text-slate-900 text-sm">
                                {displayDate}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-center">
                          <Badge
                            status={rec.status === 'late' ? 'late' : rec.status === 'present' ? 'present' : rec.status === 'half_day' ? 'half_day' : 'absent'}
                            variant="subtle"
                          />
                        </td>
                        <td className="py-4 px-5">
                          {rec.check_in_time ? (
                            <div className="flex items-center space-x-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#1dbf73] shrink-0" />
                              <span className="font-semibold text-[#1dbf73]">
                                {new Date(rec.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ) : <span className="text-slate-500 text-xs italic">—</span>}
                        </td>
                        <td className="py-4 px-5">
                          {rec.check_out_time ? (
                            <div className="flex items-center space-x-1.5">
                              <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <span className="font-semibold text-blue-400">
                                {new Date(rec.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ) : <span className="text-slate-500 text-xs italic">Still On Shift</span>}
                        </td>
                        <td className="py-4 px-5 text-slate-600 font-semibold text-sm">{hoursWorked}</td>
                        <td className="py-4 px-5">
                          <div className="flex items-center space-x-1.5 text-xs text-slate-600">
                            {rec.check_in_method === 'biometric' ? (
                              <Camera className="w-3.5 h-3.5 text-purple-400" />
                            ) : (
                              <MapPin className="w-3.5 h-3.5 text-blue-400" />
                            )}
                            <span className="capitalize">{rec.check_in_method || 'manual'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* MISS-N2 fix: show a 'Missing Day' button for absent records */}
                            {!rec.check_in_time && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedRecord(rec);
                                  setCorrectionType('check_in');
                                  setRequestedTime('');
                                  setCorrectionReason('Missing attendance for this day — requesting check-in correction.');
                                  setCorrectionSuccess('');
                                  setError(null);
                                  setIsCorrectionModalOpen(true);
                                }}
                                title="Request Missing Day Correction"
                                className="text-amber-500 hover:text-amber-700 text-[10px] px-2"
                              >
                                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                                Missing Day
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openCorrectionModal(rec)}
                              title="Request Correction"
                              className="text-slate-600 hover:text-blue-400"
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-200/80 flex items-center justify-between">
            <span className="text-xs text-slate-600">Showing page <strong className="text-slate-900">{page}</strong> of <strong className="text-slate-900">{totalPages}</strong></span>
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                icon={<ChevronLeft className="w-4 h-4" />}
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                icon={<ChevronRight className="w-4 h-4" />}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Correction Modal */}
      {isCorrectionModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-200/60 bg-white/50">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Request Correction</h3>
                <p className="text-sm text-slate-600">For {selectedRecord.date || 'this record'}</p>
              </div>
              <button
                onClick={() => setIsCorrectionModalOpen(false)}
                className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50/50 hover:bg-slate-100 rounded-full transition-colors"
                disabled={isSubmitting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={submitCorrectionRequest} className="p-6 space-y-5">
              {error && (
                <div className="p-3 bg-red-950/40 text-red-400 text-sm rounded-xl border border-red-900/50 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              {correctionSuccess && (
                <div className="p-3 bg-emerald-950/40 text-[#1dbf73] text-sm rounded-xl border border-emerald-900/50">
                  {correctionSuccess}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Correction Type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-900 cursor-pointer">
                      <input 
                        type="radio" 
                        name="correctionType" 
                        value="check_in"
                        checked={correctionType === 'check_in'}
                        onChange={() => setCorrectionType('check_in')}
                        className="text-blue-500 focus:ring-blue-500 bg-slate-50 border-slate-600"
                        disabled={isSubmitting}
                      />
                      Check-In Time
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-900 cursor-pointer">
                      <input 
                        type="radio" 
                        name="correctionType" 
                        value="check_out"
                        checked={correctionType === 'check_out'}
                        onChange={() => setCorrectionType('check_out')}
                        className="text-blue-500 focus:ring-blue-500 bg-slate-50 border-slate-600"
                        disabled={isSubmitting}
                      />
                      Check-Out Time
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Requested Time</label>
                  <input
                    type="time"
                    value={requestedTime}
                    onChange={(e) => setRequestedTime(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Reason</label>
                  <textarea
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="Provide a valid reason for this correction..."
                    required
                    minLength={5}
                    rows={3}
                    disabled={isSubmitting}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200/80">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setIsCorrectionModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="primary"
                  disabled={isSubmitting || !!correctionSuccess}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

