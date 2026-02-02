# Current Project Status

_Last updated: Feb 2026_

## Production Status

| Platform | Status | Version |
|----------|--------|---------|
| iOS App Store | Live | v1.1.1 |
| TestFlight | Active | v1.1.1 |
| Web (Vercel) | Stable | - |
| Supabase (Prod) | Live | - |
| Android | Planned | - |

## Active Development: v1.2 Shareable Access Codes

### What's New
Managers can now generate shareable access codes that grant event access without email invitations. Codes can be shared via QR code or deep link, making it easy to onboard checker staff quickly.

### Implementation Status

**Backend - COMPLETE:**
- Supabase Vault stores CODE_SALT (single source of truth)
- `hash_access_code()` RPC for server-side hashing
- `get_code_salt()` RPC for edge function access
- `create_event_access_code()` RPC for code creation
- `list_event_access_codes()` RPC for listing codes
- `revoke_event_access_code()` RPC for disabling codes
- `redeem_event_code` Edge Function for validation
- Database tables: `event_access_codes`, `event_code_redemptions`

**Frontend - COMPLETE:**
- Code management service with crypto-secure generation
- QR code generation and deep link sharing
- CreateAccessCodeModal for managers
- AccessCodeDashboard for viewing/managing codes
- QRCodeModal for displaying shareable QR codes
- Deep link route (`/redeem`) for code pre-fill

**Testing - IN PROGRESS:**
- [x] Code creation via app UI
- [x] QR code scanning on physical device
- [x] Manual code entry
- [x] Deep link redemption
- [ ] Edge case testing (expiration, limits, revocation)
- [ ] Multi-device testing

**Remaining for Release:**
- [ ] Deploy migrations to production Supabase
- [ ] TestFlight build
- [ ] App Store submission

---

## Completed Features

### Authentication & Security
- Magic Link Authentication with Supabase v2
- Hash Fragment Token Parsing (#access_token=...&refresh_token=...)
- Deep Link Handling with tunnel URL support
- Auth Callback Screen with loading UI and auto-redirect
- Session Persistence with AsyncStorage
- Centralized Configuration with dynamic redirect URLs

### Event Management & User Invitations
- Event Selection Interface with proper modal UI
- User Invitation System with magic link integration
- Role-Based Access Control with permission enforcement
- Admin Screen UX Polish with dynamic sign in/out

### Check-In Workflow
- Attendee list with search and filter
- Manual and bulk check-ins (group/table)
- Real-time sync across devices
- Auto-refresh at configurable intervals

### Roster Import
- CSV file import with column mapping
- Google Sheets integration via URL
- Bulk upsert with error reporting

### Access Codes (v1.2 - NEW)
- Cryptographically secure code generation
- Server-side hashing with Vault-stored salt
- QR code generation and sharing
- Deep link support for easy redemption
- Code expiration and usage limits
- Revocation capability
- Audit trail for redemptions

---

## Architecture Highlights

### Access Code Salt Management
```
Supabase Vault (code_salt)
        │
        ├── hash_access_code() RPC
        │       └── Used by create_event_access_code()
        │
        └── get_code_salt() RPC
                └── Used by redeem_event_code Edge Function
```

This ensures the salt is never duplicated or out of sync.

### New Files (v1.2)
| File | Purpose |
|------|---------|
| `services/codeManagement.ts` | Code CRUD operations |
| `services/qrCodeGeneration.ts` | QR and deep link generation |
| `components/CreateAccessCodeModal.tsx` | Code creation UI |
| `components/AccessCodeDashboard.tsx` | Code management UI |
| `components/QRCodeModal.tsx` | QR display with sharing |
| `app/redeem.tsx` | Deep link route handler |

### Database Migrations (v1.2)
| Migration | Purpose |
|-----------|---------|
| `20260201_create_access_code_rpc.sql` | Initial RPC functions |
| `20260202_fix_code_hashing.sql` | Server-side hashing |
| `20260203_use_vault_for_salt.sql` | Vault integration |
| `20260204_get_code_salt_rpc.sql` | RPC for edge function |

---

## Git Status

**Current Branch:** `main`

**Modified Files:**
- `ROADMAP.md` - Updated with v1.2 progress
- `docs/current-status.md` - This file

**New Files (uncommitted):**
- `services/codeManagement.ts`
- `services/qrCodeGeneration.ts`
- `components/CreateAccessCodeModal.tsx`
- `components/AccessCodeDashboard.tsx`
- `components/QRCodeModal.tsx`
- `app/redeem.tsx`
- `supabase/migrations/20260201_*.sql`
- `supabase/migrations/20260202_*.sql`
- `supabase/migrations/20260203_*.sql`
- `supabase/migrations/20260204_*.sql`

---

## Next Milestones

| Version | Target | Focus |
|---------|--------|-------|
| v1.2 | Feb 2026 | Shareable Access Codes (current) |
| v1.3 | Mar 2026 | Offline mode + Android |
| v1.4 | Apr 2026 | Custom branding + Analytics |
| v2.0 | Summer 2026 | Anonymous event access |

---

## Testing Checklist for v1.2

Before release, verify:

### Code Creation
- [ ] Manager can access "Manage Access Codes" from Admin tab
- [ ] Code generation produces valid 8-character code
- [ ] Role selection (Checker/Manager) works
- [ ] Expiration options work correctly
- [ ] Max uses limit can be set
- [ ] Note field saves properly
- [ ] Code displayed once with copy buttons
- [ ] QR code modal displays correctly

### Code Redemption
- [ ] Manual code entry works
- [ ] QR code scanning works on iOS
- [ ] Deep link opens app and pre-fills code
- [ ] User gains correct role after redemption
- [ ] Event appears in user's event list
- [ ] Expired codes are rejected
- [ ] Revoked codes are rejected
- [ ] Max uses limit is enforced

### Code Management
- [ ] Dashboard shows all codes for event
- [ ] Active/inactive codes separated
- [ ] Revoke button disables code
- [ ] Pull-to-refresh updates list
