# Supabase Dashboard Configuration for Expo Magic Links

## 🚨 CRITICAL: Fix Magic Link Redirect Issue

If your magic links are redirecting to `https://efcgzxjwystresjbcezc.supabase.co` instead of your Expo app, follow these exact steps.

### Supabase v2 Magic Link Flow

This app uses **Supabase v2** magic link authentication flow:
1. `signInWithOtp()` sends magic link email
2. Deep link opens with token parameter
3. `verifyOtp()` with `token_hash` establishes session
4. User is authenticated and logged in

### 1. Authentication Settings

Go to: **Supabase Dashboard** → **Your Project** → **Authentication** → **URL Configuration**

#### Site URL
- **Set to**: `https://efcgzxjwystresjbcezc.supabase.co`
- **Why**: Required by Supabase but not used by Expo for redirects

#### Redirect URLs
**Copy and paste these EXACT URLs** into your **Redirect URLs** list:

```
exp://127.0.0.1:8081/--/auth/callback
exp://*.exp.direct/--/auth/callback
expo-checkin://auth/callback
http://localhost:3000/auth/callback
```

**Required URLs for all environments:**
- `exp://127.0.0.1:8081/--/auth/callback` - Local Expo Go
- `exp://*.exp.direct/--/auth/callback` - Tunnel Expo Go (wildcard for all tunnel variations)
- `expo-checkin://auth/callback` - Production custom scheme
- `http://localhost:3000/auth/callback` - Web development fallback

**⚠️ IMPORTANT**: Remove any extra redirect URLs. Keep only these 4 URLs.

**CRITICAL NOTES**: 
- ✅ **Include** the `--` path segment for Expo Go URLs (required)
- ✅ **Use wildcards** (`*`) for exp.direct URLs to catch all tunnel variations
- ✅ **Include** `http://localhost:3000/auth/callback` for web development fallback
- ❌ **Remove** any URLs without the `--` path segment for Expo URLs

#### Expected URL Formats

**Development (Expo Go with tunnel):**
```
exp://u3m58lo-serendipitytech-8081.exp.direct/--/auth/callback
```

**Development (Expo Go local):**
```
exp://127.0.0.1:8081/--/auth/callback
```

**Production (Custom scheme):**
```
expo-checkin://auth/callback
```

### 2. Common Issues and Fixes

#### Issue: Magic link redirects to Supabase domain instead of app
**Cause**: Missing `--` path segment in redirect URLs or incorrect URL format
**Fix**: 
1. Add `exp://*.exp.direct/--/auth/callback` to redirect URLs
2. Ensure all Expo URLs include the `--` path segment
3. Remove any URLs without the `--` segment

#### Issue: Magic link still uses localhost
**Cause**: Site URL is set to localhost or localhost is in redirect URLs
**Fix**: 
1. Change Site URL to your Supabase project URL
2. Remove localhost URLs from redirect URLs
3. Clear browser cache and try again

#### Issue: "Invalid redirect URL" error
**Cause**: Generated URL doesn't match any in the redirect URLs list
**Fix**: 
1. Check console logs for the generated URL
2. Add the exact URL to your redirect URLs list
3. Use wildcards for tunnel URLs: `exp://*.exp.direct/--/auth/callback`

#### Issue: Deep link doesn't open app
**Cause**: Missing `--` path segment in the generated URL
**Fix**: 
1. Verify console shows URL with `--` segment
2. Update Supabase redirect URLs to include `--` segment
3. Test with fresh magic link

#### Issue: Deep link handler rejects Supabase OTP links
**Cause**: Deep link handler expects specific URL patterns
**Fix**: 
1. Check console logs for "Not an auth callback URL" message
2. Verify URL contains `/auth/callback`, `--/auth/callback`, `verify`, or `supabase.co` with `token`
3. Update Supabase redirect URLs to match expected patterns
4. Ensure all required URLs are in Supabase dashboard

### 3. Testing Your Configuration

1. **Start Expo with tunnel**:
   ```bash
   npx expo start --tunnel
   ```

2. **Trigger login** and check console logs:
   ```
   🔗 Forcing redirectTo: exp://u3m58lo-serendipitytech-8081.exp.direct/--/auth/callback
   === SENDING MAGIC LINK ===
   Email: your@email.com
   🔗 Forcing redirectTo: exp://u3m58lo-serendipitytech-8081.exp.direct/--/auth/callback
   ```

3. **Verify the magic link email** contains the exact same URL:
   ```
   exp://u3m58lo-serendipitytech-8081.exp.direct/--/auth/callback
   ```

4. **Click the magic link** and check console logs:
   ```
   === RECEIVED DEEP LINK ===
   Full URL: exp://u3m58lo-serendipitytech-8081.exp.direct/--/auth/callback?token=...
   ✅ Magic link callback detected, processing with verifyOtp...
   Token extracted from URL: 56c5b1cc86...
   ✅ Logged in
   User ID: xxx-xxx-xxx
   Email: your@email.com
   ```

5. **Test the complete flow**:
   - Click magic link in email
   - Should open Expo Go app (not Safari)
   - Should complete authentication
   - Should show success message

### 4. Production Configuration

For production builds, ensure these URLs are in your redirect URLs:
```
expo-checkin://auth/callback
https://yourdomain.com/auth/callback
```

### 5. Quick Fix Checklist

- [ ] Site URL set to `https://your-project.supabase.co`
- [ ] Redirect URLs include `exp://*.exp.direct/auth/callback`
- [ ] No localhost URLs in redirect URLs
- [ ] Tunnel URL shows in console logs
- [ ] Magic link email contains tunnel URL
- [ ] App opens when clicking magic link on device

### 6. Debug Commands

Add this to your app to debug URL generation:

```typescript
import { verifyAuthUrl } from './utils/verifyAuthUrl';

// Call this to see what URL is being generated
verifyAuthUrl();
```

This will show you exactly what URL is being generated and whether it's a tunnel URL or localhost URL.
