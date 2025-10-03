# Edge Function Deployment Guide

## Deploy the Invite User Function

To deploy the `invite_user` Edge Function to your Supabase project:

### Prerequisites

1. **Supabase CLI installed**:
   ```bash
   npm install -g supabase
   ```

2. **Authenticated with Supabase**:
   ```bash
   supabase login
   ```

3. **Linked to your project**:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

### Deployment Steps

1. **Deploy the function**:
   ```bash
   supabase functions deploy invite_user --no-verify-jwt
   ```

2. **Verify deployment**:
   ```bash
   supabase functions list
   ```

### Testing the Function

You can test the function using curl:

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/invite_user' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test@example.com",
    "role": "checker",
    "eventId": "your-event-id"
  }'
```

### Environment Variables

The function automatically has access to:
- `SUPABASE_URL` - Your project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for admin operations)

### Security Notes

- The function uses `--no-verify-jwt` because we handle authentication manually in the function
- The service role key is only used server-side in the Edge Function
- Client requests must include a valid session token in the Authorization header

### Troubleshooting

If deployment fails:
1. Check that you're linked to the correct project
2. Verify your Supabase CLI is up to date
3. Ensure you have the necessary permissions on the project

If the function returns errors:
1. Check the Supabase dashboard logs
2. Verify the function is deployed correctly
3. Test with a simple request first
