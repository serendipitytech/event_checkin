import 'dotenv/config';
import { config } from 'dotenv';
import fs from 'fs';

const appEnv = process.env.APP_ENV || process.env.NODE_ENV || 'development';
const envFile =
  appEnv === 'production' ? '.env.production' : '.env.development';

// Load the appropriate .env file
if (fs.existsSync(envFile)) {
  config({ path: envFile });
  console.log(`🔧 Loaded environment file: ${envFile}`);
} else {
  console.warn(`⚠️ Missing ${envFile} — using defaults.`);
}

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
      EXPO_PUBLIC_REDIRECT_URL: process.env.EXPO_PUBLIC_REDIRECT_URL,
      EXPO_PUBLIC_ENV: process.env.EXPO_PUBLIC_ENV,
      EXPO_TUNNEL_URL: process.env.EXPO_TUNNEL_URL,
    },

    plugins: ['expo-router'],
  },
};