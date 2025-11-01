# delete_user Edge Function

Deletes the currently authenticated user and removes personal memberships/data references to comply with App Store Guideline 5.1.1(v).

What it does:
- Identifies the caller from the Authorization header (JWT)
- Removes rows owned by the user that would leak identity (e.g., membership rows)
- Nulls soft references such as `checked_in_by`
- Deletes the user via the Admin API

## Deploy

Set required secrets (run in the `expo-checkin` folder):

```
supabase secrets set \
  SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  SUPABASE_ANON_KEY=YOUR_ANON_KEY \
  SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

Deploy the function:

```
supabase functions deploy delete_user
```

## Notes
- This function uses the Service Role key server-side for admin operations.
- Adjust the cleanup queries if your schema differs (e.g., additional references to user IDs).

