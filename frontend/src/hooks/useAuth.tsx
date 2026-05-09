import { User } from '@supabase/gotrue-js';
import React, { useEffect, useState } from 'react';
import { getAccessToken } from '../app/authStorage';
import { supabase } from '../app/supabase';

export function useAuth(): User | null {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function syncAuth() {
      if (getAccessToken()) {
        await supabase.auth.refresh();
      }

      if (isMounted) {
        setUser(supabase.auth.user());
      }
    }

    void syncAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  return user;
}
