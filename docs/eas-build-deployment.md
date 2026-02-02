# EAS Build & Deployment Guide

_Last updated: Feb 2026_

## Build Profiles

| Profile | Distribution | Provisioning | Purpose |
|---------|--------------|--------------|---------|
| `development` | Internal | Ad Hoc | Dev client for local testing |
| `preview` | Internal | Ad Hoc | Direct install via QR/link (NOT for TestFlight) |
| `production` | App Store | Distribution | TestFlight AND App Store |

**Important:** Only `production` builds can be submitted to TestFlight or App Store. The `preview` profile creates Ad Hoc builds that can only be installed directly via a link - they cannot be uploaded to App Store Connect.

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

### Direct Install Testing (Ad Hoc)
Use this for quick internal testing without going through TestFlight:
```bash
eas build --profile preview --platform ios
```
After build completes, install directly via the QR code or link from the EAS dashboard.

**Note:** This build CANNOT be submitted to TestFlight - it uses Ad Hoc provisioning.

### TestFlight / App Store
Use `production` profile for ANY build that needs to go to TestFlight or App Store:
```bash
security unlock-keychain
eas build --profile production --platform ios --auto-submit
```

This builds AND submits to App Store Connect in one step. The build will appear in TestFlight after Apple processing (10-30 min).

### Submit Existing Build to TestFlight
If you built without `--auto-submit`:
```bash
eas submit --platform ios --latest
```

**Remember:** Only `production` profile builds can be submitted. If you get "Invalid Provisioning Profile" error, you used the wrong profile.

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
