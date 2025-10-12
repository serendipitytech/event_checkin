# 🧭 Expo Check-In – Developer Roadmap

**Repo:** `serendipitytech/event_checkin`  
**Primary Branches:**  
- `main` → App Store / production build  
- `dev` → active development  
- feature branches → short-lived (merged into `dev`)

_Last updated: Oct 2025_

---

## 🚀 Current State
| Item | Status |
|------|---------|
| iOS App Store | Submitted ✅ |
| TestFlight | Active ✅ |
| Web (Vercel) | Stable ✅ |
| Supabase (Prod) | Live ✅ |
| Android | Planned 🕓 |

---

## 🧱 Development Process

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

✅  This protects production — `main` is never edited directly.  
🧪  All live testing happens in `dev` via Expo or internal TestFlight.

---

## 🧩 Active Milestones

### v1.1 — Session & UI Polish (Nov 2025)
- [ ] Persistent login (AsyncStorage + refresh token)
- [ ] Hide environment banner in prod
- [ ] Reset All Check-Ins button (Manager only)
- [ ] Finalize privacy / terms links
- [ ] Web console warning cleanup

### v1.2 — Network Resilience & iPad Layout (Dec 2025)
- [ ] Auto-refresh attendees on reconnect
- [ ] Responsive 2-column layout
- [ ] Local session cache + auto-restore

### v1.3 — Offline-First + Android (Jan 2026)
- [ ] Launch offline in read-only mode
- [ ] Queue unsynced check-ins + sync on reconnect
- [ ] EAS Android build & Play Store internal track

### v1.4 — Customization & Analytics (Feb 2026)
- [ ] Event-specific banner / accent color
- [ ] Attendance summary & CSV export
- [ ] Role-based permissions (Manager / Checker / Guest)
- [ ] /debug and /health internal pages

### v2.0 — Anonymous Event Links (Spring 2026)
- [ ] Public QR / URL → auto anonymous login via Supabase
- [ ] Temporary JWT tokens per event
- [ ] Read-only “Checker Mode”
- [ ] Optional expiration by event date

---

## 🔧 Infrastructure / Docs
| File | Purpose |
|------|----------|
| `.env.production` | `EXPO_PUBLIC_REDIRECT_URL=checkin://auth` |
| `.env.development` | `EXPO_PUBLIC_REDIRECT_URL=https://.../redirect-dev` |
| `ENVIRONMENT-WORKFLOW.md` | Describes redirect / build pipeline |
| `QA-CHECKLIST.md` | Test steps before merge to `main` |
| `ROADMAP.md` | (this file) shared plan for Cursor + Codex |

---

## 🧠 Suggested Cursor / Codex Prompts
- _“Add persistent session using AsyncStorage and supabase.auth.onAuthStateChange.”_  
- _“Create Reset All Check-Ins button visible to managers only.”_  
- _“Implement customizable banner color per event with fallback to gold.”_  
- _“Add anonymous event-link login using supabase.auth.signInAnonymously.”_  

---

## 📅 Release Cadence
| Milestone | Target | Focus |
|------------|---------|-------|
| **v1.1** | Nov 2025 | Session persistence + UI polish |
| **v1.2** | Dec 2025 | Reconnect logic + iPad layout |
| **v1.3** | Jan 2026 | Offline mode + Android |
| **v1.4** | Feb 2026 | Custom branding + Analytics |
| **v2.0** | Spring 2026 | Anonymous event access |

---

## 🔐 Production Protection
- Always build from `main` using `eas build --platform ios --profile production`.  
- Keep `.env.production` secrets **only** in local machine or CI, never committed.  
- Tag releases:  
  ```bash
  git tag -a v1.0.0 -m "Initial App Store release"
  git push origin v1.0.0
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

## 🧭 Branching Model Summary

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
