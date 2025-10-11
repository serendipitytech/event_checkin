// @supabase-auth-allow-anon
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const scheme = Deno.env.get("PROD_SCHEME_URL") || "checkin://auth";

    const fragment = url.hash || "";
    const redirectUrl = `${scheme}?token=${encodeURIComponent(token)}${fragment}`;

    console.log("🔁 [PROD] Redirecting to:", redirectUrl);

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