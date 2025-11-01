# redeem_event_code Edge Function

Redeems a human-entered access code for event membership without requiring email sign-in.

Input JSON:

```
{ "code": "ABC-123-XYZ", "clientInstanceId": "optional-uuid" }
```

Environment variables:

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
CODE_SALT            # used to hash codes server-side
```

Deploy:

```
supabase secrets set \
  SUPABASE_URL=... \
  SUPABASE_ANON_KEY=... \
  SUPABASE_SERVICE_ROLE_KEY=... \
  CODE_SALT=your_random_salt

supabase functions deploy redeem_event_code
```

