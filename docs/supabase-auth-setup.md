# Supabase Authentication Setup Guide

This guide explains how to configure Supabase authentication for the Expo Check-In app to work seamlessly in both development and production environments.

## Overview

The app uses a centralized configuration system that automatically selects the appropriate redirect URLs based on the environment (development vs production) without requiring manual code changes.

## Environment Configuration

### Development Environment

In development, the app automatically uses these redirect URLs:
- **Expo Go**: `exp://127.0.0.1:8081`
- **Development Build**: `http://localhost:3000`

### Production Environment

In production, the app uses:
- **Deep Link**: `expo-checkin://auth/callback`
- **Web Fallback**: `https://checkin.yourdomain.com` (if applicable)

## Supabase Dashboard Configuration

### 1. Authentication Settings

In your Supabase project dashboard, navigate to **Authentication > URL Configuration** and add these redirect URLs:

#### For Development
```
exp://127.0.0.1:8081
http://localhost:3000
```

#### For Production
```
expo-checkin://auth/callback
https://checkin.yourdomain.com
```

### 2. Site URL Configuration

Set the **Site URL** in Supabase to your primary production URL:
```
https://checkin.yourdomain.com
```

### 3. Email Templates (Optional)

Customize the email templates in **Authentication > Email Templates** to match your app's branding.

## Environment Variables

### Development (.env file)

Create a `.env` file in your project root:

```bash
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Production (EAS Build)

Configure environment variables in your `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key-here"
      }
    }
  }
}
```

## App Configuration

The app uses `app.config.js` to handle dynamic configuration:

```javascript
export default {
  expo: {
    scheme: 'expo-checkin',
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
    // ... other config
  }
};
```

## How It Works

### 1. Centralized Configuration

The `config/env.ts` file automatically detects the environment and selects appropriate URLs:

```typescript
const getRedirectUrl = () => {
  if (isDev) {
    if (isExpoGo) {
      return 'exp://127.0.0.1:8081';
    } else {
      return 'http://localhost:3000';
    }
  } else {
    return 'expo-checkin://auth/callback';
  }
};
```

### 2. Dynamic Auth Flow

The auth service uses the dynamic configuration:

```typescript
const { error } = await supabase.auth.signInWithOtp({
  email: email.trim(),
  options: {
    emailRedirectTo: REDIRECT_URL, // Dynamically selected
  },
});
```

### 3. Deep Link Handling

The app automatically handles deep links using Expo's Linking API:

```typescript
export const initializeDeepLinkHandling = async () => {
  const initialUrl = await Linking.getInitialURL();
  if (initialUrl) {
    await handleDeepLink(initialUrl);
  }

  const subscription = Linking.addEventListener('url', (event) => {
    handleDeepLink(event.url);
  });
};
```

## Testing Authentication

### Development Testing

1. **Expo Go**: Run `npx expo start` and test magic link authentication
2. **Development Build**: Create a development build and test the flow
3. **Check Console**: Look for debug information in the console

### Production Testing

1. **Build App**: Create a production build with EAS Build
2. **Install**: Install the app on a device
3. **Test Flow**: Test the complete authentication flow
4. **Verify**: Ensure deep links work correctly

## Troubleshooting

### Common Issues

#### 1. "Invalid redirect URL" Error

**Problem**: Supabase rejects the redirect URL
**Solution**: Ensure all redirect URLs are whitelisted in Supabase dashboard

#### 2. Deep Links Not Working

**Problem**: App doesn't respond to deep links
**Solution**: 
- Check `app.config.js` has correct scheme
- Verify intent filters (Android) and URL schemes (iOS)
- Test with `npx uri-scheme open expo-checkin://auth/callback --ios`

#### 3. Environment Variables Not Loading

**Problem**: Supabase credentials not found
**Solution**:
- Check `.env` file exists and has correct variables
- Restart Expo development server
- Verify variable names start with `EXPO_PUBLIC_`

#### 4. Development vs Production Mismatch

**Problem**: Different behavior between environments
**Solution**:
- Check debug logs in development
- Verify environment detection (`__DEV__` flag)
- Ensure production build has correct environment variables

### Debug Information

In development, the app logs debug information:

```typescript
const debugInfo = getDebugInfo();
console.log('Auth Debug Info:', debugInfo);
```

This shows:
- Current environment (development/production)
- App ownership (expo/managed/standalone)
- Supabase URL and redirect URL
- Deep link scheme

## Security Considerations

### 1. Environment Variables

- Never commit `.env` files to version control
- Use different Supabase projects for development and production
- Rotate API keys regularly

### 2. Redirect URLs

- Only whitelist necessary URLs in Supabase
- Use HTTPS in production
- Avoid wildcard redirects

### 3. Deep Links

- Validate deep link URLs before processing
- Handle malformed URLs gracefully
- Log security-relevant events

## Migration Guide

If upgrading from a previous version:

1. **Update Configuration**: Replace hardcoded URLs with dynamic config
2. **Update Supabase**: Add new redirect URLs to dashboard
3. **Test Thoroughly**: Verify both development and production flows
4. **Update Documentation**: Ensure team knows new configuration process

## Support

For issues with this configuration:

1. Check the debug logs in development
2. Verify Supabase dashboard settings
3. Test with different environments
4. Review this documentation

The configuration system is designed to be robust and handle edge cases automatically, but proper setup is essential for smooth operation.
