'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Bell, Calendar, Clock, Megaphone } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function ProfileAnnouncements({ userId, role }: { userId?: string, role: string }) {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnnouncements() {
      if (!userId) return;
      try {
        const res = await fetch('/api/notifications?type=alert&limit=10');
        const json = await res.json();
        if (json.success) {
          setAnnouncements(json.data || []);
          
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
      <Card className="bg-[#ffffff] border-slate-200 p-6 shadow-lg flex items-center justify-center min-h-[200px]">
        <Spinner size="md" label="Loading Announcements..." />
      </Card>
    );
  }

  return (
    <Card className="bg-[#ffffff] border-slate-200 p-6 shadow-lg mt-6">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-2 text-slate-900">
          <Megaphone className="w-5 h-5 text-rose-500" />
          <h3 className="font-semibold text-base">Announcements</h3>
        </div>
        <button
          onClick={() => router.push(`/${role === 'branch_manager' ? 'branch-manager' : 'employee'}/announcements`)}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
        >
          View All &rarr;
        </button>
      </div>
      
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
        {announcements.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm font-medium">No recent announcements</p>
          </div>
        ) : (
          announcements.map((announcement) => {
            const dateObj = new Date(announcement.created_at);
            const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const weekDay = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

            return (
              <div key={announcement.id} className={`p-4 rounded-xl border ${!announcement.is_read ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-bold text-slate-900">{announcement.title}</h4>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{announcement.message}</p>
                  
                  <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-slate-200/60">
                    <div className="flex items-center text-[10px] text-slate-500 font-medium">
                      <Calendar className="w-3 h-3 mr-1" />
                      {dateStr}
                    </div>
                    <div className="flex items-center text-[10px] text-slate-500 font-medium">
                      <Clock className="w-3 h-3 mr-1" />
                      {timeStr}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">
                      {weekDay}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
