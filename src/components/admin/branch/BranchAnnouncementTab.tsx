'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { Bell, Volume2, MessageSquare, Send, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Branch } from './types';

interface BranchAnnouncementTabProps {
  branch: Branch;
  employees: { id: string }[];
}

export const BranchAnnouncementTab: React.FC<BranchAnnouncementTabProps> = ({ branch, employees }) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSend = async () => {
    if (!message.trim() || employees.length === 0 || isSending) return;
    
    setIsSending(true);
    setFeedback({ type: 'success', text: `Sending...` });
    
    try {
      const res = await fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: branch.id,
          title: `📢 Store Announcement: ${branch.name}`,
          message: message.trim(),
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setFeedback({ type: 'success', text: `Sent announcement to ${json.data.total} staff members in ${branch.name}.` });
        setMessage('');
      } else {
        throw new Error(json.error?.message || 'Failed to send announcement');
      }
    } catch (err: any) {
      console.error('Broadcast failed:', err);
      setFeedback({ type: 'error', text: err.message || 'Failed to send broadcast.' });
    } finally {
      setIsSending(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col gap-2">
        <h4 className="text-lg font-bold text-slate-900 flex items-center">
          <Bell className="w-5 h-5 mr-2 text-[#1dbf73]" /> Branch Announcements
        </h4>
        <p className="text-sm text-slate-900">Send notifications to all employees assigned to {branch.name}.</p>
      </div>

      <Card className="bg-white border-slate-200 p-6 shadow-xl">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-900">
              Message Content
            </Label>
            <Textarea 
              className="bg-white border-slate-200 min-h-[120px]" 
              placeholder="Enter your announcement here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          
          <div className="pt-4 flex justify-end">
            <Button onClick={handleSend} disabled={!message.trim() || isSending} className="bg-[#1dbf73] hover:bg-[#1dbf73]">
              <Send className="w-4 h-4 mr-2" /> {isSending ? 'Sending...' : 'Send Announcement'}
            </Button>
          </div>
        </div>
        
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-6 p-4 rounded-xl border bg-[#1dbf73]/10 border-emerald-500/20 text-[#1dbf73] text-sm font-medium"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{feedback.text}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
};
