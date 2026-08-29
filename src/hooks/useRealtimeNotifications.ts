'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert' | 'success' | 'attendance_approval' | 'attendance_decision' | 'welcome' | 'system' | 'leave' | 'attendance' | 'correction' | 'payroll';
  action_url?: string | null;
  link_url?: string | null;
  is_read: boolean;
  created_at: string;
}

// Helper to play a clean, crisp double-pip notification sound via Web Audio API
const playPipSound = async () => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Resume context if suspended (browser autoplay policies)
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    // First note (A5 - 880 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second note (E6 - 1318.5 Hz) played right after 160ms
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.5, now + 0.16);
    gain2.gain.setValueAtTime(0.4, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.16);
    osc2.stop(now + 0.35);
  } catch (err) {
    console.warn('Could not play pip sound:', err);
  }
};

export function useRealtimeNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [latestToast, setLatestToast] = useState<NotificationItem | null>(null);

  const notificationsRef = useRef<NotificationItem[]>([]);
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // Use useMemo to ensure the supabase client is created only once — not on every render.
  // This prevents the infinite subscribe/unsubscribe loop caused by a new object
  // reference being created each render and appearing as a changed dependency.
  const supabase = useMemo(() => createClient(), []);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async (silent = false) => {
    if (!userId) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=50');
      const json = await res.json();
      if (json.success && json.data) {
        // If there's a newly created unread notification in live sync that wasn't here before
        const incoming: NotificationItem[] = json.data;
        if (silent && incoming.length > 0) {
          const newest = incoming[0];
          const exists = notificationsRef.current.some((n) => n.id === newest.id);
          if (!exists && !newest.is_read) {
            playPipSound();
            setLatestToast(newest);
          }
        }
        setNotifications(incoming);
        setUnreadCount(json.meta?.unread_count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications(false);
    
    // Live polling fallback every 12 seconds to guarantee 100% delivery even if WebSocket connection drops
    const syncInterval = setInterval(() => {
      fetchNotifications(true);
    }, 12000);
    return () => clearInterval(syncInterval);
  }, [fetchNotifications]);

  // Loop sound every 5 seconds if there are unread notifications
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (unreadCount > 0) {
      // Play immediately once when count becomes > 0 is handled by realtime or fetch
      interval = setInterval(() => {
        playPipSound();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [unreadCount]);

  // Subscribe to Supabase Realtime WebSocket channel (Spec P23)
  useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    const topic = `user-notifications-${userId}`;

    async function setupChannel() {
      try {
        // Ensure the real-time client has the user's active JWT so RLS allows INSERT notifications
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.access_token) {
          supabase.realtime.setAuth(sessionData.session.access_token);
        }
      } catch (e) {
        console.warn('[Realtime] Could not set auth token:', e);
      }

      if (!isMounted) return;

      // Remove any stale channel with the same topic before initializing
      const existingChannels = supabase.getChannels();
      existingChannels.forEach((c) => {
        if (c.topic === `realtime:${topic}`) {
          supabase.removeChannel(c);
        }
      });

      // Create a user-scoped broadcast channel listening to INSERT events on public.notifications
      const channel = supabase
        .channel(topic)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const newNotif = payload.new as NotificationItem;
            
            // Prevent duplicates
            if (notificationsRef.current.some((n) => n.id === newNotif.id)) {
              return;
            }

            // Play the double-pip sound immediately
            playPipSound();
            // Update state immediately
            setNotifications((prev) => [newNotif, ...prev]);
            setUnreadCount((prev) => prev + 1);
            // Trigger toast alert
            setLatestToast(newNotif);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Realtime] Connected to notification channel for user ${userId}`);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[Realtime] Connection dropped. Reconnecting...');
          }
        });
    }

    setupChannel();

    return () => {
      isMounted = false;
      const existingChannels = supabase.getChannels();
      existingChannels.forEach((c) => {
        if (c.topic === `realtime:${topic}`) {
          supabase.removeChannel(c);
        }
      });
    };
  }, [userId, supabase]);

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'PUT' });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  };

  const dismiss = async (id: string) => {
    // Optimistic update: remove immediately from UI
    setNotifications((prev) => {
      const notif = prev.find((n) => n.id === id);
      if (notif && !notif.is_read) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      return prev.filter((n) => n.id !== id);
    });
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Error dismissing notification:', err);
    }
  };

  const clearToast = () => setLatestToast(null);

  return {
    notifications,
    unreadCount,
    loading,
    latestToast,
    clearToast,
    markAsRead,
    markAllAsRead,
    dismiss,
    refetch: fetchNotifications,
  };
}
