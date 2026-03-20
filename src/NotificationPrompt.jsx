import useNotifications from "./useNotifications.js";

/**
 * Lazy-loaded notification permission prompt.
 * Wired via lazy() in OurWorld to avoid TDZ in OurWorldInner.
 */
export default function NotificationPrompt({ entries, showToast, P }) {
  const { showNotifPrompt, acceptNotifications, dismissNotifPrompt } = useNotifications(entries);

  if (!showNotifPrompt) return null;

  return (
    <div style={{
      position: "absolute", bottom: 140, right: 20, zIndex: 12, maxWidth: 260,
      background: P.card + "ee", backdropFilter: "blur(16px)",
      border: `1px solid ${P.gold}25`, borderRadius: 16,
      padding: "14px 16px", boxShadow: "0 4px 24px rgba(0,0,0,.10)",
      animation: "onThisDaySlideUp .5s ease both", fontFamily: "inherit",
    }}>
      <button
        onClick={dismissNotifPrompt}
        style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", color: P.textFaint, cursor: "pointer", fontSize: 14, padding: "2px 4px", lineHeight: 1, fontFamily: "inherit" }}
        aria-label="Dismiss"
      >×</button>
      <div style={{ fontSize: 10, fontVariant: "all-small-caps", letterSpacing: ".12em", color: P.gold, marginBottom: 6 }}>
        🔔 Memory Notifications
      </div>
      <p style={{ fontSize: 11, color: P.textMid, lineHeight: 1.5, margin: "0 0 10px" }}>
        Get notified when a memory from this day resurfaces, or when your partner adds a new one.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={async () => {
            await acceptNotifications();
            showToast("Notifications enabled", "🔔", 3000);
          }}
          style={{
            flex: 1, padding: "6px 0", background: P.rose, color: "#fff",
            border: "none", borderRadius: 10, fontSize: 10, fontWeight: 600,
            letterSpacing: ".06em", cursor: "pointer", fontFamily: "inherit",
            transition: "opacity .2s",
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          Allow
        </button>
        <button
          onClick={dismissNotifPrompt}
          style={{
            flex: 1, padding: "6px 0", background: "transparent",
            color: P.textFaint, border: `1px solid ${P.gold}20`, borderRadius: 10,
            fontSize: 10, fontWeight: 500, letterSpacing: ".04em", cursor: "pointer",
            fontFamily: "inherit", transition: "opacity .2s",
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
