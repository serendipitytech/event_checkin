// @supabase-auth-allow-anon
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const env = Deno.env.get("ENVIRONMENT") ?? "dev";

    const expoTunnel =
      Deno.env.get("EXPO_TUNNEL_URL") ||
      "exp://xy9yc6w-serendipitytech-8081.exp.direct/--/auth";
    const prodScheme = "checkin://auth";

    // Base redirect
    const baseTarget =
      env === "dev"
        ? expoTunnel
        : prodScheme;

    // Preserve any hash fragments if present (Supabase will include them after verify)
    const fragment = url.hash ? url.hash : "";
    const redirectUrl = `${baseTarget}?token=${encodeURIComponent(token)}${fragment}`;

    console.log("🔁 Redirecting to:", redirectUrl);

    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl },
    });
  } catch (err) {
    console.error("Redirect error:", err);
    return new Response(
      JSON.stringify({ error: "Internal redirect error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});