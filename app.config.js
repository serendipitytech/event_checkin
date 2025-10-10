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
    name: 'CheckIn by Serendipity',
    slug: 'checkin',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],

    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.serendipity.checkin',
      buildNumber: '9',
      infoPlist: {
        CFBundleURLTypes: [
          {
            CFBundleURLName: 'checkin',
            CFBundleURLSchemes: ['checkin'],
          },
        ],
      },
    },

    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.serendipity.checkin',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'checkin' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },

    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
      output: 'static',
    },

    scheme: 'checkin',

    extra: {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_REDIRECT_URL:
        process.env.EXPO_PUBLIC_REDIRECT_URL ||
        'https://checkin.serendipitytechnology.com/auth/callback',
      EXPO_PUBLIC_ENV: process.env.EXPO_PUBLIC_ENV || 'production',
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      eas: {
        projectId: 'your-project-id',
      },
    },

    plugins: ['expo-router'],
  },
};