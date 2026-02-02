/**
 * Lintnotes
 * - Purpose: CRUD-style helpers and realtime wiring for event attendees, plus bulk operations.
 * - Exports: Attendee (type), AttendeeChange (type), fetchAttendees, subscribeAttendees, toggleCheckin,
 *            resetAllCheckins, bulkCheckInByGroup, bulkCheckInByTable,
 *            importAttendeesFromFile, syncFromGoogleSheet.
 * - Major deps: @supabase/supabase-js, services/supabase, services/realtime
 * - Side effects: Opens realtime subscription when subscribeAttendees is called; otherwise pure RPC/queries.
 */
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

import { getSupabaseClient } from './supabase';
import { subscribeToAttendees as subscribeToAttendeesRealtime } from './realtime';
import { queueCheckIn, hasPendingCheckIn } from './offlineQueue';

// Storage key prefix for cached attendees
const ATTENDEES_CACHE_PREFIX = '@checkin_attendees_';

export type Attendee = {
  id: string;
  eventId: string;
  attendeeName: string;
  groupName: string;
  tableNumber: string;
  ticketType: string;
  notes?: string | null;
  checkedIn: boolean;
  checkedInAt?: string | null;
  checkedInBy?: string | null;
  updatedAt?: string | null;
};

type AttendeeRecord = {
  id: string | number;
  event_id: string | null;
  full_name: string | null;
  group_name: string | null;
  table_number: string | null;
  ticket_type: string | null;
  notes: string | null;
  checked_in: boolean | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  updated_at: string | null;
};

export type AttendeeChange = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  attendee: Attendee | null;
  payload: RealtimePostgresChangesPayload<AttendeeRecord>;
};

const mapRecordToAttendee = (record: AttendeeRecord | null): Attendee | null => {
  if (!record || !record.event_id) return null;

  const checkedIn = Boolean(record.checked_in);
  const fullName = record.full_name?.trim();
  const groupName = record.group_name?.trim();
  const tableNumber = record.table_number?.trim();
  const ticketType = record.ticket_type?.trim();

  return {
    id: String(record.id),
    eventId: String(record.event_id),
    attendeeName: fullName && fullName.length > 0 ? fullName : 'Unnamed Guest',
    groupName: groupName ?? '',
    tableNumber: tableNumber ?? '',
    ticketType: ticketType ?? '',
    notes: record.notes,
    checkedIn,
    checkedInAt: record.checked_in_at,
    checkedInBy: record.checked_in_by,
    updatedAt: record.updated_at
  };
};

/**
 * Save attendees to AsyncStorage cache
 */
const saveAttendeesToCache = async (eventId: string, attendees: Attendee[]): Promise<void> => {
  try {
    const cacheKey = `${ATTENDEES_CACHE_PREFIX}${eventId}`;
    await AsyncStorage.setItem(cacheKey, JSON.stringify(attendees));
    console.log('💾 Cached attendees for event:', eventId, `(${attendees.length} attendees)`);
  } catch (error) {
    console.error('Failed to cache attendees:', error);
    // Don't throw - caching is optional
  }
};

/**
 * Load attendees from AsyncStorage cache
 */
const loadAttendeesFromCache = async (eventId: string): Promise<Attendee[] | null> => {
  try {
    const cacheKey = `${ATTENDEES_CACHE_PREFIX}${eventId}`;
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const attendees = JSON.parse(cached) as Attendee[];
      console.log('📦 Restored attendees from cache for event:', eventId, `(${attendees.length} attendees)`);
      return attendees;
    }
    return null;
  } catch (error) {
    console.error('Failed to load attendees from cache:', error);
    return null;
  }
};

export const fetchAttendees = async (eventId: string, useCache: boolean = true): Promise<Attendee[]> => {
  const supabase = getSupabaseClient();
  
  // Check network connectivity
  const networkState = await Network.getNetworkStateAsync();
  const isOnline = networkState.isConnected && networkState.isInternetReachable;

  // If offline and cache is allowed, try to load from cache
  if (!isOnline && useCache) {
    console.log('📴 Offline detected, loading from cache');
    const cached = await loadAttendeesFromCache(eventId);
    if (cached) {
      return cached;
    }
    console.warn('⚠️ No cache available for offline use');
    throw new Error('Unable to load attendees while offline');
  }

  // Online - fetch from Supabase
  const { data, error } = await supabase
    .from('attendees')
    .select('*')
    .eq('event_id', eventId)
    .order('full_name');

  if (error) {
    console.error('fetchAttendees failed:', JSON.stringify(error, null, 2));
    
    // If fetch fails and we have cache, use it as fallback
    if (useCache) {
      console.log('⚠️ Fetch failed, attempting to load from cache');
      const cached = await loadAttendeesFromCache(eventId);
      if (cached) {
        console.log('✅ Using cached data as fallback');
        return cached;
      }
    }
    
    throw error;
  }

  const attendees = (data ?? [])
    .map((record) => mapRecordToAttendee(record as AttendeeRecord))
    .filter((attendee): attendee is Attendee => attendee !== null);

  // Save to cache for offline use
  if (useCache) {
    await saveAttendeesToCache(eventId, attendees);
  }

  return attendees;
};

