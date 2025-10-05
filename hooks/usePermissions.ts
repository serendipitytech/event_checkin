/**
 * Lintnotes
 * - Purpose: Derive permission booleans and role utilities for the current event from the Supabase context.
 * - Exports: usePermissions (hook), useRoleGuard (hook)
 * - Major deps: React useMemo, services/permissions, hooks/useSupabase
 * - Side effects: None (hook only computes values).
 */
import { useMemo } from 'react';
import { useSupabase } from './useSupabase';
import {
  canManageAttendees,
  canToggleCheckins,
  canManageEvents,
  canViewAttendees,
  canEditAttendees,
  canInviteUsers,
  canDeleteEvents,
  canCreateEvents,
  canManageOrganization,
  canManageRole,
  getAvailableRoles,
  normalizeRole,
  describeRole,
  type EventRole,
} from '../services/permissions';

export const usePermissions = () => {
  const { selectedEvent } = useSupabase();
  const currentRole = normalizeRole(selectedEvent?.role);

  const permissions = useMemo(() => ({
    // Basic permissions
    canViewAttendees: canViewAttendees(currentRole),
    canEditAttendees: canEditAttendees(currentRole),
    canManageAttendees: canManageAttendees(currentRole),
    canToggleCheckins: canToggleCheckins(currentRole),
    canManageEvents: canManageEvents(currentRole),
    
    // Advanced permissions
    canInviteUsers: canInviteUsers(currentRole),
    canDeleteEvents: canDeleteEvents(currentRole),
    canCreateEvents: canCreateEvents(currentRole),
    canManageOrganization: canManageOrganization(currentRole),
    
    // Role management
    canManageRole: (targetRole: EventRole) => canManageRole(currentRole, targetRole),
    getAvailableRoles: () => getAvailableRoles(currentRole),
    
    // Utility functions
    describeRole: () => describeRole(currentRole),
    currentRole,
  }), [currentRole]);

  return permissions;
};

export const useRoleGuard = (requiredPermission: (role: EventRole) => boolean) => {
  const { currentRole } = usePermissions();
  return useMemo(() => requiredPermission(currentRole), [currentRole, requiredPermission]);
};
