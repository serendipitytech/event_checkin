/**
 * Lintnotes
 * - Purpose: Send and resend event invitations via a Supabase Edge Function; validates access using an RLS-safe query.
 * - Exports: InviteUserData (type), inviteUserToEvent, resendInvitation
 * - Major deps: services/supabase, expo-linking/Constants (for redirect), fetch to Edge Function endpoint
 * - Side effects: Network requests to Supabase functions; logs diagnostic info.
 */
import { getSupabaseClient } from './supabase';
import type { EventRole } from './permissions';
import * as Linking from "expo-linking";
import Constants from 'expo-constants';
import { logger } from '../utils/logger';

export type InviteUserData = {
  email: string;
  role: EventRole;
  message?: string;
};

/**
 * Helper function to get the appropriate redirect URL based on environment
 * Development: Uses dynamic Expo tunnel URL from Linking.createURL
 * Production: Uses HTTPS domain for deployed app
 */
function getRedirectTo(): string {
  const redirectTo = process.env.EXPO_PUBLIC_REDIRECT_URL;
  if (!redirectTo) {
    throw new Error('EXPO_PUBLIC_REDIRECT_URL is not configured. Cannot send invitation.');
  }

  logger.debug('Execution Environment:', Constants.executionEnvironment);
  logger.debug('Using redirectTo:', redirectTo);
  return redirectTo;
}

type AccessibleEvent = {
  eventId: string;
  eventName: string;
  orgId: string;
  orgName: string;
  role: string | null;
};

/**
 * Helper function to fetch an accessible event with proper RLS enforcement
 * Uses the get_my_access RPC function to respect row-level security
 */
const fetchAccessibleEvent = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  eventId: string,
  userId: string
): Promise<AccessibleEvent> => {
  const { data, error } = await supabase.rpc('get_my_access');

  if (error) {
    logger.error('Error fetching accessible events:', {
      eventId,
      error: error.message,
      details: error.details
    });
    throw new Error('Failed to fetch accessible events');
  }

  const rows = (data ?? []) as Array<{
    org_id: string | null;
    org_name: string | null;
    event_id: string | null;
    event_name: string | null;
    role: string | null;
  }>;

  // Find the specific event
  const eventRow = rows.find(row => row.event_id === eventId);

  if (!eventRow) {
    logger.error('Event not accessible to current user:', { eventId });
    throw new Error('Event not accessible to current user');
  }

  return {
    eventId: String(eventRow.event_id),
    eventName: eventRow.event_name ?? 'Untitled Event',
    orgId: eventRow.org_id ? String(eventRow.org_id) : '',
    orgName: eventRow.org_name ?? 'Unnamed Org',
    role: eventRow.role
  };
};

export const inviteUserToEvent = async (
  eventId: string,
  email: string,
  role: EventRole
): Promise<void> => {
  const supabase = getSupabaseClient();
  
  try {
    // Get the current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('You must be signed in to invite users');
    }

    // Get event details using RLS-compliant helper
    const eventData = await fetchAccessibleEvent(supabase, eventId, session.user.id);

    // Get the appropriate redirect URL for the environment
    const redirectTo = getRedirectTo();
    logger.debug('Sending invite with redirectTo:', redirectTo);

    // Validate environment variables before making the request
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are not configured');
    }

    // Call the Edge Function
    const response = await fetch(`${supabaseUrl}/functions/v1/invite_user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify({
        eventId,
        email: email.trim(),
        role,
        orgId: eventData.orgId,
        orgName: eventData.orgName,
        redirectTo
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      logger.error('Edge Function error:', data);
      throw new Error(data.error || 'Failed to invite user');
    }

    // Check if user was successfully added to the event
    if (data.eventMembershipCreated) {
      logger.info(`User added to event ${data.eventId} as ${data.role}`);
    } else {
      logger.error('Failed to assign user to event');
      throw new Error('Failed to assign user to event');
    }

    logger.info('Successfully sent invitation');
    logger.debug('Edge Function response:', data);

  } catch (error) {
    logger.error('Invite user error:', error);
    throw error;
  }
};

export const resendInvitation = async (
  eventId: string,
  email: string
): Promise<void> => {
  const supabase = getSupabaseClient();
  
  try {
    // Get the current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('You must be signed in to resend invitations');
    }

    // Get event details using RLS-compliant helper
    const eventData = await fetchAccessibleEvent(supabase, eventId, session.user.id);

    // Get the appropriate redirect URL for the environment
    const redirectTo = getRedirectTo();
    logger.debug('Resending invite with redirectTo:', redirectTo);

    // Validate environment variables before making the request
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are not configured');
    }

    // Call the Edge Function with resend flag
    const response = await fetch(`${supabaseUrl}/functions/v1/invite_user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify({
        eventId,
        email: email.trim(),
        role: 'checker', // Default role for resend
        orgId: eventData.orgId,
        orgName: eventData.orgName,
        redirectTo,
        resend: true
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      logger.error('Edge Function error (resend):', data);
      throw new Error(data.error || 'Failed to resend invitation');
    }

    // Check if user was successfully added to the event
    if (data.eventMembershipCreated) {
      logger.info(`User added to event ${data.eventId} as ${data.role}`);
    } else {
      logger.error('Failed to assign user to event');
      throw new Error('Failed to assign user to event');
    }

    logger.info('Successfully resent invitation');

  } catch (error) {
    logger.error('Resend invitation error:', error);
    throw error;
  }
};
