'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Bell, Send, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function BroadcastPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) return;
    
    setSending(true);
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: '00000000-0000-0000-0000-000000000000', // System wide
          title: title,
          message: message,
          type: 'alert',
        }),
      });
      alert('Broadcast dispatched to all Anchor Fashion staff!');
      router.push('/admin');
    } catch (err) {
      console.error('Broadcast error:', err);
      alert('Failed to send broadcast');
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
          <Bell className="w-4 h-4" />
          <span>System Comms</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Dispatch System Broadcast
        </h1>
        <p className="text-sm text-slate-400">
          Send an urgent alert to all staff devices across the Anchor Fashion network.
        </p>
      </div>

      <Card className="bg-[#061224] border-[#1E293B] p-6 shadow-2xl">
        <form onSubmit={handleSend} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message Title</label>
            <input 
              required
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., URGENT: System Maintenance" 
              className="w-full px-4 py-3 bg-[#040A15] border border-[#1E293B] rounded-xl text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message Body</label>
            <textarea 
              required
              value={message} 
              onChange={(e) => setMessage(e.target.value)}
              rows={5} 
              placeholder="Details of your broadcast..." 
              className="w-full px-4 py-3 bg-[#040A15] border border-[#1E293B] rounded-xl text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all" 
            />
          </div>
          <div className="pt-4 flex justify-end space-x-3 border-t border-[#1E293B]">
            <Button type="button" variant="secondary" onClick={() => router.push('/admin')}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={sending} icon={<Send className="w-4 h-4" />}>
              {sending ? 'Dispatching...' : 'Send to Network'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
