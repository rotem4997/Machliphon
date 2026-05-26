import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { User } from '../lib/types';

interface UseUserResult {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export function useUser(): UseUserResult {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        if (!newSession) {
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    setLoading(true);
    supabase
      .from('users')
      .select('id, role, full_name, phone')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setUser(null);
        } else {
          setUser(data as User);
        }
        setLoading(false);
      });
  }, [session]);

  return { user, session, loading };
}
