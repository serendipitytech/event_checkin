# Tasks: expo-checkin v1.3

**Last updated:** 2026-02-18

## Pre-Event (before 2/20/2026)

- [ ] Commit all production hardening changes (Cards 1-13)
- [ ] Deploy updated `invite_user` edge function to Supabase (`supabase functions deploy invite_user`)
- [ ] Build TestFlight: `eas build --platform ios --profile preview`
- [ ] Manual smoke test on physical device:
  - [ ] Online check-in (tap attendee, verify toggle)
  - [ ] Offline queuing (airplane mode, check in, verify queued)
  - [ ] Auto-sync (restore connectivity, verify sync)
  - [ ] Access code redemption (enter code, verify event access)
  - [ ] Auth flow (magic link sign-in, verify session persistence across app restart)
  - [ ] Error boundary (force crash in dev, verify "Try Again" screen)
  - [ ] Invite flow (invite checker, verify email sent, verify 401/403 for unauthorized)
  - [ ] No console.log spam in release build

## Post-Event (deferred from hardening plan)

- [ ] **Card 14: Checker RLS policy fix** — Add BEFORE UPDATE trigger restricting which columns checkers can modify. Currently deferred because checkers are trusted staff and UI restricts via `toggle_checkin` RPC.
- [ ] **Optimistic locking** for multi-device concurrent check-in (QA CRIT-2) — Requires schema migration (`version` column), RPC change, client update. Too risky for pre-event window.
- [ ] **FlatList performance**: Add search debounce, `getItemLayout`, tune `windowSize`
- [ ] **Consolidated network polling**: Replace 3 parallel network polls with single event-driven service
- [ ] **Accessibility labels** on all interactive elements
- [ ] **CSV parser fix** for quoted fields in roster import
- [ ] **Code redemption atomicity**: Fix `used_count` TOCTOU race in `redeem_event_code` edge function
- [ ] **File size refactors**: `app/(tabs)/index.tsx` (1523 lines), `app/(tabs)/admin.tsx` (1058 lines) — break into smaller components
- [ ] **Redirect edge function**: Add open redirect validation
- [ ] **Global coverage to 50%+**: Add tests for attendees.ts, auth.ts, realtime.ts, events.ts, permissions.ts
- [ ] **TypeScript strict mode**: Fix test file types (add `@types/jest` to tsconfig)
