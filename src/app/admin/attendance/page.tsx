'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Search, MapPin, Clock, Filter, Download, RefreshCw, Calendar } from 'lucide-react';
import Abstract3DBackground from '@/components/Abstract3DBackground';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

interface AttendanceRecord {
  id: string;
  user_id: string;
  full_name: string;
  branch_name: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
}

const getLocalDateString = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

export default function AdminAttendancePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  // Bug 7 fix: Add date filter with today as default
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());

  // Bug 7 fix: Fetch historical records by selected date directly from Supabase
  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

      const { data, error } = await supabase
        .from('attendance_records')
        .select('id, employee_id, check_in_time, check_out_time, status, profiles!attendance_records_employee_id_fkey(full_name), branches!attendance_records_branch_id_fkey(name)')
        .gte('check_in_time', startOfDay.toISOString())
        .lte('check_in_time', endOfDay.toISOString())
        .order('check_in_time', { ascending: false })
        .limit(200);

      if (error) throw error;

      const formatted: AttendanceRecord[] = (data || []).map((item: Record<string, unknown>) => {
        return {
          id: String(item.id),
          user_id: String(item.employee_id),
          full_name: (item.profiles as { full_name?: string })?.full_name || 'Unknown Employee',
          branch_name: (item.branches as { name?: string })?.name || 'Headquarters',
          status: String(item.status || 'present'),
          check_in_time: item.check_in_time as string | null,
          check_out_time: item.check_out_time as string | null,
        };
      });
      setRecords(formatted);
    } catch (e) {
      console.error('Failed fetching attendance', e);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, supabase]);

  // eslint-disable-next-line
  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      (r.full_name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.branch_name ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Bug 8 fix: Export attendance as CSV
  const handleExport = () => {
    const headers = ['Employee', 'Branch', 'Check-In', 'Check-Out', 'Status'];
    const rows = filteredRecords.map((r) => [
      r.full_name,
      r.branch_name,
      r.check_in_time ? new Date(r.check_in_time).toLocaleString() : '',
      r.check_out_time ? new Date(r.check_out_time).toLocaleString() : 'Not checked out',
      r.status,
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isToday = selectedDate === getLocalDateString();

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 backdrop-blur-sm shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#1dbf73_1px,transparent_1px)] [background-size:40px_40px] mix-blend-overlay z-0" />
        <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
          <Abstract3DBackground />
        </div>

        <div className="relative z-10 pointer-events-none">
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-[#1dbf73]/10 border border-[#1dbf73]/30 text-[#1dbf73] text-xs font-bold uppercase tracking-widest">
              Master Log
            </span>
            {isToday && (
              <span className="text-xs text-slate-400 flex items-center">
                <Clock className="w-3 h-3 text-[#1dbf73] mr-1" />
                Today — Live
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
            Enterprise Attendance Grid
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''} for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
          </p>
        </div>

        <div className="relative z-10 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-slate-200 bg-white/50 text-slate-300 hover:bg-slate-100 hover:text-slate-900"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={fetchAttendance}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-slate-200 bg-white/50 text-slate-300 hover:bg-slate-100 hover:text-slate-900"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExport}
            disabled={filteredRecords.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </motion.div>

      {/* Filters and Table Area */}
      <Card className="bg-white border-slate-200 p-0 overflow-hidden relative z-10 shadow-2xl">

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 bg-white flex flex-col md:flex-row gap-3 justify-between items-center">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by employee name or branch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-[#1dbf73] transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            {/* Bug 7 fix: Date picker */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
              <Calendar className="w-4 h-4 text-[#1dbf73] shrink-0" />
              <input
                type="date"
                value={selectedDate}
                max={getLocalDateString()}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm text-slate-300 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-[#1dbf73]"
              >
                <option value="all">All Statuses</option>
                <option value="present">Present (On-Time)</option>
                <option value="late">Late Arrival</option>
                <option value="absent">Absent</option>
                <option value="half_day">Half Day</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 flex justify-center">
              <Spinner size="lg" label="Loading attendance records..." />
            </div>
          ) : (
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-white border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                  <th className="py-4 px-6">Identity</th>
                  <th className="py-4 px-6">Location</th>
                  <th className="py-4 px-6">Check-In</th>
                  <th className="py-4 px-6">Check-Out</th>
                  <th className="py-4 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50 text-sm">
                <AnimatePresence>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 text-center text-slate-500 text-sm">
                          <Clock className="w-8 h-8 mx-auto mb-3 text-slate-600 opacity-50" />
                          No attendance records found for {new Date(selectedDate).toLocaleDateString()}.
                        </motion.div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((rec) => (
                      <motion.tr
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        key={rec.id}
                        className="hover:bg-slate-100/30 transition-colors group"
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[#1dbf73] font-bold text-xs shrink-0">
                              {rec.full_name?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 group-hover:text-[#1dbf73] transition-colors">{rec.full_name}</p>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {rec.user_id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center text-slate-300 text-sm">
                            <MapPin className="w-4 h-4 text-[#1dbf73]/60 mr-2 shrink-0" />
                            {rec.branch_name}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-300 font-mono text-xs">
                          {rec.check_in_time
                            ? new Date(rec.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : <span className="text-slate-500">—</span>}
                        </td>
                        <td className="py-4 px-6 text-slate-300 font-mono text-xs">
                          {rec.check_out_time
                            ? new Date(rec.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : <span className="text-slate-500 italic">Not checked out</span>}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <Badge
                            status={rec.status === 'late' ? 'late' : rec.status === 'absent' ? 'absent' : 'present'}
                            variant="subtle"
                          />
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

