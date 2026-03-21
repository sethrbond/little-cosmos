import { useRef, useEffect } from "react";
import { useRealtimePresence } from "./useRealtimeSync.js";

const FONT = "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif";
const REUNION_KEY = "cosmos_reunion_shown_";

/**
 * Self-contained reunion detection.
 * Rendered from App.jsx — uses useRealtimePresence directly, no OurWorld dependency.
 * Shows a fixed toast when 2+ users are online in the same world.
 */
export default function ReunionToast({ worldId, userId, displayName, worldType }) {
  const isPartnerWorld = worldType === "our" || worldType === "partner";
  const { onlineUsers } = useRealtimePresence({
    worldId: isPartnerWorld ? worldId : undefined,
    userId,
    displayName: displayName || "Traveler",
    enabled: isPartnerWorld,
  });

  const prevCountRef = useRef(null);
  const toastRef = useRef(null);

  useEffect(() => {
    if (!isPartnerWorld || !worldId) return;

    const othersOnline = onlineUsers.filter(u => u.user_id !== userId).length;
    const prevOthers = prevCountRef.current;

    // Detect 0 → 1+ transition (someone else came online = reunion)
    if (prevOthers === 0 && othersOnline > 0) {
      const todayKey = REUNION_KEY + worldId + "_" + new Date().toISOString().slice(0, 10);
      if (!localStorage.getItem(todayKey)) {
        localStorage.setItem(todayKey, "1");
        // Show toast
        if (toastRef.current) toastRef.current.remove();
        const toast = document.createElement("div");
        toast.style.cssText = `position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:10003;
          background:rgba(30,25,48,0.95);backdrop-filter:blur(16px);border:1px solid rgba(200,170,110,0.2);
          border-radius:16px;padding:12px 24px;box-shadow:0 4px 24px rgba(0,0,0,.25);
          font-family:${FONT};font-size:13px;color:#e8e0d0;letter-spacing:.03em;
          animation:cosmosToastIn .5s ease both;pointer-events:auto;cursor:pointer;`;
        toast.textContent = "You\u2019re both here right now \uD83D\uDC95";
        toast.onclick = () => toast.remove();
        document.body.appendChild(toast);
        toastRef.current = toast;
        setTimeout(() => toast.remove(), 6000);
      }
    }

    prevCountRef.current = othersOnline;
  }, [onlineUsers, worldId, userId, isPartnerWorld]);

  return null;
}
