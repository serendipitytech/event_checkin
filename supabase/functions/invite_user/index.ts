import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { global: { headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` } } }
);

serve(async (req) => {
  try {
    const { email, eventId, role, redirectTo: clientRedirectTo } = await req.json();

    // Use client-provided redirectTo with fallback for production
    const redirectTo = clientRedirectTo || "https://your-app-domain.com/auth/callback";
    
    console.log("🔗 Client provided redirectTo:", clientRedirectTo);
    console.log("🔗 Using final redirectTo:", redirectTo);

    // Send login magic link explicitly
    const { data: linkData, error: linkErr } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (linkErr) throw linkErr;

    console.log("✅ Magic link sent successfully with redirect:", redirectTo);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation sent to ${email}`,
        eventId,
        role,
        redirectTo,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Invite function error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});