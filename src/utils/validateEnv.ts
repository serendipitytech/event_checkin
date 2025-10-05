/**
 * Lintnotes
 * - Purpose: Validate required EXPO_PUBLIC_* environment variables and log clear messages.
 * - Exports: validateEnv()
 * - Major deps: None (uses process.env only)
 * - Side effects: Console logging only; no exceptions thrown.
 */

export function validateEnv(): void {
  const required = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_REDIRECT_URL',
    'EXPO_PUBLIC_ENV',
  ] as const;

  let missing = 0;

  for (const key of required) {
    const val = process.env[key as keyof typeof process.env];
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

