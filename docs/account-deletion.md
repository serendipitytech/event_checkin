# Account Deletion (App Store 5.1.1(v))

This app supports in‑app account deletion for users who created an account.

- Location: Admin tab → "Account & Privacy" → "Delete My Account"
- Behavior: Deletes the user account and removes event/organization memberships. Event data remains for other collaborators; user references like `checked_in_by` are anonymized.
- Backend: Supabase Edge Function `delete_user` performs secure deletion using the Service Role key.

## Setup

1) Set Supabase Function Secrets:

```
cd expo-checkin
supabase secrets set \
  SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  SUPABASE_ANON_KEY=YOUR_ANON_KEY \
  SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

2) Deploy the function:

```
supabase functions deploy delete_user
```

3) (Optional) Provide a fallback web portal URL in `admin.tsx` for deletion if needed:

```
Linking.openURL('https://your-domain.com/account/delete')
```

## Notes
- Highly regulated industries may require additional confirmation steps; otherwise, deletion must not require contacting support.
- This flow is self‑service and within the app, meeting Apple’s guideline.
- If you prefer a web deletion flow, keep the in‑app button linking to the exact deletion page.

