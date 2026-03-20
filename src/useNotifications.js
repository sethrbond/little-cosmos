import { useState, useEffect, useCallback } from "react";

const PERM_KEY = "cosmos_notif_permission";
const ASKED_KEY = "cosmos_notif_asked";

/**
 * Fires a browser notification when a partner adds a memory.
 */
export function firePartnerNotification(partnerName, city) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(`${partnerName} added a memory`, {
      body: (city || "somewhere new") + " \u{1F495}",
      icon: "/icons/icon.svg",
    });
  }
}

/**
 * Custom hook for "On This Day" notifications and permission prompting.
 *
 * @param {Array} entries - Array of entry objects with { dateStart, city }
 * @returns {{ showNotifPrompt: boolean, acceptNotifications: Function, dismissNotifPrompt: Function }}
 */
export default function useNotifications(entries) {
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  // Check whether to show the permission prompt
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    const alreadyAsked = localStorage.getItem(ASKED_KEY);
    const savedPerm = localStorage.getItem(PERM_KEY);
    if (alreadyAsked || savedPerm === "granted") return;
    if (entries && entries.length >= 5) {
      setShowNotifPrompt(true);
    }
  }, [entries?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire "On This Day" notifications on mount when permission is granted
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    if (!entries || entries.length === 0) return;

    const now = new Date();
    const todayKey = `cosmos_otd_notif_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (localStorage.getItem(todayKey)) return;

    const month = now.getMonth();
    const day = now.getDate();
    const year = now.getFullYear();
    const matches = [];

    for (const entry of entries) {
      if (!entry.dateStart) continue;
      const d = new Date(entry.dateStart);
      if (d.getMonth() === month && d.getDate() === day && d.getFullYear() !== year) {
        const yearsAgo = year - d.getFullYear();
        matches.push({ yearsAgo, city: entry.city || "a special place" });
      }
    }

    if (matches.length > 0) {
      // Fire one notification per match (max 3 to avoid spam)
      for (const m of matches.slice(0, 3)) {
        new Notification("\u{1F4CD} On This Day", {
          body: `${m.yearsAgo} year${m.yearsAgo !== 1 ? "s" : ""} ago: ${m.city}`,
          icon: "/icons/icon.svg",
        });
      }
      localStorage.setItem(todayKey, "1");
    }
  }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps

  const acceptNotifications = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    localStorage.setItem(PERM_KEY, result);
    localStorage.setItem(ASKED_KEY, "1");
    setShowNotifPrompt(false);
  }, []);

  const dismissNotifPrompt = useCallback(() => {
    localStorage.setItem(ASKED_KEY, "1");
    setShowNotifPrompt(false);
  }, []);

  return { showNotifPrompt, acceptNotifications, dismissNotifPrompt };
}
