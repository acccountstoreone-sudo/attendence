'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Search, MapPin, Clock, Calendar, Filter, FileText } from 'lucide-react';
import Abstract3DBackground from '@/components/Abstract3DBackground';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';

interface AttendanceRecord {
  id: string;
  user_id: string;
  full_name: string;
  branch_name: string;
  type: string;
  status: string;
  timestamp: string;
}

export default function AdminAttendancePage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      // Fetching from today's attendance API to populate list
      const resLive = await fetch('/api/reports/live-feed');
      if (resLive.ok) {
        const jsonLive = await resLive.json();
        if (jsonLive.success) {
          const liveData = Array.isArray(jsonLive.data) ? jsonLive.data : [];
          const formattedRecords: AttendanceRecord[] = liveData.map((item: any) => ({
            id: item.id,
            user_id: item.user_id,
            full_name: item.profiles?.full_name || 'Unknown Employee',
            branch_name: item.profiles?.branches?.name || 'Headquarters',
            type: item.check_out_time ? 'Check-Out' : 'Check-In',
            status: item.status || 'present',
            timestamp: item.check_out_time || item.check_in_time || new Date().toISOString(),
          }));
          setRecords(formattedRecords);
        }
      }
    } catch (e) {
      console.error('Failed fetching attendance', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const filteredRecords = records.filter(r => {
    const matchesSearch = r.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.branch_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#061224] p-6 rounded-3xl border border-[#1E293B] backdrop-blur-xl shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#D2A02A_1px,transparent_1px)] [background-size:40px_40px] mix-blend-overlay z-0" />
        <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
          <Abstract3DBackground />
        </div>

        <div className="relative z-10 pointer-events-none">
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-[#D2A02A]/20 border border-[#D2A02A]/30 text-[#D2A02A] text-xs font-bold uppercase tracking-widest">
              Master Log
            </span>
            <span className="text-xs text-slate-400 flex items-center">
              <Clock className="w-3 h-3 text-[#D2A02A] mr-1" />
              Real-time synchronization active
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-2 tracking-tight">
            Enterprise Attendance Grid
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Comprehensive ledger of all biometric checks, geo-fenced logs, and staff punctuality metrics.
          </p>
        </div>

        <div className="relative z-10 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-[#1E293B] bg-[#040A15]/50 backdrop-blur-md text-slate-300 hover:bg-[#1E293B] hover:text-white"
            icon={<FileText className="w-4 h-4" />}
          >
            Export Log
          </Button>
        </div>
      </motion.div>

      {/* Filters and Table Area */}
      <Card className="bg-[#061224] border-[#1E293B] p-0 overflow-hidden relative z-10 shadow-2xl">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-[#1E293B] bg-[#040A15]/80 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by employee name or branch location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#061224] border border-[#1E293B] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#D2A02A] transition-colors shadow-inner shadow-[#000000]/50"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#061224] border border-[#1E293B] text-slate-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-[#D2A02A]"
            >
              <option value="all">All Statuses</option>
              <option value="present">Present (On-Time)</option>
              <option value="late">Late Arrival</option>
              <option value="absent">Absent</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 flex justify-center">
              <Spinner size="lg" label="Synchronizing attendance matrix..." />
            </div>
          ) : (
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-[#040A15] border-b border-[#1E293B] text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                  <th className="py-4 px-6">Identity</th>
                  <th className="py-4 px-6">Location</th>
                  <th className="py-4 px-6">Event Type</th>
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/50 text-sm">
                <AnimatePresence>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 text-center text-slate-500 text-sm">
                          <Clock className="w-8 h-8 mx-auto mb-3 text-slate-600 opacity-50" />
                          No attendance records found matching the criteria.
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
                        className="hover:bg-[#1E293B]/30 transition-colors group"
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#040A15] border border-[#1E293B] flex items-center justify-center text-[#D2A02A] font-bold text-xs shrink-0 relative overflow-hidden">
                              <div className="absolute inset-0 bg-[#D2A02A]/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                              {rec.full_name?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <p className="font-bold text-white group-hover:text-[#D2A02A] transition-colors">{rec.full_name}</p>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {rec.user_id.split('-')[0]}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center text-slate-300 text-sm">
                            <MapPin className="w-4 h-4 text-[#D2A02A]/60 mr-2" />
                            {rec.branch_name}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`text-xs font-bold px-2 py-1 rounded-md border ${
                            rec.type === 'Check-In' 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                              : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                          }`}>
                            {rec.type}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-300 font-mono">
                          <div className="flex flex-col">
                            <span>{new Date(rec.timestamp).toLocaleDateString()}</span>
                            <span className="text-xs text-slate-500">
                              {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
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
