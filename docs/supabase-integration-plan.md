# Supabase Integration Plan

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
- `SupabaseContext` exposes `signIn` / `signOut` placeholders today; the sign-in implementation will later invoke Supabase email or magic link flows, then refresh the accessible events list.
- Role-aware hooks can read `selectedEvent.role` (returned from `get_my_access`) to toggle admin-only UI and guard bulk actions. Screen-level checks call lightweight helpers exported from the services directory (e.g., `canManageAttendees(role)` once implemented).
- Future user-role-specific RPCs (invites, event management) will live under `services/organizations.ts` or similar modules keeping parity with the schema tables.

## Real-time Strategy
- Continue using Supabase realtime channels via `supabase.channel(...).on('postgres_changes', ...)` within domain services. Each service exposes `subscribeX` helpers that return an unsubscribe function; screens own subscription lifecycle.
- For attendee updates, debounce UI writes inside the screen if necessary, but keep change-shaping (mapping payloads, translating enums) in the service so every subscriber receives consistent models.
- Additional channel helpers for invites/events can follow the same pattern with channel names prefixed by the table and scoped identifiers (e.g., `events-${orgId}`).

## Testing & Documentation
- Co-locate integration tests under `tests/playwright` once flows exist, stubbing Supabase via the proxy.
- Update `CHECKIN_APP_DOCUMENTATION.md` whenever attendee life-cycle behaviour changes, especially if new roles or RLS-driven state transitions are introduced.
