/**
 * Lintnotes
 * - Purpose: App-wide context for Supabase client, auth session, accessible events, and selected event state.
 * - Exports: SupabaseProvider (context provider), useSupabaseContext (hook), SupabaseContextValue (types)
 * - Major deps: @supabase/supabase-js, React context/hooks, services: supabase, auth (deep link init), events (fetch)
 * - Side effects: Subscribes to Supabase auth state changes; initializes deep-link handling for auth callbacks; fetches events on session change.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseClient } from '../services/supabase';
import { launchMagicLinkSignIn, initializeDeepLinkHandling } from '../services/auth';
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

  // Initialize deep link handling for auth callbacks
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const initDeepLinks = async () => {
      try {
        cleanup = await initializeDeepLinkHandling();
      } catch (error) {
        console.error('Failed to initialize deep link handling:', error);
      }
    };

    initDeepLinks();

    return () => {
      cleanup?.();
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
