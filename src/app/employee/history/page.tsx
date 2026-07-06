'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  History,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Camera,
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
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [searchDate, setSearchDate] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const res = await fetch(`/api/attendance/history?page=${page}&limit=${PER_PAGE}`);
        const json = await res.json();
        if (json.success) {
          setRecords(json.data || []);
        }
      } catch (err) {
        console.error('History load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [page, supabase]);

  const filtered = searchDate
    ? records.filter((r) => r.date?.includes(searchDate))
    : records;

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
              onChange={(e) => setSearchDate(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          {searchDate && (
            <Button size="sm" variant="ghost" onClick={() => setSearchDate('')}>
              Clear Filter
            </Button>
          )}
        </div>
      </Card>

      {/* Records Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" label="Fetching Attendance History..." />
        </div>
      ) : (
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
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-500 text-sm">
                      No attendance records found for the selected date.
                    </td>
                  </tr>
                ) : (
                  filtered.map((rec) => {
                    const hoursWorked = rec.worked_minutes
                      ? `${Math.floor(rec.worked_minutes / 60)}h ${rec.worked_minutes % 60}m`
                      : rec.check_in_time && rec.check_out_time
                        ? (() => {
                            const mins = Math.round((new Date(rec.check_out_time).getTime() - new Date(rec.check_in_time).getTime()) / 60000);
                            return `${Math.floor(mins / 60)}h ${mins % 60}m`;
                          })()
                        : '—';

                    return (
                      <tr key={rec.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                            <div>
                              <p className="font-bold text-white text-sm">
                                {new Date(rec.date).toLocaleDateString('en-BD', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
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
            <span className="text-xs text-slate-400">Showing page <strong className="text-white">{page}</strong></span>
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
                disabled={records.length < PER_PAGE}
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