/**
 * Sync attendees cache after successful update
 */
export const syncAttendeesCache = async (eventId: string, attendees: Attendee[]): Promise<void> => {
  await saveAttendeesToCache(eventId, attendees);
  console.log('🔁 Synced cached attendees after update');
};

export const subscribeAttendees = (
  eventId: string,
  onChange: (change: AttendeeChange) => void,
  onReconnected?: () => void
) => {
  return subscribeToAttendeesRealtime(
    {
      eventId,
      onError: (error) => {
        console.error('Real-time attendee subscription error:', error);
      },
      onStatusChange: (status) => {
        console.log('Real-time attendee subscription status:', status);
      },
      onReconnected: () => {
        console.log('🔄 Realtime reconnected, refreshing attendee data');
        onReconnected?.();
      },
      reconnectAttempts: 5,
      reconnectDelay: 2000,
    },
    (payload) => {
      const attendee = mapRecordToAttendee(
        (payload.eventType === 'DELETE' ? payload.old : payload.new) as
          | AttendeeRecord
          | null
      );

      onChange({
        type: payload.eventType,
        attendee,
        payload: payload as RealtimePostgresChangesPayload<AttendeeRecord>
      });
    }
  );
};

export type ToggleCheckinResult = {
  success: boolean;
  queued: boolean;
  error?: string;
};

export const toggleCheckin = async (
  attendeeId: string,
  checkedIn: boolean,
  eventId?: string
): Promise<ToggleCheckinResult> => {
  // Check network connectivity
  const networkState = await Network.getNetworkStateAsync();
  const isOnline = networkState.isConnected && networkState.isInternetReachable;

  // If offline and we have an eventId, queue the operation
  if (!isOnline && eventId) {
    console.log(`📴 Offline: queuing check-in for attendee ${attendeeId}`);
    const result = await queueCheckIn(attendeeId, eventId, checkedIn);

    if (result.success) {
      return { success: true, queued: true };
    } else {
      return { success: false, queued: false, error: result.error };
    }
  }

  // Online - perform the check-in directly
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('toggle_checkin', {
    p_attendee_id: attendeeId,
    p_checked: checkedIn
  });

  if (error) {
    // If online request fails, try to queue if we have eventId
    if (eventId) {
      console.log(`⚠️ Online check-in failed, queuing for retry: ${error.message}`);
      const queueResult = await queueCheckIn(attendeeId, eventId, checkedIn);
      if (queueResult.success) {
        return { success: true, queued: true };
      }
    }

    return { success: false, queued: false, error: error.message };
  }

  return { success: true, queued: false };
};

/**
 * Check if an attendee has a pending offline check-in
 */
export const getAttendeeOfflineStatus = async (
  attendeeId: string,
  eventId: string
): Promise<{ pending: boolean; checkedIn?: boolean }> => {
  return hasPendingCheckIn(attendeeId, eventId);
};

export const resetAllCheckins = async (eventId: string): Promise<void> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('reset_attendees', { p_event_id: eventId });

  if (error) {
    console.error('resetAllCheckins failed:', JSON.stringify(error, null, 2));
    throw error;
  }
};

export const bulkCheckInByGroup = async (
  eventId: string,
  groupName: string,
  checkedIn: boolean
): Promise<number> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('bulk_checkin_by_group', {
    p_event_id: eventId,
    p_group: groupName,
    p_checked: checkedIn
  });

  if (error) {
    throw error;
  }

  return (data as number) ?? 0;
};

export const bulkCheckInByTable = async (
  eventId: string,
  tableNumber: string,
  checkedIn: boolean
): Promise<number> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('bulk_checkin_by_table', {
    p_event_id: eventId,
    p_table: tableNumber,
    p_checked: checkedIn
  });

  if (error) {
    throw error;
  }

  return (data as number) ?? 0;
};

export const importAttendeesFromFile = async (
  fileUri: string, 
  eventId: string,
  options?: { skipFirstRow?: boolean; columnMapping?: any }
): Promise<{ success: boolean; imported: number; errors: string[]; skipped: number }> => {
  const { importAttendeesFromCSV } = await import('./rosterImport');
  return importAttendeesFromCSV(fileUri, { eventId, ...options });
};

export const syncFromGoogleSheet = async (
  sheetUrl: string, 
  eventId: string,
  options?: { skipFirstRow?: boolean; columnMapping?: any }
): Promise<{ success: boolean; imported: number; errors: string[]; skipped: number }> => {
  const { importAttendeesFromGoogleSheet } = await import('./rosterImport');
  return importAttendeesFromGoogleSheet(sheetUrl, { eventId, ...options });
};
