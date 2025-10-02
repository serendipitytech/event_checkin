import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { getSupabaseClient } from '../services/supabase';
import { launchMagicLinkSignIn, handleAuthCallback } from '../services/auth';
import { fetchAccessibleEvents, type EventSummary } from '../services/events';

export type SupabaseContextValue = {
  supabase: SupabaseClient;
  session: Session | null;
  loading: boolean;
  events: EventSummary[];
  selectedEvent: EventSummary | null;
  setSelectedEventId: (eventId: string | null) => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SupabaseContext = createContext<SupabaseContextValue | undefined>(undefined);

export const SupabaseProvider = ({ children }: { children: ReactNode }) => {
  const supabase = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initialiseAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    };

    initialiseAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      setSession(newSession ?? null);
      
      // Handle successful sign in
      if (event === 'SIGNED_IN' && newSession) {
        console.log('User signed in successfully');
      }
      
      // Handle sign out
      if (event === 'SIGNED_OUT') {
        console.log('User signed out');
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  // Handle deep linking for auth callbacks
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      if (url.includes('auth/callback')) {
        handleAuthCallback(url);
      }
    };

    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadEvents = async () => {
      if (!session) {
        setEvents([]);
        setSelectedEventId(null);
        return;
      }

      setLoading(true);
      try {
        const accessible = await fetchAccessibleEvents();
        if (ignore) return;
        setEvents(accessible);
        if (accessible.length > 0) {
          setSelectedEventId((current) => current ?? accessible[0].eventId);
        } else {
          setSelectedEventId(null);
        }
      } catch (error) {
        console.warn('Failed to load events', error);
        if (!ignore) {
          setEvents([]);
          setSelectedEventId(null);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadEvents();

    return () => {
      ignore = true;
    };
  }, [session, supabase]);

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return events.find((event) => event.eventId === selectedEventId) ?? null;
  }, [events, selectedEventId]);

  const value = useMemo<SupabaseContextValue>(() => ({
    supabase,
    session,
    loading,
    events,
    selectedEvent,
    setSelectedEventId,
    signIn: async () => {
      await launchMagicLinkSignIn();
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setEvents([]);
      setSelectedEventId(null);
    }
  }), [events, loading, selectedEvent, session, supabase]);

  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>;
};

export const useSupabaseContext = (): SupabaseContextValue => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabaseContext must be used within a SupabaseProvider');
  }
  return context;
};
