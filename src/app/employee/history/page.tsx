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

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-blue-950/30 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl">
        <div>
          <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">
            <History className="w-4 h-4" />
            <span>Personal Attendance Ledger</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">My Attendance History</h1>
          <p className="text-sm text-slate-400 mt-1">Full record of your check-in/out timestamps and daily status.</p>
        </div>
      </div>

      {/* Date Filter */}
      <Card className="bg-slate-900 border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="date"
              value={searchDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
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
        <Card className="p-0 overflow-hidden border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/80 text-slate-400 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-800">
                  <th className="py-4 px-5">Date</th>
                  <th className="py-4 px-5 text-center">Status</th>
                  <th className="py-4 px-5">Check-In</th>
                  <th className="py-4 px-5">Check-Out</th>
                  <th className="py-4 px-5">Hours Worked</th>
                  <th className="py-4 px-5">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-500 text-sm">
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
                      <tr key={rec.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                            <div>
                              <p className="font-bold text-white text-sm">
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
                              <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="font-semibold text-emerald-400">
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
                        <td className="py-4 px-5 text-slate-300 font-semibold text-sm">{hoursWorked}</td>
                        <td className="py-4 px-5">
                          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                            {rec.check_in_method === 'biometric' ? (
                              <Camera className="w-3.5 h-3.5 text-purple-400" />
                            ) : (
                              <MapPin className="w-3.5 h-3.5 text-blue-400" />
                            )}
                            <span className="capitalize">{rec.check_in_method || 'manual'}</span>
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
          <div className="p-4 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-xs text-slate-400">Showing page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong></span>
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
    </div>
  );
}
