# Current Project Status

_Last updated: Feb 2026_

> **For Claude Context Recovery:** Read this file first when resuming work. It contains the current project state, what's in progress, and what's next.

## Production Status

| Platform | Status | Version |
|----------|--------|---------|
| iOS App Store | Live | v1.1.1 |
| TestFlight | Active | v1.2.0 (1.0.21) |
| Web (Vercel) | Stable | - |
| Supabase (Prod) | Live | - |
| Android | Planned | - |

---

## v1.3 Offline Mode + Undo UX - IN PROGRESS

**Branch:** `feature/offline-mode`
**Target:** 2/20/2026 event deadline
**Priority:** High - Core functionality for unreliable venue connectivity

### Completed ✅

#### Undo Check-in UX Improvements (NEW)

1. **Visual Differentiation** - Checked-In tab is clearly different
   - Amber segment indicator (instead of blue)
   - Light amber background tint on filter section
   - Amber left border on attendee rows
   - "Viewing checked-in guests" banner below tabs

2. **Hold-to-Undo Gesture** - Prevents accidental undos
   - Pending attendees: swipe to check in (unchanged)
   - Checked-in attendees (Standard mode): hold 0.8s to undo
   - Double-tap fallback for power users
   - "Hold to undo" hint text on rows

3. **Different Undo Modal** - Scarier, simpler
   - Red title "Return to Pending"
   - Warning text about returning to non-checked-in list
   - No group/table/ticket details shown
   - Red "Return to Pending" button
   - No "Check In Group" option

4. **Feature Flag Infrastructure**
   - `services/settings.ts` - Persistent settings with AsyncStorage
   - `hooks/useSettings.ts` - React hooks for reactive settings
   - `undoProtectionLevel` flag: 'relaxed' | 'standard' | 'strict'
   - Admin UI toggle for managers/admins

5. **Testing Infrastructure**
   - Jest configured with `jest-expo` preset
   - AsyncStorage mock in `__tests__/setup.ts`
   - 23 unit tests for settings service
   - QA checklist updated for all v1.3 features
   - Simulator testing guide created

#### Offline Mode Infrastructure

1. **`services/offlineQueue.ts`** - Queue management
   - Queue check-ins with attendee ID, event ID, checked-in state
   - Persist to AsyncStorage (`@checkin_offline_queue`)
   - Replace duplicates (if user toggles same attendee multiple times)
   - Track attempts, timestamps, sync status
   - Max 100 pending items per event
   - Max 3 retry attempts before marking failed

2. **`services/syncManager.ts`** - Sync orchestration
   - Polls network state every 5 seconds (expo-network)
   - Auto-syncs when transitioning from offline → online
   - Processes queue sequentially via `toggle_checkin` RPC
   - Server wins on conflict (accepts server state)
   - Cleans up old synced items after 24 hours
   - Emits status to listeners for UI updates

3. **`components/OfflineIndicator.tsx`** - UI feedback
   - Orange banner when offline
   - Blue banner when online with pending items
   - Shows pending count
   - Manual "Sync" button
   - Expandable for details

4. **Integration** (partial)
   - `toggleCheckin()` queues when offline
   - Sync manager initialized on app start
   - OfflineIndicator on check-in screen

### Testing Needed 🧪

1. Start dev server: `npx expo start --tunnel`
2. Check in attendees while online (verify works)
3. Enable airplane mode on device
4. Check in more attendees (should see "Offline" banner, local updates)
5. Disable airplane mode
6. Watch pending items sync automatically

### Remaining Work 📋

- [x] Verify integration works end-to-end
- [x] Optimistic UI updates (cache updates persist across refreshes)
- [x] Undo UX improvements (visual differentiation, hold-to-undo, modal)
- [x] Feature flag infrastructure for undo protection levels
- [ ] Handle edge cases (app killed while offline, etc.)
- [ ] Add failed sync retry UI
- [ ] Test with poor connectivity (throttled network)
- [ ] Suppress realtime reconnection error in dev (non-blocking)

### Known Limitations

**Conflict resolution:** Currently "last write wins" - if the same guest is checked in from multiple devices (online or offline), only the last sync's timestamp/user is recorded. See v1.4 roadmap for audit trail feature.

---

## Future: v1.4+ Roadmap

### Check-in Audit Trail & Reporting
**Priority:** Medium (needed for reporting requirements)

**Problem:** Currently only stores last check-in timestamp/user. No history for:
- Who checked in a guest first
- Undo/redo history
- Offline vs online actions
- Staff activity reports

**Solution:** Add `checkin_history` table:
```sql
create table public.checkin_history (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid references public.attendees(id),
  event_id uuid references public.events(id),
  action text not null, -- 'check_in' | 'undo'
  performed_by uuid,
  performed_at timestamptz default now(),
  device_id text,
  was_offline boolean default false,
  queued_at timestamptz
);
```

**Benefits:**
- Full audit trail for compliance
- Conflict visibility (see all check-ins, not just last)
- Staff performance reporting
- Check-in time analytics

### Testing Expansion (v1.4)
**Priority:** Medium - Technical debt / maintainability

**Current State:**
- Unit tests: 23 (settings service only)
- Integration tests: None
- E2E tests: None

**Planned:**
- Integration tests with mocked Supabase responses
- E2E tests with Detox for critical user flows
- CI pipeline with automated test runs
- Target coverage: 60%+ for services

**Test Pyramid Target:**
```
        /\
       /  \  E2E (Detox) - 5-10 critical flows
      /----\
     /      \  Integration - Service + mock backend
    /--------\
   /          \  Unit - Pure functions, utilities
  /--------------\
```

