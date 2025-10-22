# Environment Setup Guide

## Overview

This document explains how to configure environment variables for different deployment scenarios:
- **Local Development** (npm start / Expo)
- **Vercel Preview** (branch deployments)
- **Production** (main branch / production URL)

---

## Environment Variables Reference

### Required Variables (All Environments)

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_REDIRECT_URL=<environment-specific-url>
```

---

## Local Development (.env.development)

Create a `.env.development` file in the project root:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://efcgzxjwystresjbcezc.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_REDIRECT_URL=http://localhost:19006
EXPO_PUBLIC_ENV=development
```

### Notes:
- The app **automatically detects localhost** and uses `http://localhost:19006` for redirects
- This works even if `EXPO_PUBLIC_REDIRECT_URL` is not explicitly set
- Metro bundler loads `.env.development` automatically when running `npm start`

---

## Production (.env.production)

Create a `.env.production` file in the project root:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://efcgzxjwystresjbcezc.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_REDIRECT_URL=https://efcgzxjwystresjbcezc.functions.supabase.co/redirect-dev
EXPO_PUBLIC_ENV=production
```

### Notes:
- This is the redirect URL for your production Supabase edge function
- Used when deploying to your main production URL
- Vercel will load this when building from the `main` branch

---

## Vercel Preview Deployments

### In Vercel Dashboard:

1. Go to your project → **Settings** → **Environment Variables**
2. Add the following for **Preview** environment:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://efcgzxjwystresjbcezc.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_PREVIEW_REDIRECT_URL=https://your-preview-domain.vercel.app
VERCEL_ENV=preview
```

### How Preview Redirect Works:

The app checks for preview environment in this order:

1. **Is it localhost?** → Use `http://localhost:19006`
2. **Is `VERCEL_ENV=preview`?** → Use `EXPO_PUBLIC_PREVIEW_REDIRECT_URL`
3. **Otherwise** → Use `EXPO_PUBLIC_REDIRECT_URL`

---

## Smart Redirect Logic

The auth service (`services/auth.ts`) automatically detects the environment:

```typescript
// Automatic environment detection
if (window.location.hostname === 'localhost') {
  redirectTo = 'http://localhost:19006';
} else if (process.env.VERCEL_ENV === 'preview') {
  redirectTo = process.env.EXPO_PUBLIC_PREVIEW_REDIRECT_URL;
} else {
  redirectTo = process.env.EXPO_PUBLIC_REDIRECT_URL;
}
```

This means:
- ✅ **Local dev**: Always uses localhost (no configuration needed)
- ✅ **Preview**: Uses your preview URL automatically
- ✅ **Production**: Uses your production redirect URL

---

## Testing the Configuration

### Local Development Test:
```bash
npm start
# Open http://localhost:19006
# Try signing in → should redirect to localhost after clicking magic link
```

### Vercel Preview Test:
```bash
git push origin feature/link-based-auth
# Vercel automatically deploys preview
# Visit preview URL → try signing in
# Should redirect back to preview URL after magic link
```

### Production Test:
```bash
# After merging to main
# Visit production URL → try signing in
# Should redirect to production Supabase function
```

---

## Common Issues

### Issue: "crypto is not defined" on iOS
**Solution:** ✅ Fixed! We now use `expo-crypto` instead of `nanoid`

### Issue: Magic links redirect to wrong URL
**Solution:** Check that `VERCEL_ENV` is set correctly in Vercel dashboard

### Issue: Local development redirects to production
**Solution:** The app automatically detects localhost - no action needed

---

## Supabase Configuration

Make sure your Supabase project has these redirect URLs whitelisted:

1. Go to **Authentication** → **URL Configuration**
2. Add to **Redirect URLs**:
   - `http://localhost:19006` (for local dev)
   - `https://your-preview-domain.vercel.app` (for previews)
   - `https://your-production-domain.vercel.app` (for production)
   - Your Supabase edge function URL

---

## Security Notes

- ✅ Never commit `.env.*` files to git
- ✅ All environment variables are prefixed with `EXPO_PUBLIC_` (exposed to client)
- ✅ Use different Supabase projects for dev/staging/production if handling sensitive data
- ✅ Rotate keys regularly in production

---

## Quick Reference

| Environment | Redirect URL | How It's Set |
|-------------|--------------|--------------|
| Local Dev | `http://localhost:19006` | Auto-detected |
| Preview | Your preview domain | `EXPO_PUBLIC_PREVIEW_REDIRECT_URL` |
| Production | Supabase function | `EXPO_PUBLIC_REDIRECT_URL` |

