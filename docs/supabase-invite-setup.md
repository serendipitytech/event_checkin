# Supabase Invite Setup with HTTPS Bridge

This document outlines the setup for the Supabase invite flow using an HTTPS bridge domain to handle magic link redirects.

## Overview

The invite system uses a three-layer approach:
1. **Supabase Edge Function** - Sends magic links with HTTPS redirect URLs
2. **HTTPS Bridge Domain** - Receives HTTPS requests and rewrites to local Expo Go
3. **Apache Rewrite Rules** - Transforms HTTPS URLs to local `exp://` deep links

## 1. Edge Function Configuration

### File: `supabase/functions/invite_user/index.ts`

The Edge Function is configured to always use the HTTPS bridge domain:

```typescript
// Always use HTTPS bridge domain for redirects
const redirectTo = "https://serendipityhosting.net/event_checkin/auth/callback";

console.log("🔗 Using HTTPS bridge redirect URL:", redirectTo);

// Send login magic link explicitly
const { data: linkData, error: linkErr } = await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: redirectTo },
});
```

### Key Features:
- ✅ Hardcoded HTTPS redirect URL (no dynamic logic)
- ✅ Logging to confirm redirect URL being used
- ✅ Simplified magic link sending

## 2. Supabase Dashboard Configuration

### Authentication → Redirect URLs

The following URL **MUST** be added to your Supabase project's allowed redirect URLs:

```
https://serendipityhosting.net/event_checkin/auth/callback
```

**Steps:**
1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Add the above URL to **Redirect URLs**
4. Save the configuration

## 3. Apache Bridge Configuration

### .htaccess Rewrite Rules

The Apache server is configured to rewrite HTTPS requests to local Expo Go deep links:

```apache
# Rewrite HTTPS bridge URLs to local Expo Go deep links
RewriteEngine On
RewriteCond %{REQUEST_URI} ^/event_checkin/auth/callback
RewriteRule ^event_checkin/auth/callback(.*)$ exp://192.168.0.25:8081/--/auth/callback$1 [R=302,L]
```

### How It Works:
1. User clicks magic link: `https://serendipityhosting.net/event_checkin/auth/callback?token=...`
2. Apache receives the HTTPS request
3. Apache rewrites to: `exp://192.168.0.25:8081/--/auth/callback?token=...`
4. Browser opens Expo Go with the local deep link
5. No SSL errors since Supabase only sees valid HTTPS endpoints

## 4. Local Development Testing Flow

### Step 1: Deploy the Edge Function
```bash
supabase functions deploy invite_user
```

### Step 2: Send an Invite
- Use your app's invite functionality
- Check the email for the magic link

### Step 3: Verify Email Content
The email should contain:
```
https://serendipityhosting.net/event_checkin/auth/callback?token=...
```

### Step 4: Test the Flow
1. Click the magic link in the email
2. Browser should redirect through Apache
3. Expo Go should open locally with the deep link
4. No SSL certificate errors should occur

## 5. Troubleshooting

### Common Issues:

**SSL Certificate Errors:**
- Ensure the HTTPS bridge domain has a valid SSL certificate
- Check that Apache is properly configured for HTTPS

**Redirect Not Working:**
- Verify the URL is added to Supabase redirect URLs
- Check Apache rewrite rules are active
- Confirm the local IP address (192.168.0.25:8081) is correct

**Expo Go Not Opening:**
- Ensure Expo Go is installed and running
- Check that the local development server is accessible
- Verify the deep link scheme is correct

### Debugging Steps:

1. **Check Edge Function Logs:**
   ```bash
   supabase functions logs invite_user
   ```
   Look for: `🔗 Using HTTPS bridge redirect URL:` and `✅ Magic link sent successfully with redirect:`

2. **Test Apache Rewrite:**
   - Visit `https://serendipityhosting.net/event_checkin/auth/callback?test=1`
   - Should redirect to `exp://192.168.0.25:8081/--/auth/callback?test=1`

3. **Verify Supabase Configuration:**
   - Check Authentication → URL Configuration
   - Ensure the HTTPS bridge URL is listed

## 6. Production Considerations

### For Production Deployment:
1. Update the Apache rewrite rule to use your production Expo Go URL
2. Ensure the HTTPS bridge domain is properly configured for production
3. Update the Edge Function if needed for production-specific redirects

### Security Notes:
- The HTTPS bridge provides a secure endpoint for Supabase
- Local development URLs are only accessible on your local network
- Magic links contain time-limited tokens for security

## 7. Benefits of This Setup

✅ **No SSL Errors**: Supabase only sees valid HTTPS endpoints  
✅ **Local Development**: Seamless integration with Expo Go  
✅ **Flexible**: Easy to switch between development and production  
✅ **Secure**: HTTPS encryption for all magic link communications  
✅ **Reliable**: Apache handles the URL transformation reliably
