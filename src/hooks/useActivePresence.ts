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

export function useActivePresence(currentUser?: { id: string; full_name: string; role: string; branch_id?: string | null }) {
  const [onlineUsers, setOnlineUsers] = useState<ActiveUser[]>([]);
  const supabase = createClient();

  useEffect(() => {
    // We create a single room for global presence tracking
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: currentUser ? currentUser.id : undefined,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: ActiveUser[] = [];
        
        // Flatten presence state map into an array of unique users
        Object.keys(state).forEach((key) => {
          const presences = state[key] as unknown[];
          if (presences && presences.length > 0) {
            users.push(presences[0] as ActiveUser);
          }
        });
        
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // If we have a user to track, track their presence
          if (currentUser) {
            await channel.track({
              id: currentUser.id,
              full_name: currentUser.full_name,
              role: currentUser.role,
              branch_id: currentUser.branch_id,
              online_at: new Date().toISOString(),
            });
          }
        }
      });

    return () => {
      // Clean up when unmounting
      if (currentUser) {
        channel.untrack();
      }
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, supabase]);

  return { onlineUsers };
}
