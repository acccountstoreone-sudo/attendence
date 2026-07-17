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
        <Link href="/branch-manager" className="flex items-center text-slate-900 hover:text-slate-900 transition-colors text-sm mb-2 w-fit">
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
        <p className="text-sm text-slate-900">
          View all recent broadcasts and important updates from management.
        </p>
      </div>

      <div className="space-y-8">
        {announcements.length === 0 ? (
          <Card className="p-12 text-center bg-slate-50 border-dashed">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No Announcements</h3>
            <p className="text-slate-500 mt-2">You don't have any announcements at the moment.</p>
          </Card>
        ) : (
          (() => {
            // Group announcements by date
            const grouped = announcements.reduce((acc: any, announcement: any) => {
              const dateObj = new Date(announcement.created_at);
              
              // Determine if Today or Yesterday
              const today = new Date();
              const yesterday = new Date(today);
              yesterday.setDate(yesterday.getDate() - 1);
              
              let groupKey = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
              
              if (dateObj.toDateString() === today.toDateString()) {
                groupKey = 'Today';
              } else if (dateObj.toDateString() === yesterday.toDateString()) {
                groupKey = 'Yesterday';
              }
              
              if (!acc[groupKey]) acc[groupKey] = [];
              acc[groupKey].push(announcement);
              return acc;
            }, {});

            return Object.keys(grouped).map((dateKey) => (
              <div key={dateKey} className="space-y-4">
                <div className="flex items-center space-x-4">
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                    {dateKey}
                  </h2>
                  <div className="flex-1 h-px bg-slate-200"></div>
                </div>
                
                <div className="space-y-4">
                  {grouped[dateKey].map((announcement: any) => {
                    const dateObj = new Date(announcement.created_at);
                    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                    const isUnread = !announcement.is_read;

                    return (
                      <Card key={announcement.id} className={`p-0 overflow-hidden transition-all shadow-sm border ${isUnread ? 'border-rose-200 shadow-rose-100/50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <div className="flex flex-col sm:flex-row">
                          {/* Time Column */}
                          <div className={`sm:w-32 flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-center p-4 sm:p-6 border-b sm:border-b-0 sm:border-r ${isUnread ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex items-center space-x-2">
                              {isUnread && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>}
                              <span className={`text-sm font-bold ${isUnread ? 'text-rose-700' : 'text-slate-500'}`}>
                                {timeStr}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-slate-400 sm:mt-1">
                              {isUnread ? 'New' : 'Read'}
                            </span>
                          </div>
                          
                          {/* Content Column */}
                          <div className="flex-1 p-4 sm:p-6 bg-white">
                            <h3 className="text-lg font-bold text-slate-900 mb-2">{announcement.title}</h3>
                            <p className="text-slate-900 leading-relaxed text-sm whitespace-pre-wrap">
                              {announcement.message}
                            </p>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ));
          })()
        )}
      </div>
    </div>
  );
}
