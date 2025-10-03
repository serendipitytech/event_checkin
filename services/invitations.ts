import { Alert } from 'react-native';
import * as ExpoLinking from 'expo-linking';
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
    // Step 1: Check if user exists in auth.users via Admin API
    const { data: existingUsers, error: userCheckError } = await supabase.auth.admin.listUsers();
    
    if (userCheckError) {
      console.error('Error checking existing users:', userCheckError);
      throw new Error('Failed to check if user exists. Please try again.');
    }
    
    const existingUser = existingUsers.users.find(user => user.email === email);
    let userId: string;
    
    if (existingUser) {
      // User exists, use their ID
      userId = existingUser.id;
      console.log('User already exists:', email, 'ID:', userId);
    } else {
      // Step 2: Create new user with Admin API
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        email_confirm: false, // They'll confirm via magic link
        user_metadata: {
          invited_to_event: eventId,
          invited_role: role
        }
      });
      
      if (createError) {
        console.error('Error creating user:', createError);
        throw new Error(`Failed to create user account: ${createError.message}`);
      }
      
      if (!newUser.user) {
        throw new Error('Failed to create user account');
      }
      
      userId = newUser.user.id;
      console.log('Created new user:', email, 'ID:', userId);
    }
    
    // Step 3: Insert into event_members table
    const { error: memberError } = await supabase
      .from('event_members')
      .insert({
        event_id: eventId,
        user_id: userId,
        role: role
      });
    
    if (memberError) {
      console.error('Error adding user to event:', memberError);
      // If it's a duplicate key error, that's actually okay
      if (memberError.code === '23505') {
        console.log('User is already a member of this event');
        // Continue to send magic link anyway
      } else {
        throw new Error(`Failed to add user to event: ${memberError.message}`);
      }
    }
    
    // Step 4: Send magic link for sign-in
    const redirectTo = ExpoLinking.createURL('/auth/callback');
    console.log('Sending magic link to:', email, 'with redirect:', redirectTo);
    
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          event_id: eventId,
          role: role
        }
      }
    });
    
    if (otpError) {
      console.error('Error sending magic link:', otpError);
      throw new Error(`Failed to send invitation email: ${otpError.message}`);
    }
    
    console.log('Successfully sent invitation to:', email);
    
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
    const redirectTo = ExpoLinking.createURL('/auth/callback');
    
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          event_id: eventId,
          resend: true
        }
      }
    });
    
    if (error) {
      throw new Error(`Failed to resend invitation: ${error.message}`);
    }
    
  } catch (error) {
    console.error('Resend invitation error:', error);
    throw error;
  }
};
