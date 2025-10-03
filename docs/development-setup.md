# Development Setup Guide

## 🚀 Quick Start for Development

### Prerequisites
- Node.js 18+ and npm
- Expo CLI (`npm install -g @expo/cli`)
- Supabase account and project

### 1. Environment Setup

Create a `.env` file in the project root:
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Supabase Configuration

Follow the complete setup guide in `docs/supabase-dashboard-setup.md`:

**Required Redirect URLs in Supabase Dashboard:**
```
exp://127.0.0.1:8081/--/auth/callback
exp://*.exp.direct/--/auth/callback
expo-checkin://auth/callback
http://localhost:3000/auth/callback
```

### 3. Start Development Server

**For Local Development:**
```bash
npx expo start
```

**For Physical Device Testing (Tunnel):**
```bash
npx expo start --tunnel
```

### 4. Test Authentication Flow

1. Open app on device/simulator
2. Tap "Sign In" button
3. Enter email address
4. Check email for magic link
5. Click magic link → should open app and authenticate
6. Should see "Signing you in..." screen → redirect to home

### 5. Debug Authentication Issues

Check console logs for:
```
🔗 Forcing redirectTo: exp://xxx.exp.direct/--/auth/callback
✅ Magic link callback detected with hash fragment tokens
Fragment parameters: ['access_token', 'refresh_token', 'token_type', 'expires_in']
✅ Logged in
```

## 🔧 Current Working Features

### ✅ Authentication System
- Magic link authentication with Supabase v2
- Hash fragment token parsing (#access_token=...)
- Deep link handling with tunnel URL support
- Auth callback screen with loading UI

### ✅ Core Infrastructure
- Centralized environment configuration (`config/env.ts`)
- Supabase client with proper auth setup
- URL generation verification utilities
- Comprehensive error handling and logging

## 🚧 Next Development Priorities

1. **Event Management** - Create and manage events
2. **Role-Based Access** - Implement permission system
3. **Attendee Management** - Check-in interface and real-time sync
4. **Roster Import** - CSV and Google Sheets integration
5. **Admin Onboarding** - Event creation and user invitations

## 🐛 Common Issues

### Magic Link Not Working
- Check Supabase redirect URLs include tunnel URLs
- Verify environment variables are set
- Check console logs for URL generation

### Deep Link Issues
- Ensure app scheme is configured in `app.json`
- Test with both local and tunnel URLs
- Check hash fragment token parsing

### Session Not Persisting
- Verify Supabase client configuration
- Check AsyncStorage permissions
- Review auth context implementation

## 📱 Testing on Physical Devices

1. **Install Expo Go** on your phone
2. **Start with tunnel**: `npx expo start --tunnel`
3. **Scan QR code** with Expo Go
4. **Test magic link** - should work on physical device

## 🔄 Git Workflow

```bash
# Current branch: feature/supabase-integration
# Push to dev when ready
git checkout dev
git merge feature/supabase-integration
git push origin dev

# Create new feature branch
git checkout -b feature/event-management
```

## 📚 Documentation Links

- [Supabase Dashboard Setup](supabase-dashboard-setup.md)
- [Troubleshooting Magic Links](troubleshooting-magic-links.md)
- [Integration Plan](supabase-integration-plan.md)
