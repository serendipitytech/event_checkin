# Current Project Status

_Last updated: Feb 2026_

## Production Status

| Platform | Status | Version |
|----------|--------|---------|
| iOS App Store | Live | v1.1.1 |
| TestFlight | Active | v1.2.0 (1.0.21) |
| Web (Vercel) | Stable | - |
| Supabase (Prod) | Live | - |
| Android | Planned | - |

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

## Next: v1.3 Offline Mode

**Target:** 2/20/2026 event deadline

### Planned Features
- Check-in queue when offline
- Sync manager on reconnect
- Offline UI indicator
- Conflict resolution (server wins)

### Existing Infrastructure
- Network detection via expo-network (already in attendees.ts)
- Attendee caching (already working for read)
- Realtime reconnection with backoff
- Session/event persistence

### Files to Create
- `services/offlineQueue.ts` - Queue check-in operations
- `services/syncManager.ts` - Process queue on reconnect
- `components/OfflineIndicator.tsx` - Visual feedback

---

## Git Status

**Current Branch:** `main` (clean)

**Recent Commits:**
- `2ec6ed5` - docs(eas): clarify build profiles and TestFlight requirements
- `6c58198` - fix(eas): add preview submit profile for auto-submit support
- `75f60bb` - docs: add EAS build deployment guide with Keychain troubleshooting
- `f7c8667` - fix(build): add encryption compliance flag
- `11782bc` - feat(v1.2): shareable access codes with QR support

---

## Documentation

| Doc | Purpose |
|-----|---------|
| `ROADMAP.md` | Development roadmap and milestones |
| `docs/current-status.md` | This file - current project state |
| `docs/eas-build-deployment.md` | EAS build commands and troubleshooting |
| `docs/mvp_qa_list.md` | QA checklist for releases |
| `docs/code-access-auth.md` | Access code authentication flow |
