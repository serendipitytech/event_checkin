/**
 * Lintnotes
 * - Purpose: Anonymous session handling and code redemption against Edge Function.
 * - Exports: ensureAnonymousSession, redeemEventCode, getClientInstanceId
 */

import AsyncStorage from '../utils/safeAsyncStorage';
import { getSupabaseClient } from './supabase';

const CLIENT_INSTANCE_KEY = 'client_instance_id';

function randomUUID(): string {
  // Simple uuid v4 fallback (React Native)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getClientInstanceId(): Promise<string> {
  try {
    const val = await AsyncStorage.getItem(CLIENT_INSTANCE_KEY);
    if (val) return val;
  } catch {}
  const id = randomUUID();
  try { await AsyncStorage.setItem(CLIENT_INSTANCE_KEY, id); } catch {}
  return id;
}

export async function ensureAnonymousSession(): Promise<void> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  if (data?.session) return; // already signed in (email or anon)

  const maybeAnon = (supabase.auth as any).signInAnonymously;
  if (typeof maybeAnon === 'function') {
    const { error } = await maybeAnon.call(supabase.auth);
    if (error) throw error;
    return;
  }
  throw new Error('Anonymous sign-in is not available in current SDK. Please upgrade @supabase/supabase-js.');
}

export async function redeemEventCode(code: string): Promise<{ success: boolean; eventId?: string; role?: string; error?: string }>{
  const supabase = getSupabaseClient();
  await ensureAnonymousSession();
  const clientInstanceId = await getClientInstanceId();
  const { data, error } = await supabase.functions.invoke('redeem_event_code', {
    method: 'POST',
    body: { code, clientInstanceId },
  });
  if (error) return { success: false, error: error.message };
  return data;
}

