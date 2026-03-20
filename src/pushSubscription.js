import { supabase } from "./supabaseClient.js";

/**
 * Push subscription management for Web Push API.
 *
 * Server-side setup required:
 * 1. Generate VAPID keys: npx web-push generate-vapid-keys
 * 2. Set VITE_VAPID_PUBLIC_KEY in .env
 * 3. Store VAPID_PRIVATE_KEY as Supabase secret
 * 4. Create Supabase edge function "send-push" that sends push notifications
 * 5. Create "push_subscriptions" table:
 *    CREATE TABLE push_subscriptions (
 *      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 *      endpoint text NOT NULL,
 *      keys_p256dh text NOT NULL,
 *      keys_auth text NOT NULL,
 *      created_at timestamptz DEFAULT now(),
 *      UNIQUE(user_id, endpoint)
 *    );
 *    ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
 *    CREATE POLICY "Users manage own subscriptions" ON push_subscriptions
 *      FOR ALL USING (auth.uid() = user_id);
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Subscribe the current browser to push notifications.
 * Stores the subscription in Supabase for server-side push delivery.
 */
export async function subscribeToPush(userId) {
  if (!VAPID_PUBLIC_KEY) {
    console.warn("[push] No VAPID public key configured");
    return { ok: false, error: "Push not configured" };
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, error: "Push not supported" };
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Convert VAPID key from base64 to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    const subJSON = subscription.toJSON();

    // Store in Supabase
    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: userId,
      endpoint: subJSON.endpoint,
      keys_p256dh: subJSON.keys.p256dh,
      keys_auth: subJSON.keys.auth,
    }, { onConflict: "user_id,endpoint" });

    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[push] Subscribe failed:", err);
    return { ok: false, error: err.message };
  }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    }
    return { ok: true };
  } catch (err) {
    console.error("[push] Unsubscribe failed:", err);
    return { ok: false, error: err.message };
  }
}

/**
 * Check if push is currently subscribed.
 */
export async function isPushSubscribed() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

// Helper: convert URL-safe base64 to Uint8Array for applicationServerKey
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
