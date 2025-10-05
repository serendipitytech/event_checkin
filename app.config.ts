/**
 * Lintnotes
 * - Purpose: Typed Expo app config that merges env (.env) and existing config.extra into the final Expo config.
 * - Exports: default config function (ExpoConfig)
 * - Major deps: expo/config, dotenv (optional)
 * - Side effects: Loads environment variables via dotenv in development if available.
 */
import { ConfigContext, ExpoConfig } from 'expo/config';

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
} catch (error) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('dotenv not found: falling back to process env only');
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const existingExtra = (config.extra ?? {}) as Record<string, unknown>;

  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    (existingExtra.supabaseUrl as string | undefined) ??
    '';

  const supabaseAnonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    (existingExtra.supabaseAnonKey as string | undefined) ??
    '';

  const mergedConfig: ExpoConfig = {
    ...config,
    name: config.name ?? 'Expo Checkin',
    slug: config.slug ?? 'expo-checkin',
    extra: {
      ...existingExtra,
      supabaseUrl,
      supabaseAnonKey
    }
  };

  return mergedConfig;
};
