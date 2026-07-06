'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ShieldAlert, Search, Filter, Download, Activity, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import Abstract3DBackground from '@/components/Abstract3DBackground';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';

interface AuditLog {
  id: string;
  created_at: string;
  user_id: string;
  action: string;
  table_name?: string;
  record_id?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
  actor_name?: string;
}

type Severity = 'info' | 'warning' | 'critical';

const getSeverity = (action: string): Severity => {
  const lower = action.toLowerCase();
  if (lower.includes('manual') || lower.includes('override') || lower.includes('deactivat') || lower.includes('suspend')) return 'warning';
  if (lower.includes('biometric') || lower.includes('mismatch') || lower.includes('unauthorized') || lower.includes('failed') || lower.includes('delete')) return 'critical';
  return 'info';
};

const getSeverityIcon = (severity: Severity) => {
  switch (severity) {
    case 'critical': return <ShieldAlert className="w-5 h-5 text-rose-400" />;
    case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-400" />;
    default: return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
  }
};

const getSeverityColor = (severity: Severity) => {
  switch (severity) {
    case 'critical': return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
    case 'warning': return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    default: return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
  }
};

export default function AdminAuditPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');

  // Bug 11 fix: Load real audit_logs data from Supabase
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, profiles!audit_logs_user_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setLogs(
        (data || []).map((log: Record<string, unknown>) => ({
          id: String(log.id),
          created_at: String(log.created_at),
          user_id: String(log.user_id),
          action: String(log.action),
          table_name: log.table_name as string | undefined,
          record_id: log.record_id as string | undefined,
          old_values: log.old_values as Record<string, unknown> | undefined,
          new_values: log.new_values as Record<string, unknown> | undefined,
          ip_address: log.ip_address as string | undefined,
          actor_name: (log.profiles as { full_name?: string } | null)?.full_name || 'System',
        }))
      );
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filteredLogs = logs.filter((log) => {
    const severity = getSeverity(log.action);
    const matchesSearch =
      log.actor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.table_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ip_address?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = filterSeverity === 'all' || severity === filterSeverity;
    return matchesSearch && matchesSeverity;
  });

  // Bug 8 fix: Export audit log as CSV
  const handleExport = () => {
    const headers = ['Timestamp', 'Actor', 'Action', 'Table', 'IP Address', 'Severity'];
    const rows = filteredLogs.map((log) => [
      new Date(log.created_at).toISOString(),
      log.actor_name || 'System',
      log.action,
      log.table_name || '',
      log.ip_address || '',
      getSeverity(log.action),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#061224] p-6 rounded-3xl border border-[#1E293B] shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#D2A02A_1px,transparent_1px)] [background-size:40px_40px] mix-blend-overlay z-0" />
        <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
          <Abstract3DBackground />
        </div>

        <div className="relative z-10 pointer-events-none">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-[#D2A02A]" />
            <span className="px-3 py-1 rounded-full bg-[#D2A02A]/20 border border-[#D2A02A]/30 text-[#D2A02A] text-xs font-bold uppercase tracking-widest">
              Security Compliance
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-3 tracking-tight">
            System Audit & Security Logs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Live ledger of all administrative actions, system overrides, and security events.
          </p>
        </div>

        <div className="relative z-10 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-[#1E293B] bg-[#040A15]/50 backdrop-blur-md text-slate-300 hover:bg-[#1E293B] hover:text-white"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={fetchLogs}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-[#1E293B] bg-[#040A15]/50 backdrop-blur-md text-slate-300 hover:bg-[#1E293B] hover:text-white"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExport}
          >
            Export CSV
          </Button>
        </div>
      </motion.div>

      {/* Main Content */}
      <Card className="bg-[#061224] border-[#1E293B] p-0 overflow-hidden relative z-10 shadow-2xl">

        {/* Toolbar */}
        <div className="p-4 border-b border-[#1E293B] bg-[#040A15]/80 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search actions, users, tables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#061224] border border-[#1E293B] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#D2A02A] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-[#061224] border border-[#1E293B] text-slate-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-[#D2A02A]"
            >
              <option value="all">All Events</option>
              <option value="critical">Critical (Security)</option>
              <option value="warning">Warnings (Overrides)</option>
              <option value="info">Info (System)</option>
            </select>
          </div>
        </div>

        {/* Audit List */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 flex justify-center">
              <Spinner size="lg" label="Loading audit logs..." />
            </div>
          ) : (
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-[#040A15] border-b border-[#1E293B] text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                  <th className="py-4 px-6 w-12">Event</th>
                  <th className="py-4 px-6">Timestamp & IP</th>
                  <th className="py-4 px-6">Actor</th>
                  <th className="py-4 px-6">Action Details</th>
                  <th className="py-4 px-6 text-right">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/50 text-sm">
                <AnimatePresence>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 text-center text-slate-500 text-sm">
                          <Activity className="w-8 h-8 mx-auto mb-3 text-slate-600 opacity-50" />
                          {logs.length === 0 ? 'No audit events recorded yet.' : 'No events match your filter criteria.'}
                        </motion.div>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const severity = getSeverity(log.action);
                      return (
                        <motion.tr
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          key={log.id}
                          className="hover:bg-[#1E293B]/30 transition-colors group"
                        >
                          <td className="py-4 px-6">
                            <div className="w-10 h-10 rounded-full bg-[#040A15] border border-[#1E293B] flex items-center justify-center shrink-0">
                              {getSeverityIcon(severity)}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col font-mono text-slate-300">
                              <span>{new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                              <span className="text-xs text-slate-500 mt-0.5">IP: {log.ip_address || 'Internal'}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <p className="font-bold text-white">{log.actor_name}</p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">{log.user_id?.slice(0, 8)}...</p>
                          </td>
                          <td className="py-4 px-6 whitespace-normal min-w-[300px]">
                            <p className="font-bold text-[#D2A02A] text-xs uppercase tracking-wider mb-0.5">{log.action}</p>
                            {log.table_name && (
                              <p className="text-slate-400 text-sm leading-snug">
                                Table: <span className="font-mono text-slate-300">{log.table_name}</span>
                                {log.record_id && <span className="text-slate-500"> · ID: {log.record_id.slice(0, 8)}...</span>}
                              </p>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${getSeverityColor(severity)}`}>
                              {severity}
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })
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
