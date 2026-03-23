import { useEffect } from "react";
import { todayStr } from "./geodata.js";

export function useKeyboardShortcuts({
  stepDay, flushConfigSave, setSelected, setEditing, modalDispatch, modals,
  setShowLetter, setShowCapsule, setShowCreateCapsule, setMarkerFilter,
  setLocationList, setConfirmDelete, setLightboxOpen, setShowOnboarding,
  setConfirmModal, setTripCardEntry, onboardKey, tSpinSpd, isPlaying, stopPlay,
  dispatch, showToast, editing, setSliderDate, saveGlobeScreenshot,
  data, tZm, flyTo, surpriseTimers, playStory, togetherList, sorted, isPartnerWorld,
}) {
  useEffect(() => {
    const handler = e => {
      const inInput = e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT";
      if (inInput && e.key !== "Escape") return;
      if (e.key === "ArrowLeft") { e.preventDefault(); stepDay(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); stepDay(1); }
      if (e.key === "Escape") { flushConfigSave(); setSelected(null); setEditing(null); modalDispatch({ type: 'CLOSE_ALL' }); setShowLetter(null); setShowCapsule(null); setShowCreateCapsule(false); setMarkerFilter("all"); setLocationList(null); setConfirmDelete(null); setLightboxOpen(false); setShowOnboarding(false); setConfirmModal(null); setTripCardEntry(null); localStorage.setItem(onboardKey, "1"); tSpinSpd.current = 0.002; if (isPlaying) stopPlay(); }
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey && !modals.showAdd && !editing) { e.preventDefault(); dispatch({ type: "UNDO" }); showToast("Undone", "\u21A9", 1500); }
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && e.shiftKey && !modals.showAdd && !editing) { e.preventDefault(); dispatch({ type: "REDO" }); showToast("Redone", "\u21AA", 1500); }
      if (e.key === "?" && !modals.showAdd && !editing && !modals.showSettings) modalDispatch({ type: 'TOGGLE', name: 'showShortcuts' });
      if (e.key === "f" && !modals.showAdd && !editing && !modals.showSettings) { if (modals.showFilter) { setMarkerFilter("all"); setLocationList(null); } modalDispatch({ type: 'TOGGLE', name: 'showFilter' }); }
      if (e.key === "i" && !modals.showAdd && !editing && !modals.showSettings) modalDispatch({ type: 'TOGGLE', name: 'showStats' });
      if (e.key === "s" && !modals.showAdd && !editing && !modals.showSettings && !modals.showSearch) { e.preventDefault(); modalDispatch({ type: 'OPEN', name: 'showSearch' }); }
      if (e.key === "g" && !modals.showAdd && !editing && !modals.showSettings) modalDispatch({ type: 'TOGGLE', name: 'showGallery' });
      if (e.key === "t" && !modals.showAdd && !editing && !modals.showSettings) setSliderDate(todayStr());
      if (e.key === "p" && !modals.showAdd && !editing && !modals.showSettings && !modals.showSearch) saveGlobeScreenshot();
      if (e.key === "r" && !modals.showAdd && !editing && !modals.showSettings && !modals.showSearch) {
        const pool = data.entries.filter(en => en.lat != null && en.lng != null);
        if (pool.length > 1) {
          const pick = pool[Math.floor(Math.random() * pool.length)];
          tZm.current = 4.5;
          const t1 = setTimeout(() => { flyTo(pick.lat, pick.lng, 2.2); const t2 = setTimeout(() => { setSelected(pick); }, 600); surpriseTimers.current.push(t2); }, 400);
          surpriseTimers.current.push(t1);
        }
      }
      if (e.key === " " && !modals.showAdd && !editing && !modals.showSettings && !modals.showSearch) { e.preventDefault(); if (isPlaying) stopPlay(); else if ((isPartnerWorld ? togetherList : sorted).length > 0) playStory(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stepDay, isPlaying, modals.showAdd, editing, modals.showSettings, modals.showSearch, stopPlay, playStory, togetherList, sorted, isPartnerWorld, showToast]);
}
