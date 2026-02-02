# Expo Check-In – Developer Roadmap

**Repo:** `serendipitytech/event_checkin`
**Primary Branches:**
- `main` → App Store / production build
- `dev` → active development
- feature branches → short-lived (merged into `dev`)

_Last updated: Feb 2026_

---

## Current State
| Item | Status |
|------|---------|
| iOS App Store | v1.3.0 (1.0.23) - Submitted for review |
| TestFlight | v1.3.0 (1.0.23) |
| Web (Vercel) | Stable |
| Supabase (Prod) | Live |
| Android | Planned |

**Current Version:** 1.3.0 (submitted to App Store)
**Active Development:** iPad view optimization (feature/ipad-view)

---

## Development Process

1. **Create feature branch**
   ```bash
   git checkout dev
   git pull
   git checkout -b feature/<short-desc>
   ```
2. **Develop + commit** — Cursor / Codex read this `ROADMAP.md` for context.
3. **Local test**
   - iOS Simulator: `npx expo start --tunnel`
   - Web: `npx expo start --web`
4. **Push + PR to `dev`**
   ```bash
   git push origin feature/<short-desc>
   ```
5. **QA on `dev` environment** (uses `redirect-dev`, `.env.development`).
6. **Merge to `main`** only when approved → triggers new build for App Store/TestFlight.

This protects production — `main` is never edited directly.
All live testing happens in `dev` via Expo or internal TestFlight.

---

## Active Milestones

### v1.1.x — Bug Fixes & Polish (Jan 2026) COMPLETE
- [x] Fix JSX comment syntax error in Check-In logged-out section
- [x] Fix code-access refresh events after code redemption
- [x] Session persistence with AsyncStorage
- [ ] Hide environment banner in prod
- [ ] Finalize privacy / terms links
- [ ] Web console warning cleanup

### v1.2 — Shareable Access Codes (Feb 2026) ✅ RELEASED
**Status:** Included in v1.3.0 release - QR deep links verified working

**Backend:** Complete
- [x] Supabase Vault for centralized CODE_SALT storage
- [x] `hash_access_code()` RPC - server-side hashing
- [x] `get_code_salt()` RPC - restricted to service role
- [x] `create_event_access_code()` RPC
- [x] `list_event_access_codes()` RPC
- [x] `revoke_event_access_code()` RPC
- [x] `redeem_event_code` Edge Function - validates via Vault

**Frontend:** Complete
- [x] Code management service with crypto-secure generation
- [x] QR code generation and deep link sharing
- [x] CreateAccessCodeModal, AccessCodeDashboard, QRCodeModal
- [x] Deep link route handler (`app/redeem.tsx`)

**Deployment:**
- [x] Migrations deployed to Supabase
- [x] TestFlight build submitted
- [x] QR code deep links verified (`checkin://` scheme)
- [ ] App Store release (pending QA)

### v1.3 — Offline Mode + Undo UX (Feb 2026) ✅ RELEASED
**Released:** Feb 2, 2026 | **Target:** 2/20/2026 event deadline

**Existing Infrastructure:**
- [x] Network detection via expo-network (in attendees.ts)
- [x] Attendee caching with AsyncStorage fallback
- [x] Realtime reconnection with exponential backoff
- [x] Session and event persistence

**Offline Mode:**
- [x] Check-in queue system (`services/offlineQueue.ts`)
- [x] Sync manager for reconnection (`services/syncManager.ts`)
- [x] Offline UI indicator (`components/OfflineIndicator.tsx`)
- [x] Update check-in flow to queue when offline
- [x] Conflict resolution (server wins)
- [ ] Handle edge cases (app killed while offline)
- [ ] Failed sync retry UI
- [ ] EAS Android build & Play Store internal track

**Undo UX Improvements:**
- [x] Visual differentiation for Checked-In tab (amber indicator, tinted background, bordered rows)
- [x] "Viewing checked-in guests" banner
- [x] Hold-to-undo gesture (0.8s) replaces swipe for checked-in attendees
- [x] Double-tap fallback for power users
- [x] "Hold to undo" hint text on rows
- [x] Different undo modal (red, warning message, simplified)
- [x] Feature flag infrastructure (`services/settings.ts`, `hooks/useSettings.ts`)
- [x] Admin UI toggle for undo protection level
- [ ] Strict mode (type "UNDO" to confirm) - deferred to v1.4

**Testing & QA:**
- [x] Unit tests for settings service (23 tests)
- [x] Jest infrastructure with AsyncStorage mocks
- [x] Updated QA checklist (`docs/mvp_qa_list.md`)
- [x] Simulator testing guide (`docs/simulator-testing-guide.md`)

### v1.3.1 — iPad View Optimization (Feb 2026) IN PROGRESS
**Branch:** `feature/ipad-view`
**Target:** Nice-to-have for 2/20/2026 event

**Responsive Layout:**
- [ ] `useDeviceLayout` hook (phone / tablet-portrait / tablet-landscape)
- [ ] Multi-column grid for attendee list (2-col portrait, 4-col landscape)
- [ ] Constrained modal widths on larger screens
- [ ] Inline filters for landscape mode
- [ ] Larger touch targets for iPad usability

**UX Considerations:**
- Portrait: 2-column grid, larger cards
- Landscape: 4-column grid, header+filters on same row
- Tap-to-check-in may be more natural than swipe on landscape iPad

