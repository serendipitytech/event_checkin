# ✅ Supabase Integration Checklist (Event Check-in App)

This checklist tracks progress as we migrate from a single-attendee list to a multi-event, role-based Supabase backend.

---

## Phase 1: Database & Schema
- [x] Create `events` table with ownership/admin/member roles  
- [x] Create `attendees` table scoped to events  
- [x] Create `event_members` join table for roles & permissions  
- [ ] Verify RLS policies enforce:
  - Users only see events they belong to  
  - Users only see/edit attendees in their events  
  - Owners/admins can invite new members  

---

## Phase 2: Services & Context
- [x] Add `services/attendees.ts` with mapping from Supabase rows → UI models  
- [x] Add `services/events.ts` for event summaries  
- [x] Add `services/permissions.ts` for role-based checks  
- [x] Add `services/invitations.ts` for user invitation flow
- [x] Add `SupabaseContext.tsx` with session + event + auth placeholders  
- [ ] Wire up **Supabase real-time subscriptions** for attendees  
- [ ] Add **CSV/Excel import stub** using Supabase upsert  

---

## Phase 3: Authentication
- [x] Add `services/auth.ts` with placeholder `launchMagicLinkSignIn()`  
- [x] Implement Supabase magic link sign-in flow in context  
- [x] Add session persistence (remember logged-in user)  
- [x] Add sign-out flow  

---

## Phase 4: UI Updates
- [x] Update `index.tsx` to:
  - Show loading state  
  - Require sign-in before fetching events  
  - Require event selection before loading attendees  
- [x] Update `admin.tsx` with role-based gating for roster imports & sync  
- [x] Add event switcher in Admin tab (EventSelectorModal)
- [x] Add role display ("Your Role: Manager") in Admin tab
- [x] Add dynamic sign in/out button behavior  

---

## Phase 5: Onboarding & Sharing
- [x] Add "Invite User" flow (owner/admins only) → inserts into `event_members`  
- [x] Add user creation via Supabase Admin API for new users
- [x] Add magic link invitations for invited users
- [ ] Add "Share Event Code/Link" option (optional)  
- [x] Document new-user onboarding (magic link + RLS)  

---

## Phase 6: Scaling & Testing
- [x] Add demo data seeding with `generate_demo_data.sql`
- [x] Create multiple events for testing event selection
- [ ] Add polling/refresh interval as backup to real-time  
- [ ] Simulate multiple devices checking in attendees simultaneously  
- [ ] Verify race conditions (two devices checking in same attendee)  
- [ ] QA RLS enforcement (test with users in different roles)  
- [ ] Write tests for services (`attendees.ts`, `events.ts`, `permissions.ts`, `invitations.ts`)  

---