### Other Future Items
- [ ] Android support (v1.5)
- [ ] Check-in analytics dashboard
- [ ] Export check-in reports (CSV/PDF)
- [ ] Multi-event check-in (guest at multiple events)

---

## v1.2 Shareable Access Codes - IN TESTFLIGHT

### What's New
Managers can now generate shareable access codes that grant event access without email invitations. Codes can be shared via QR code or deep link, making it easy to onboard checker staff quickly.

### Status: TestFlight Testing
- Build submitted to App Store Connect: Feb 2026
- TestFlight verified: QR code deep links working with `checkin://` scheme
- Pending: App Store release after QA

### Features Delivered

**Code Generation:**
- Cryptographically secure 8-character codes (expo-crypto)
- Role selection: Checker or Manager
- Expiration options: Never, 1 hour, 1 day, 1 week, 1 month
- Usage limits: Unlimited or specific device count
- Optional notes for internal tracking

**Code Sharing:**
- QR code generation (scannable by device camera)
- Deep links: `checkin://redeem?code=XXXX&event=UUID`
- Copy code / Copy link buttons
- One-time display with security warning

**Code Redemption:**
- Manual code entry via "Enter Access Code" button
- QR scan opens app and pre-fills code
- Grants appropriate role on event
- Works for logged-out and logged-in users

**Code Management:**
- Dashboard shows all codes for event
- Active/inactive code separation
- Revoke functionality
- Usage tracking (X/Y uses)

### Architecture

```
Supabase Vault (code_salt - single source of truth)
        │
        ├── hash_access_code() RPC (code creation)
        │
        └── get_code_salt() RPC → redeem_event_code Edge Function
```

### Files Added/Modified (v1.2)

| File | Purpose |
|------|---------|
| `services/codeManagement.ts` | Code CRUD with crypto-secure generation |
| `services/qrCodeGeneration.ts` | QR codes and deep links |
| `components/CreateAccessCodeModal.tsx` | Code creation UI |
| `components/AccessCodeDashboard.tsx` | Code management dashboard |
| `components/QRCodeModal.tsx` | QR display with sharing |
| `app/redeem.tsx` | Deep link route handler |
| `supabase/functions/redeem_event_code/` | Edge function (updated for Vault) |

### Database Migrations (v1.2)

| Migration | Purpose |
|-----------|---------|
| `20260201_create_access_code_rpc.sql` | Initial RPC functions |
| `20260202_fix_code_hashing.sql` | Server-side hashing |
| `20260203_use_vault_for_salt.sql` | Vault integration |
| `20260204_get_code_salt_rpc.sql` | get_code_salt RPC for edge function |

---

## Completed Features (v1.0 - v1.1)

### Authentication & Security
- Magic Link Authentication with Supabase v2
- Hash Fragment Token Parsing
- Deep Link Handling with production `checkin://` scheme
- Session Persistence with AsyncStorage
- Auth state restoration on app launch

### Event Management
- Event Selection Interface
- User Invitation System with magic links
- Role-Based Access Control (Admin, Manager, Checker)

### Check-In Workflow
- Attendee list with search and filter
- Manual and bulk check-ins
- Real-time sync across devices
- Auto-refresh at configurable intervals
- Offline attendee cache (read-only fallback)

### Roster Import
- CSV/XLSX file import
- Google Sheets integration
- Bulk upsert with error reporting

---

## Git Status

**Current Branch:** `feature/offline-mode` (clean)

**Recent Commits:**
- `f46e0be` - feat(v1.3): add offline mode core infrastructure
- `51db29c` - docs: update status for v1.2 TestFlight release and v1.3 planning
- `2ec6ed5` - docs(eas): clarify build profiles and TestFlight requirements
- `6c58198` - fix(eas): add preview submit profile for auto-submit support
- `75f60bb` - docs: add EAS build deployment guide with Keychain troubleshooting

---

## Documentation

| Doc | Purpose |
|-----|---------|
| `ROADMAP.md` | Development roadmap and milestones |
| `docs/current-status.md` | This file - current project state |
| `docs/eas-build-deployment.md` | EAS build commands and troubleshooting |
| `docs/mvp_qa_list.md` | QA checklist for releases |
| `docs/simulator-testing-guide.md` | Step-by-step testing in iOS Simulator |
| `docs/code-access-auth.md` | Access code authentication flow |

## Testing

| Command | Purpose |
|---------|---------|
| `npm test` | Run all unit tests |
| `npm test -- --coverage` | Run with coverage report |
| `npm test -- --watch` | Watch mode for development |

**Current coverage:** Settings service only (23 tests)

---

## Context Recovery Process

When starting a new Claude session:

1. **Read this file first** - It has the current state
2. **Check git status** - `git status` and `git log --oneline -5`
3. **Ask Claude to update this doc** after major changes

### Updating This Document

After completing significant work, ask Claude to:
- Update the "IN PROGRESS" section with completed items
- Move checklist items from "Remaining" to "Completed"
- Update git status with recent commits
- Add any new files created to the relevant table

### Key Files for Context

| Area | Files |
|------|-------|
| Offline Mode | `services/offlineQueue.ts`, `services/syncManager.ts`, `components/OfflineIndicator.tsx` |
| Access Codes | `services/codeManagement.ts`, `components/AccessCodeDashboard.tsx`, `app/redeem.tsx` |
| Auth | `services/auth.ts`, `app/auth/callback.tsx` |
| Check-ins | `services/attendees.ts`, `app/(tabs)/index.tsx` |
| Settings/Flags | `services/settings.ts`, `hooks/useSettings.ts` |
| Testing | `__tests__/setup.ts`, `__tests__/services/settings.test.ts`, `jest.config.js` |
| Config | `app.json`, `config/env.ts`, `.env` |
