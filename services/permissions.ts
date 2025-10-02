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

// TODO: Extend these helpers when dedicated Supabase policies for read/write nuances land.
