import { getSupabaseClient } from './supabase';
import type { EventRole } from './permissions';
import * as Linking from "expo-linking";

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
  if (__DEV__) {
    const redirectTo = Linking.createURL("/auth/callback");
    console.log("🔗 Using dynamic redirectTo:", redirectTo);
    return redirectTo;
  }
  return 'https://your-app-domain.com/auth/callback';
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
    console.error('Error fetching accessible events:', { 
      eventId, 
      userId, 
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
    console.error('Event not accessible to current user:', { eventId, userId });
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
    console.log('Sending invite with redirectTo:', redirectTo);

    // Call the Edge Function
    const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/invite_user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
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
      console.error('Edge Function error:', data);
      throw new Error(data.error || 'Failed to invite user');
    }

    console.log('Successfully sent invitation to:', email);
    console.log('Edge Function response:', data);
    
  } catch (error) {
    console.error('Invite user error:', error);
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
    console.log('Resending invite with redirectTo:', redirectTo);

    // Call the Edge Function with resend flag
    const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/invite_user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
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
      console.error('Edge Function error (resend):', data);
      throw new Error(data.error || 'Failed to resend invitation');
    }

    console.log('Successfully resent invitation to:', email);
    
  } catch (error) {
    console.error('Resend invitation error:', error);
    throw error;
  }
};
