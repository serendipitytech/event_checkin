import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Admin client (service role) for privileged operations
const admin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
});

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // User-scoped client to read the caller's identity
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'Unable to resolve current user' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = userRes.user.id;

    // Cleanup: remove memberships (does not delete orgs/events themselves)
    const cleanupErrors: string[] = [];

    // organization_members
    const { error: orgMemErr } = await admin
      .from('organization_members')
      .delete()
      .eq('user_id', userId);
    if (orgMemErr) cleanupErrors.push(`organization_members: ${orgMemErr.message}`);

    // event_members
    const { error: eventMemErr } = await admin
      .from('event_members')
      .delete()
      .eq('user_id', userId);
    if (eventMemErr) cleanupErrors.push(`event_members: ${eventMemErr.message}`);

    // attendees: nullify checked_in_by references — preserves event data integrity
    const { error: attNullErr } = await admin
      .from('attendees')
      .update({ checked_in_by: null })
      .eq('checked_in_by', userId);
    if (attNullErr) cleanupErrors.push(`attendees: ${attNullErr.message}`);

    // Optionally, nullify created_by on events; comment out if schema differs
    const { error: eventsNullErr } = await admin
      .from('events')
      .update({ created_by: null })
      .eq('created_by', userId);
    if (eventsNullErr) cleanupErrors.push(`events: ${eventsNullErr.message}`);

    // Finally, delete the auth user (revokes sessions)
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      // If user deletion fails, report along with any prior cleanup errors
      const all = cleanupErrors.concat([`auth.deleteUser: ${delErr.message}`]).join('; ');
      return new Response(JSON.stringify({ success: false, error: all }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, userId, cleanupWarnings: cleanupErrors }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('❌ delete_user error:', err);
    return new Response(JSON.stringify({ error: err?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

