// @supabase-auth-allow-anon
/**
 * Lintnotes
 * - Purpose: Dev-only redirect function for Supabase magic-link callbacks.
 *            Forwards to the current Expo tunnel URL so links open the running dev app.
 * - Config: Set secrets ENVIRONMENT=dev and EXPO_TUNNEL_URL to your current tunnel.
 * - Behavior: If ENVIRONMENT!=='dev', falls back to production scheme (safety), mirroring redirect.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const env = Deno.env.get("ENVIRONMENT") ?? "dev";

    const expoTunnel =
      Deno.env.get("EXPO_TUNNEL_URL") ||
      "exp://exp-direct-url-placeholder/--/auth";
    const prodScheme = "checkin://auth";

    const baseTarget = env === "dev" ? expoTunnel : prodScheme;

    // Preserve any hash fragments if present (Supabase may append)
    const fragment = url.hash ? url.hash : "";
    const redirectUrl = `${baseTarget}?token=${encodeURIComponent(token)}${fragment}`;

    console.log("🔁 [redirect-dev] Redirecting to:", redirectUrl);

    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl },
    });
  } catch (err) {
    console.error("[redirect-dev] Redirect error:", err);
    return new Response(
      JSON.stringify({ error: "Internal redirect error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

