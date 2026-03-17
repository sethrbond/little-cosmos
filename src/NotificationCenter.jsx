import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/**
 * NotificationCenter — floating in-app notification panel for shared worlds.
 *
 * Props:
 *   notifications       array   — { id, type, message, icon, timestamp, entryId, worldId, read }
 *   onDismiss           fn(id)  — dismiss a single notification
 *   onDismissAll        fn()    — mark all as read
 *   onClickNotification fn(n)   — called when user clicks a notification row
 *   palette             object  — { primary, text, bg, card, textFaint, rose, ... }
 */

const ICON_MAP = {
  entry_added: "\u{1F4CD}",
  entry_updated: "\u270F\uFE0F",
  comment: "\u{1F4AC}",
  reaction: "\u{1F496}",
  member_joined: "\u{1F44B}",
  invite_accepted: "\u2705",
};

const MAX_SHOWN = 50;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

function relativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function NotificationCenter({
  notifications = [],
  onDismiss,
  onDismissAll,
  onClickNotification,
  palette = {},
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const injectedRef = useRef(false);

  // Inject keyframes once
  useEffect(() => {
    if (injectedRef.current) return;
    const id = "cosmos-notif-keyframes";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id;
      s.textContent = `@keyframes cosmosBellShake { 0%,100%{transform:rotate(0)} 20%{transform:rotate(12deg)} 40%{transform:rotate(-10deg)} 60%{transform:rotate(6deg)} 80%{transform:rotate(-3deg)} }`;
      document.head.appendChild(s);
    }
    injectedRef.current = true;
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Filter out read notifications older than 24h, sort newest first, cap at MAX_SHOWN
  const visible = useMemo(() => {
    const now = Date.now();
    return notifications
      .filter((n) => !n.read || now - new Date(n.timestamp).getTime() < TWENTY_FOUR_HOURS)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, MAX_SHOWN);
  }, [notifications]);

  const unreadCount = useMemo(() => visible.filter((n) => !n.read).length, [visible]);

  const handleClick = useCallback((n) => {
    if (onClickNotification) onClickNotification(n);
  }, [onClickNotification]);

  const bg = palette.bg || "rgba(20, 18, 30, 0.92)";
  const textColor = palette.text || "#e8e0d0";
  const faint = palette.textFaint || "#888";
  const accent = palette.primary || palette.rose || "#c48aa8";

  return (
    <div ref={panelRef} style={{ position: "relative", display: "inline-block" }}>
      {/* Bell button */}
      <button
        aria-label={`Notifications — view activity from shared worlds${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "relative", background: "none", border: "none", cursor: "pointer",
          fontSize: 20, padding: 6, lineHeight: 1, color: textColor,
          animation: unreadCount > 0 ? "cosmosBellShake 0.6s ease-in-out" : undefined,
        }}
      >
        {"\u{1F514}"}
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: 0, right: 0,
            background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700,
            minWidth: 20, height: 20, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 4px", fontFamily: "system-ui, sans-serif",
          }}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Notifications"
        style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 320, maxHeight: 420,
          background: bg, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          borderRadius: 14, border: `1px solid ${accent}20`,
          boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.97)",
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.2s ease, transform 0.2s ease",
          zIndex: 9999, overflow: "hidden",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 14px 8px", borderBottom: `1px solid ${accent}15`,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: textColor }}>Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={() => { if (onDismissAll) onDismissAll(); }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 11, color: accent, padding: "2px 6px", borderRadius: 4,
                fontFamily: "inherit",
              }}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Notification list */}
        <div style={{ overflowY: "auto", maxHeight: 360 }}>
          {visible.length === 0 ? (
            <div style={{ padding: "36px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{"\u2705"}</div>
              <div style={{ fontSize: 13, color: faint }}>All caught up!</div>
            </div>
          ) : (
            visible.map((n) => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "10px 14px", cursor: "pointer",
                  background: n.read ? "transparent" : `${accent}08`,
                  borderBottom: `1px solid ${accent}08`,
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `${accent}15`; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = n.read ? "transparent" : `${accent}08`; }}
              >
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                  {n.icon || ICON_MAP[n.type] || "\u{1F514}"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, color: textColor, lineHeight: 1.4,
                    fontWeight: n.read ? 400 : 600,
                    overflow: "hidden", textOverflow: "ellipsis",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: 10, color: faint, marginTop: 2 }}>
                    {relativeTime(n.timestamp)}
                  </div>
                </div>
                {onDismiss && (
                  <button
                    aria-label="Dismiss notification"
                    onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: faint, fontSize: 14, padding: "0 2px", lineHeight: 1,
                      opacity: 0.5, flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.5; }}
                  >
                    {"\u00D7"}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mobile full-width override */}
      <style>{`
        @media (max-width: 480px) {
          [role="dialog"][aria-label="Notifications"] {
            width: calc(100vw - 24px) !important;
            right: -8px !important;
          }
        }
      `}</style>
    </div>
  );
}
