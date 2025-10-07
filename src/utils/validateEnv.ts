/**
 * Lintnotes
 * - Purpose: Validate required EXPO_PUBLIC_* environment variables and log clear messages.
 * - Exports: validateEnv()
 * - Major deps: expo-constants
 * - Side effects: Console logging only; no exceptions thrown.
 */
import Constants from 'expo-constants';

export function validateEnv(): void {
  const required = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_REDIRECT_URL',
    'EXPO_PUBLIC_ENV',
  ] as const;

  let missing = 0;

  const extra = (Constants.expoConfig?.extra || {}) as Record<string, any>;

  for (const key of required) {
    const envVal = process.env[key as keyof typeof process.env];
    const extraVal = extra[key];
    const val = envVal ?? extraVal;
    if (!val || String(val).trim() === '') {
      // eslint-disable-next-line no-console
      console.warn(`⚠️ Missing environment variable: ${key}`);
      missing++;
    }
  }

  if (missing === 0) {
    // eslint-disable-next-line no-console
    console.log('✅ Environment variables validated successfully.');
  }
}
