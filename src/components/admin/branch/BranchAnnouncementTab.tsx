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

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSend = async () => {
    if (!message.trim() || employees.length === 0) return;
    
    setFeedback({ type: 'success', text: `Sending...` });
    
    let successCount = 0;
    for (const emp of employees) {
      try {
        const res = await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: emp.id,
            title: `📢 Store Announcement: ${branch.name}`,
            message: message.trim(),
            type: 'alert',
            action_url: '/employee/announcements',
          })
        });
        if (res.ok) successCount++;
      } catch (err) {
        console.error('Failed to notify', emp.id, err);
      }
    }
    
    setFeedback({ type: 'success', text: `Sent announcement to ${successCount} employees in ${branch.name}.` });
    setMessage('');
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col gap-2">
        <h4 className="text-lg font-bold text-slate-900 flex items-center">
          <Bell className="w-5 h-5 mr-2 text-[#1dbf73]" /> Branch Announcements
        </h4>
        <p className="text-sm text-slate-600">Send notifications to all employees assigned to {branch.name}.</p>
      </div>

      <Card className="bg-white border-slate-200 p-6 shadow-xl">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-600">
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
            <Button onClick={handleSend} disabled={!message.trim()} className="bg-[#1dbf73] hover:bg-[#1dbf73]">
              <Send className="w-4 h-4 mr-2" /> Send Announcement
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
