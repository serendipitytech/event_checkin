# Invite User Edge Function

This Edge Function handles user invitations for the event check-in app. It safely performs admin operations that require the service role key.

## What it does:

1. **Checks or creates user** - Uses Supabase Admin API to check if user exists, creates if not
2. **Adds to event** - Inserts user into `event_members` table with specified role
3. **Sends magic link** - Generates and sends a magic link for the user to sign in

## Deployment:

```bash
# Deploy the function (no JWT verification needed since we handle auth in the function)
supabase functions deploy invite_user --no-verify-jwt
```

## Environment Variables Required:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (automatically available in Edge Functions)

## Usage:

The function expects a POST request with:
```json
{
  "email": "user@example.com",
  "role": "manager" | "checker",
  "eventId": "uuid-of-event"
}
```

## Security:

- Uses service role key only server-side
- Validates input parameters
- Handles duplicate user scenarios gracefully
- Includes proper error handling and logging
