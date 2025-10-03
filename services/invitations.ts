import { getSupabaseClient } from './supabase';
import type { EventRole } from './permissions';

export type InviteUserData = {
  email: string;
  role: EventRole;
  message?: string;
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
        role 
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
