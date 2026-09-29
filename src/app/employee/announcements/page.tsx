'use client';

import React, { useState, useEffect } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { Bell, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function EmployeeAnnouncementsPage() {
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
        const res = await fetch('/api/notifications?type=system&limit=50');
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
        <Link href="/employee" className="flex items-center text-slate-900 hover:text-slate-900 transition-colors text-sm mb-2 w-fit">
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

      <div className="space-y-6 bg-slate-50 p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-inner min-h-[400px]">
        {announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
              <Bell className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Messages</h3>
            <p className="text-slate-500 mt-2 text-sm">You&apos;re all caught up! No new announcements.</p>
          </div>
        ) : (
          (() => {
            const grouped = announcements.reduce((acc: any, announcement: any) => {
              const dateObj = new Date(announcement.created_at);
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
              <div key={dateKey} className="space-y-6">
                <div className="flex justify-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-200/50 px-3 py-1 rounded-full">
                    {dateKey}
                  </span>
                </div>
                
                <div className="space-y-4 flex flex-col">
                  {grouped[dateKey].map((announcement: any) => {
                    const dateObj = new Date(announcement.created_at);
                    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                    const isUnread = !announcement.is_read;

                    return (
                      <div key={announcement.id} className="flex w-full items-end justify-start">
                        <div className="flex flex-col max-w-[85%] sm:max-w-[70%]">
                          <div className={`p-4 rounded-2xl rounded-bl-sm shadow-sm relative ${
                            isUnread 
                              ? 'bg-gradient-to-br from-[#1dbf73] to-[#16965a] text-white' 
                              : 'bg-white border border-slate-200 text-slate-800'
                          }`}>
                            <div className="flex items-start justify-between gap-4 mb-1">
                              <h3 className={`font-bold text-sm ${isUnread ? 'text-white' : 'text-slate-900'}`}>
                                {announcement.title}
                              </h3>
                              {isUnread && <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0 mt-1 animate-pulse"></span>}
                            </div>
                            <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isUnread ? 'text-emerald-50' : 'text-slate-600'}`}>
                              {announcement.message}
                            </p>
                            <div className={`text-[10px] font-medium text-right mt-2 ${isUnread ? 'text-emerald-200' : 'text-slate-400'}`}>
                              {timeStr}
                            </div>
                          </div>
                        </div>
                      </div>
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
