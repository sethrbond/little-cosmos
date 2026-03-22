import { useState, useEffect, useCallback } from "react";

const PERM_KEY = "cosmos_notif_permission";
const ASKED_KEY = "cosmos_notif_asked";
const FONT = "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif";
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

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

/**
 * Self-contained notification permission prompt.
 * Rendered from App.jsx — queries entry count via Supabase, no OurWorld dependency.
 * Also subscribes to Web Push when permission is granted and VAPID key is configured.
 */
export default function NotificationPrompt({ supabase, worldId, userId }) {
  const [show, setShow] = useState(false);

  // Check entry count and whether to show prompt
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (localStorage.getItem(ASKED_KEY) || localStorage.getItem(PERM_KEY) === "granted") return;
    if (!worldId) return;

    (async () => {
      const { count } = await supabase
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("world_id", worldId);
      if (count >= 5) setShow(true);
    })();
  }, [worldId, supabase]);

  // Fire "On This Day" notifications on mount
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (!worldId) return;

    const now = new Date();
    const todayKey = `cosmos_otd_notif_${now.toISOString().slice(0, 10)}`;
    if (localStorage.getItem(todayKey)) return;

    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");

    (async () => {
      const { data } = await supabase
        .from("entries")
        .select("city, date_start")
        .eq("world_id", worldId)
        .like("date_start", `%-${mm}-${dd}`);

      const year = now.getFullYear();
      const matches = (data || [])
        .filter(e => e.date_start && parseInt(e.date_start.slice(0, 4)) !== year)
        .map(e => ({ yearsAgo: year - parseInt(e.date_start.slice(0, 4)), city: e.city || "a special place" }));

      if (matches.length > 0) {
        for (const m of matches.slice(0, 3)) {
          new Notification("\u{1F4CD} On This Day", {
            body: `${m.yearsAgo} year${m.yearsAgo !== 1 ? "s" : ""} ago: ${m.city}`,
            icon: "/icons/icon.svg",
          });
        }
        localStorage.setItem(todayKey, "1");
      }
    })();
  }, [worldId, supabase]);

  const accept = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    localStorage.setItem(PERM_KEY, result);
    localStorage.setItem(ASKED_KEY, "1");
    setShow(false);

    // Subscribe to Web Push when permission granted and VAPID key is configured
    if (result === "granted" && VAPID_PUBLIC_KEY && userId) {
      try {
        if ("serviceWorker" in navigator && "PushManager" in window) {
          const registration = await navigator.serviceWorker.ready;
          let subscription = await registration.pushManager.getSubscription();
          if (!subscription) {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
          }
          const subJSON = subscription.toJSON();
          const { error } = await supabase.from("push_subscriptions").upsert({
            user_id: userId,
            endpoint: subJSON.endpoint,
            keys_p256dh: subJSON.keys.p256dh,
            keys_auth: subJSON.keys.auth,
          }, { onConflict: "user_id,endpoint" });
          if (error) console.error("[push] Failed to store subscription:", error);
          else console.log("[push] Subscribed to Web Push");
        }
      } catch (err) {
        console.error("[push] Push subscription failed:", err);
      }
    }
  }, [supabase, userId]);

  const dismiss = useCallback(() => {
    localStorage.setItem(ASKED_KEY, "1");
    setShow(false);
  }, []);

  if (!show) return null;

  return (
    <div style={{
      position: "fixed", bottom: 100, right: 20, zIndex: 10002, maxWidth: 260,
      background: "rgba(30,25,48,0.95)", backdropFilter: "blur(16px)",
      border: "1px solid rgba(200,170,110,0.15)", borderRadius: 16,
      padding: "14px 16px", boxShadow: "0 4px 24px rgba(0,0,0,.25)",
      animation: "cosmosToastIn .5s ease both", fontFamily: FONT,
    }}>
      <button onClick={dismiss} style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", color: "rgba(200,170,110,0.4)", cursor: "pointer", fontSize: 14, padding: "2px 4px", lineHeight: 1, fontFamily: "inherit" }} aria-label="Dismiss">×</button>
      <div style={{ fontSize: 10, fontVariant: "all-small-caps", letterSpacing: ".12em", color: "rgba(200,170,110,0.8)", marginBottom: 6 }}>
        {"\uD83D\uDD14"} Memory Notifications
      </div>
      <p style={{ fontSize: 11, color: "rgba(232,224,208,0.6)", lineHeight: 1.5, margin: "0 0 10px" }}>
        Get notified when a memory from this day resurfaces, or when your partner adds a new one.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={accept} style={{
          flex: 1, padding: "6px 0", background: "rgba(196,138,168,0.8)", color: "#fff",
          border: "none", borderRadius: 10, fontSize: 10, fontWeight: 600,
          letterSpacing: ".06em", cursor: "pointer", fontFamily: "inherit", transition: "opacity .2s",
        }} onMouseEnter={e => e.currentTarget.style.opacity = "0.85"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
          Allow
        </button>
        <button onClick={dismiss} style={{
          flex: 1, padding: "6px 0", background: "transparent",
          color: "rgba(200,170,110,0.4)", border: "1px solid rgba(200,170,110,0.15)", borderRadius: 10,
          fontSize: 10, fontWeight: 500, letterSpacing: ".04em", cursor: "pointer",
          fontFamily: "inherit", transition: "opacity .2s",
        }} onMouseEnter={e => e.currentTarget.style.opacity = "0.7"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
          Not now
        </button>
      </div>
    </div>
  );
}
