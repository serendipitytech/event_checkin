/**
 * Lintnotes
 * - Purpose: Higher-level event management operations (create/delete events, manage invites/roles) via Supabase RPCs.
 * - Exports: EventInvite, CreateEventData, InviteUserData (types), createEvent, deleteEvent,
 *            inviteUserToEvent, updateUserRole, removeUserFromEvent, fetchEventInvites,
 *            acceptEventInvite, declineEventInvite.
 * - Major deps: services/supabase, services/permissions
 * - Side effects: Performs database mutations through RPC calls; no module-level state.
 */
import { getSupabaseClient } from './supabase';
import { canCreateEvents, canDeleteEvents, canInviteUsers, canManageRole, type EventRole } from './permissions';

export type EventInvite = {
  id: string;
  eventId: string;
  email: string;
  role: EventRole;
  invitedBy: string;
  invitedAt: string;
  acceptedAt?: string | null;
  status: 'pending' | 'accepted' | 'declined';
};

export type CreateEventData = {
  eventName: string;
  orgName: string;
  description?: string;
  eventDate?: string;
  location?: string;
};

export type InviteUserData = {
  email: string;
  role: EventRole;
  message?: string;
};

export const createEvent = async (
  userRole: EventRole,
  eventData: CreateEventData
): Promise<string> => {
  if (!canCreateEvents(userRole)) {
    throw new Error('You do not have permission to create events');
  }

  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase.rpc('create_event_with_org', {
    p_event_name: eventData.eventName,
    p_org_name: eventData.orgName,
    p_description: eventData.description || null,
    p_event_date: eventData.eventDate || null,
    p_location: eventData.location || null,
  });

  if (error) {
    throw error;
  }

  return data as string;
};

export const deleteEvent = async (
  userRole: EventRole,
  eventId: string
): Promise<void> => {
  if (!canDeleteEvents(userRole)) {
    throw new Error('You do not have permission to delete events');
  }

  const supabase = getSupabaseClient();
  
  const { error } = await supabase.rpc('delete_event', {
    p_event_id: eventId,
  });

  if (error) {
    throw error;
  }
};

export const inviteUserToEvent = async (
  userRole: EventRole,
  eventId: string,
  inviteData: InviteUserData
): Promise<void> => {
  if (!canInviteUsers(userRole)) {
    throw new Error('You do not have permission to invite users');
  }

  const supabase = getSupabaseClient();
  
  const { error } = await supabase.rpc('invite_user_to_event', {
    p_event_id: eventId,
    p_email: inviteData.email,
    p_role: inviteData.role,
    p_message: inviteData.message || null,
  });

  if (error) {
    throw error;
  }
};

export const updateUserRole = async (
  managerRole: EventRole,
  eventId: string,
  userId: string,
  newRole: EventRole
): Promise<void> => {
  // Check if the manager can manage the target role
  if (!canManageRole(managerRole, newRole)) {
    throw new Error('You do not have permission to assign this role');
  }

  const supabase = getSupabaseClient();
  
  const { error } = await supabase.rpc('update_user_role', {
    p_event_id: eventId,
    p_user_id: userId,
    p_new_role: newRole,
  });

  if (error) {
    throw error;
  }
};

export const removeUserFromEvent = async (
  managerRole: EventRole,
  eventId: string,
  userId: string
): Promise<void> => {
  // Only owners and admins can remove users
  if (managerRole !== 'owner' && managerRole !== 'admin') {
    throw new Error('You do not have permission to remove users');
  }

  const supabase = getSupabaseClient();
  
  const { error } = await supabase.rpc('remove_user_from_event', {
    p_event_id: eventId,
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }
};

export const fetchEventInvites = async (eventId: string): Promise<EventInvite[]> => {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('event_invites')
    .select('*')
    .eq('event_id', eventId)
    .order('invited_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((invite: any) => ({
    id: invite.id,
    eventId: invite.event_id,
    email: invite.email,
    role: invite.role,
    invitedBy: invite.invited_by,
    invitedAt: invite.invited_at,
    acceptedAt: invite.accepted_at,
    status: invite.status,
  }));
};

export const acceptEventInvite = async (inviteId: string): Promise<void> => {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase.rpc('accept_event_invite', {
    p_invite_id: inviteId,
  });

  if (error) {
    throw error;
  }
};

export const declineEventInvite = async (inviteId: string): Promise<void> => {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase.rpc('decline_event_invite', {
    p_invite_id: inviteId,
  });

  if (error) {
    throw error;
  }
};