### v1.4 — Testing, Analytics & Polish (Apr 2026)

**Testing Infrastructure:**
- [ ] Integration tests (mock Supabase responses)
- [ ] E2E tests with Detox for critical flows
- [ ] CI pipeline with automated test runs
- [ ] Code coverage reporting (target: 60%+)

**Features:**
- [ ] Event-specific banner / accent color
- [ ] Attendance summary & CSV export
- [ ] Check-in audit trail (who checked in whom, when)
- [ ] Strict undo mode (type "UNDO" to confirm)
- [ ] /debug and /health internal pages

### v1.5 — Android & Cross-Platform (May 2026)
- [ ] EAS Android build configuration
- [ ] Play Store internal track submission
- [ ] Android-specific gesture handling review
- [ ] Cross-platform testing automation

### v2.0 — Anonymous Event Links (Summer 2026)
- [ ] Public QR / URL → auto anonymous login via Supabase
- [ ] Temporary JWT tokens per event
- [ ] Read-only "Checker Mode"
- [ ] Optional expiration by event date

---

## Architecture: Access Code System

### Salt Management (Single Source of Truth)
```
Supabase Vault
    └── code_salt secret
            │
            ├── hash_access_code() RPC (code creation)
            │       └── reads from vault.decrypted_secrets
            │
            └── redeem_event_code Edge Function (code redemption)
                    └── calls get_code_salt() RPC
```

### Code Flow
1. **Manager creates code** → App calls `create_event_access_code` RPC
2. **RPC hashes code** → Uses `hash_access_code()` which reads salt from Vault
3. **Hash stored** → Plain code shown once to manager, only hash in DB
4. **User redeems code** → App calls `redeem_event_code` Edge Function
5. **Edge function validates** → Fetches salt from Vault via RPC, hashes input, compares

### Key Files
| File | Purpose |
|------|---------|
| `services/codeManagement.ts` | Client-side code CRUD operations |
| `services/qrCodeGeneration.ts` | QR code and deep link generation |
| `components/CreateAccessCodeModal.tsx` | UI for creating codes |
| `components/AccessCodeDashboard.tsx` | UI for managing codes |
| `components/QRCodeModal.tsx` | QR code display modal |
| `app/redeem.tsx` | Deep link route handler |
| `supabase/functions/redeem_event_code/` | Edge function for redemption |
| `supabase/migrations/20260202_*.sql` | Code hashing RPC |
| `supabase/migrations/20260203_*.sql` | Vault integration |
| `supabase/migrations/20260204_*.sql` | get_code_salt RPC |

---

## Infrastructure / Docs
| File | Purpose |
|------|----------|
| `.env.production` | `EXPO_PUBLIC_REDIRECT_URL=checkin://auth` |
| `.env.development` | `EXPO_PUBLIC_REDIRECT_URL=https://.../redirect-dev` |
| `docs/eas-build-deployment.md` | EAS build commands and troubleshooting |
| `docs/mvp_qa_list.md` | QA checklist for releases |
| `docs/simulator-testing-guide.md` | Step-by-step simulator testing |
| `ROADMAP.md` | (this file) shared plan for Cursor + Codex |
| `docs/current-status.md` | Detailed current project status |

## Testing Infrastructure
| File | Purpose |
|------|----------|
| `jest.config.js` | Jest configuration for Expo |
| `__tests__/setup.ts` | Test setup with AsyncStorage mock |
| `__tests__/services/settings.test.ts` | Settings service unit tests (23 tests) |

**Run tests:** `npm test`

---

## Release Cadence
| Milestone | Target | Focus |
|------------|---------|-------|
| **v1.1.x** | Jan 2026 | Bug fixes + UI polish |
| **v1.2** | Feb 2026 | Shareable Access Codes (in TestFlight) |
| **v1.3** | Feb 2026 | Offline mode + Undo UX ✅ RELEASED |
| **v1.3.1** | Feb 2026 | iPad view optimization ← CURRENT |
| **v1.4** | Apr 2026 | Testing infrastructure + Analytics |
| **v1.5** | May 2026 | Android + Cross-platform |
| **v2.0** | Summer 2026 | Anonymous event access |

---

## Production Protection
- Always build from `main` using `eas build --platform ios --profile production`.
- Keep `.env.production` secrets **only** in local machine or CI, never committed.
- Tag releases:
  ```bash
  git tag -a v1.2.0 -m "Shareable Access Codes"
  git push origin v1.2.0
  ```
- Hotfix?
  ```bash
  git checkout main
  git checkout -b hotfix/<issue>
  # fix + test
  git merge hotfix/<issue> main
  git push origin main
  ```

---

## Branching Model Summary

| Stage | Branch | Environment | Purpose |
|--------|---------|--------------|----------|
| **Local Dev** | `feature/*` | `.env.development` | New code, run with Expo tunnel |
| **Integration QA** | `dev` | Supabase dev + redirect-dev | Shared testing, internal builds |
| **Production** | `main` | Supabase prod + redirect | Stable App Store/TestFlight release |

**Flow Diagram**
```
feature/foo → dev → main → App Store
```

**Build Targets**
- Local test: `npx expo start --tunnel`
- Internal TestFlight: `eas build --profile development --platform ios`
- App Store Release: `eas build --profile production --platform ios && eas submit --latest`
