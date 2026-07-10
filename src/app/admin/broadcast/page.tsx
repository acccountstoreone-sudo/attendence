'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Bell, Send, ChevronLeft, AlertTriangle, CheckCircle2, Users, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export default function BroadcastPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const TITLE_MAX = 100;
  const MESSAGE_MAX = 500;

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
      // Fetch all active employee user IDs to broadcast individually
      const empRes = await fetch('/api/employees?limit=200');
      const empJson = await empRes.json();

      if (!empJson.success) {
        throw new Error('Failed to fetch employee list for broadcast.');
      }

      const employees: Array<{ id: string }> = empJson.data || [];

      if (employees.length === 0) {
        setFeedback({ type: 'error', text: 'No active employees found to broadcast to.' });
        return;
      }

      // Send notification to each employee
      let successCount = 0;
      let failCount = 0;

      await Promise.all(
        employees.map(async (emp) => {
          const res = await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: emp.id,
              title: title.trim(),
              message: message.trim(),
              type: 'alert',
            }),
          });
          if (res.ok) successCount++;
          else failCount++;
        })
      );

      setFeedback({
        type: 'success',
        text: `Broadcast dispatched to ${successCount} staff member${successCount !== 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}.`,
      });
      setTitle('');
      setMessage('');
    } catch (err: unknown) {
      console.error('Broadcast error:', err);
      setFeedback({ type: 'error', text: (err as Error).message || 'Failed to send broadcast. Please try again.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Link href="/admin" className="flex items-center text-slate-400 hover:text-white transition-colors text-sm mb-2 w-fit">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Link>
        <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
          <Megaphone className="w-4 h-4" />
          <span>System Comms</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Dispatch System Broadcast
        </h1>
        <p className="text-sm text-slate-400">
          Send an urgent alert to all active staff devices across the Anchor Fashion network.
        </p>
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
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <span>{feedback.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="bg-[#021a0a] border-[#0a3a1e] p-6 shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Message Title</label>
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
              className="w-full px-4 py-3 bg-[#010e05] border border-[#0a3a1e] rounded-xl text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Message Body</label>
              <span className={`text-[10px] font-mono ${message.length > MESSAGE_MAX * 0.9 ? 'text-amber-400' : 'text-slate-500'}`}>
                {message.length}/{MESSAGE_MAX}
              </span>
            </div>
            <textarea
              required
              value={message}
              maxLength={MESSAGE_MAX}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Details of your broadcast..."
              className="w-full px-4 py-3 bg-[#010e05] border border-[#0a3a1e] rounded-xl text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all resize-none"
            />
          </div>

          {/* Warning Banner */}
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <span>This will send a notification to <strong>all active staff members</strong>. Use with caution.</span>
          </div>

          <div className="pt-4 flex justify-end space-x-3 border-t border-[#0a3a1e]">
            <Button type="button" variant="secondary" onClick={() => router.push('/admin')}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={sending || !title.trim() || !message.trim()}
              icon={<Send className="w-4 h-4" />}
            >
              {sending ? 'Dispatching...' : 'Review & Send'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#021a0a] border border-rose-500/30 rounded-2xl shadow-2xl p-6 max-w-md w-full"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Confirm Broadcast</h3>
                  <p className="text-xs text-slate-400">This action cannot be undone.</p>
                </div>
              </div>
              <div className="bg-[#010e05] rounded-xl p-4 border border-[#0a3a1e] mb-5 space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Title</p>
                <p className="text-white font-semibold text-sm">{title}</p>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mt-2">Message</p>
                <p className="text-slate-300 text-sm leading-relaxed">{message}</p>
              </div>
              <p className="text-xs text-amber-400 text-center mb-5">
                ⚠ This will notify every active staff member across all branches.
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setShowConfirm(false)}>
                  Go Back
                </Button>
                <Button variant="danger" className="flex-1" icon={<Send className="w-4 h-4" />} onClick={handleConfirmSend}>
                  Send to All Staff
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

