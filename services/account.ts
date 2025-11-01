/**
 * Lintnotes
 * - Purpose: Account-related helpers for deletion and local cleanup.
 * - Exports: deleteMyAccount, deleteLocalSession
 * - Major deps: services/supabase client
 */

import { getSupabaseClient } from './supabase';

export async function deleteMyAccount(): Promise<{ success: boolean; message?: string }>
{
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase.functions.invoke('delete_user', {
      method: 'POST',
      body: {},
    });
    if (error) {
      console.error('delete_user function error:', error);
      return { success: false, message: error.message };
    }
    if (!data?.success) {
      return { success: false, message: data?.error || 'Unknown deletion error' };
    }
    return { success: true };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : 'Unknown error' };
  }
}

export async function deleteLocalSession(): Promise<void> {
  const supabase = getSupabaseClient();
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore sign-out failures
  }
}

