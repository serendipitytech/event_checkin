// @supabase-auth-allow-anon
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const tunnel = Deno.env.get("DEV_EXPO_TUNNEL_URL") ||
      "exp://localhost:8081/--/auth";

    const fragment = url.hash || "";
    const redirectUrl = `${tunnel}?token=${encodeURIComponent(token)}${fragment}`;

    console.log("🔁 [DEV] Redirecting to:", redirectUrl);

    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl },
    });
  } catch (err) {
    console.error("Redirect error:", err);
    return new Response(JSON.stringify({ error: "Internal redirect error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});