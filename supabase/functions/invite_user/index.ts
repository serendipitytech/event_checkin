import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // ✅ safe here
    );

    const { email, role, eventId, orgId, orgName, redirectTo } = await req.json();

    if (!email || !role || !eventId) {
      return new Response(JSON.stringify({ error: 'Missing required fields: email, role, eventId' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate role
    if (!['manager', 'checker'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role. Must be manager or checker' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log("Invite flow: Starting", { email, role, eventId, orgId, orgName });

    // 1. Check or create user
    console.log("Invite flow: Checking user existence", { email });
    const { data: existing, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('Invite flow: Error listing users', listError);
      return new Response(JSON.stringify({ error: `Failed to check user existence: ${listError.message}` }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let user = existing.users.find(u => u.email === email);
    if (!user) {
      console.log("Invite flow: Creating new user", { email });
      const { data: created, error: createError } = await supabase.auth.admin.createUser({ 
        email,
        email_confirm: false, // They'll confirm via magic link
        user_metadata: {
          invited_to_event: eventId,
          invited_role: role,
          org_id: orgId,
          org_name: orgName
        }
      });
      if (createError) {
        console.error('Invite flow: Error creating user', createError);
        return new Response(JSON.stringify({ error: `Failed to create user account: ${createError.message}` }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      user = created.user;
      console.log("Invite flow: User created successfully", { userId: user.id, email });
    } else {
      console.log("Invite flow: User already exists", { userId: user.id, email });
    }

    // 2. Insert into event_members (handle duplicate key error gracefully)
    console.log("Invite flow: Adding user to event", { userId: user.id, eventId, role });
    const { error: insertError } = await supabase
      .from("event_members")
      .insert({ event_id: eventId, user_id: user.id, role });

    if (insertError) {
      // If it's a duplicate key error, that's actually okay
      if (insertError.code === '23505') {
        console.log("Invite flow: User already member of event", { userId: user.id, eventId });
      } else {
        console.error('Invite flow: Error inserting into event_members', insertError);
        return new Response(JSON.stringify({ error: `Failed to add user to event: ${insertError.message}` }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      console.log("Invite flow: User added to event successfully", { userId: user.id, eventId, role });
    }

    // 3. Send magic link
    console.log("Invite flow: Preparing magic link", { email, eventId });
    
    // TODO: Future improvement - customize email template with org-specific branding
    // TODO: Add org_id and org_name to email template context
    // TODO: Consider using custom mailer (SendGrid, etc.) for branded emails
    
    // Use the redirectTo from client, or fallback to default if not provided
    const baseRedirectUrl = redirectTo || "exp+auth://expo-checkin/--/auth/callback";
    const magicLinkRedirectUrl = `${baseRedirectUrl}?event_id=${eventId}`;
    
    console.log("Invite flow: Sending magic link", { 
      email, 
      redirectTo: baseRedirectUrl,
      magicLinkRedirectUrl 
    });
    
    const { data: otpData, error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: magicLinkRedirectUrl,
        data: {
          event_id: eventId,
          role: role,
          org_id: orgId,
          org_name: orgName
        }
      }
    });

    if (otpError) {
      console.error('Invite flow: Error sending magic link', otpError);
      return new Response(JSON.stringify({ error: `Failed to send invitation email: ${otpError.message}` }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log("Invite flow: Magic link sent successfully", { email, eventId });

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Invitation sent to ${email}`,
      userCreated: !existing.users.find(u => u.email === email),
      eventId: eventId,
      role: role
    }), { 
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Invite flow: Unexpected error', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});