import { getSupabaseClient } from './supabase';
import { generateCode } from '@/utils/generateCode';

/**
 * Create a new checker link for a given event
 */
export async function generateCheckerLink(eventId: string) {
  const supabase = getSupabaseClient();
  const code = generateCode(6);
  const { data, error } = await supabase
    .from('checker_links')
    .insert([{ event_id: eventId, code }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Validate a checker link by its code
 */
export async function validateCheckerLink(code: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('validate_checker_code', { p_code: code });
  if (error) throw error;
  return data?.[0];
}

/**
 * Get all checker links for a specific event
 */
export async function getCheckerLinks(eventId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('checker_links')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Revoke a checker link by deleting it
 */
export async function revokeCheckerLink(linkId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('checker_links')
    .delete()
    .eq('id', linkId);

  if (error) throw error;
}

