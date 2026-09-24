'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Bell, Send, ChevronLeft, AlertTriangle, CheckCircle2, Users, Megaphone, Building2, Plus, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { Spinner } from '@/components/ui/Spinner';

interface Branch {
  id: string;
  name: string;
}

interface BroadcastHistoryItem {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

export default function BroadcastPage() {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const TITLE_MAX = 100;

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/notifications/broadcast/history');
      const json = await res.json();
      if (json.success) {
        setHistory(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    async function loadBranches() {
      const { data } = await supabase.from('branches').select('id, name').eq('is_active', true).order('name');
      if (data) setBranches(data);
    }
    loadBranches();
    loadHistory();
  }, [supabase, loadHistory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setShowConfirm(true);
  };

  const handleConfirmSend = async () => {
    setShowConfirm(false);
    setSending(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: selectedBranch,
          title: title.trim(),
          message: message.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to dispatch broadcast');
      }

      setFeedback({
        type: 'success',
        text: `Broadcast dispatched successfully to ${json.data.total} staff members.`,
      });
      setTitle('');
      setMessage('');
      setShowCompose(false);
      loadHistory(); // Reload history after sending
    } catch (err: unknown) {
      console.error('Broadcast error:', err);
      setFeedback({ type: 'error', text: (err as Error).message || 'Failed to send broadcast. Please try again.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-2">
          <Link href="/admin" className="flex items-center text-slate-900 hover:text-slate-900 transition-colors text-sm mb-2 w-fit">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Link>
          <div className="flex items-center space-x-2 text-[#1dbf73] text-xs font-bold uppercase tracking-widest mb-1">
            <Megaphone className="w-4 h-4" />
            <span>System Announcements</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Announcements History
          </h1>
          <p className="text-sm text-slate-500">
            View previously sent announcements and dispatch new ones.
          </p>
        </div>
        <Button onClick={() => setShowCompose(true)} icon={<Plus className="w-4 h-4" />}>
          New Announcement
        </Button>
      </div>

      {/* Feedback Banner */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`flex items-start gap-3 p-4 rounded-xl border text-sm font-medium ${
              feedback.type === 'success'
                ? 'bg-[#1dbf73]/10 border-emerald-500/20 text-[#1dbf73]'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="ml-auto text-slate-400 hover:text-slate-600">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History List */}
      <div className="space-y-4">
        {loadingHistory ? (
          <div className="py-12 flex justify-center"><Spinner /></div>
        ) : history.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
              <Megaphone className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Announcements Sent</h3>
            <p className="text-slate-500 mt-2 text-sm max-w-sm">You haven&apos;t sent any announcements yet. Click &quot;New Announcement&quot; to send your first one.</p>
            <Button onClick={() => setShowCompose(true)} className="mt-6" variant="outline" icon={<Plus className="w-4 h-4" />}>
              Create Announcement
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {history.map((item) => {
              const d = new Date(item.created_at);
              return (
                <div key={item.id} className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 hover:border-[#1dbf73]/30 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-slate-900 leading-tight">{item.title}</h3>
                    <div className="flex flex-col items-end shrink-0 ml-4 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                      <div className="flex items-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        <Calendar className="w-3 h-3 mr-1" />
                        {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="flex items-center text-[10px] text-slate-400 mt-0.5 font-medium">
                        <Clock className="w-3 h-3 mr-1" />
                        {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{item.message}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Compose Popup */}
      <AnimatePresence>
        {showCompose && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={() => setShowCompose(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 md:p-8 max-w-2xl w-full my-8"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">New Announcement</h2>
                  <p className="text-xs font-medium text-slate-500 mt-1">Send a broadcast to staff members.</p>
                </div>
                <button onClick={() => setShowCompose(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors">
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                    Target Audience / Store Branch
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all"
                    >
                      <option value="all">🌐 All Store Branches (Universal Broadcast)</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          🏪 {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">Message Title</label>
                    <span className={`text-[10px] font-mono ${title.length > TITLE_MAX * 0.9 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {title.length}/{TITLE_MAX}
                    </span>
                  </div>
                  <input
                    required
                    value={title}
                    maxLength={TITLE_MAX}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., URGENT: Store Policy Update"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">Message Body (Unlimited)</label>
                    <span className="text-[10px] font-mono text-slate-500">
                      {message.length} chars
                    </span>
                  </div>
                  <textarea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    placeholder="Type your detailed announcement here..."
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all resize-y"
                  />
                </div>

                <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
                  <Button type="button" variant="secondary" onClick={() => setShowCompose(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={sending || !title.trim() || !message.trim()}
                    icon={<Send className="w-4 h-4" />}
                  >
                    {sending ? 'Dispatching...' : 'Send Announcement'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 max-w-md w-full"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Confirm Broadcast</h3>
                  <p className="text-xs text-slate-500">This action cannot be undone.</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-5 space-y-2 max-h-40 overflow-y-auto">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Title</p>
                <p className="text-slate-900 font-semibold text-sm">{title}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-2">Message Preview</p>
                <p className="text-slate-600 text-xs leading-relaxed truncate">{message}</p>
              </div>
              <p className="text-xs text-amber-500 font-medium text-center mb-5">
                ⚠ This will notify every active staff member in the selected branch(es).
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setShowConfirm(false)}>
                  Go Back
                </Button>
                <Button variant="danger" className="flex-1" icon={<Send className="w-4 h-4" />} onClick={handleConfirmSend}>
                  Confirm & Send
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
