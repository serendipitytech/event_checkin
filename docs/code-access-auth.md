# Code-Based Access (No Email Login)

This app supports joining events via access codes without requiring email sign-in. Users get an anonymous session and redeem a code to obtain event membership.

## Flow
- The app creates an anonymous session (no email required).
- The user enters an access code (Admin tab → logged-out section → "Enter Access Code").
- Edge Function `redeem_event_code` validates the code, grants membership, and records the redemption.

## Setup
1) Apply migrations (tables, RLS, helper):

```
psql < supabase/migrations/20251101_add_event_access_codes.sql
```

2) Deploy the redeem function and secrets:

```
cd expo-checkin
supabase secrets set \
  SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  SUPABASE_ANON_KEY=YOUR_ANON_KEY \
  SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY \
  CODE_SALT=your_random_salt

supabase functions deploy redeem_event_code
```

3) Create an access code for an event (server-side):
- Compute `code_hash = sha256(CODE_SALT || '|' || CODE_PLAIN.toUpperCase().replace(/\s+/g,''))`.
- Insert into `public.event_access_codes` with `event_id`, `code_hash`, `role`, `max_uses`, `expires_at`, etc.

4) (Optional) Bind to a single device: set `single_device = true` (the app passes a stable `clientInstanceId`).

## Notes
- Keep the plain code value out of the database; store only the hash.
- Rate limit the function to mitigate brute forcing.
- Ensure your installed `@supabase/supabase-js` supports `auth.signInAnonymously()`. If not, upgrade.

