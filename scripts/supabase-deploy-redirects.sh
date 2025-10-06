#!/usr/bin/env bash
set -euo pipefail

# Lintnotes
# - Purpose: Helper to configure secrets and deploy both redirect functions.
# - Usage: export SUPABASE_PROJECT_REF=efcgzxjwystresjbcezc; ./scripts/supabase-deploy-redirects.sh "exp://<your-tunnel>/--/auth"

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found. Install: https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <EXPO_TUNNEL_URL>" >&2
  exit 1
fi

TUNNEL_URL="$1"
PROJECT_REF="${SUPABASE_PROJECT_REF:-}" # export SUPABASE_PROJECT_REF=...

if [[ -z "$PROJECT_REF" ]]; then
  echo "Please export SUPABASE_PROJECT_REF before running (e.g., efcgzxjwystresjbcezc)." >&2
  exit 1
fi

echo "Setting secrets for redirect-dev (ENVIRONMENT=dev, EXPO_TUNNEL_URL)" 
supabase secrets set ENVIRONMENT=dev EXPO_TUNNEL_URL="$TUNNEL_URL" --project-ref "$PROJECT_REF"

echo "Deploying redirect-dev..."
supabase functions deploy redirect-dev --project-ref "$PROJECT_REF" --no-verify-jwt

echo "Setting secrets for redirect (ENVIRONMENT=prod)"
supabase secrets set ENVIRONMENT=prod --project-ref "$PROJECT_REF"

echo "Deploying redirect..."
supabase functions deploy redirect --project-ref "$PROJECT_REF" --no-verify-jwt

echo "Done. Validate with:"
echo "curl -i https://$PROJECT_REF.functions.supabase.co/redirect-dev | head -n 1"
echo "curl -i https://$PROJECT_REF.functions.supabase.co/redirect | head -n 1"

