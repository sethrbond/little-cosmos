// Supabase Edge Function: send-push
// Sends Web Push notifications to subscribed users.
//
// Setup:
// 1. Generate VAPID keys: npx web-push generate-vapid-keys
// 2. Set secrets: supabase secrets set VAPID_PRIVATE_KEY=xxx VAPID_PUBLIC_KEY=xxx VAPID_SUBJECT=mailto:hello@littlecosmos.app
// 3. Deploy: supabase functions deploy send-push

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:hello@littlecosmos.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

serve(async (req) => {
  try {
    const { user_id, title, body, tag, data } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --- Auth: require JWT or service role key ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401 });
    }
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Allow service role key (used by cron jobs) to bypass user check
    if (token !== serviceRoleKey) {
      // Verify JWT and check that the caller matches the target user_id
      const { data: userData, error: authError } = await supabase.auth.getUser(token);
      if (authError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401 });
      }
      if (userData.user.id !== user_id) {
        return new Response(JSON.stringify({ error: "Cannot send push to another user" }), { status: 403 });
      }
    }

    // Get all push subscriptions for this user
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, keys_p256dh, keys_auth")
      .eq("user_id", user_id);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    const payload = JSON.stringify({ title, body, tag, data });
    let sent = 0;
    const stale: string[] = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
          },
          payload
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          stale.push(sub.endpoint);
        } else {
          console.error("[send-push] Failed for endpoint:", sub.endpoint, err.statusCode || err.message);
        }
      }
    }

    // Clean up stale subscriptions
    if (stale.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", stale);
    }

    return new Response(JSON.stringify({ sent, cleaned: stale.length }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
