# Supabase Edge Functions — Deployment Guide

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed (`npm i -g supabase`)
- Linked to your project: `supabase link --project-ref neduoxnmlotrygulngrv`
- Node.js 18+ (for `web-push` key generation)

---

## 1. Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

This outputs a **public key** and a **private key**. You need both.

---

## 2. Set Environment Variables

### Vercel (frontend)

In your Vercel project settings, add:

| Variable | Value |
|---|---|
| `VITE_VAPID_PUBLIC_KEY` | Your VAPID public key |

Or via CLI:

```bash
npx vercel env add VITE_VAPID_PUBLIC_KEY
```

### Supabase (edge functions)

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=your-vapid-public-key \
  VAPID_PRIVATE_KEY=your-vapid-private-key \
  VAPID_SUBJECT=mailto:hello@littlecosmos.app
```

For the monthly recap email function, also set:

```bash
supabase secrets set RESEND_API_KEY=re_your-resend-api-key
```

---

## 3. Create the push_subscriptions Table

Run the SQL in `supabase/push_subscriptions.sql` in the Supabase SQL Editor:

```bash
# Or via CLI:
supabase db execute -f supabase/push_subscriptions.sql
```

This creates the table, enables RLS, and adds the user lookup index.

---

## 4. Deploy Edge Functions

Deploy all three functions:

```bash
npx supabase functions deploy send-push
npx supabase functions deploy daily-digest
npx supabase functions deploy monthly-recap
```

Or deploy all at once:

```bash
npx supabase functions deploy
```

---

## 5. Set Up Cron Jobs

In the Supabase SQL Editor, enable the required extensions and create cron schedules:

```sql
-- Enable extensions (one-time)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Daily "On This Day" digest — runs at 9:00 AM UTC every day
SELECT cron.schedule(
  'daily-otd',
  '0 9 * * *',
  $$SELECT net.http_post(
    url := 'https://neduoxnmlotrygulngrv.supabase.co/functions/v1/daily-digest',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )$$
);

-- Monthly recap email — runs at 10:00 AM UTC on the 1st of each month
SELECT cron.schedule(
  'monthly-recap',
  '0 10 1 * *',
  $$SELECT net.http_post(
    url := 'https://neduoxnmlotrygulngrv.supabase.co/functions/v1/monthly-recap',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )$$
);
```

Replace `YOUR_SERVICE_ROLE_KEY` with your actual service role key from Supabase Dashboard > Settings > API.

### Managing Cron Jobs

```sql
-- List active cron jobs
SELECT * FROM cron.job;

-- Remove a cron job
SELECT cron.unschedule('daily-otd');
SELECT cron.unschedule('monthly-recap');
```

---

## Verification

1. **Push subscriptions**: Grant notification permission in the app, then check `push_subscriptions` table for a new row.
2. **send-push**: Invoke manually to test:
   ```bash
   curl -X POST https://neduoxnmlotrygulngrv.supabase.co/functions/v1/send-push \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"user_id": "YOUR_USER_ID", "title": "Test", "body": "Push works!"}'
   ```
3. **daily-digest**: Invoke manually — it checks for "On This Day" matches and calls send-push.
4. **monthly-recap**: Invoke manually on the 1st — it sends recap emails via Resend.
