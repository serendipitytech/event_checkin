/**
 * Lintnotes
 * - Purpose: Fetch the list of events the signed-in user can access, normalized for app consumption.
 * - Exports: EventSummary (type), fetchAccessibleEvents (async)
 * - Major deps: services/supabase client; Supabase RPC get_my_access
 * - Side effects: None (pure data fetch/transform).
 */
import { getSupabaseClient } from './supabase';

export type EventSummary = {
  eventId: string;
  eventName: string;
  orgId: string;
  orgName: string;
  role: string | null;
};

export const fetchAccessibleEvents = async (): Promise<EventSummary[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_my_access');

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<{
    org_id: string | null;
    org_name: string | null;
    event_id: string | null;
    event_name: string | null;
    role: string | null;
  }>;

  const summaries = rows
    .filter((row) => row.event_id)
    .map((row) => ({
      eventId: String(row.event_id),
      eventName: row.event_name ?? 'Untitled Event',
      orgId: row.org_id ? String(row.org_id) : '',
      orgName: row.org_name ?? 'Unnamed Org',
      role: row.role
    }));

  // Deduplicate by eventId (view may return duplicates when user has multiple roles)
  const unique = new Map<string, EventSummary>();
  summaries.forEach((summary) => {
    unique.set(summary.eventId, summary);
  });

  return Array.from(unique.values());
};
