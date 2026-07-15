'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Bell, Calendar, ChevronLeft, Clock } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function BranchManagerAnnouncementsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | undefined>(undefined);
  
  // Custom fetch logic for announcements specifically
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      } else {
        router.push('/login');
      }
    }
    loadUser();
  }, [supabase, router]);

  useEffect(() => {
    async function fetchAnnouncements() {
      if (!userId) return;
      try {
        const res = await fetch('/api/notifications?type=alert&limit=50');
        const json = await res.json();
        if (json.success) {
          setAnnouncements(json.data || []);
          
          // Mark all fetched announcements as read
          json.data.forEach(async (a: any) => {
            if (!a.is_read) {
              await fetch(`/api/notifications/${a.id}/read`, { method: 'PUT' });
            }
          });
        }
      } catch (err) {
        console.error('Failed to fetch announcements', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnnouncements();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <Spinner size="lg" label="Loading Announcements..." />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-6">
        <Link href="/branch-manager" className="flex items-center text-slate-600 hover:text-slate-900 transition-colors text-sm mb-2 w-fit">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Link>
        <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1">
          <Bell className="w-4 h-4" />
          <span>System Comms</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Store Announcements
        </h1>
        <p className="text-sm text-slate-600">
          View all recent broadcasts and important updates from management.
        </p>
      </div>

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <Card className="p-12 text-center bg-slate-50 border-dashed">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No Announcements</h3>
            <p className="text-slate-500 mt-2">You don't have any announcements at the moment.</p>
          </Card>
        ) : (
          announcements.map((announcement) => {
            const dateObj = new Date(announcement.created_at);
            const dateStr = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const weekDay = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

            return (
              <Card key={announcement.id} className={`p-5 transition-all shadow-sm ${!announcement.is_read ? 'bg-white border-l-4 border-l-rose-500' : 'bg-white'}`}>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 space-y-2">
                    <h3 className="text-lg font-bold text-slate-900">{announcement.title}</h3>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-700 leading-relaxed text-sm whitespace-pre-wrap">
                      {announcement.message}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 min-w-[150px] shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-4">
                    <div className="flex items-center text-xs text-slate-500 font-medium">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                      {dateStr}
                    </div>
                    <div className="flex items-center text-xs text-slate-500 font-medium">
                      <Clock className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                      {timeStr}
                    </div>
                    <div className="inline-flex mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {weekDay}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
