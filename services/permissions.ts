/**
 * Lintnotes
 * - Purpose: Small role/permission helpers to gate UI and actions by event role.
 * - Exports: EventRole (type) and a set of canX()/describeRole()/normalizeRole utilities.
 * - Major deps: None (pure functions).
 * - Side effects: None (stateless).
 */
export type EventRole =
  | 'manager'
  | 'checker'
  | null
  | undefined;

const KNOWN_ROLES = new Set(['manager', 'checker']);
const ADMIN_ROLES = new Set(['manager']);
const CHECKIN_ROLES = new Set(['manager', 'checker']);

export const normalizeRole = (role: string | null | undefined): EventRole => {
  if (!role || !KNOWN_ROLES.has(role)) {
    return null;
  }
  return role as EventRole;
};

export const canManageAttendees = (role: EventRole): boolean => {
  if (!role) return false;
  return ADMIN_ROLES.has(role);
};

export const canToggleCheckins = (role: EventRole): boolean => {
  if (!role) return false;
  return CHECKIN_ROLES.has(role);
};

export const canManageEvents = (role: EventRole): boolean => {
  if (!role) return false;
  return role === 'manager';
};

export const describeRole = (role: EventRole): string => {
  if (!role) return 'No assigned role';
  switch (role) {
    case 'manager':
      return 'Event manager';
    case 'checker':
      return 'Event checker';
    default:
      return role;
  }
};

export const canViewAttendees = (role: EventRole): boolean => {
  if (!role) return false;
  return CHECKIN_ROLES.has(role);
};

export const canEditAttendees = (role: EventRole): boolean => {
  if (!role) return false;
  return ADMIN_ROLES.has(role);
};

export const canInviteUsers = (role: EventRole): boolean => {
  if (!role) return false;
  return role === 'manager';
};

export const canDeleteEvents = (role: EventRole): boolean => {
  if (!role) return false;
  return role === 'manager';
};

export const canCreateEvents = (role: EventRole): boolean => {
  if (!role) return false;
  return role === 'manager';
};

export const canManageOrganization = (role: EventRole): boolean => {
  if (!role) return false;
  return role === 'manager';
};

export const getRoleHierarchy = (role: EventRole): number => {
  if (!role) return 0;
  switch (role) {
    case 'manager': return 2;
    case 'checker': return 1;
    default: return 0;
  }
};

export const canManageRole = (managerRole: EventRole, targetRole: EventRole): boolean => {
  if (!managerRole || !targetRole) return false;
  return getRoleHierarchy(managerRole) > getRoleHierarchy(targetRole);
};

export const getAvailableRoles = (currentRole: EventRole): EventRole[] => {
  if (!currentRole) return [];
  
  // Simplified role options: only manager and checker
  const roleOptions: EventRole[] = ['manager', 'checker'];
  
  return roleOptions;
};

// TODO: Extend these helpers when dedicated Supabase policies for read/write nuances land.
