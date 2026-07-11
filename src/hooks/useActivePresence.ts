'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ActiveUser {
  id: string;
  full_name: string;
  role: string;
  branch_id?: string;
  online_at: string;
}

let sharedChannel: any = null;
let cachedOnlineUsers: ActiveUser[] = [];
const listeners = new Set<(users: ActiveUser[]) => void>();
const trackedUsers = new Map<string, ActiveUser>();
let cleanupTimeoutId: any = null;

function setupSharedChannel(supabase: ReturnType<typeof createClient>) {
  if (sharedChannel) return sharedChannel;

  // Remove any stale channel with the same topic before initializing a new one
  const existingChannels = supabase.getChannels();
  existingChannels.forEach((c) => {
    if (c.topic === 'realtime:online-users') {
      supabase.removeChannel(c);
    }
  });

  const channel = supabase.channel('online-users', {
    config: {
      presence: {
        key: 'global-presence',
      },
    },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users: ActiveUser[] = [];
      
      Object.keys(state).forEach((key) => {
        const presences = state[key] as unknown[];
        if (presences && presences.length > 0) {
          users.push(presences[0] as ActiveUser);
        }
      });
      
      cachedOnlineUsers = users;
      listeners.forEach((listener) => listener(users));
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        syncPresenceTracking();
      }
    });

  sharedChannel = channel;
  return channel;
}

function syncPresenceTracking() {
  if (!sharedChannel || sharedChannel.state !== 'joined') return;

  if (trackedUsers.size > 0) {
    // Track the first user in our trackedUsers map
    const firstUser = Array.from(trackedUsers.values())[0];
    sharedChannel.track(firstUser).catch((err: any) => {
      console.error('[Realtime] Failed to track presence:', err);
    });
  } else {
    sharedChannel.untrack().catch(() => {});
  }
}

export function useActivePresence(currentUser?: { id: string; full_name: string; role: string; branch_id?: string | null }) {
  const [onlineUsers, setOnlineUsers] = useState<ActiveUser[]>(cachedOnlineUsers);
  const supabase = createClient();

  useEffect(() => {
    // Cancel any scheduled teardown if a component using presence just mounted
    if (cleanupTimeoutId) {
      clearTimeout(cleanupTimeoutId);
      cleanupTimeoutId = null;
    }

    setupSharedChannel(supabase);

    const listener = (users: ActiveUser[]) => setOnlineUsers(users);
    listeners.add(listener);

    if (cachedOnlineUsers.length > 0) {
      setOnlineUsers(cachedOnlineUsers);
    }

    if (currentUser?.id) {
      trackedUsers.set(currentUser.id, {
        id: currentUser.id,
        full_name: currentUser.full_name,
        role: currentUser.role,
        branch_id: currentUser.branch_id || undefined,
        online_at: new Date().toISOString(),
      });
      syncPresenceTracking();
    }

    return () => {
      listeners.delete(listener);

      if (currentUser?.id) {
        trackedUsers.delete(currentUser.id);
        syncPresenceTracking();
      }

      if (listeners.size === 0) {
        cleanupTimeoutId = setTimeout(() => {
          if (listeners.size === 0 && sharedChannel) {
            sharedChannel.untrack().catch(() => {});
            supabase.removeChannel(sharedChannel);
            sharedChannel = null;
            cachedOnlineUsers = [];
          }
        }, 300);
      }
    };
  }, [currentUser?.id, currentUser?.full_name, currentUser?.role, currentUser?.branch_id, supabase]);

  return { onlineUsers };
}
