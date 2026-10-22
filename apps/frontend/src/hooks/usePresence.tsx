import { useEffect, useState } from 'react';
import { getChatSocket } from '../app/supabase';

export type UserPresence = {
  userId: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  lastSeen?: string;
};

type PresenceCache = Record<string, UserPresence>;

const presenceCache: PresenceCache = {};

/**
 * Custom hook to track user presence
 * Listens to presence updates from the socket
 */
export function useUserPresence(userId: string | undefined) {
  const [presence, setPresence] = useState<UserPresence>({
    userId: userId || '',
    status: 'offline',
  });

  useEffect(() => {
    if (!userId) return;

    // Check cache first
    if (presenceCache[userId]) {
      setPresence(presenceCache[userId]);
    }

    const socket = getChatSocket();
    if (!socket) return;

    // Listen for presence updates
    const handlePresenceUpdate = (payload: any) => {
      if (payload.userId === userId) {
        const updated = {
          userId,
          status: (payload.status || 'offline') as
            | 'online'
            | 'idle'
            | 'dnd'
            | 'offline',
          lastSeen: payload.lastSeen || new Date().toISOString(),
        };
        presenceCache[userId] = updated;
        setPresence(updated);
      }
    };

    socket.on('presence:update', handlePresenceUpdate);
    socket.on('presence:updated', handlePresenceUpdate);

    return () => {
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('presence:updated', handlePresenceUpdate);
    };
  }, [userId]);

  return presence;
}

/**
 * Custom hook to listen to all presence changes
 * Useful for DM lists showing multiple users
 */
export function useAllPresence() {
  const [allPresence, setAllPresence] = useState<PresenceCache>({});

  useEffect(() => {
    const socket = getChatSocket();
    if (!socket) return;

    const handlePresenceUpdate = (payload: any) => {
      setAllPresence((prev) => ({
        ...prev,
        [payload.userId]: {
          userId: payload.userId,
          status: (payload.status || 'offline') as
            | 'online'
            | 'idle'
            | 'dnd'
            | 'offline',
          lastSeen: payload.lastSeen || new Date().toISOString(),
        },
      }));

      // Update cache
      if (payload.userId) {
        presenceCache[payload.userId] = {
          userId: payload.userId,
          status: payload.status || 'offline',
          lastSeen: payload.lastSeen,
        };
      }
    };

    socket.on('presence:update', handlePresenceUpdate);
    socket.on('presence:updated', handlePresenceUpdate);

    return () => {
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('presence:updated', handlePresenceUpdate);
    };
  }, []);

  return allPresence;
}

export function getPresenceColor(
  status: 'online' | 'idle' | 'dnd' | 'offline',
): string {
  switch (status) {
    case 'online':
      return '#43b581';
    case 'idle':
      return '#faa61a';
    case 'dnd':
      return '#f04747';
    case 'offline':
      return '#747f8d';
  }
}

export function getPresenceLabel(
  status: 'online' | 'idle' | 'dnd' | 'offline',
): string {
  switch (status) {
    case 'online':
      return 'Online';
    case 'idle':
      return 'Idle';
    case 'dnd':
      return 'Do Not Disturb';
    case 'offline':
      return 'Offline';
  }
}
