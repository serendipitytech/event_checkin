import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
});

// Cache the salt to avoid repeated Vault lookups (cleared on function cold start)
let cachedSalt: string | null = null;

async function getCodeSalt(): Promise<string> {
  if (cachedSalt) {
    return cachedSalt;
  }

  // Fetch salt from Vault via RPC - single source of truth
  const { data, error } = await admin.rpc('get_code_salt');

  if (error || !data) {
    console.error('Failed to fetch code_salt from Vault:', error);
    throw new Error('CODE_SALT not configured in Vault');
  }

  cachedSalt = data as string;
  console.log('Loaded code_salt from Vault');
  return cachedSalt;
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = enc.encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const rawCode: string = (body?.code || '').toString().trim();
    const clientInstanceId: string | undefined = body?.clientInstanceId || undefined;
    if (!rawCode) {
      return new Response(JSON.stringify({ error: 'Missing code' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Get salt from Vault (cached after first call)
    const codeSalt = await getCodeSalt();

    const normalized = rawCode.toUpperCase().replace(/\s+/g, '');
    const codeHash = await sha256Hex(`${codeSalt}|${normalized}`);

    // Resolve current user
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'Unable to resolve current user' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    const userId = userRes.user.id;

    // Look up code
    const { data: codes, error: codeErr } = await admin
      .from('event_access_codes')
      .select('*')
      .eq('code_hash', codeHash)
      .limit(1);

    if (codeErr) {
      return new Response(JSON.stringify({ error: codeErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    const code = codes?.[0];
    if (!code) {
      return new Response(JSON.stringify({ error: 'Invalid code' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (code.disabled) {
      return new Response(JSON.stringify({ error: 'Code disabled' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (code.expires_at && new Date(code.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Code expired' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (code.max_uses !== null && code.max_uses !== undefined && code.used_count >= code.max_uses) {
      return new Response(JSON.stringify({ error: 'Code usage limit reached' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // If single_device, ensure same clientInstanceId or not used yet
    if (code.single_device) {
      if (!clientInstanceId) {
        return new Response(JSON.stringify({ error: 'Device binding required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const { data: prior, error: priorErr } = await admin
        .from('event_code_redemptions')
        .select('client_instance_id')
        .eq('code_id', code.id)
        .limit(1);
      if (priorErr) {
        return new Response(JSON.stringify({ error: priorErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      const first = prior?.[0];
      if (first && first.client_instance_id && first.client_instance_id !== clientInstanceId) {
        return new Response(JSON.stringify({ error: 'Code already bound to another device' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Grant membership (idempotent) to the event with role from code
    const { error: upsertErr } = await admin
      .from('event_members')
      .upsert({ event_id: code.event_id, user_id: userId, role: code.role }, { onConflict: 'event_id,user_id' });
    if (upsertErr) {
      return new Response(JSON.stringify({ error: upsertErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // Insert redemption audit (ignore if already redeemed)
    await admin
      .from('event_code_redemptions')
      .upsert({ event_id: code.event_id, code_id: code.id, user_id: userId, client_instance_id: clientInstanceId }, { onConflict: 'code_id,user_id' });

    // Increment used_count if under max_uses (ignore errors silently)
    if (code.max_uses === null || code.max_uses === undefined || code.used_count < code.max_uses) {
      const { error: incErr } = await admin.rpc('http_increment_code_use', { p_code_id: code.id });
      if (incErr) {
        // Non-fatal; log and continue
        console.warn('increment_code_use failed:', incErr.message);
      }
    }

    return new Response(JSON.stringify({ success: true, eventId: code.event_id, role: code.role }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('❌ redeem_event_code error:', err);
    return new Response(JSON.stringify({ error: err?.message ?? 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
