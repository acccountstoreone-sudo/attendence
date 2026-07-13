'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
const playPipSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // First pip note (A5 - 880 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    gain1.gain.setValueAtTime(0.18, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.12);

    // Second pip note (D6 - 1174.66 Hz) played right after 140ms
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.14);
    gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.14);
    osc2.stop(ctx.currentTime + 0.28);
  } catch (err) {
    console.warn('Could not play pip sound:', err);
  }
};

export function useRealtimeNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [latestToast, setLatestToast] = useState<NotificationItem | null>(null);

  // useRef ensures the supabase client is created only once — not on every render.
  // This prevents the infinite subscribe/unsubscribe loop caused by a new object
  // reference being created each render and appearing as a changed dependency.
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=30');
      const json = await res.json();
      if (json.success && json.data) {
        setNotifications(json.data);
        setUnreadCount(json.meta?.unread_count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch initial notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
  }, [fetchNotifications]);

  // Subscribe to Supabase Realtime WebSocket channel (Spec P23)
  useEffect(() => {
    if (!userId) return;

    // Remove any stale channel with the same topic before initializing
    const topic = `user-notifications-${userId}`;
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

    return () => {
      supabase.removeChannel(channel);
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
