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
| iOS App Store | Live (v1.1.1) |
| TestFlight | Active |
| Web (Vercel) | Stable |
| Supabase (Prod) | Live |
| Android | Planned |

**Current Version:** 1.1.1
**Active Development:** v1.2 Shareable Access Codes

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

### v1.2 — Shareable Access Codes (Feb 2026) IN PROGRESS
**Backend (Complete):**
- [x] Supabase Vault for centralized CODE_SALT storage
- [x] `hash_access_code()` RPC - hashes codes server-side using Vault
- [x] `get_code_salt()` RPC - restricted to service role
- [x] `create_event_access_code()` RPC - creates codes with server-side hashing
- [x] `list_event_access_codes()` RPC - lists codes for an event
- [x] `revoke_event_access_code()` RPC - disables codes
- [x] `redeem_event_code` Edge Function - validates codes using Vault salt
- [x] `event_access_codes` table with code_hash, role, expiration, max_uses
- [x] `event_code_redemptions` table for audit trail

**Frontend (Complete):**
- [x] `services/codeManagement.ts` - create, list, revoke codes
- [x] `services/qrCodeGeneration.ts` - QR codes and deep links
- [x] `components/CreateAccessCodeModal.tsx` - code creation UI
- [x] `components/AccessCodeDashboard.tsx` - view/manage codes
- [x] `components/QRCodeModal.tsx` - QR code display with sharing
- [x] Cryptographically secure code generation (expo-crypto)
- [x] Deep link handling for code redemption (`app/redeem.tsx`)
- [x] Pre-fill code modal from deep links

**Testing (In Progress):**
- [x] Code creation via app UI
- [x] QR code generation and scanning
- [x] Code redemption on physical device
- [x] Code redemption on simulator
- [ ] End-to-end testing on multiple devices
- [ ] Edge cases (expiration, max uses, revocation)

**Deployment:**
- [ ] Deploy migrations to production Supabase
- [ ] TestFlight build with new features
- [ ] App Store release

### v1.3 — Offline Mode + Android (Mar 2026)
- [ ] Offline detection service (`services/offlineMode.ts`)
- [ ] Extended caching layer (`services/offlineCache.ts`)
- [ ] Check-in queue system (`services/offlineQueue.ts`)
- [ ] Sync manager for reconnection (`services/syncManager.ts`)
- [ ] OfflineIndicator component for UI feedback
- [ ] Launch app in read-only mode when offline
- [ ] Queue check-ins locally when no connectivity
- [ ] Sync queued operations when connectivity returns
- [ ] EAS Android build & Play Store internal track

### v1.4 — Customization & Analytics (Apr 2026)
- [ ] Event-specific banner / accent color
- [ ] Attendance summary & CSV export
- [ ] Reset All Check-Ins button (Manager only)
- [ ] /debug and /health internal pages

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
| `ROADMAP.md` | (this file) shared plan for Cursor + Codex |
| `docs/current-status.md` | Detailed current project status |

---

## Release Cadence
| Milestone | Target | Focus |
|------------|---------|-------|
| **v1.1.x** | Jan 2026 | Bug fixes + UI polish |
| **v1.2** | Feb 2026 | Shareable Access Codes ← CURRENT |
| **v1.3** | Mar 2026 | Offline mode + Android |
| **v1.4** | Apr 2026 | Custom branding + Analytics |
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
