/**
 * Lintnotes
 * - Purpose: Base Expo config (JS form). Specifies app metadata, deep link scheme, native identifiers, and extra env values.
 * - Exports: default Expo config object
 * - Major deps: dotenv (via 'dotenv/config')
 * - Side effects: None beyond reading envs.
 */
/**
 * Lintnotes
 * - Purpose: Base Expo config (JS form). Specifies app metadata, deep link scheme, native identifiers, and extra env values.
 * - Exports: default Expo config object
 * - Major deps: dotenv (via 'dotenv/config')
 * - Side effects: None beyond reading envs.
 */
import 'dotenv/config';

export default {
  expo: {
    name: 'Expo Check-In',
    slug: 'expo-checkin',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.expo.checkin',
      infoPlist: {
        CFBundleURLTypes: [
          {
            CFBundleURLName: 'expo-checkin',
            CFBundleURLSchemes: ['expo-checkin']
          }
        ]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff'
      },
      package: 'com.expo.checkin',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'expo-checkin' }],
          category: ['BROWSABLE', 'DEFAULT']
        }
      ]
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
      output: 'static'
    },
    scheme: 'expo-checkin',
    extra: {
      // Public Supabase environment variables (used for both native & web)
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_REDIRECT_URL:
        process.env.EXPO_PUBLIC_REDIRECT_URL || 'https://my-event-checkin.vercel.app/auth/callback',
      EXPO_PUBLIC_ENV: process.env.EXPO_PUBLIC_ENV || 'production',

      // Legacy keys for backward compatibility with native code
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,

      eas: {
        projectId: 'your-project-id'
      }
    },
    plugins: ['expo-router']
  }
};
