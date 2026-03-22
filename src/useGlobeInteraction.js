import { useState, useCallback, useEffect, useRef } from "react";
import * as THREE from "three";

// ---- Local utility copies (avoid importing from form/UI modules) ----
const RAD = 1;
const MIN_Z = 1.15;
const MAX_Z = 6;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ll2v = (lat, lng, r) => {
  const phi = (90 - lat) * Math.PI / 180, theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(-(r * Math.sin(phi) * Math.cos(theta)), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
};

/**
 * useGlobeInteraction — pointer, touch, wheel, hover, flyTo, and screenshot
 *
 * @param {Object} deps — all refs, state, and callbacks needed by the interaction layer
 * @returns {{ flyTo, hoverLabel, setHoverLabel, saveGlobeScreenshot, onDown, onMove, onUp, RAD, MIN_Z, MAX_Z, clamp, ll2v }}
 */
export function useGlobeInteraction(deps) {
  const {
    mountRef, camRef, rendRef, scnRef, mkRef,
    dragR, prevR, rot, tRot, tZm, spinSpd, tSpinSpd,
    mouseRef, hoverThrottleRef, longPressRef, lastTapRef, clickSR, tDistR,
    entries, locationGroups, config, sceneReady,
    isMyWorld, isPartnerWorld, worldType, showToast,
    setSelected, setLocationList, setSliderDate, setShowLetter, setShowCapsule, setShowZoomHint,

  } = deps;

  // Raycaster + mouse vector (owned by this hook)
  const rayRef = useRef(new THREE.Raycaster());
  const mRef = useRef(new THREE.Vector2());
  const isTouchDevice = useRef("ontouchstart" in window || navigator.maxTouchPoints > 0);

  const [hoverLabel, setHoverLabel] = useState(null);

  // ---- flyTo — Euler XYZ rotation to center (lat,lng) on camera ----
  const flyTo = useCallback((lat, lng, zoom) => {
    const p = ll2v(lat, lng, RAD);
    const rx = Math.atan2(p.y, Math.sqrt(p.x * p.x + p.z * p.z));
    let ry = Math.atan2(-p.x, p.z);
    const dy = ry - rot.current.y;
    ry -= Math.round(dy / (2 * Math.PI)) * 2 * Math.PI;
    tRot.current = { x: rx, y: ry };
    tSpinSpd.current = 0;
    spinSpd.current = 0;
    if (zoom !== undefined) tZm.current = zoom;
  }, []);

  // ---- POINTER handlers ----
  const onDown = useCallback(e => {
    dragR.current = true;
    prevR.current = { x: e.clientX, y: e.clientY };
    clickSR.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, []);

  const onMove = useCallback(e => {
    mouseRef.current = { x: (e.clientX / window.innerWidth - 0.5) * 2, y: (e.clientY / window.innerHeight - 0.5) * 2 };
    if (dragR.current) {
      tRot.current.y += (e.clientX - prevR.current.x) * 0.005;
      tRot.current.x = clamp(tRot.current.x + (e.clientY - prevR.current.y) * 0.005, -1.2, 1.2);
      prevR.current = { x: e.clientX, y: e.clientY };
      setHoverLabel(null);
      return;
    }
    // Throttled hover detection (~every 80ms)
    const now = Date.now();
    if (now - hoverThrottleRef.current < 80) return;
    hoverThrottleRef.current = now;
    if (!mountRef.current || !camRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    mRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    rayRef.current.setFromCamera(mRef.current, camRef.current);
    const targets = isTouchDevice.current
      ? mkRef.current.map(m => m.hitArea || m.dot).filter(Boolean)
      : mkRef.current.map(m => m.dot).filter(Boolean);
    const hits = rayRef.current.intersectObjects(targets);
    if (hits.length > 0) {
      const id = hits[0].object.userData.entryId;
      let label = null;
      if (id.startsWith("group-")) {
        const parts = id.replace("group-", "").split("-");
        const glat = parseFloat(parts[0]), glng = parseFloat(parts.slice(1).join("-"));
        const group = locationGroups.find(g => Math.abs(g.lat - glat) < 0.05 && Math.abs(g.lng - glng) < 0.05);
        if (group) {
          const groupPhoto = group.entries.find(en => en.photos?.length)?.photos[0] || null;
          label = { city: group.city, date: `${group.entries.length} entries`, x: e.clientX, y: e.clientY, photo: groupPhoto };
        }
      } else if (id.startsWith("dream-")) {
        const dreamId = id.replace("dream-", "");
        const dream = (config.dreamDestinations || config.bucketList || []).find(d => d.id === dreamId);
        if (dream) label = { city: dream.city || dream.name, date: "dream destination", x: e.clientX, y: e.clientY };
      } else if (id.startsWith("capsule-")) {
        const capsuleId = id.replace("capsule-", "");
        const capsule = (config.timeCapsules || []).find(c => c.id === capsuleId);
        if (capsule) {
          const today = new Date().toISOString().slice(0, 10);
          const isSealed = capsule.unlockDate > today;
          label = { city: capsule.city || "Time Capsule", date: isSealed ? `🔒 Sealed until ${capsule.unlockDate}` : "🎉 Opened!", x: e.clientX, y: e.clientY };
        }
      } else {
        const entry = entries.find(en => en.id === id);
        if (entry) {
          const d = entry.dateStart ? new Date(entry.dateStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";
          const photo = entry.photos?.length ? entry.photos[0] : null;
          label = { city: entry.city, date: d, x: e.clientX, y: e.clientY, photo };
        }
      }
      setHoverLabel(label);
      mountRef.current.style.cursor = "pointer";
    } else {
      setHoverLabel(null);
      if (mountRef.current) mountRef.current.style.cursor = "grab";
    }
  }, [entries, locationGroups, config]);

  const onUp = useCallback(e => {
    dragR.current = false;
    if (!mountRef.current) return;
    if (Math.abs(e.clientX - clickSR.current.x) < 6 && Math.abs(e.clientY - clickSR.current.y) < 6 && Date.now() - clickSR.current.t < 350) {
      const rect = mountRef.current.getBoundingClientRect();
      mRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      rayRef.current.setFromCamera(mRef.current, camRef.current);
      const clickTargets = isTouchDevice.current
        ? mkRef.current.map(m => m.hitArea || m.dot).filter(Boolean)
        : mkRef.current.map(m => m.dot).filter(Boolean);
      const hits = rayRef.current.intersectObjects(clickTargets);
      if (hits.length > 0) {
        const id = hits[0].object.userData.entryId;
        // Haptic feedback on touch devices
        if (isTouchDevice.current) navigator.vibrate?.([15]);
        if (id.startsWith("group-")) {
          const parts = id.replace("group-", "").split("-");
          const glat = parseFloat(parts[0]), glng = parseFloat(parts.slice(1).join("-"));
          const group = locationGroups.find(g => Math.abs(g.lat - glat) < 0.05 && Math.abs(g.lng - glng) < 0.05);
          if (group) {
            setLocationList(group);
            setSelected(null);
            flyTo(group.lat, group.lng, 2.3);
          }
        } else {
          const entry = entries.find(en => en.id === id);
          if (entry) {
            setSelected(entry); setLocationList(null);
            setSliderDate(entry.dateStart);
            flyTo(entry.lat, entry.lng, 2.5);
          } else if (id.startsWith("love-")) {
            const letterId = id.replace("love-", "");
            setShowLetter(letterId);
          } else if (id.startsWith("capsule-")) {
            const capsuleId = id.replace("capsule-", "");
            if (setShowCapsule) setShowCapsule(capsuleId);
          }
        }
      } else { setSelected(null); setLocationList(null); tSpinSpd.current = 0.002; }
    }
  }, [entries, locationGroups, flyTo]);

  const onWheel = useCallback(e => {
    e.preventDefault();
    tZm.current = clamp(tZm.current + e.deltaY * 0.001, MIN_Z, MAX_Z);
    setShowZoomHint(false);
  }, []);

  // ---- Touch + wheel registration (passive: false for Safari) ----
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const opts = { passive: false };
    el.addEventListener("wheel", onWheel, opts);
    const canvas = el.querySelector("canvas");
    if (canvas) canvas.addEventListener("wheel", onWheel, opts);

    const handleTouchStart = (e) => {
      e.preventDefault();
      if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
      if (e.touches.length === 1) {
        dragR.current = true;
        prevR.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        clickSR.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          tZm.current = tZm.current < 2.5 ? 2.0 : 3.6;
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
        }
        const tx = e.touches[0].clientX, ty = e.touches[0].clientY;
        longPressRef.current = setTimeout(() => {
          longPressRef.current = null;
          if (!mountRef.current || !camRef.current) return;
          const rect = mountRef.current.getBoundingClientRect();
          mRef.current.x = ((tx - rect.left) / rect.width) * 2 - 1;
          mRef.current.y = -((ty - rect.top) / rect.height) * 2 + 1;
          rayRef.current.setFromCamera(mRef.current, camRef.current);
          const touchTargets = mkRef.current.map(m => m.hitArea || m.dot).filter(Boolean);
          const hits = rayRef.current.intersectObjects(touchTargets);
          if (hits.length > 0) {
            const id = hits[0].object.userData.entryId;
            let label = null;
            if (id.startsWith("group-")) {
              const parts = id.replace("group-", "").split("-");
              const glat = parseFloat(parts[0]), glng = parseFloat(parts.slice(1).join("-"));
              const group = locationGroups.find(g => Math.abs(g.lat - glat) < 0.05 && Math.abs(g.lng - glng) < 0.05);
              if (group) {
                const groupPhoto = group.entries.find(en => en.photos?.length)?.photos[0] || null;
                label = { city: group.city, date: `${group.entries.length} entries`, x: tx, y: ty, photo: groupPhoto };
              }
            } else if (!id.startsWith("dream-") && !id.startsWith("love-") && !id.startsWith("capsule-")) {
              const entry = entries.find(en => en.id === id);
              if (entry) {
                const d = entry.dateStart ? new Date(entry.dateStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";
                label = { city: entry.city, date: d, x: tx, y: ty, photo: entry.photos?.length ? entry.photos[0] : null };
              }
            }
            if (label) {
              setHoverLabel(label);
              dragR.current = false;
              setTimeout(() => setHoverLabel(prev => prev === label ? null : prev), 2500);
            }
          }
        }, 400);
      } else if (e.touches.length === 2) {
        dragR.current = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        tDistR.current = Math.sqrt(dx * dx + dy * dy);
      }
    };
    const handleTouchMove = (e) => {
      e.preventDefault();
      if (longPressRef.current && e.touches.length === 1) {
        const dx = e.touches[0].clientX - clickSR.current.x, dy = e.touches[0].clientY - clickSR.current.y;
        if (dx * dx + dy * dy > 100) { clearTimeout(longPressRef.current); longPressRef.current = null; }
      }
      if (e.touches.length === 1 && dragR.current) {
        tRot.current.y += (e.touches[0].clientX - prevR.current.x) * 0.005;
        tRot.current.x = clamp(tRot.current.x + (e.touches[0].clientY - prevR.current.y) * 0.005, -1.2, 1.2);
        prevR.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        const d = Math.sqrt(dx * dx + dy * dy);
        tZm.current = clamp(tZm.current - (d - tDistR.current) * 0.012, MIN_Z, MAX_Z);
        tDistR.current = d;
      }
    };
    const handleTouchEnd = () => {
      dragR.current = false;
      if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
    };

    el.addEventListener("touchstart", handleTouchStart, opts);
    el.addEventListener("touchmove", handleTouchMove, opts);
    el.addEventListener("touchend", handleTouchEnd);

    return () => {
      el.removeEventListener("wheel", onWheel);
      if (canvas) canvas.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onWheel, sceneReady]);

  // ---- Screenshot ----
  const saveGlobeScreenshot = useCallback(() => {
    const rend = rendRef.current, scene = scnRef.current, cam = camRef.current;
    if (!rend || !scene || !cam) return;
    rend.render(scene, cam);
    try {
      const globeData = rend.domElement.toDataURL("image/png");
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.font = `${Math.round(c.height * 0.018)}px 'Palatino Linotype', Georgia, serif`;
        ctx.textAlign = "right";
        ctx.fillText("Little Cosmos", c.width - 16, c.height - 12);
        const title = config.title || (isMyWorld ? "My World" : isPartnerWorld ? "Our World" : worldType === "friends" ? "Friends" : "Family");
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = `${Math.round(c.height * 0.028)}px 'Palatino Linotype', Georgia, serif`;
        ctx.textAlign = "left";
        ctx.fillText(title, 16, c.height - 12);
        const link = document.createElement("a");
        link.download = `${title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_globe.png`;
        link.href = c.toDataURL("image/png");
        link.click();
        showToast("Globe saved to downloads", "\u{1F4F7}", 2500);
      };
      img.src = globeData;
    } catch (err) {
      console.error("[screenshot]", err);
      showToast("Couldn't capture globe", "\u26A0\uFE0F", 3000);
    }
  }, [config.title, isMyWorld, isPartnerWorld, worldType, showToast]);

  return { flyTo, hoverLabel, setHoverLabel, saveGlobeScreenshot, onDown, onMove, onUp };
}
