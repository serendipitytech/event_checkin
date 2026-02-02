/**
 * Lintnotes
 * - Purpose: Manage event access codes - create, list, revoke, and audit.
 * - Exports: createAccessCode, listAccessCodes, revokeAccessCode, getCodeRedemptions, generateCodeString
 * - Major deps: services/supabase client; Supabase RPCs; expo-crypto for secure random/hash
 * - Side effects: None (pure data operations via Supabase RPCs).
 */
import * as Crypto from 'expo-crypto';
import { getSupabaseClient } from './supabase';

export type AccessCodeRole = 'checker' | 'manager';

export type CreateAccessCodeOptions = {
  role?: AccessCodeRole;
  expiresAt?: Date | null;
  maxUses?: number | null;
  note?: string | null;
};

export type AccessCode = {
  id: string;
  eventId: string;
  role: string;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  singleDevice: boolean;
  disabled: boolean;
  note: string | null;
  createdAt: Date;
  createdBy: string | null;
  redemptionCount: number;
};

export type CodeRedemption = {
  id: string;
  userId: string;
  clientInstanceId: string | null;
  createdAt: Date;
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_CODE_LENGTH = 8;
const CODE_SEGMENT_LENGTH = 4;

async function generateRandomCode(length: number = DEFAULT_CODE_LENGTH): Promise<string> {
  const segments: string[] = [];
  let remaining = length;

  while (remaining > 0) {
    const segmentLength = Math.min(CODE_SEGMENT_LENGTH, remaining);
    const randomBytes = await Crypto.getRandomBytesAsync(segmentLength);
    let segment = '';

    for (let i = 0; i < segmentLength; i++) {
      const randomIndex = randomBytes[i] % CODE_ALPHABET.length;
      segment += CODE_ALPHABET[randomIndex];
    }
    segments.push(segment);
    remaining -= segmentLength;
  }

  return segments.join('-');
}

function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]+/g, '');
}

export async function generateCodeString(length: number = DEFAULT_CODE_LENGTH): Promise<string> {
  return generateRandomCode(length);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_CODE_LENGTH = 4;
const MAX_NOTE_LENGTH = 500;

export async function createAccessCode(
  eventId: string,
  plainCode: string,
  options: CreateAccessCodeOptions = {}
): Promise<{ success: boolean; code?: AccessCode; error?: string }> {
  if (!eventId || !UUID_REGEX.test(eventId)) {
    return { success: false, error: 'Invalid event ID format' };
  }

  if (!plainCode || plainCode.length < MIN_CODE_LENGTH) {
    return { success: false, error: `Code must be at least ${MIN_CODE_LENGTH} characters` };
  }

  const { role = 'checker', expiresAt = null, maxUses = null, note = null } = options;

  if (role !== 'checker' && role !== 'manager') {
    return { success: false, error: 'Invalid role: must be checker or manager' };
  }

  if (note && note.length > MAX_NOTE_LENGTH) {
    return { success: false, error: `Note must be at most ${MAX_NOTE_LENGTH} characters` };
  }

  const supabase = getSupabaseClient();
  const normalizedCode = normalizeCode(plainCode);

  const { data, error } = await supabase.rpc('create_event_access_code', {
    p_event_id: eventId,
    p_plain_code: normalizedCode,
    p_role: role,
    p_expires_at: expiresAt?.toISOString() ?? null,
    p_max_uses: maxUses,
    p_note: note,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const row = data as {
    id: string;
    event_id: string;
    role: string;
    expires_at: string | null;
    max_uses: number | null;
    used_count: number;
    single_device: boolean;
    disabled: boolean;
    note: string | null;
    created_at: string;
    created_by: string | null;
  };

  return {
    success: true,
    code: {
      id: row.id,
      eventId: row.event_id,
      role: row.role,
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      maxUses: row.max_uses,
      usedCount: row.used_count,
      singleDevice: row.single_device,
      disabled: row.disabled,
      note: row.note,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by,
      redemptionCount: 0,
    },
  };
}

export async function listAccessCodes(
  eventId: string
): Promise<{ success: boolean; codes?: AccessCode[]; error?: string }> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('list_event_access_codes', {
    p_event_id: eventId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const rows = (data ?? []) as Array<{
    id: string;
    event_id: string;
    role: string;
    expires_at: string | null;
    max_uses: number | null;
    used_count: number;
    single_device: boolean;
    disabled: boolean;
    note: string | null;
    created_at: string;
    created_by: string | null;
    redemption_count: number;
  }>;

  const codes: AccessCode[] = rows.map((row) => ({
    id: row.id,
    eventId: row.event_id,
    role: row.role,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    singleDevice: row.single_device,
    disabled: row.disabled,
    note: row.note,
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
    redemptionCount: row.redemption_count,
  }));

  return { success: true, codes };
}

export async function revokeAccessCode(
  codeId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.rpc('revoke_event_access_code', {
    p_code_id: codeId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getCodeRedemptions(
  codeId: string
): Promise<{ success: boolean; redemptions?: CodeRedemption[]; error?: string }> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('get_code_redemptions', {
    p_code_id: codeId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const rows = (data ?? []) as Array<{
    id: string;
    user_id: string;
    client_instance_id: string | null;
    created_at: string;
  }>;

  const redemptions: CodeRedemption[] = rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    clientInstanceId: row.client_instance_id,
    createdAt: new Date(row.created_at),
  }));

  return { success: true, redemptions };
}

export function isCodeExpired(code: AccessCode): boolean {
  if (!code.expiresAt) return false;
  return new Date() > code.expiresAt;
}

export function isCodeUsageLimitReached(code: AccessCode): boolean {
  if (code.maxUses === null) return false;
  return code.usedCount >= code.maxUses;
}

export function getCodeStatus(code: AccessCode): 'active' | 'expired' | 'revoked' | 'exhausted' {
  if (code.disabled) return 'revoked';
  if (isCodeExpired(code)) return 'expired';
  if (isCodeUsageLimitReached(code)) return 'exhausted';
  return 'active';
}

export function formatCodeForDisplay(code: string): string {
  const clean = code.toUpperCase().replace(/[\s-]+/g, '');
  const segments: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    segments.push(clean.slice(i, i + 4));
  }
  return segments.join('-');
}
