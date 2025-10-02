import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const expoExtra = Constants?.expoConfig?.extra ?? {};

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? expoExtra.supabaseUrl ?? '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? expoExtra.supabaseAnonKey ?? '';

let client: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase credentials are missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
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
