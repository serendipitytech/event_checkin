import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_ROLES = ["checker", "manager"];

// Basic email format check
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // 1. Check Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Verify caller identity using anon-key client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: userError,
    } = await anonClient.auth.getUser();
    if (userError || !caller) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const {
      email,
      eventId,
      role = "checker",
      redirectTo: clientRedirectTo,
    } = await req.json();

    // 3. Validate inputs
    if (!email || !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    if (!eventId) {
      return new Response(
        JSON.stringify({ error: "eventId is required" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    if (!VALID_ROLES.includes(role)) {
      return new Response(
        JSON.stringify({
          error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Verify caller has manager role for this event
    const { data: membershipRows, error: membershipError } = await anonClient
      .from("event_members")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", caller.id)
      .single();

    if (
      membershipError ||
      !membershipRows ||
      membershipRows.role !== "manager"
    ) {
      return new Response(
        JSON.stringify({ error: "Only event managers can send invitations" }),
        {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // 5. Create service-role client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${supabaseServiceKey}` },
      },
    });

    console.log("Invite flow starting:", {
      email,
      eventId,
      role,
      callerEmail: caller.email,
    });

    const redirectTo =
      clientRedirectTo || "https://your-app-domain.com/auth";

    let userId: string | null = null;
    let userCreated = false;
    let eventMembershipCreated = false;

    // 6. Check if user already exists
    let foundUser: any = null;

    const { data: userList, error: listError } =
      await adminClient.auth.admin.listUsers();
    if (!listError && userList?.users) {
      foundUser = userList.users.find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase()
      );
    }

    if (foundUser) {
      userId = foundUser.id;
      console.log("User already exists:", { userId, email });
    } else {
      // Create user if they don't exist
      const { data: created, error: createError } =
        await adminClient.auth.admin.createUser({
          email,
          email_confirm: true,
        });
      if (createError) {
        throw new Error(
          `Failed to create user account: ${createError.message}`
        );
      }
      userId = created.user?.id ?? null;
      userCreated = true;
      console.log("User created:", { userId, email });
    }

    // 7. Add user to event_members table
    if (userId) {
      const { error: memberError } = await adminClient
        .from("event_members")
        .upsert(
          { event_id: eventId, user_id: userId, role },
          { onConflict: "event_id,user_id" }
        )
        .select();

      if (memberError) {
        throw new Error(
          `Failed to add user to event: ${memberError.message}`
        );
      }

      eventMembershipCreated = true;
      console.log("User added to event:", { userId, eventId, role });
    }

    // 8. Send login magic link
    const { error: linkErr } = await adminClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (linkErr) {
      throw linkErr;
    }

    console.log("Magic link sent with redirect:", redirectTo);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation sent to ${email}`,
        userCreated,
        eventMembershipCreated,
        eventId,
        userId,
        role,
        redirectTo,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Invite function error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Unknown error" }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
