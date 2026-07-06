'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ShieldAlert, Search, Filter, Download, Activity, AlertTriangle, ShieldCheck, UserMinus } from 'lucide-react';
import Abstract3DBackground from '@/components/Abstract3DBackground';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';

interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
  severity: 'info' | 'warning' | 'critical';
  ip_address: string;
}

// Dummy data for the audit log
const DUMMY_LOGS: AuditLog[] = [
  {
    id: 'LOG-001',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    actor: 'System Admin',
    action: 'Settings Updated',
    details: 'Updated geofence radius to 50 meters globally.',
    severity: 'info',
    ip_address: '192.168.1.104'
  },
  {
    id: 'LOG-002',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    actor: 'Sazzad Ali',
    action: 'Face Mismatch Alert',
    details: 'Failed biometric verification at Gulshan Branch. Confidence: 0.2',
    severity: 'critical',
    ip_address: '103.111.45.22'
  },
  {
    id: 'LOG-003',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    actor: 'Branch Manager (Banani)',
    action: 'Manual Override',
    details: 'Manually marked employee E-1045 as Present.',
    severity: 'warning',
    ip_address: '10.0.0.45'
  },
  {
    id: 'LOG-004',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    actor: 'System',
    action: 'Database Backup',
    details: 'Automated Supabase snapshot completed successfully.',
    severity: 'info',
    ip_address: 'Internal'
  },
  {
    id: 'LOG-005',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    actor: 'Unknown',
    action: 'Unauthorized Access Attempt',
    details: 'Failed login attempt for Admin portal from unrecognized IP.',
    severity: 'critical',
    ip_address: '45.22.19.100'
  }
];

export default function AdminAuditPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');

  const filteredLogs = DUMMY_LOGS.filter((log) => {
    const matchesSearch = 
      log.actor.toLowerCase().includes(searchTerm.toLowerCase()) || 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = filterSeverity === 'all' || log.severity === filterSeverity;
    return matchesSearch && matchesSeverity;
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <ShieldAlert className="w-5 h-5 text-rose-400" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'info': return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
      default: return <Activity className="w-5 h-5 text-slate-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
      case 'warning': return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'info': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      default: return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
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
            Immutable ledger of all administrative actions, system overrides, and security events.
          </p>
        </div>

        <div className="relative z-10 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-[#1E293B] bg-[#040A15]/50 backdrop-blur-md text-slate-300 hover:bg-[#1E293B] hover:text-white"
            icon={<Download className="w-4 h-4" />}
          >
            Export Audit Trail
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
              placeholder="Search actions, users, or details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#061224] border border-[#1E293B] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#D2A02A] transition-colors shadow-inner shadow-[#000000]/50"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
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
                        No audit events found matching the criteria.
                      </motion.div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <motion.tr 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      key={log.id} 
                      className="hover:bg-[#1E293B]/30 transition-colors group"
                    >
                      <td className="py-4 px-6">
                        <div className="w-10 h-10 rounded-full bg-[#040A15] border border-[#1E293B] flex items-center justify-center shrink-0">
                          {getSeverityIcon(log.severity)}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col font-mono text-slate-300">
                          <span>{new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          <span className="text-xs text-slate-500 mt-0.5">IP: {log.ip_address}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-bold text-white">{log.actor}</p>
                      </td>
                      <td className="py-4 px-6 whitespace-normal min-w-[300px]">
                        <p className="font-bold text-[#D2A02A] text-xs uppercase tracking-wider mb-0.5">{log.action}</p>
                        <p className="text-slate-400 text-sm leading-snug">{log.details}</p>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${getSeverityColor(log.severity)}`}>
                          {log.severity}
                        </span>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
