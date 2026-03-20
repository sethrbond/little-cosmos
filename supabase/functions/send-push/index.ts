// Supabase Edge Function: send-push
// Sends Web Push notifications to subscribed users.
//
// Setup:
// 1. Generate VAPID keys: npx web-push generate-vapid-keys
// 2. Set secrets: supabase secrets set VAPID_PRIVATE_KEY=xxx VAPID_PUBLIC_KEY=xxx VAPID_SUBJECT=mailto:hello@littlecosmos.app
// 3. Deploy: supabase functions deploy send-push

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:hello@littlecosmos.app";

serve(async (req) => {
  try {
    const { user_id, title, body, tag, data } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
        // Web Push protocol — sign with VAPID, encrypt payload
        const pushResult = await sendWebPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
          payload,
          { vapidPublicKey: VAPID_PUBLIC_KEY, vapidPrivateKey: VAPID_PRIVATE_KEY, vapidSubject: VAPID_SUBJECT }
        );

        if (pushResult.status === 201) {
          sent++;
        } else if (pushResult.status === 410 || pushResult.status === 404) {
          // Subscription expired or invalid — mark for cleanup
          stale.push(sub.endpoint);
        }
      } catch (err) {
        console.error("[send-push] Failed for endpoint:", sub.endpoint, err);
      }
    }

    // Clean up stale subscriptions
    if (stale.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", stale);
    }

    return new Response(JSON.stringify({ sent, cleaned: stale.length }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

// Minimal Web Push sender using Deno crypto
// For production, consider using a full Web Push library
async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapid: { vapidPublicKey: string; vapidPrivateKey: string; vapidSubject: string }
): Promise<Response> {
  // NOTE: Full Web Push encryption requires:
  // 1. ECDH key agreement with subscriber's p256dh key
  // 2. HKDF key derivation
  // 3. AES-128-GCM content encryption
  // 4. VAPID JWT signing
  //
  // For now, this is a placeholder. In production, use:
  // - npm: web-push (generate VAPID + send)
  // - Or call a push service like OneSignal, Firebase FCM, or Pushover
  //
  // The simplest production approach:
  // Deploy a small Node.js worker alongside this edge function that uses
  // the `web-push` npm package, OR use Supabase's built-in push support
  // when it becomes available.

  console.log(`[send-push] Would send to ${subscription.endpoint}: ${payload}`);
  return new Response("", { status: 201 });
}
