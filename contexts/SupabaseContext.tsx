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
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSupabaseClient } from '../services/supabase';
import { launchMagicLinkSignIn, initializeDeepLinkHandling } from '../services/auth';
import { fetchAccessibleEvents, type EventSummary } from '../services/events';

// Storage keys for persistent session
const SESSION_STORAGE_KEY = '@checkin_session';
const SELECTED_EVENT_STORAGE_KEY = '@checkin_selected_event';

export type SupabaseContextValue = {
  supabase: SupabaseClient;
  session: Session | null;
  loading: boolean;
  events: EventSummary[];
  selectedEvent: EventSummary | null;
  setSelectedEventId: (eventId: string | null) => void;
  refreshEvents: () => Promise<void>;
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
      try {
        // First, try to restore session from AsyncStorage
        const storedSession = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if (storedSession && mounted) {
          const parsedSession = JSON.parse(storedSession) as Session;
          console.log('📦 Restored session from storage for:', parsedSession.user?.email);
          
          // Verify the session is still valid with Supabase
          const { data, error } = await supabase.auth.setSession({
            access_token: parsedSession.access_token,
            refresh_token: parsedSession.refresh_token,
          });
          
          if (!error && data.session && mounted) {
            setSession(data.session);
            console.log('✅ Session validated and restored');
          } else if (mounted) {
            // Stored session is invalid, clear it
            await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
            console.log('🗑️ Cleared invalid stored session');
          }
        }
      } catch (error) {
        console.error('Failed to restore session from storage:', error);
      }

      // Always check current session from Supabase
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    };

    initialiseAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      setSession(newSession ?? null);
      
      // Handle successful sign in - persist session to AsyncStorage
      if (event === 'SIGNED_IN' && newSession) {
        console.log('✅ User signed in:', newSession.user?.email);
        try {
          await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
          console.log('💾 Session persisted to storage');
        } catch (error) {
          console.error('Failed to persist session:', error);
        }
      }
      
      // Handle token refresh - update stored session
      if (event === 'TOKEN_REFRESHED' && newSession) {
        console.log('🔄 Token refreshed');
        try {
          await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
          console.log('💾 Refreshed session persisted to storage');
        } catch (error) {
          console.error('Failed to persist refreshed session:', error);
        }
      }
      
      // Handle sign out - clear stored session
      if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out');
        try {
          await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
          await AsyncStorage.removeItem(SELECTED_EVENT_STORAGE_KEY);
          console.log('🗑️ Cleared stored session and event selection');
        } catch (error) {
          console.error('Failed to clear stored session:', error);
        }
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
        
        // Try to restore previously selected event from storage
        const storedEventId = await AsyncStorage.getItem(SELECTED_EVENT_STORAGE_KEY);
        
        if (accessible.length > 0) {
          // If we have a stored event and it's still accessible, use it
          if (storedEventId && accessible.some(e => e.eventId === storedEventId)) {
            console.log('📦 Restored selected event from storage:', storedEventId);
            setSelectedEventId(storedEventId);
          } else {
            // Otherwise, select the first event
            setSelectedEventId((current) => current ?? accessible[0].eventId);
          }
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

  // Persist selected event to AsyncStorage whenever it changes
  useEffect(() => {
    if (selectedEventId) {
      AsyncStorage.setItem(SELECTED_EVENT_STORAGE_KEY, selectedEventId)
        .then(() => console.log('💾 Selected event persisted:', selectedEventId))
        .catch((error) => console.error('Failed to persist selected event:', error));
    }
  }, [selectedEventId]);

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
    refreshEvents: async () => {
      try {
        const accessible = await fetchAccessibleEvents();
        setEvents(accessible);
        // Preserve current selection if still valid; otherwise pick the first
        if (selectedEventId && accessible.some(e => e.eventId === selectedEventId)) {
          // keep
        } else if (accessible.length > 0) {
          setSelectedEventId(accessible[0].eventId);
        } else {
          setSelectedEventId(null);
        }
      } catch (err) {
        console.warn('refreshEvents failed:', err);
      }
    },
    signIn: async () => {
      await launchMagicLinkSignIn();
    },
    signOut: async () => {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error('Sign out error:', error);
      }
      // Explicitly clear state regardless of signOut result
      // The onAuthStateChange listener should also fire, but this ensures immediate UI update
      setSession(null);
      setEvents([]);
      setSelectedEventId(null);
    }
  }), [events, loading, selectedEvent, selectedEventId, session, supabase]);

  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>;
};

export const useSupabaseContext = (): SupabaseContextValue => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabaseContext must be used within a SupabaseProvider');
  }
  return context;
};
