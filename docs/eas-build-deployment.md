# EAS Build & Deployment Guide

_Last updated: Feb 2026_

## Build Profiles

| Profile | Distribution | Purpose |
|---------|--------------|---------|
| `development` | Internal | Dev client for local testing |
| `preview` | Internal | TestFlight internal testing |
| `production` | App Store | App Store / public TestFlight |

## Pre-Build Checklist

1. **Version bump** in `app.config.js`:
   ```javascript
   version: '1.2.0',  // Update for each release
   ```
   Note: `buildNumber` and `versionCode` are managed remotely by EAS (`appVersionSource: "remote"`)

2. **Commit all changes**:
   ```bash
   git add .
   git commit -m "feat(v1.x): description"
   git push origin main
   ```

3. **Verify environment**:
   - `.env.production` has correct Supabase URL and keys
   - `EXPO_PUBLIC_REDIRECT_URL=checkin://auth` for production

## Build Commands

### TestFlight (Internal Testing)
```bash
eas build --profile preview --platform ios
```

### Production (App Store)
```bash
eas build --profile production --platform ios
```

### Submit to App Store / TestFlight
```bash
eas submit --platform ios --latest
```

## Troubleshooting

### Apple Authentication - Keychain Error 36

**Symptom:**
```
Authentication with Apple Developer Portal failed!
Security returned a non-successful error code: 36
```

**Solution:**
Unlock the macOS Keychain before running the build:
```bash
security unlock-keychain
```
You'll be prompted for your macOS login password. Then retry the build command.

**Why this happens:**
EAS CLI tries to save Apple credentials to the macOS Keychain, but the Keychain is locked (common after sleep/restart or extended idle time).

### Encryption Compliance Prompt

If prompted about encryption, the app uses standard HTTPS (Supabase) which is exempt.

This is configured in `app.config.js`:
```javascript
ios: {
  infoPlist: {
    ITSAppUsesNonExemptEncryption: false,
  },
}
```

### Build Number Warnings

If you see warnings about `buildNumber` being ignored, that's expected. EAS manages version numbers remotely when `appVersionSource: "remote"` is set in `eas.json`.

### Credentials Issues

To manage or reset credentials:
```bash
eas credentials --platform ios
```

To see what credentials are configured:
```bash
eas credentials --platform ios
```

## Post-Build

### After TestFlight Build
1. Build completes on EAS servers
2. Run `eas submit --platform ios --latest` to push to TestFlight
3. Wait for Apple processing (~10-30 min)
4. Test on physical devices via TestFlight app

### After Production Build
1. Build completes on EAS servers
2. Run `eas submit --platform ios --latest`
3. Complete App Store Connect metadata if needed
4. Submit for Apple review

## Release Tagging

After successful App Store release:
```bash
git tag -a v1.2.0 -m "Shareable Access Codes"
git push origin v1.2.0
```

## Configuration Files

| File | Purpose |
|------|---------|
| `eas.json` | Build profiles and EAS configuration |
| `app.config.js` | Expo app configuration (version, scheme, etc.) |
| `app.json` | Minimal Expo config (version only, rest in app.config.js) |
| `.env.production` | Production environment variables |
| `.env.development` | Development environment variables |
