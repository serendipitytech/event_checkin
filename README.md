# Expo Check-In App

A cross-platform event check-in app built with **Expo SDK 54**, **React Native**, and **Supabase**.  
Supports multi-device attendee check-in with realtime sync, CSV/Excel imports, and role-based access.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v20.19.x (use `nvm use 20.19.4`)
- npm v10.x
- Expo CLI (`npm install -g expo-cli`)
- Supabase project with schema + RLS applied (see `checkin_supabase_initial.sql`)

### Setup
```bash
git clone git@github.com:<your-username>/expo-checkin.git
cd expo-checkin
npm ci
```

### Environment Variables
Copy `.env.example` to `.env` and set your Supabase credentials:

```
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Running the App
```bash
npx expo start
```

- Press `i` → open iOS simulator
- Press `a` → open Android emulator
- Scan QR in Expo Go app → run on physical device
- Press `w` → run in web preview

---

## 🗂️ Git Workflow

We use **branch-per-feature** workflow:
- `main` → stable baseline
- `feature/...` → work-in-progress branches for Codex/feature work
- Tags for milestones (`v0.1.0-sdk54-baseline`)

Example:
```bash
git checkout -b feature/supabase-integration
# make changes
git add .
git commit -m "Wire Supabase get_my_access RPC"
git push origin feature/supabase-integration
```

---

## 📦 Adding Dependencies
- Use `npx expo install <package>` for Expo/React Native packages (ensures SDK compatibility)
- Use `npm install <package>` for pure JavaScript/TypeScript libraries

---

## ✅ Health Checks
```bash
npx expo-doctor
```

---

## 🗃️ Supabase Schema
See [`checkin_supabase_initial.sql`](./checkin_supabase_initial.sql) for full schema, RLS, and helper functions:
- Organizations & Members
- Events & Event Members
- Attendees with realtime sync
- RPCs for toggle/bulk check-in
- Join codes for kiosk mode

---

## 👥 Contributing
1. Branch off `main` for your work
2. Use descriptive commits
3. Run `npx expo-doctor` before PR
4. Submit PR to `main`
