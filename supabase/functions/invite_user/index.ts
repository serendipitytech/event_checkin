import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { global: { headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` } } }
);

serve(async (req) => {
  try {
    const { email, eventId, role = "checker", redirectTo: clientRedirectTo } = await req.json();

    console.log("🎯 Invite flow starting:", { email, eventId, role });

    // Use client-provided redirectTo with fallback for production
    const redirectTo = clientRedirectTo || "https://your-app-domain.com/auth/callback";
    
    console.log("🔗 Client provided redirectTo:", clientRedirectTo);
    console.log("🔗 Using final redirectTo:", redirectTo);

    let userId: string | null = null;
    let userCreated = false;
    let eventMembershipCreated = false;

    // 1. Check if user already exists
    console.log("👤 Checking if user exists:", email);
    const { data: existing, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error("❌ Error listing users:", listError);
      throw new Error(`Failed to check user existence: ${listError.message}`);
    }

    const foundUser = existing?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (foundUser) {
      userId = foundUser.id;
      console.log("✅ User already exists:", { userId, email });
    } else {
      // 2. Create user if they don't exist
      console.log("🆕 Creating new user:", email);
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true, // Mark email as confirmed to skip confirmation flow
      });
      if (createError) {
        console.error("❌ Error creating user:", createError);
        throw new Error(`Failed to create user account: ${createError.message}`);
      }
      userId = created.user?.id ?? null;
      userCreated = true;
      console.log("✅ User created successfully:", { userId, email });
    }

    // 3. Add user to event_members table
    if (userId) {
      console.log("📝 Adding user to event:", { userId, eventId, role });
      const { data: membershipData, error: membershipError } = await supabase
        .from("event_members")
        .upsert({ 
          event_id: eventId, 
          user_id: userId, 
          role 
        }, {
          onConflict: 'event_id,user_id'
        })
        .select();

      if (membershipError) {
        console.error("❌ Error adding user to event:", membershipError);
        throw new Error(`Failed to add user to event: ${membershipError.message}`);
      }
      
      eventMembershipCreated = true;
      console.log("✅ User added to event successfully:", { userId, eventId, role });
    }

    // 4. Send login magic link explicitly
    console.log("📧 Sending magic link to:", email);
    const { data: linkData, error: linkErr } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (linkErr) {
      console.error("❌ Error sending magic link:", linkErr);
      throw linkErr;
    }

    console.log("✅ Magic link sent successfully with redirect:", redirectTo);

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
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("❌ Invite function error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});