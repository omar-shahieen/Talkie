import React, { useEffect, useState } from 'react';
import { getAccessToken } from '../app/authStorage';
import { refreshAccessToken } from '../app/services/api.service';
import { fetchCurrentUser } from '../app/services/user.service';

/** Matches the subset of user fields stored in localStorage by login/OAuth flows. */
export type TalkieUser = {
  id?: string;
  email?: string;
  name?: string;
  username?: string;
  avatar?: string | null;
  appRole?: string;
};

function getStoredUser(): TalkieUser | null {
  try {
    const value = localStorage.getItem('user');
    return value ? (JSON.parse(value) as TalkieUser) : null;
  } catch {
    return null;
  }
}

export function useAuth(): TalkieUser | null {
  const [user, setUser] = useState<TalkieUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function syncAuth() {
      const hasToken = Boolean(getAccessToken());

      if (hasToken) {
        await refreshAccessToken().catch(() => null);

        try {
          const me = await fetchCurrentUser();

          if (me?.id) {
            const fullName = [me.firstName, me.lastName]
              .filter(Boolean)
              .join(' ')
              .trim();

            const normalizedUser: TalkieUser = {
              id: me.id,
              email: me.email ?? '',
              name:
                me.name ||
                fullName ||
                me.username ||
                (me.email ?? 'User').split('@')[0],
              username: me.username ?? '',
              appRole: me.appRole ?? 'user',
              avatar: me.avatar ?? null,
            };

            localStorage.setItem('user', JSON.stringify(normalizedUser));
          }
        } catch {
          // Keep cached identity when profile endpoint is temporarily unavailable.
        }
      }

      if (isMounted) {
        setUser(getStoredUser());
      }
    }

    void syncAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  return user;
}
