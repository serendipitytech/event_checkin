# Supabase Dashboard Configuration for Expo Magic Links

## Critical Configuration Steps

To fix the magic link redirect issue, you need to configure your Supabase dashboard correctly.

### 1. Authentication Settings

Go to: **Supabase Dashboard** → **Your Project** → **Authentication** → **URL Configuration**

#### Site URL
- **Set to**: `https://your-project-id.supabase.co`
- **Why**: This is required by Supabase but not used by Expo
- **Example**: `https://efcgzxjwystresjbcezc.supabase.co`

#### Redirect URLs
Add these URLs to the **Redirect URLs** list:

```
exp://127.0.0.1:8081/auth/callback
exp://*.exp.direct/auth/callback
expo-checkin://auth/callback
```

**Important**: 
- Use wildcards (`*`) for the exp.direct URLs to catch all tunnel variations
- **Remove** any `http://localhost:3000` URLs if they exist

### 2. Common Issues and Fixes

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
3. Use wildcards for tunnel URLs: `exp://*.exp.direct/auth/callback`

### 3. Testing Your Configuration

1. **Start Expo with tunnel**:
   ```bash
   npx expo start --tunnel
   ```

2. **Check console logs** when testing magic link:
   ```
   Generated URL: exp://u3m58lo-serendipitytech-8081.exp.direct/auth/callback
   ✅ TUNNEL URL DETECTED - This will work on physical devices
   ```

3. **Verify the magic link email** contains the tunnel URL, not localhost

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
