/**
 * Lintnotes
 * - Purpose: Create and cache a configured Supabase client for React Native with AsyncStorage-backed auth.
 * - Exports: getSupabaseClient, clearSupabaseClient
 * - Major deps: @supabase/supabase-js, @react-native-async-storage/async-storage, react-native-url-polyfill, config/env
 * - Side effects: Imports URL polyfill globally; caches client instance in module scope.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, validateConfig } from '../config/env';

let client: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  // Validate configuration on first access
  validateConfig();

  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    });
  }

  return client;
};

// Function to clear the cached client (useful for testing or config changes)
export const clearSupabaseClient = (): void => {
  client = null;
};
