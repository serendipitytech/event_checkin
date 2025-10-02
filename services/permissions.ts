export type EventRole =
  | 'owner'
  | 'admin'
  | 'member'
  | 'manager'
  | 'checker'
  | null
  | undefined;

const KNOWN_ROLES = new Set(['owner', 'admin', 'member', 'manager', 'checker']);
const ADMIN_ROLES = new Set(['owner', 'admin', 'manager']);
const CHECKIN_ROLES = new Set(['owner', 'admin', 'manager', 'checker']);

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
  return role === 'owner' || role === 'admin';
};

export const describeRole = (role: EventRole): string => {
  if (!role) return 'No assigned role';
  switch (role) {
    case 'owner':
      return 'Organization owner';
    case 'admin':
      return 'Organization admin';
    case 'member':
      return 'Organization member';
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
  return role === 'owner' || role === 'admin';
};

export const canDeleteEvents = (role: EventRole): boolean => {
  if (!role) return false;
  return role === 'owner';
};

export const canCreateEvents = (role: EventRole): boolean => {
  if (!role) return false;
  return role === 'owner' || role === 'admin';
};

export const canManageOrganization = (role: EventRole): boolean => {
  if (!role) return false;
  return role === 'owner';
};

export const getRoleHierarchy = (role: EventRole): number => {
  if (!role) return 0;
  switch (role) {
    case 'owner': return 5;
    case 'admin': return 4;
    case 'manager': return 3;
    case 'checker': return 2;
    case 'member': return 1;
    default: return 0;
  }
};

export const canManageRole = (managerRole: EventRole, targetRole: EventRole): boolean => {
  if (!managerRole || !targetRole) return false;
  return getRoleHierarchy(managerRole) > getRoleHierarchy(targetRole);
};

export const getAvailableRoles = (currentRole: EventRole): EventRole[] => {
  if (!currentRole) return [];
  
  const hierarchy = getRoleHierarchy(currentRole);
  const allRoles: EventRole[] = ['owner', 'admin', 'manager', 'checker', 'member'];
  
  return allRoles.filter(role => {
    const roleHierarchy = getRoleHierarchy(role);
    return roleHierarchy < hierarchy && roleHierarchy > 0;
  });
};

// TODO: Extend these helpers when dedicated Supabase policies for read/write nuances land.
