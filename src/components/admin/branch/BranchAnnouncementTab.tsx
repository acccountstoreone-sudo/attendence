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
}

export const BranchAnnouncementTab: React.FC<BranchAnnouncementTabProps> = ({ branch }) => {
  const [announcementType, setAnnouncementType] = useState<'text' | 'sound'>('text');
  const [message, setMessage] = useState('');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSend = () => {
    setFeedback({ type: 'success', text: `Sent ${announcementType} announcement to ${branch.name}.` });
    setMessage('');
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col gap-2">
        <h4 className="text-lg font-bold text-white flex items-center">
          <Bell className="w-5 h-5 mr-2 text-[#004417]" /> Branch Announcements
        </h4>
        <p className="text-sm text-slate-400">Send notifications to all employees assigned to {branch.name}.</p>
      </div>

      <Card className="bg-slate-900 border-slate-800 p-6 shadow-xl">
        <div className="flex space-x-4 mb-6 border-b border-slate-800 pb-4">
          <button
            onClick={() => setAnnouncementType('text')}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              announcementType === 'text' 
                ? 'bg-[#004417]/10 text-[#004417] border border-[#004417]/20' 
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4 mr-2" /> Text Announcement
          </button>
          <button
            onClick={() => setAnnouncementType('sound')}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              announcementType === 'sound' 
                ? 'bg-[#004417]/10 text-[#004417] border border-[#004417]/20' 
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            <Volume2 className="w-4 h-4 mr-2" /> Sound Notification
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">
              {announcementType === 'text' ? 'Message Content' : 'Text-to-Speech Message'}
            </Label>
            <Textarea 
              className="bg-slate-950 border-slate-800 min-h-[120px]" 
              placeholder={announcementType === 'text' ? "Enter your announcement here..." : "Enter text to be played as audio..."}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            {announcementType === 'sound' && (
              <p className="text-xs text-slate-500 flex items-center mt-2">
                <Volume2 className="w-3 h-3 mr-1" /> This message will be played out loud on active employee devices.
              </p>
            )}
          </div>
          
          <div className="pt-4 flex justify-end">
            <Button onClick={handleSend} disabled={!message.trim()} className="bg-[#004417] hover:bg-[#003311]">
              <Send className="w-4 h-4 mr-2" /> Send Announcement
            </Button>
          </div>
        </div>
        
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-6 p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-sm font-medium"
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
