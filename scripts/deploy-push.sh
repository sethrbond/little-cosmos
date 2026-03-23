#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Push Notification Deployment Script for MyCosmos
# ============================================================
# This script deploys everything needed for web push notifications.
# Some steps require manual action in the Supabase dashboard.
# ============================================================

PROJECT_REF="neduoxnmlotrygulngrv"
PROJECT_URL="https://${PROJECT_REF}.supabase.co"
VAPID_PUBLIC_KEY="BLBJKITSItFRv60BNpVPKIgpLNLyI47kPfHbReHCdHPP6R_CVTSKRJpafmbGuOWjhsyH6XJuh9EeEo-0r4KTef0"

echo ""
echo "=== MyCosmos Push Notification Deployment ==="
echo ""

# ----------------------------------------------------------
# Step 1: Check prerequisites
# ----------------------------------------------------------
echo "--- Step 1: Checking prerequisites ---"
echo ""

if ! command -v supabase &>/dev/null; then
  echo "ERROR: Supabase CLI not found. Install with: npm i -g supabase"
  exit 1
fi

echo "Supabase CLI found: $(supabase --version 2>/dev/null || echo 'unknown version')"
echo ""

# ----------------------------------------------------------
# Step 2: Link project (if not already linked)
# ----------------------------------------------------------
echo "--- Step 2: Ensure project is linked ---"
echo ""
echo "If not already linked, run:"
echo "  supabase link --project-ref ${PROJECT_REF}"
echo ""

# ----------------------------------------------------------
# Step 3: Set Supabase secrets
# ----------------------------------------------------------
echo "--- Step 3: Set VAPID secrets on Supabase ---"
echo ""
echo "MANUAL STEP REQUIRED: Replace YOUR_VAPID_PRIVATE_KEY below with your"
echo "actual private key, then run the command."
echo ""
echo "Your VAPID public key is:"
echo "  ${VAPID_PUBLIC_KEY}"
echo ""
echo "Run this command (paste your private key in place of the placeholder):"
echo ""
echo "  supabase secrets set \\"
echo "    VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY} \\"
echo "    VAPID_PRIVATE_KEY=YOUR_VAPID_PRIVATE_KEY \\"
echo "    VAPID_SUBJECT=mailto:hello@littlecosmos.app"
echo ""

read -rp "Press Enter once you've set the secrets (or Ctrl+C to abort)..."
echo ""

# ----------------------------------------------------------
# Step 4: Create push_subscriptions table
# ----------------------------------------------------------
echo "--- Step 4: Create push_subscriptions table ---"
echo ""
echo "MANUAL STEP: Run the following SQL in the Supabase SQL Editor"
echo "(Dashboard > SQL Editor > New Query), or use the CLI:"
echo ""
echo "  supabase db execute -f supabase/push_subscriptions.sql"
echo ""
echo "The SQL creates:"
echo "  - push_subscriptions table with RLS enabled"
echo "  - Policy: users can only manage their own subscriptions"
echo "  - Index on user_id for fast lookups"
echo ""
echo "Full SQL:"
echo ""
cat <<'SQLBLOCK'
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    endpoint text NOT NULL,
    keys_p256dh text NOT NULL,
    keys_auth text NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, endpoint)
  );

  ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users manage own push subscriptions"
    ON push_subscriptions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
SQLBLOCK
echo ""

read -rp "Press Enter once the table is created (or Ctrl+C to abort)..."
echo ""

# ----------------------------------------------------------
# Step 5: Deploy edge functions
# ----------------------------------------------------------
echo "--- Step 5: Deploying edge functions ---"
echo ""

echo "Deploying send-push..."
supabase functions deploy send-push --project-ref "${PROJECT_REF}" || {
  echo "WARNING: send-push deploy failed. You may need to run: supabase link --project-ref ${PROJECT_REF}"
}

echo ""
echo "Deploying daily-digest..."
supabase functions deploy daily-digest --project-ref "${PROJECT_REF}" || {
  echo "WARNING: daily-digest deploy failed."
}

echo ""
echo "Deploying monthly-recap..."
supabase functions deploy monthly-recap --project-ref "${PROJECT_REF}" || {
  echo "WARNING: monthly-recap deploy failed."
}

echo ""

# ----------------------------------------------------------
# Step 6: Set up cron jobs
# ----------------------------------------------------------
echo "--- Step 6: Set up cron jobs ---"
echo ""
echo "MANUAL STEP: Run the following SQL in the Supabase SQL Editor."
echo "Replace YOUR_SERVICE_ROLE_KEY with your service role key"
echo "(Dashboard > Settings > API > service_role key)."
echo ""
cat <<'CRONBLOCK'
  -- Enable extensions (one-time)
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;

  -- Daily "On This Day" digest at 9:00 AM UTC
  SELECT cron.schedule(
    'daily-otd',
    '0 9 * * *',
    $$SELECT net.http_post(
      url := 'https://neduoxnmlotrygulngrv.supabase.co/functions/v1/daily-digest',
      headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    )$$
  );

  -- Monthly recap email at 10:00 AM UTC on the 1st
  SELECT cron.schedule(
    'monthly-recap',
    '0 10 1 * *',
    $$SELECT net.http_post(
      url := 'https://neduoxnmlotrygulngrv.supabase.co/functions/v1/monthly-recap',
      headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    )$$
  );
CRONBLOCK
echo ""

# ----------------------------------------------------------
# Done
# ----------------------------------------------------------
echo "=== Deployment complete ==="
echo ""
echo "Verification checklist:"
echo "  1. Open the app and grant notification permission"
echo "  2. Check push_subscriptions table for a new row"
echo "  3. Test send-push manually:"
echo "     curl -X POST ${PROJECT_URL}/functions/v1/send-push \\"
echo "       -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"user_id\": \"YOUR_USER_ID\", \"title\": \"Test\", \"body\": \"Push works!\"}'"
echo ""
echo "  4. Check cron jobs: SELECT * FROM cron.job;"
echo ""
