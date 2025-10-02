# Supabase Integration Plan

## ✅ COMPLETED FEATURES

### Authentication & Session Management
- **Magic Link Authentication** – Implemented email-based magic link sign-in with deep linking support
- **Session Persistence** – Automatic session restoration and auth state management
- **Deep Link Handling** – Support for `expo-checkin://auth/callback` URL scheme

### Role-Based Access Control
- **Comprehensive Permission System** – Granular role checks for all operations
- **Role Hierarchy** – Owner > Admin > Manager > Checker > Member with proper inheritance
- **Permission Hooks** – `usePermissions()` hook for easy component integration
- **UI Guards** – Role-based UI elements and access restrictions

### Real-Time Subscriptions
- **Robust Connection Management** – Automatic reconnection with exponential backoff
- **Multi-Device Sync** – Real-time attendee updates across all connected devices
- **Connection Monitoring** – Status indicators and error handling
- **Channel Management** – Proper cleanup and subscription lifecycle

### Roster Import System
- **CSV File Import** – File picker with configurable column mapping
- **Google Sheets Integration** – Direct URL import with CSV conversion
- **Bulk Operations** – Efficient Supabase upsert with error reporting
- **Import Validation** – File format validation and error feedback

### Admin Onboarding Flow
- **Event Creation** – Complete event setup with organization management
- **User Invitations** – Role-based invitation system with email notifications
- **Onboarding UI** – Guided workflows for new event setup

## Layered Structure
- **Client bootstrap (`services/supabase.ts`)** – Owns the singleton Supabase client, session persistence config, and exposure of low-level helpers (e.g., typed rest fetchers, RPC wrappers). Keep this file focused on client construction and cross-cutting utilities (storage adapters, auth interceptors).
- **Domain services (`services/*.ts`)** – Group fetch/mutation logic by domain (events, attendees, invites, admin tools). Each module exports typed helpers plus optional subscription factories that encapsulate filters and channel naming. These modules are the only callers of Supabase queries outside of the auth context.
- **Context provider (`contexts/SupabaseContext.tsx`)** – Centralises auth/session state, exposes the seeded Supabase client, accessible events, current selection, and auth actions. This provider is mounted once in `app/_layout.tsx` so every screen can read the same session + event scope.
- **Hooks (`hooks/useSupabase.ts`)** – Thin wrappers around the context to keep imports terse inside components. Additional hooks (e.g., `useAttendees`, `useEventRoles`) can compose the domain services with screen-specific state when needed.

## Data Flow
1. The provider initialises `supabase.auth.getSession()` on mount to hydrate the session and listen for changes.
2. When a session exists, `services/events.ts` runs the `get_my_access` RPC to load org+event metadata permitted by row-level security. Results hydrate the context and establish the default `selectedEvent`.
3. Screens request data through domain services. For example, the check-in screen calls `fetchAttendees(selectedEvent.eventId)` which internally scopes the query to that event ID.
4. Real-time listeners such as `subscribeAttendees(eventId, handler)` are created inside the screen layer but fully encapsulated in the service module so all RLS filters and channel names live alongside the fetch logic.
5. Mutations (`toggleCheckin`, bulk actions) stay inside the attendee service so they can call the SECURITY DEFINER RPCs and handle Supabase errors consistently.

## Authentication + Roles
- ✅ **Implemented**: `SupabaseContext` exposes `signIn` / `signOut` with magic link authentication and deep linking support
- ✅ **Implemented**: Role-aware hooks (`usePermissions`) read `selectedEvent.role` to toggle admin-only UI and guard bulk actions
- ✅ **Implemented**: Comprehensive permission helpers (`canManageAttendees`, `canInviteUsers`, etc.) with role hierarchy
- ✅ **Implemented**: User-role-specific RPCs for invites and event management in `services/eventManagement.ts`

## Real-time Strategy
- ✅ **Implemented**: Enhanced Supabase realtime channels via `RealtimeManager` class with automatic reconnection and error handling
- ✅ **Implemented**: Robust subscription lifecycle management with proper cleanup and status monitoring
- ✅ **Implemented**: Consistent change-shaping in services with proper payload mapping and error handling
- ✅ **Implemented**: Multi-channel support for attendees and events with scoped identifiers (`attendees-${eventId}`, `events-${orgId}`)

## Testing & Documentation
- ✅ **Updated**: Integration plan documentation reflects all implemented features
- 🔄 **Next**: Co-locate integration tests under `tests/playwright` once flows exist, stubbing Supabase via the proxy
- 🔄 **Next**: Update `CHECKIN_APP_DOCUMENTATION.md` with new features and user workflows

## New Service Architecture

### Core Services
- **`services/supabase.ts`** – Supabase client singleton with auth configuration
- **`services/auth.ts`** – Magic link authentication and deep link handling
- **`services/permissions.ts`** – Role-based access control and permission helpers
- **`services/realtime.ts`** – Enhanced real-time subscription management
- **`services/eventManagement.ts`** – Event creation, user invitations, and role management
- **`services/rosterImport.ts`** – CSV and Google Sheets import functionality

### UI Components
- **`components/RosterImportModal.tsx`** – File picker and Google Sheets import UI
- **`components/CreateEventModal.tsx`** – Event creation with organization setup
- **`components/InviteUserModal.tsx`** – User invitation with role selection

### Hooks
- **`hooks/useSupabase.ts`** – Supabase context wrapper
- **`hooks/usePermissions.ts`** – Role-based permission checks
- **`hooks/useRealtime.ts`** – Real-time connection status monitoring

## Implementation Status: ✅ COMPLETE

All major features have been implemented and are ready for testing and deployment. The app now supports:
- Full authentication flow with magic links
- Comprehensive role-based access control
- Real-time multi-device synchronization
- Roster import from CSV and Google Sheets
- Complete admin onboarding workflow
