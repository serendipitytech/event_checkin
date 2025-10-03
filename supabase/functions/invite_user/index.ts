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

    const { email, role, eventId } = await req.json();

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

    console.log(`Inviting user: ${email} with role: ${role} to event: ${eventId}`);

    // 1. Check or create user
    const { data: existing, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(JSON.stringify({ error: listError.message }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let user = existing.users.find(u => u.email === email);
    if (!user) {
      console.log(`Creating new user: ${email}`);
      const { data: created, error: createError } = await supabase.auth.admin.createUser({ 
        email,
        email_confirm: false // They'll confirm via magic link
      });
      if (createError) {
        console.error('Error creating user:', createError);
        return new Response(JSON.stringify({ error: createError.message }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      user = created.user;
      console.log(`Created user with ID: ${user.id}`);
    } else {
      console.log(`User already exists with ID: ${user.id}`);
    }

    // 2. Insert into event_members (handle duplicate key error gracefully)
    const { error: insertError } = await supabase
      .from("event_members")
      .insert({ event_id: eventId, user_id: user.id, role });

    if (insertError) {
      // If it's a duplicate key error, that's actually okay
      if (insertError.code === '23505') {
        console.log(`User ${user.id} is already a member of event ${eventId}`);
      } else {
        console.error('Error inserting into event_members:', insertError);
        return new Response(JSON.stringify({ error: insertError.message }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      console.log(`Added user ${user.id} to event ${eventId} with role ${role}`);
    }

    // 3. Send magic link
    const redirectTo = "exp://192.168.1.100:8081/--/auth/callback"; // You may need to adjust this URL
    console.log(`Sending magic link to ${email} with redirect: ${redirectTo}`);
    
    const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { 
        redirectTo,
        data: {
          event_id: eventId,
          role: role
        }
      }
    });

    if (linkError) {
      console.error('Error generating magic link:', linkError);
      return new Response(JSON.stringify({ error: linkError.message }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Successfully generated magic link for ${email}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Invitation sent to ${email}`,
      link: link.properties?.action_link 
    }), { 
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Unexpected error in invite_user function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
