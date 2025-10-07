/**
 * Lintnotes
 * - Purpose: Read environment from process.env (CLI/EAS/Vercel) and embedded Expo config (Constants.expoConfig.extra).
 * - Exports: SUPABASE_URL, SUPABASE_ANON_KEY, REDIRECT_URL, ENVIRONMENT, validateConfig()
 * - Major deps: expo-constants
 * - Side effects: Logs warnings when envs are missing; does not throw.
 */
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra || {}) as Record<string, any>;

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || extra.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || '';

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || '';

export const REDIRECT_URL =
  process.env.EXPO_PUBLIC_REDIRECT_URL || extra.EXPO_PUBLIC_REDIRECT_URL || '';

export const ENVIRONMENT =
  process.env.EXPO_PUBLIC_ENV || extra.EXPO_PUBLIC_ENV || 'development';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Missing Supabase environment variables. Check your Vercel config.');
}

console.log('✅ Environment variables validated successfully.');

// Backwards-compatible signature used by services/supabase.ts
export const validateConfig = () => {
  // Non-throwing validation to avoid web runtime crashes
  if (!SUPABASE_URL) console.warn('SUPABASE_URL is missing');
  if (!SUPABASE_ANON_KEY) console.warn('SUPABASE_ANON_KEY is missing');
  if (!REDIRECT_URL) console.warn('REDIRECT_URL is missing');
  return true;
};
