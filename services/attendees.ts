import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { getSupabaseClient } from './supabase';

export type AttendeeStatus = 'pending' | 'checked-in';

export type Attendee = {
  id: string;
  attendeeName: string;
  groupName: string;
  tableNumber: string;
  ticketType: string;
  status: AttendeeStatus;
  checkedInAt?: string | null;
};

type AttendeeRecord = {
  id: string | number;
  attendee_name: string | null;
  group_name: string | null;
  table_number: string | null;
  ticket_type: string | null;
  status: AttendeeStatus | null;
  checked_in_at: string | null;
};

export type AttendeeChange = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  attendee: Attendee | null;
  payload: RealtimePostgresChangesPayload<AttendeeRecord>;
};

const mapRecordToAttendee = (record: AttendeeRecord | null): Attendee | null => {
  if (!record) return null;

  return {
    id: String(record.id),
    attendeeName: record.attendee_name ?? 'Unnamed Guest',
    groupName: record.group_name ?? '—',
    tableNumber: record.table_number ?? '—',
    ticketType: record.ticket_type ?? '—',
    status: record.status ?? 'pending',
    checkedInAt: record.checked_in_at
  };
};

export const fetchAttendees = async (): Promise<Attendee[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('attendees')
    .select(
      'id, attendee_name, group_name, table_number, ticket_type, status, checked_in_at'
    )
    .order('attendee_name');

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((record) => mapRecordToAttendee(record as AttendeeRecord))
    .filter((attendee): attendee is Attendee => attendee !== null);
};

export const subscribeAttendees = (
  onChange: (change: AttendeeChange) => void
) => {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel('attendees-changes')
    .on<AttendeeRecord>(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'attendees' },
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
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const toggleCheckin = async (
  attendeeId: string,
  checkedIn: boolean
): Promise<void> => {
  const supabase = getSupabaseClient();
  const nextStatus: AttendeeStatus = checkedIn ? 'checked-in' : 'pending';
  const { error } = await supabase
    .from('attendees')
    .update({
      status: nextStatus,
      checked_in_at: checkedIn ? new Date().toISOString() : null
    })
    .eq('id', attendeeId);

  if (error) {
    throw error;
  }
};

export const resetAllCheckins = async (): Promise<void> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('attendees')
    .update({ status: 'pending', checked_in_at: null })
    .neq('status', 'pending');

  if (error) {
    console.error('resetAllCheckins failed', error);
    throw error;
  }
};

export const importAttendeesFromFile = async (fileUri: string): Promise<void> => {
  // TODO: Wire up CSV/XLSX import using Expo file system + Supabase upsert.
  console.info(`importAttendeesFromFile stub invoked for file=${fileUri}`);
};

export const syncFromGoogleSheet = async (sheetUrl: string): Promise<void> => {
  // TODO: Feed Google Sheet CSV through proxy and update Supabase.
  console.info(`syncFromGoogleSheet stub invoked for url=${sheetUrl}`);
};
