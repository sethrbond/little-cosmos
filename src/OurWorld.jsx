import { useState, useEffect, useRef, useCallback, useMemo, useReducer, Component, lazy, Suspense } from "react";
import * as THREE from "three";
import { createOurWorldDB, createSharedWorldDB } from "./supabase.js";
import { createMyWorldDB, createFriendWorldDB } from "./supabaseMyWorld.js";
import { useAuth } from "./AuthContext.jsx";
import { wrapDbForOffline, onQueueChange, flushQueue } from "./offlineQueue.js";

// Lazy-loaded overlay components — code-split, only loaded when user opens them
const PhotoMap = lazy(() => import("./PhotoMap.jsx"));
const Milestones = lazy(() => import("./Milestones.jsx"));
const TravelStats = lazy(() => import("./TravelStats.jsx"));
const ExportHub = lazy(() => import("./ExportHub.jsx"));
const TripCard = lazy(() => import("./TripCard.jsx"));
const YearInReview = lazy(() => import("./YearInReview.jsx"));
const KeyboardShortcuts = lazy(() => import("./KeyboardShortcuts.jsx"));
const TripJournal = lazy(() => import("./TripJournal.jsx"));
import SyncIndicator from "./SyncIndicator.jsx";
import NotificationCenter from "./NotificationCenter.jsx";
import { EntryTemplates, saveTemplate } from "./EntryTemplates.jsx";
import useRealtimeSync, { useRealtimePresence } from "./useRealtimeSync.js";
import { supabase } from "./supabaseClient.js";
import { geocodeSearch } from "./geocode.js";
import { inputStyle, navStyle, imageNavBtn, renderList, TBtn, TBtnGroup, Lbl, Fld, QuickAddForm, DreamAddForm, DREAM_CATEGORIES, AddForm, EditForm, hasDraft, getDraftSummary, OverlayBoundary, useFocusTrap } from "./EntryForms.jsx";
import {
  OUR_WORLD_PALETTE, MY_WORLD_PALETTE,
  OUR_WORLD_TYPES, MY_WORLD_TYPES,
  OUR_WORLD_DEFAULT_CONFIG, MY_WORLD_DEFAULT_CONFIG,
  OUR_WORLD_FIELDS, MY_WORLD_FIELDS,
  OUR_WORLD_SCENE, MY_WORLD_SCENE,
  FRIENDS_TYPES, FRIENDS_FIELDS, FRIENDS_DEFAULT_CONFIG,
  FAMILY_TYPES, FAMILY_FIELDS, FAMILY_DEFAULT_CONFIG,
  getSeasonalHue, resolveTypes, getSharedWorldConfig,
  WORLD_THEMES,
} from "./worldConfigs.js";
import { sendWelcomeLetter, getMyLetters, deleteWelcomeLetter } from "./supabaseWelcomeLetters.js";
import { loadComments, addComment, deleteComment, loadAllWorldReactions, toggleReaction, getWorldMembers, removeWorldMember, updateMemberRole, deleteWorld, leaveWorld, updateWorld, loadMyWorlds, shareEntryToWorld, getPersonalWorldId } from "./supabaseWorlds.js";
import { thumbnail, compressImage } from "./imageUtils.js";
import { useCelebrations } from "./useCelebrations.js";
import StatsOverlay from "./StatsOverlay.jsx";
import RecapOverlay from "./RecapOverlay.jsx";
import OnboardingOverlay from "./OnboardingOverlay.jsx";
import SettingsPanel from "./SettingsPanel.jsx";
import DetailCard from "./DetailCard.jsx";
import { useGlobeScene } from "./useGlobeScene.js";

/* =================================================================
   🌍 OUR WORLD / MY WORLD — Multi-World Globe Engine
   v9.0 — dual world support, earth-tone My World palette
   ================================================================= */

// Mutable palette ref — stored on window to survive Vite production bundling
// (Vite may convert top-level `let` to `const`, making reassignment throw)
// External form components (inputStyle, TBtn, Fld, etc.) read from P so they get correct world colors.
// Initialized with Our World palette but mutated in-place by _paletteBase useMemo to match current world.
// Shared palette object — mutated at runtime when user customizes colors.
// Referenced as window.__cosmosP by EntryForms and other components.
window.__cosmosP = {
  cream: "#faf7f5", warm: "#fdf8f5", parchment: "#f3ede8",
  blush: "#faf0f2", lavMist: "#f1edf8",
  text: "#2e2440", textMid: "#584c6e", textMuted: "#8878a0", textFaint: "#b8aec8",
  rose: "#c48aa8", roseLight: "#e4c0d4", roseSoft: "#d8a8c0",
  sky: "#8ca8c8", skyLight: "#b8d0e8", skySoft: "#a0bcd8",
  sage: "#90b080", gold: "#c8a060", goldWarm: "#dab470", lavender: "#a898c0",
  together: "#b898d0", togetherSoft: "#d0b8e4", togetherLight: "#e6d8f2",
  heart: "#d06888", heartSoft: "#e890a8",
  special: "#d0a870", specialSoft: "#e0c090",
  card: "rgba(252,249,246,0.96)", glass: "rgba(248,244,240,0.92)",
  warmMist: "#f0e6de",
};
const P = window.__cosmosP; // P = palette shorthand used throughout this file
// ---- EXTENDED THEME PRESETS ----
Object.assign(WORLD_THEMES, {
  sunset: {
    name: "Sunset Garden",
    description: "Warm oranges and pinks",
    preview: ["#1a1008", "#e8884a", "#d06878"],
    palette: { rose: "#e8884a", sky: "#d06878", gold: "#f0b060", heart: "#e05858", text: "#f0e0d0", cream: "#1a1210" },
    scene: { bg: "#120c06", globe: "#2c2018", glow: "#e8884a30", coast: "#e8884a", particles: "#d0687840", starTint: "#e8884a20" },
  },
  desert: {
    name: "Desert Sand",
    description: "Warm tans and terracotta",
    preview: ["#1c1610", "#d4a070", "#c07850"],
    palette: { rose: "#c07850", sky: "#a89878", gold: "#d4a070", heart: "#c86848", text: "#e8dcd0", cream: "#1c1814" },
    scene: { bg: "#100c08", globe: "#2c2418", glow: "#d4a07030", coast: "#c07850", particles: "#d4a07040", starTint: "#d4a07020" },
  },
  arctic: {
    name: "Arctic Ice",
    description: "Cool whites and light blues",
    preview: ["#0c1018", "#a0d0e8", "#d8e8f0"],
    palette: { rose: "#78b8d8", sky: "#a0d0e8", gold: "#d8e8f0", heart: "#6098c0", text: "#d0e0e8", cream: "#0e1418" },
    scene: { bg: "#060a10", globe: "#182028", glow: "#a0d0e830", coast: "#78b8d8", particles: "#a0d0e840", starTint: "#d8e8f020" },
  },
  lavender: {
    name: "Lavender Fields",
    description: "Soft purples and lilacs",
    preview: ["#14101c", "#b090d0", "#d0b8e8"],
    palette: { rose: "#b090d0", sky: "#9880c0", gold: "#d0b8e8", heart: "#c878b0", text: "#e0d8e8", cream: "#161020" },
    scene: { bg: "#0a0810", globe: "#201830", glow: "#b090d030", coast: "#b090d0", particles: "#9880c040", starTint: "#d0b8e820" },
  },
  forest: {
    name: "Forest Canopy",
    description: "Deep woodland greens",
    preview: ["#0a1208", "#58a068", "#88c898"],
    palette: { rose: "#58a068", sky: "#78b888", gold: "#a0c878", heart: "#48884c", text: "#d0e0d0", cream: "#0c1410" },
    scene: { bg: "#060a06", globe: "#142818", glow: "#58a06830", coast: "#58a068", particles: "#78b88840", starTint: "#88c89820" },
  },
  golden: {
    name: "Golden Hour",
    description: "Warm golds and ambers",
    preview: ["#181008", "#d8a840", "#e8c868"],
    palette: { rose: "#d8a840", sky: "#c89848", gold: "#e8c868", heart: "#c08830", text: "#f0e0c8", cream: "#181410" },
    scene: { bg: "#100c04", globe: "#282010", glow: "#d8a84030", coast: "#d8a840", particles: "#e8c86840", starTint: "#e8c86820" },
  },
  nebula: {
    name: "Cosmic Nebula",
    description: "Deep purples and magentas",
    preview: ["#10081c", "#c058a0", "#8848c0"],
    palette: { rose: "#c058a0", sky: "#8848c0", gold: "#d080c0", heart: "#d04888", text: "#e0d0e8", cream: "#140c1c" },
    scene: { bg: "#080410", globe: "#201030", glow: "#c058a030", coast: "#c058a0", particles: "#8848c040", starTint: "#d080c020" },
  },
  rosegold: {
    name: "Rose Gold",
    description: "Elegant blush and copper",
    preview: ["#181014", "#c89888", "#e8b8a8"],
    palette: { rose: "#c89888", sky: "#b8a098", gold: "#e8b8a8", heart: "#d08878", text: "#e8d8d0", cream: "#181214" },
    scene: { bg: "#0c0808", globe: "#281c1c", glow: "#c8988830", coast: "#c89888", particles: "#e8b8a840", starTint: "#e8b8a820" },
  },
  monochrome: {
    name: "Monochrome",
    description: "Elegant grayscale",
    preview: ["#111111", "#888888", "#cccccc"],
    palette: { rose: "#888888", sky: "#a0a0a0", gold: "#cccccc", heart: "#707070", text: "#e0e0e0", cream: "#141414" },
    scene: { bg: "#080808", globe: "#1c1c1c", glow: "#88888830", coast: "#888888", particles: "#a0a0a040", starTint: "#cccccc20" },
  },
  tropical: {
    name: "Tropical Paradise",
    description: "Vibrant turquoise and coral",
    preview: ["#081418", "#40c8b8", "#e87870"],
    palette: { rose: "#40c8b8", sky: "#58d8c8", gold: "#e8c868", heart: "#e87870", text: "#d0e8e8", cream: "#0c1618" },
    scene: { bg: "#040c10", globe: "#142028", glow: "#40c8b830", coast: "#40c8b8", particles: "#58d8c840", starTint: "#e8c86820" },
  },
});



import { _symbolCache, _meteorV1, _meteorV2, createPool, makeSymbolTexture, ll2v, lerp, haversine, daysBetween, addDays, fmtDate, todayStr, clamp, regionDots, LAND, COAST_DATA, RAD, MIN_Z, MAX_Z } from "./globeUtils.js";
import { useGlobeInteraction } from "./useGlobeInteraction.js";
import { useGlobeMarkers } from "./useGlobeMarkers.js";



// Location search powered by OpenStreetMap Nominatim — see geocode.js
// ---- REDUCER (with Supabase persistence + undo history) ----
function reducer(st, a) {
  let next = st;
  // DB functions passed via a.db from dispatch wrapper
  const _saveEntry = a.db?.saveEntry;
  const _deleteEntry = a.db?.deleteEntry;
  const _deletePhoto = a.db?.deletePhoto;
  const _savePhotos = a.db?.savePhotos;
  const pushUndo = (inverse) => {
    if (!a._skipSave && !a._skipUndo) {
      next = { ...next, undoStack: [...(next.undoStack || []).slice(-29), inverse], redoStack: [] };
    }
  };
  switch (a.type) {
    case "LOAD": return { ...st, entries: a.entries, undoStack: st.undoStack || [], redoStack: st.redoStack || [] };
    case "UNDO": {
      const stack = [...(st.undoStack || [])];
      if (stack.length === 0) return st;
      const action = stack.pop();
      // Apply the inverse action
      if (action.type === "ADD") {
        next = { ...st, entries: [...st.entries, action.entry], undoStack: stack, redoStack: [...(st.redoStack || []), { type: "DELETE", id: action.entry.id }] };
        if (_saveEntry) _saveEntry(action.entry).catch(err => console.error('[cosmos] save failed:', err));
      } else if (action.type === "DELETE") {
        const doomed = st.entries.find(e => e.id === action.id);
        next = { ...st, entries: st.entries.filter(e => e.id !== action.id), undoStack: stack, redoStack: [...(st.redoStack || []), { type: "ADD", entry: doomed }] };
        if (_deleteEntry) _deleteEntry(action.id);
      } else if (action.type === "UPDATE") {
        const prev = st.entries.find(e => e.id === action.id);
        next = { ...st, entries: st.entries.map(e => e.id === action.id ? { ...e, ...action.data } : e), undoStack: stack, redoStack: [...(st.redoStack || []), { type: "UPDATE", id: action.id, data: prev ? { ...prev } : {} }] };
        const updated = next.entries.find(e => e.id === action.id);
        if (_saveEntry && updated) _saveEntry(updated).catch(err => console.error('[cosmos] save failed:', err));
      }
      return next;
    }
    case "REDO": {
      const stack = [...(st.redoStack || [])];
      if (stack.length === 0) return st;
      const action = stack.pop();
      if (action.type === "ADD") {
        next = { ...st, entries: [...st.entries, action.entry], redoStack: stack, undoStack: [...(st.undoStack || []), { type: "DELETE", id: action.entry.id }] };
        if (_saveEntry) _saveEntry(action.entry).catch(err => console.error('[cosmos] save failed:', err));
      } else if (action.type === "DELETE") {
        const doomed = st.entries.find(e => e.id === action.id);
        next = { ...st, entries: st.entries.filter(e => e.id !== action.id), redoStack: stack, undoStack: [...(st.undoStack || []), { type: "ADD", entry: doomed }] };
        if (_deleteEntry) _deleteEntry(action.id);
      } else if (action.type === "UPDATE") {
        const prev = st.entries.find(e => e.id === action.id);
        next = { ...st, entries: st.entries.map(e => e.id === action.id ? { ...e, ...action.data } : e), redoStack: stack, undoStack: [...(st.undoStack || []), { type: "UPDATE", id: action.id, data: prev ? { ...prev } : {} }] };
        const updated = next.entries.find(e => e.id === action.id);
        if (_saveEntry && updated) _saveEntry(updated).catch(err => console.error('[cosmos] save failed:', err));
      }
      return next;
    }
    case "ADD":
      next = { ...st, entries: [...st.entries, a.entry] };
      pushUndo({ type: "DELETE", id: a.entry.id });
      if (_saveEntry && !a._skipSave) _saveEntry(a.entry).catch(() => {
        window.dispatchEvent(new CustomEvent('cosmos-save-error', { detail: { city: a.entry?.city } }))
      });
      break;
    case "UPDATE":
      { const prev = st.entries.find(e => e.id === a.id);
        if (prev) pushUndo({ type: "UPDATE", id: a.id, data: { ...prev } });
      }
      next = { ...next, entries: (next.entries || st.entries).map(e => e.id === a.id ? { ...e, ...a.data } : e) };
      if (_saveEntry && !a._skipSave) { const updated = next.entries.find(e => e.id === a.id); if (updated) _saveEntry(updated).catch(() => {
        window.dispatchEvent(new CustomEvent('cosmos-save-error', { detail: { city: updated?.city } }))
      }); }
      break;
    case "DELETE":
      { const doomed = st.entries.find(e => e.id === a.id);
        if (doomed) pushUndo({ type: "ADD", entry: { ...doomed } });
        if (_deletePhoto && !a._skipSave && doomed?.photos?.length) doomed.photos.forEach(url => _deletePhoto(url));
      }
      next = { ...next, entries: (next.entries || st.entries).filter(e => e.id !== a.id) };
      if (_deleteEntry && !a._skipSave) _deleteEntry(a.id);
      break;
    case "ADD_PHOTOS":
      next = { ...st, entries: st.entries.map(e => e.id === a.id ? { ...e, photos: [...(e.photos || []), ...a.urls] } : e) };
      break;
    case "REMOVE_PHOTO":
      { const photoUrl = (st.entries.find(e => e.id === a.id)?.photos || [])[a.photoIndex];
        if (photoUrl) _deletePhoto(photoUrl); }
      next = { ...st, entries: st.entries.map(e => e.id === a.id ? { ...e, photos: (e.photos || []).filter((_, i) => i !== a.photoIndex) } : e) };
      { const remaining = next.entries.find(e => e.id === a.id);
        if (remaining) _savePhotos(a.id, remaining.photos || []); }
      break;
    default: return st;
  }
  return next;
}

// ---- FIRST BADGES ----
function getFirstBadges(entries) {
  const badges = {};
  const together = entries.filter(e => e.who === "both").sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));
  if (together.length > 0) badges[together[0].id] = "First time together";
  const countries = {};
  together.forEach(e => {
    if (e.country && !countries[e.country]) { countries[e.country] = e.id; }
    (e.stops || []).forEach(s => { if (s.country && !countries[s.country]) countries[s.country] = e.id; });
  });
  const international = together.find(e => e.country && e.country !== "USA");
  if (international) badges[international.id] = badges[international.id] || "First trip abroad together";
  // First Christmas
  together.forEach(e => {
    const ds = e.dateStart;
    if (ds && ds.slice(5) >= "12-20" && ds.slice(5) <= "12-31" && !Object.values(badges).includes("First Christmas together")) {
      badges[e.id] = "First Christmas together";
    }
  });
  return badges;
}

// ---- ERROR BOUNDARY ----
class OurWorldErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(err, info) { console.error("OurWorld error:", err, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ width: "100%", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf8f4", fontFamily: "Georgia,serif", textAlign: "center", padding: 40 }}>
          <div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🌍</div>
            <h2 style={{ fontSize: 18, fontWeight: 400, color: "#3d3552", marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 12, color: "#958ba8", marginBottom: 16 }}>Your data is safe — try refreshing the page.</p>
            <button onClick={() => window.location.reload()} style={{ padding: "8px 24px", background: "#d4a0b9", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Refresh</button>
            <p style={{ fontSize: 9, color: "#c4bbd4", marginTop: 12 }}>{String(this.state.error)}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ================================================================
// MAIN
// ================================================================
function OurWorldInner({ worldMode = "our", worldId = null, worldName = null, worldRole = null, worldType = null, onSwitchWorld }) {
  // ---- AUTH ----
  const { user, userId, signOut } = useAuth();
  const userDisplayName = user?.user_metadata?.display_name || "";

  // ---- WORLD MODE CONFIG ----
  const isMyWorld = worldMode === "my" || worldMode === "friend";
  const isFriendWorld = worldMode === "friend";
  const isSharedWorld = worldMode === "our" && !!worldId;
  const isViewer = worldRole === "viewer" || isFriendWorld;
  const isPartnerWorld = !isMyWorld && (!worldType || worldType === "partner" || worldType === "shared");
  const DEFAULT_CONFIG = isMyWorld ? MY_WORLD_DEFAULT_CONFIG
    : worldType === "friends" ? FRIENDS_DEFAULT_CONFIG
    : worldType === "family" ? FAMILY_DEFAULT_CONFIG
    : OUR_WORLD_DEFAULT_CONFIG;
  const FIELD_LABELS = isMyWorld ? MY_WORLD_FIELDS
    : worldType === "friends" ? FRIENDS_FIELDS
    : worldType === "family" ? FAMILY_FIELDS
    : OUR_WORLD_FIELDS;
  useEffect(() => {
    const typeLabel = { partner: "Partner", friends: "Friends", family: "Family" }[worldType] || "";
    document.title = isFriendWorld ? `${worldName || "Friend's World"} — Little Cosmos`
      : isMyWorld ? "My World — Little Cosmos"
      : worldName ? `${worldName}${typeLabel ? ` (${typeLabel})` : ""} — Little Cosmos`
      : "Our World — Little Cosmos";
  }, [isMyWorld, isFriendWorld, worldName, worldType]);

  // DB functions selected by mode, scoped to current user or shared world
  const _rawDb = useMemo(() => {
    if (isFriendWorld) return createFriendWorldDB(worldId);
    if (isMyWorld) return createMyWorldDB(worldId, userId);
    if (isSharedWorld) return createSharedWorldDB(worldId, userId);
    if (worldMode === 'our') console.warn('[OurWorld] worldMode=our but no worldId — using legacy DB, entries from other users will NOT be visible');
    return createOurWorldDB(userId);
  }, [isMyWorld, isFriendWorld, isSharedWorld, worldId, userId]);
  const dbKey = useMemo(() => `${worldId || 'default'}-${userId}`, [worldId, userId]);
  const db = useMemo(() => isFriendWorld ? _rawDb : wrapDbForOffline(_rawDb, dbKey), [_rawDb, dbKey, isFriendWorld]);

  // Offline queue: pending count + flush on reconnect
  const [pendingOffline, setPendingOffline] = useState(0);
  useEffect(() => {
    const unsub = onQueueChange(setPendingOffline);
    const handleOnline = () => {
      flushQueue({ [dbKey]: _rawDb }).then(({ flushed }) => {
        if (flushed > 0) showToast(`${flushed} offline ${flushed === 1 ? 'change' : 'changes'} synced`, "☁️", 3000);
      });
    };
    window.addEventListener('online', handleOnline);
    // Attempt flush on mount if online
    if (navigator.onLine) handleOnline();
    return () => { unsub(); window.removeEventListener('online', handleOnline); };
  }, [dbKey, _rawDb]); // eslint-disable-line react-hooks/exhaustive-deps

  const [data, _dispatch] = useReducer(reducer, { entries: [] });
  const dispatch = useCallback(action => _dispatch({ ...action, db }), [db]);
  const [config, setConfigState] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const loadErrorRef = useRef(false);

  // Palette & scene merge custom overrides from config (takes effect on render for UI, on reload for scene)
  // Mutates module-level P so external form components (TBtn, Fld, etc.) get correct world colors
  const _paletteBase = useMemo(() => {
    let basePalette = isMyWorld ? MY_WORLD_PALETTE : OUR_WORLD_PALETTE;
    if (!isMyWorld && worldType) {
      const shared = getSharedWorldConfig(worldType);
      basePalette = shared.palette;
    }
    return { ...basePalette, ...(config.customPalette || {}) };
  }, [isMyWorld, worldType, config.customPalette]);
  useEffect(() => {
    for (const k of Object.keys(_paletteBase)) window.__cosmosP[k] = _paletteBase[k];
  }, [_paletteBase]);
  const SC = useMemo(() => {
    let baseScene = isMyWorld ? MY_WORLD_SCENE : OUR_WORLD_SCENE;
    if (!isMyWorld && worldType) {
      const shared = getSharedWorldConfig(worldType);
      baseScene = shared.scene;
    }
    return { ...baseScene, ...(config.customScene || {}) };
  }, [isMyWorld, worldType, config.customScene]);
  const TYPES = useMemo(() => {
    const base = isMyWorld ? MY_WORLD_TYPES
      : worldType === "friends" ? FRIENDS_TYPES
      : worldType === "family" ? FAMILY_TYPES
      : OUR_WORLD_TYPES;
    return resolveTypes(base, _paletteBase);
  }, [isMyWorld, worldType, _paletteBase]);
  const DEFAULT_TYPE = isMyWorld ? TYPES.adventure
    : worldType === "friends" ? (TYPES["group-trip"] || Object.values(TYPES)[0])
    : worldType === "family" ? (TYPES["family-trip"] || Object.values(TYPES)[0])
    : TYPES.together;

  useEffect(() => {
    (async () => {
      try {
        const results = await Promise.allSettled([db.loadEntries(), db.loadConfig()]);
        const entries = results[0].status === 'fulfilled' ? results[0].value : [];
        const cfg = results[1].status === 'fulfilled' ? results[1].value : null;
        results.forEach((r, i) => { if (r.status === 'rejected') console.error('[loadWorld] call', i, 'failed:', r.reason) });
        dispatch({ type: "LOAD", entries: entries || [] });
        if (cfg) {
          const merged = { ...DEFAULT_CONFIG, ...cfg };
          // Migrate legacy single loveLetter to loveLetters array (partner worlds only)
          if (isPartnerWorld && merged.loveLetter && (!merged.loveLetters || merged.loveLetters.length === 0)) {
            merged.loveLetters = [{ id: `ll-legacy`, text: merged.loveLetter, lat: 48.8566, lng: 2.3522, city: "Paris" }];
            merged.loveLetter = "";
          }
          setConfigState(merged);
        }
      } catch (err) {
        console.error("Failed to load from Supabase:", err);
        loadErrorRef.current = true;
      }
      setLoading(false);
    })();
  }, [db]);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const configSaveTimer = useRef(null);
  const pendingConfigRef = useRef(null);
  // Clean up pending config save timer when db changes (prevents saving to wrong world)
  useEffect(() => {
    return () => { clearTimeout(configSaveTimer.current); pendingConfigRef.current = null; };
  }, [db]);
  const setConfig = useCallback(partial => {
    setConfigState(prev => {
      const next = { ...prev, ...partial };
      // Store latest config in ref so debounced save always gets the newest version
      pendingConfigRef.current = next;
      clearTimeout(configSaveTimer.current);
      const currentDb = db;
      configSaveTimer.current = setTimeout(() => {
        if (pendingConfigRef.current) {
          currentDb.saveConfig(pendingConfigRef.current).catch(err => console.error('[setConfig] save failed:', err));
          pendingConfigRef.current = null;
        }
      }, 400);
      return next;
    });
  }, [db]);

  // Flush any pending config save immediately (used when closing settings, switching worlds)
  const flushConfigSave = useCallback(() => {
    clearTimeout(configSaveTimer.current);
    if (pendingConfigRef.current) {
      db.saveConfig(pendingConfigRef.current).catch(err => console.error('[flushConfigSave] failed:', err));
      pendingConfigRef.current = null;
    }
  }, [db]);


  // THREE refs
  const mountRef = useRef(null);
  const mkRef = useRef([]);
  const rtRef = useRef([]);
  const rayRef = useRef(new THREE.Raycaster());
  const mRef = useRef(new THREE.Vector2());
  const frameRef = useRef(0);
  const easterEggRef = useRef(null);
  const ambientRef = useRef(null);
  const [ambientPlaying, setAmbientPlaying] = useState(false);

  const dragR = useRef(false);
  const prevR = useRef({ x: 0, y: 0 });
  const rot = useRef({ x: 0.25, y: -1.8 });
  const tRot = useRef({ x: 0.25, y: -1.8 });
  const zmR = useRef(8);
  const tZm = useRef(3.6);
  const spinSpd = useRef(0.001);
  const tSpinSpd = useRef(0.001);

  const clickSR = useRef({ x: 0, y: 0, t: 0 });
  const tDistR = useRef(0);

  const [selected, setSelected] = useState(null);
  const selectedRef = useRef(null);
  useEffect(() => { selectedRef.current = selected; setShareMenu(null); }, [selected]);

  // Keep selected entry in sync with latest data (e.g. after reducer UPDATE from realtime sync)
  useEffect(() => {
    if (!selected) return;
    const fresh = data.entries.find(e => e.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [data.entries]); // eslint-disable-line react-hooks/exhaustive-deps


  // Atmosphere pulse — visual response when selecting an entry
  useEffect(() => {
    const atm = atmosphereRef.current;
    if (!selected) {
      atm.targetHue = null;
      return;
    }
    // Derive mood color from entry type
    const typeInfo = TYPES[selected.type];
    const typeColor = typeInfo ? (P[typeInfo.color] || typeInfo.color) : P.rose;
    atm.targetHue = typeColor;
    atm.intensity = 0.01; // start ramp
    atm.particleBoost = 1.0; // brief speed burst

    // Create expanding pulse ring on the globe surface
    const g = globeRef.current;
    if (g && selected.lat != null && selected.lng != null) {
      const pos = ll2v(selected.lat, selected.lng, RAD * 1.015);
      const ring = pulseRingPoolRef.current ? pulseRingPoolRef.current.acquire() : new THREE.Mesh(new THREE.RingGeometry(0.02, 0.035, 32), new THREE.MeshBasicMaterial({ color: typeColor, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthTest: false }));
      ring.material.color.set(typeColor);
      ring.material.opacity = 0.25;
      ring.scale.setScalar(1);
      ring.position.copy(pos);
      ring.lookAt(pos.clone().multiplyScalar(2));
      ring.renderOrder = 5;
      g.add(ring);
      pulseRingsRef.current.push({ mesh: ring, age: 0 });
      // Second ring with slight delay for layered effect
      const ring2Timer = setTimeout(() => {
        if (!globeRef.current) return;
        const ring2 = pulseRingPoolRef.current ? pulseRingPoolRef.current.acquire() : new THREE.Mesh(new THREE.RingGeometry(0.015, 0.025, 32), new THREE.MeshBasicMaterial({ color: typeColor, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthTest: false }));
        ring2.material.color.set(typeColor);
        ring2.material.opacity = 0.18;
        ring2.scale.setScalar(1);
        ring2.position.copy(pos);
        ring2.lookAt(pos.clone().multiplyScalar(2));
        ring2.renderOrder = 5;
        globeRef.current.add(ring2);
        pulseRingsRef.current.push({ mesh: ring2, age: 0 });
      }, 150);
      return () => clearTimeout(ring2Timer);
    }
  }, [selected?.id]);

  // Comet arrival — when a new entry is added, fire a comet to its location
  useEffect(() => {
    const count = data.entries.length;
    if (prevEntryCountRef.current > 0 && count > prevEntryCountRef.current && sceneReady) {
      const newest = data.entries[data.entries.length - 1];
      if (newest && newest.lat != null && newest.lng != null && !cometRef.current) {
        // Store lat/lng so we can compute world-space target each frame (accounts for globe rotation)
        const targetLocal = ll2v(newest.lat, newest.lng, RAD * 1.015);
        if (!globeRef.current) { prevEntryCountRef.current = count; return; }
        const targetWorld = targetLocal.clone().applyEuler(globeRef.current.rotation);
        // Origin: further out, always visible (camera-forward bias)
        const camZ = camRef.current ? camRef.current.position.z : 4;
        const origin = new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          2 + Math.random() * 3,
          camZ * 0.5 + Math.random() * 2
        );
        const typeInfo = TYPES[newest.type];
        const color = typeInfo ? (P[typeInfo.color] || typeInfo.color || P.gold) : P.gold;

        // Comet head — larger, glowing
        const headGeo = new THREE.SphereGeometry(0.045, 16, 16);
        const headMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.copy(origin);
        head.renderOrder = 15;
        scnRef.current.add(head);
        // Head glow halo
        const haloGeo = new THREE.SphereGeometry(0.12, 16, 16);
        const haloMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15, side: THREE.BackSide });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        head.add(halo);

        // Store halo reference for cleanup
        head._halo = halo;
        // Multi-segment trail (16 points for smooth fade)
        const TRAIL_LEN = 16;
        const trailPositions = new Float32Array(TRAIL_LEN * 3);
        for (let ti = 0; ti < TRAIL_LEN * 3; ti++) trailPositions[ti] = origin.x;
        const trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
        const trailMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 });
        const trail = new THREE.Line(trailGeo, trailMat);
        trail.renderOrder = 14;
        scnRef.current.add(trail);

        // Impact flash mesh (starts invisible)
        const flashGeo = new THREE.SphereGeometry(0.2, 24, 24);
        const flashMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, side: THREE.FrontSide });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(targetWorld);
        flash.renderOrder = 16;
        scnRef.current.add(flash);

        cometRef.current = {
          active: true, progress: 0,
          origin, targetLocal, color,
          head, trail, trailGeo, trailPositions, TRAIL_LEN,
          flash, halo,
          history: [],
          burst: null, burstAge: 0,
        };
      }
    }
    prevEntryCountRef.current = count;
  }, [data.entries.length, sceneReady]);

  // Load world members for contributor avatars
  useEffect(() => {
    if (!isSharedWorld || !worldId) { setWorldMembers([]); return; }
    getWorldMembers(worldId).then(setWorldMembers).catch(() => setWorldMembers([]));
  }, [isSharedWorld, worldId]);

  // Load reactions for shared worlds
  useEffect(() => {
    if (!isSharedWorld || !worldId) return;
    loadAllWorldReactions(worldId).then(setWorldReactions).catch(err => console.error('[cosmos] load reactions failed:', err));
  }, [isSharedWorld, worldId]);

  // Load comments when selecting an entry in a shared world
  useEffect(() => {
    if (!isSharedWorld || !worldId || !selected?.id) { setEntryComments([]); return; }
    loadComments(worldId, selected.id).then(setEntryComments).catch(() => setEntryComments([]));
  }, [isSharedWorld, worldId, selected?.id]);

  // Real-time entry sync via useRealtimeSync hook (entries table)
  const { isConnected: realtimeConnected, lastSync } = useRealtimeSync({
    tableName: 'entries',
    userId,
    worldId: isSharedWorld ? worldId : undefined,
    onInsert: useCallback((entry) => {
      _dispatch({ type: 'ADD', entry, _skipSave: true });
      showToast(`New entry added: ${entry.city || 'somewhere new'}`, "✨", 4000);
      setNotifications(prev => [{ id: `n-${Date.now()}`, type: 'entry_added', message: `New entry: ${entry.city || 'somewhere new'}`, timestamp: new Date().toISOString(), entryId: entry.id, read: false }, ...prev].slice(0, 100));
    }, []),
    onUpdate: useCallback((entry) => { _dispatch({ type: 'UPDATE', id: entry.id, data: entry, _skipSave: true }); }, []),
    onDelete: useCallback(({ id }) => { _dispatch({ type: 'DELETE', id, _skipSave: true }); }, []),
  });

  // Real-time presence — show who's online in shared worlds
  const { onlineUsers } = useRealtimePresence({
    worldId: isSharedWorld ? worldId : undefined,
    userId,
    displayName: config.youName || config.travelerName || "Traveler",
    enabled: isSharedWorld,
  });
  const otherOnlineUsers = useMemo(() => onlineUsers.filter(u => u.user_id !== userId), [onlineUsers, userId]);

  // Real-time subscription — comments & reactions for shared worlds
  useEffect(() => {
    if (!isSharedWorld || !worldId) return;
    const channel = supabase
      .channel(`world-${worldId}-social`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entry_comments', filter: `world_id=eq.${worldId}` }, (payload) => {
        const sel = selectedRef.current;
        if (sel?.id) loadComments(worldId, sel.id).then(setEntryComments).catch(err => console.error('[cosmos] load comments failed:', err));
        if (payload.eventType === 'INSERT' && payload.new?.user_id !== userId) {
          setNotifications(prev => [{ id: `n-${Date.now()}`, type: 'comment', message: `New comment on an entry`, timestamp: new Date().toISOString(), entryId: payload.new?.entry_id, read: false }, ...prev].slice(0, 100));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entry_reactions', filter: `world_id=eq.${worldId}` }, (payload) => {
        loadAllWorldReactions(worldId).then(setWorldReactions).catch(err => console.error('[cosmos] load reactions failed:', err));
        if (payload.eventType === 'INSERT' && payload.new?.user_id !== userId) {
          setNotifications(prev => [{ id: `n-${Date.now()}`, type: 'reaction', message: `Someone reacted to an entry`, timestamp: new Date().toISOString(), entryId: payload.new?.entry_id, read: false }, ...prev].slice(0, 100));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isSharedWorld, worldId]);

  // zoom tracked via zmR ref (used in animation loop directly)
  const [ready, setReady] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const onboardKey = isSharedWorld ? `v3_cosmos_onboarded_${worldId}` : isMyWorld ? `v3_cosmos_onboarded_my_${userId}` : `v3_cosmos_onboarded_${userId}`;
  const [showPhotoJourney, setShowPhotoJourney] = useState(false);
  const [pjIndex, setPjIndex] = useState(0);
  const [pjAutoPlay, setPjAutoPlay] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [showLetter, setShowLetter] = useState(null); // letter id to show, or null
  const [editLetter, setEditLetter] = useState(false); // show letter editor
  const [letterDraft, setLetterDraft] = useState("");
  const [letterEditId, setLetterEditId] = useState(null); // null = new letter
  const [letterCity, setLetterCity] = useState("");
  const [letterCitySugg, setLetterCitySugg] = useState([]);
  const [letterLat, setLetterLat] = useState("");
  const [letterLng, setLetterLng] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [worldMembers, setWorldMembers] = useState([]);
  const [sliderDate, setSliderDate] = useState(todayStr());
  const [isAnimating, setIsAnimating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showGallery, setShowGallery] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const uploadLockRef = useRef(Promise.resolve()); // sequential photo upload queue
  const [cardGallery, setCardGallery] = useState(false);
  const [markerFilter, setMarkerFilter] = useState("all"); // "all", "together", "special", "home-seth", "home-rosie", "seth-solo", "rosie-solo"
  const [listRenderLimit, setListRenderLimit] = useState(100);
  const [showFilter, setShowFilter] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [showStats, setShowStats] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [recapYear, setRecapYear] = useState(null);
  const [recapIdx, setRecapIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimerRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchHl, setSearchHl] = useState(-1); // keyboard highlight index in search results
  const [searchDateFrom, setSearchDateFrom] = useState("");
  const [searchDateTo, setSearchDateTo] = useState("");
  const [searchTypeFilter, setSearchTypeFilter] = useState("all");
  const [searchSort, setSearchSort] = useState("date-desc"); // date-desc, date-asc, alpha, country
  const [showLoveThread, setShowLoveThread] = useState(false);
  const [showConstellation, setShowConstellation] = useState(false);
  const [showRoutes, setShowRoutes] = useState(false);
  const [showDreams, setShowDreams] = useState(false);
  const [cardTab, setCardTab] = useState("overview"); // overview, highlights, places, photos
  const [locationList, setLocationList] = useState(null); // for multi-entry popup
  // Comments & Reactions (shared/viewer worlds)
  const [entryComments, setEntryComments] = useState([]);
  const [worldReactions, setWorldReactions] = useState([]);
  const [showZoomHint, setShowZoomHint] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  // Share entry to another world
  const [monthlyPromptShown, setMonthlyPromptShown] = useState(false);
  const [quickAddMode, setQuickAddMode] = useState(false);
  const [polaroidMode, setPolaroidMode] = useState(true);
  const [showPhotoMap, setShowPhotoMap] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  const [showTravelStats, setShowTravelStats] = useState(false);
  const [showExportHub, setShowExportHub] = useState(false);
  const [tripCardEntry, setTripCardEntry] = useState(null);
  const [showYearReview, setShowYearReview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [recentlyDeleted, setRecentlyDeleted] = useState(() => {
    try { const raw = localStorage.getItem(`cosmos_trash_${worldId || worldMode}`); return raw ? JSON.parse(raw).filter(t => Date.now() - t.deletedAt < 30 * 24 * 60 * 60 * 1000) : []; } catch { return []; }
  });
  // Reset On This Day dismissal when deselecting an entry
  useEffect(() => { if (!selected) setDismissOnThisDay(false); }, [selected]);
  const [showTripJournal, setShowTripJournal] = useState(false);
  const [handwrittenMode, setHandwrittenMode] = useState(() => { try { return localStorage.getItem("cosmos_handwritten") === "1"; } catch { return false; } });
  const loveThreadRef = useRef([]);
  const constellationRef = useRef([]);
  const routesRef = useRef([]);
  const pulseRingsRef = useRef([]);
  const atmosphereRef = useRef({ targetHue: null, intensity: 0, particleBoost: 0 });
  const searchMatchIdsRef = useRef(new Set());
  const hoverThrottleRef = useRef(0);
  const longPressRef = useRef(null); // timer for touch long-press tooltip
  const cometRef = useRef(null); // active comet animation
  const prevEntryCountRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  // Theme colors (always light mode)
  const lastTapRef = useRef(0); // for double-tap to zoom
  const playRef = useRef(null);
  const animRef = useRef(null);
  const surpriseTimers = useRef([]);


  // ---- DERIVED ----
  const sorted = useMemo(() => [...data.entries].sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || "")), [data.entries]);
  // Fallback startDate for timeline when config.startDate isn't set (common in shared worlds)
  const effectiveStartDate = useMemo(() => {
    if (config.startDate) return config.startDate;
    if (sorted.length > 0 && sorted[0].dateStart) return sorted[0].dateStart;
    return todayStr();
  }, [config.startDate, sorted]);
  const [listSortMode, setListSortMode] = useState("newest"); // newest, oldest, alpha, country
  const filteredList = useMemo(() => {
    const list = markerFilter === "all" ? data.entries : markerFilter === "favorites" ? data.entries.filter(e => e.favorite) : data.entries.filter(e => e.type === markerFilter);
    if (listSortMode === "oldest") return [...list].sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));
    if (listSortMode === "alpha") return [...list].sort((a, b) => (a.city || "").localeCompare(b.city || ""));
    if (listSortMode === "country") return [...list].sort((a, b) => (a.country || "").localeCompare(b.country || "") || (a.city || "").localeCompare(b.city || ""));
    return [...list].sort((a, b) => (b.dateStart || "").localeCompare(a.dateStart || ""));
  }, [data.entries, markerFilter, listSortMode]);
  // Trip grouping — cluster entries within 3 days of each other
  // Entries listed individually; stops shown inside each entry's detail card

  const togetherList = useMemo(() => sorted.filter(e => e.who === "both"), [sorted]);
  const firstBadges = useMemo(() => isPartnerWorld ? getFirstBadges(data.entries) : {}, [data.entries, isPartnerWorld]);
  const memberNameMap = useMemo(() => Object.fromEntries(worldMembers.map(m => [m.user_id, m.display_name || "Member"])), [worldMembers]);
  const season = useMemo(() => getSeasonalHue(sliderDate, isMyWorld), [sliderDate, isMyWorld]);

  // Auto-hide zoom hint after 4 seconds
  useEffect(() => {
    if (!introComplete || !showZoomHint) return;
    const t = setTimeout(() => setShowZoomHint(false), 6000);
    return () => clearTimeout(t);
  }, [introComplete, showZoomHint]);

  // Stats (must be before anniversary/milestone effects that reference it)
  const stats = useMemo(() => {
    const statList = isPartnerWorld ? togetherList : sorted;
    let daysTog = 0, totalMiles = 0;
    const countries = new Set();
    statList.forEach((e, i) => {
      const end = e.dateEnd || e.dateStart;
      daysTog += Math.max(1, daysBetween(e.dateStart, end));
      if (e.country) countries.add(e.country);
      (e.stops || []).forEach(s => { if (s.country) countries.add(s.country); });
      if (i > 0) {
        const prev = statList[i - 1];
        totalMiles += haversine(prev.lat, prev.lng, e.lat, e.lng);
      }
    });
    return { daysTog, countries: countries.size, trips: statList.length, totalMiles, photos: data.entries.reduce((s, e) => s + (e.photos || []).length, 0) };
  }, [data.entries, togetherList, sorted, isPartnerWorld]);

  // Celebrations: anniversary, milestones, on-this-day
  const {
    showCelebration, celebrationData, setShowCelebration, setCelebrationData,
    onThisDayEntry, setOnThisDayEntry, onThisDay,
    dismissOnThisDay, setDismissOnThisDay, milestoneRef,
  } = useCelebrations({
    introComplete, isPartnerWorld, config, sliderDate,
    worldId, userId, stats, data, TYPES, DEFAULT_TYPE, showToast,
  });

  // Reset On This Day dismissal when deselecting an entry
  useEffect(() => { if (!selected) setDismissOnThisDay(false); }, [selected]);

  // Positions on slider date
  const getPositions = useCallback(date => {
    let seth = null, rosie = null, tog = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const e = sorted[i];
      if (e.dateStart > date) continue;
      if (e.dateEnd && e.dateEnd < date) continue;
      if ((e.who === "seth" || e.who === "both") && !seth) { seth = { lat: e.lat, lng: e.lng, entry: e }; if (e.who === "both") tog = e; }
      if ((e.who === "rosie" || e.who === "both") && !rosie) { rosie = { lat: e.lat, lng: e.lng, entry: e }; if (e.who === "both") tog = e; }
      if (seth && rosie) break;
    }
    return { seth, rosie, together: tog };
  }, [sorted]);

  const pos = useMemo(() => getPositions(sliderDate), [sliderDate, getPositions]);
  const areTogether = !!pos.together;
  const dist = useMemo(() => {
    if (areTogether) return 0;
    if (pos.seth && pos.rosie) return haversine(pos.seth.lat, pos.seth.lng, pos.rosie.lat, pos.rosie.lng);
    return null;
  }, [pos, areTogether]);

  // Next together entry (for countdown)
  const nextTogether = useMemo(() => {
    return togetherList.find(e => e.dateStart > todayStr());
  }, [togetherList]);

  // Together entry count
  const togetherIndex = useCallback(id => {
    const idx = togetherList.findIndex(e => e.id === id);
    return idx >= 0 ? idx + 1 : null;
  }, [togetherList]);

  // ---- FOCUS TRAP (settings modal) ----

  // ---- TOAST SYSTEM (queue/stack with undo support) ----
  const showToast = useCallback((message, icon = "✓", duration = 2500, undoAction = null) => {
    const t = { message, icon, duration, key: Date.now(), undoAction };
    setToasts(prev => [...prev.slice(-4), t]); // keep max 5
  }, []);
  const dismissTimers = useRef([]);
  const dismissToast = useCallback((key) => {
    setToasts(prev => prev.map(t => t.key === key ? { ...t, exiting: true } : t));
    const t = setTimeout(() => setToasts(prev => prev.filter(t => t.key !== key)), 300);
    dismissTimers.current.push(t);
  }, []);
  const handleUndo = useCallback((toast) => {
    if (toast?.undoAction) toast.undoAction();
    dismissToast(toast.key);
  }, [dismissToast]);
  const toastTimerKeys = useRef(new Set());
  useEffect(() => {
    if (toasts.length === 0) return;
    const newTimers = [];
    toasts.forEach(t => {
      if (toastTimerKeys.current.has(t.key)) return;
      toastTimerKeys.current.add(t.key);
      newTimers.push(setTimeout(() => {
        dismissToast(t.key);
        toastTimerKeys.current.delete(t.key);
      }, t.duration || 2500));
    });
    return () => newTimers.forEach(clearTimeout);
  }, [toasts, dismissToast]);

  // ---- SAVE ERROR NOTIFICATION ----
  useEffect(() => {
    const handler = (e) => showToast(`Failed to save ${e.detail?.city || 'entry'} — check your connection`, '⚠️', 8000)
    window.addEventListener('cosmos-save-error', handler)
    return () => window.removeEventListener('cosmos-save-error', handler)
  }, [showToast])

  // ---- OFFLINE AWARENESS ----
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const goOffline = () => { setIsOffline(true); showToast("You're offline — changes won't save", "⚠️", 5000); };
    const goOnline = () => { setIsOffline(false); showToast("Back online", "✅", 2000); };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, [showToast]);



  // ---- CONFIG LOAD ERROR NOTIFICATION ----
  useEffect(() => {
    if (!introComplete || !loadErrorRef.current) return;
    loadErrorRef.current = false;
    showToast("Settings couldn't load — using defaults", "⚠️", 5000);
  }, [introComplete, showToast]);

  // ---- AUTO-FLY TO HOME on first visit ----
  useEffect(() => {
    if (!introComplete || !data.entries.length) return;
    const flyKey = isSharedWorld ? `v2_cosmos_firstfly_${worldId}` : isMyWorld ? `v2_cosmos_firstfly_my_${userId}` : `v2_cosmos_firstfly_${userId}`;
    if (localStorage.getItem(flyKey)) return;
    localStorage.setItem(flyKey, "1");
    // Find a home entry, or fall back to the first entry
    const home = data.entries.find(e => e.type === "home") || data.entries[0];
    if (home) {
      setTimeout(() => flyTo(home.lat, home.lng, 2.8), 800);
    }
  }, [introComplete, data.entries, flyTo, isSharedWorld, isMyWorld, worldId, userId]);

  // ---- GUIDED FIRST VISIT TOASTS ----
  useEffect(() => {
    if (!introComplete || showOnboarding || data.entries.length === 0) return;
    const guidedKey = isSharedWorld ? `v2_cosmos_guided_${worldId}` : isMyWorld ? `v2_cosmos_guided_my_${userId}` : `v2_cosmos_guided_${userId}`;
    if (localStorage.getItem(guidedKey)) return;
    const msgs = isMyWorld
      ? [["This is everywhere you've been", "🌍"], ["Click any marker to explore a memory", "📍"], ["Press ▶ to watch your story unfold", "▶"]]
      : isPartnerWorld
      ? [["This is everywhere you've been together", "💕"], ["Click any heart to explore a memory", "💜"], ["Press ▶ to watch your story unfold", "▶"]]
      : worldType === "friends"
      ? [["This is everywhere you've adventured together", "🌍"], ["Click any marker to explore", "📍"], ["Press ▶ to watch your story unfold", "▶"]]
      : worldType === "family"
      ? [["This is everywhere your family has been", "🌍"], ["Click any marker to explore", "📍"], ["Press ▶ to watch your story unfold", "▶"]]
      : [["This is everywhere you've been together", "🌍"], ["Click any marker to explore", "📍"], ["Press ▶ to watch your story unfold", "▶"]];
    const timers = msgs.map((m, i) => setTimeout(() => showToast(m[0], m[1], 3000), 2000 + i * 3500));
    localStorage.setItem(guidedKey, "1");
    return () => timers.forEach(clearTimeout);
  }, [introComplete, showOnboarding, data.entries.length, isMyWorld, isPartnerWorld, isSharedWorld, worldType, worldId, userId, showToast]);

  // ---- MILESTONES on timeline ----
  const milestones = useMemo(() => {
    if (!effectiveStartDate) return [];
    const ms = [
      { days: 100, label: "100 Days" }, { days: 182, label: "6 Months" },
      { days: 365, label: "1 Year" }, { days: 500, label: "500 Days" },
      { days: 730, label: "2 Years" }, { days: 1000, label: "1000 Days" },
      { days: 1095, label: "3 Years" }, { days: 1461, label: "4 Years" },
      { days: 1826, label: "5 Years" }, { days: 2557, label: "7 Years" },
      { days: 3652, label: "10 Years" },
    ];
    const total = daysBetween(effectiveStartDate, todayStr());
    return ms.filter(m => m.days <= total).map(m => ({
      ...m, date: addDays(effectiveStartDate, m.days), pct: (m.days / Math.max(1, total)) * 100
    }));
  }, [effectiveStartDate]);

  // ---- EXPANDED STATS for dashboard ----
  const expandedStats = useMemo(() => {
    const tripList = isPartnerWorld ? togetherList : sorted;
    const longestTrip = tripList.reduce((best, e) => {
      const d = e.dateEnd ? daysBetween(e.dateStart, e.dateEnd) : 1;
      return d > best.days ? { days: d, entry: e } : best;
    }, { days: 0, entry: null });

    const farthestApart = { dist: 0, seth: null, rosie: null };
    const sethEntries = sorted.filter(e => (e.who === "seth" || e.who === "both") && e.lat != null);
    const rosieEntries = sorted.filter(e => (e.who === "rosie" || e.who === "both") && e.lat != null);
    // For large datasets, sample to avoid O(n²) — pick extremes by lat/lng + random sample
    const sampleSet = (arr, maxSize) => {
      if (arr.length <= maxSize) return arr;
      const picked = new Set();
      // Always include extremes (most likely to be farthest)
      const byLat = [...arr].sort((a, b) => a.lat - b.lat);
      const byLng = [...arr].sort((a, b) => a.lng - b.lng);
      [byLat[0], byLat[byLat.length - 1], byLng[0], byLng[byLng.length - 1]].forEach(e => picked.add(e));
      // Fill remainder with random samples
      while (picked.size < maxSize) picked.add(arr[Math.floor(Math.random() * arr.length)]);
      return [...picked];
    };
    const sS = sampleSet(sethEntries, 50);
    const rS = sampleSet(rosieEntries, 50);
    for (const s of sS) {
      for (const r of rS) {
        if (s.who === "both" && r.who === "both" && s.id === r.id) continue;
        const d = haversine(s.lat, s.lng, r.lat, r.lng);
        if (d > farthestApart.dist) { farthestApart.dist = d; farthestApart.seth = s; farthestApart.rosie = r; }
      }
    }

    const cityVisits = {};
    tripList.forEach(e => { cityVisits[e.city] = (cityVisits[e.city] || 0) + 1; });
    const topCity = Object.entries(cityVisits).sort((a, b) => b[1] - a[1])[0];

    const countryList = new Set();
    const citySet = new Set();
    data.entries.forEach(e => { if (e.country) countryList.add(e.country); if (e.city) citySet.add(e.city); (e.stops || []).forEach(s => { if (s.country) countryList.add(s.country); if (s.city) citySet.add(s.city); }); });

    let longestApart = 0;
    if (isPartnerWorld) {
      for (let i = 1; i < togetherList.length; i++) {
        const gap = daysBetween(togetherList[i - 1].dateEnd || togetherList[i - 1].dateStart, togetherList[i].dateStart);
        if (gap > longestApart) longestApart = gap;
      }
    }

    const avgTripLength = tripList.length > 0
      ? Math.round(tripList.reduce((s, e) => s + Math.max(1, e.dateEnd ? daysBetween(e.dateStart, e.dateEnd) : 1), 0) / tripList.length)
      : 0;

    // Available years for recap
    const years = [...new Set(data.entries.map(e => parseInt(e.dateStart?.slice(0, 4))).filter(Boolean))].sort();

    return { longestTrip, farthestApart, topCity, countryList: [...countryList], cityCount: citySet.size, longestApart, avgTripLength, years };
  }, [data.entries, togetherList, sorted, isPartnerWorld]);

  // ---- SEARCH (with date range, type filter, sort) ----
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  const hasSearchFilters = debouncedSearch.length >= 2 || searchDateFrom || searchDateTo || searchTypeFilter !== "all";
  const searchResults = useMemo(() => {
    if (!hasSearchFilters) return [];
    let results = data.entries;
    // Text filter
    if (debouncedSearch.length >= 2) {
      const q = debouncedSearch.toLowerCase();
      results = results.filter(e =>
        (e.city || "").toLowerCase().includes(q) ||
        (e.country || "").toLowerCase().includes(q) ||
        (e.notes || "").toLowerCase().includes(q) ||
        (e.highlights || []).some(h => h.toLowerCase().includes(q)) ||
        (e.restaurants || []).some(r => r.toLowerCase().includes(q)) ||
        (e.museums || []).some(m => m.toLowerCase().includes(q)) ||
        (e.stops || []).some(s => (s.city || "").toLowerCase().includes(q))
      );
    }
    // Date range filter
    if (searchDateFrom) results = results.filter(e => (e.dateEnd || e.dateStart) >= searchDateFrom);
    if (searchDateTo) results = results.filter(e => e.dateStart <= searchDateTo);
    // Type filter
    if (searchTypeFilter !== "all") results = results.filter(e => e.type === searchTypeFilter);
    // Sort
    if (searchSort === "date-asc") results = [...results].sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));
    else if (searchSort === "alpha") results = [...results].sort((a, b) => (a.city || "").localeCompare(b.city || ""));
    else if (searchSort === "country") results = [...results].sort((a, b) => (a.country || "").localeCompare(b.country || "") || (a.city || "").localeCompare(b.city || ""));
    else results = [...results].sort((a, b) => (b.dateStart || "").localeCompare(a.dateStart || ""));
    return results;
  }, [debouncedSearch, searchDateFrom, searchDateTo, searchTypeFilter, searchSort, data.entries, hasSearchFilters]);

  // Sync search matches to ref for animation loop access
  useEffect(() => {
    searchMatchIdsRef.current = new Set(searchResults.map(e => e.id));
  }, [searchResults]);

  // ---- FAVORITES ----

  const favorites = useMemo(() => data.entries.filter(e => e.favorite), [data.entries]);

  // ---- REUNION COUNTER & DISTANCE SCOREBOARD ----
  const reunionStats = useMemo(() => {
    let reunions = 0, daysApart = 0, daysTogether = 0;
    let lastState = null; // "together" | "apart"
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      const isTog = e.who === "both";
      if (isTog && lastState === "apart") reunions++;
      if (isTog) {
        const d = e.dateEnd ? daysBetween(e.dateStart, e.dateEnd) : 1;
        daysTogether += Math.max(1, d);
        lastState = "together";
      } else {
        if (i > 0) {
          const prev = sorted[i - 1];
          const gap = daysBetween(prev.dateEnd || prev.dateStart, e.dateStart);
          if (gap > 0 && lastState === "together") daysApart += gap;
        }
        lastState = "apart";
      }
    }
    const togetherWinning = daysTogether >= daysApart;
    return { reunions, daysApart, daysTogether, togetherWinning };
  }, [sorted]);

  // ---- LOVE THREAD DATA (arcs connecting together entries) ----
  const loveThreadData = useMemo(() => {
    if (!showLoveThread) return [];
    return togetherList.slice(1).map((e, i) => {
      const prev = togetherList[i];
      return { from: { lat: prev.lat, lng: prev.lng }, to: { lat: e.lat, lng: e.lng } };
    });
  }, [togetherList, showLoveThread]);

  // ---- CONSTELLATION DATA (optimized MST) ----
  const constellationData = useMemo(() => {
    if (!showConstellation) return [];
    const all = data.entries;
    if (all.length < 2) return [];
    // Cap at 80 entries for performance (MST is O(n²) with Prim's)
    const subset = all.length > 80 ? all.slice(0, 80) : all;
    const n = subset.length;
    const lines = [];
    const inMST = new Uint8Array(n); // 0/1 flags
    const minDist = new Float32Array(n).fill(Infinity);
    const minFrom = new Int32Array(n).fill(-1);
    inMST[0] = 1;
    // Init distances from node 0
    for (let i = 1; i < n; i++) {
      minDist[i] = haversine(subset[0].lat, subset[0].lng, subset[i].lat, subset[i].lng);
      minFrom[i] = 0;
    }
    for (let step = 1; step < n; step++) {
      // Find closest non-MST node
      let bestIdx = -1, bestD = Infinity;
      for (let i = 0; i < n; i++) {
        if (!inMST[i] && minDist[i] < bestD) { bestD = minDist[i]; bestIdx = i; }
      }
      if (bestIdx < 0) break;
      inMST[bestIdx] = 1;
      lines.push({ from: subset[minFrom[bestIdx]], to: subset[bestIdx] });
      // Update distances
      for (let i = 0; i < n; i++) {
        if (inMST[i]) continue;
        const d = haversine(subset[bestIdx].lat, subset[bestIdx].lng, subset[i].lat, subset[i].lng);
        if (d < minDist[i]) { minDist[i] = d; minFrom[i] = bestIdx; }
      }
    }
    return lines;
  }, [data.entries, showConstellation]);

  // ---- TRAVEL ROUTES — chronological dotted paths between entries ----
  const routeData = useMemo(() => {
    if (!showRoutes && !isPlaying) return [];
    const s = sorted.filter(e => e.dateStart && e.dateStart <= sliderDate);
    if (s.length < 2) return [];
    const pairs = [];
    for (let i = 1; i < s.length; i++) {
      if (s[i].lat === s[i - 1].lat && s[i].lng === s[i - 1].lng) continue;
      pairs.push({ from: s[i - 1], to: s[i] });
    }
    return pairs;
  }, [sorted, showRoutes, isPlaying, sliderDate]);

  // ---- MONTHLY CHECK-IN PROMPT ----
  useEffect(() => {
    if (!introComplete || monthlyPromptShown || data.entries.length === 0) return;
    const lastEntry = sorted[sorted.length - 1];
    if (!lastEntry) return;
    const daysSince = daysBetween(lastEntry.dateEnd || lastEntry.dateStart, todayStr());
    if (daysSince >= 30) {
      const t = setTimeout(() => {
        showToast(`It's been ${daysSince} days — any new highlights to add?`, "✨", 6000);
        setMonthlyPromptShown(true);
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [introComplete, sorted, monthlyPromptShown, data.entries.length, showToast]);

  // ---- TIMELINE NAV ----
  const stepDayTimer = useRef(null);
  const stepDay = useCallback(dir => {
    if (isAnimating) return;
    const next = addDays(sliderDate, dir);
    if (next < effectiveStartDate || next > todayStr()) return;
    setSliderDate(next);
    tSpinSpd.current = 0.018;
    clearTimeout(stepDayTimer.current);
    stepDayTimer.current = setTimeout(() => { tSpinSpd.current = 0.001; }, 350);
  }, [sliderDate, effectiveStartDate, isAnimating]);

  const jumpNext = useCallback(dir => {
    if (isAnimating) return;
    const jumpList = isPartnerWorld ? togetherList : sorted;
    const cands = dir > 0 ? jumpList.filter(e => e.dateStart > sliderDate) : [...jumpList].reverse().filter(e => e.dateStart < sliderDate);
    if (cands.length === 0) return;
    const target = cands[0];
    setIsAnimating(true);
    const totalD = Math.abs(daysBetween(sliderDate, target.dateStart));
    const duration = Math.min(2500, Math.max(1200, totalD * 2));
    const startD = sliderDate;
    let startTime = null;

    const anim = (now) => {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setSliderDate(addDays(startD, Math.round(eased * totalD * dir)));
      const spinCurve = t < 0.5 ? t * 2 : (1 - t) * 2;
      tSpinSpd.current = 0.001 + spinCurve * 0.12;
      if (t < 1) { animRef.current = requestAnimationFrame(anim); }
      else {
        setSliderDate(target.dateStart);
        tSpinSpd.current = 0.001;
        setIsAnimating(false);
        flyTo(target.lat, target.lng, 2.5);
        setTimeout(() => { setSelected(target); setPhotoIdx(0); setCardTab("overview"); }, 500);
      }
    };
    animRef.current = requestAnimationFrame(anim);
  }, [sliderDate, togetherList, sorted, isPartnerWorld, isAnimating, flyTo]);

  // ---- PLAY OUR STORY ----
  // Cinema state for Play Story overlay
  const [cinemaEntry, setCinemaEntry] = useState(null); // currently showing entry
  const [cinemaPhotoIdx, setCinemaPhotoIdx] = useState(0); // cycle through photos
  const [cinemaProgress, setCinemaProgress] = useState(0); // 0-1 progress
  const [cinemaTotal, setCinemaTotal] = useState(0);
  const [cinemaIdx, setCinemaIdx] = useState(0);
  const [cinemaPhase, setCinemaPhase] = useState('fly'); // 'fly' | 'show' | 'transition'

  const photoTimerRef = useRef(null);

  const stopPlay = useCallback(() => {
    setIsPlaying(false);
    setCinemaEntry(null);
    setCinemaPhase('fly');
    if (playRef.current) { clearTimeout(playRef.current); playRef.current = null; }
    if (photoTimerRef.current) { clearInterval(photoTimerRef.current); photoTimerRef.current = null; }
    tSpinSpd.current = 0.001;
  }, []);

  const playStory = useCallback(() => {
    const playList = isPartnerWorld ? togetherList : sorted;
    if (playList.length === 0 || isPlaying) return;
    setIsPlaying(true);
    setSelected(null);
    setShowGallery(false);
    setCinemaTotal(playList.length);
    let idx = 0;

    const clearPlay = () => { if (playRef.current) { clearTimeout(playRef.current); playRef.current = null; } };
    const clearPhotoTimer = () => { if (photoTimerRef.current) { clearInterval(photoTimerRef.current); photoTimerRef.current = null; } };

    const step = () => {
      if (idx >= playList.length) { stopPlay(); showToast("Story complete", "✨", 3000); return; }
      const entry = playList[idx];
      setCinemaIdx(idx);
      setCinemaProgress(idx / playList.length);
      setCinemaPhase('fly');
      setCinemaEntry(entry);
      setCinemaPhotoIdx(0);
      setSliderDate(entry.dateStart);
      flyTo(entry.lat, entry.lng, 2.4);

      // After fly-to settles, show the full cinema card
      clearPlay();
      playRef.current = setTimeout(() => {
        setCinemaPhase('show');
        setSelected(entry);
        setPhotoIdx(0);
        setCardTab("overview");

        // Cycle through photos during display
        const photos = entry.photos || [];
        if (photos.length > 1) {
          let pIdx = 0;
          clearPhotoTimer();
          photoTimerRef.current = setInterval(() => {
            pIdx = (pIdx + 1) % photos.length;
            setCinemaPhotoIdx(pIdx);
          }, 2000);
          clearPlay();
          playRef.current = setTimeout(() => {
            clearPhotoTimer();
            setCinemaPhase('transition');
            setSelected(null);
            idx++;
            if (idx < playList.length) {
              tSpinSpd.current = 0.015;
              tZm.current = 3.0;
              clearPlay();
              playRef.current = setTimeout(step, 1000);
            } else {
              setCinemaProgress(1);
              clearPlay();
              playRef.current = setTimeout(() => { stopPlay(); showToast("Story complete", "✨", 3000); }, 800);
            }
          }, Math.min(5000, 2000 + photos.length * 1200));
        } else {
          clearPlay();
          playRef.current = setTimeout(() => {
            setCinemaPhase('transition');
            setSelected(null);
            idx++;
            if (idx < playList.length) {
              tSpinSpd.current = 0.015;
              tZm.current = 3.0;
              clearPlay();
              playRef.current = setTimeout(step, 1000);
            } else {
              setCinemaProgress(1);
              clearPlay();
              playRef.current = setTimeout(() => { stopPlay(); showToast("Story complete", "✨", 3000); }, 800);
            }
          }, 4000);
        }
      }, 1600);
    };
    step();
  }, [togetherList, sorted, isPartnerWorld, isPlaying, stopPlay, showToast]);

  // Keyboard shortcuts (must be after stopPlay/playStory declarations)
  useEffect(() => {
    const handler = e => {
      const inInput = e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT";
      if (inInput && e.key !== "Escape") return;
      if (e.key === "ArrowLeft") { e.preventDefault(); stepDay(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); stepDay(1); }
      if (e.key === "Escape") { flushConfigSave(); setSelected(null); setEditing(null); setShowAdd(false); setQuickAddMode(false); setShowLetter(null); setShowSettings(false); setShowGallery(false); setCardGallery(false); setShowFilter(false); setMarkerFilter("all"); setLocationList(null); setShowStats(false); setShowRecap(false); setShowSearch(false); setSearchQuery(""); setSearchHl(-1); setSearchDateFrom(""); setSearchDateTo(""); setSearchTypeFilter("all"); setSearchSort("date-desc"); setShowDreams(false); setConfirmDelete(null); setLightboxOpen(false); setShowShortcuts(false); setShowPhotoJourney(false); setShowCelebration(false); setShowOnboarding(false); setConfirmModal(null); setShowConstellation(false); setShowRoutes(false); setShowMilestones(false); setShowTravelStats(false); setShowLoveThread(false); setShowExportHub(false); setShowYearReview(false); setShowPhotoMap(false); setEditLetter(false); setTripCardEntry(null); setShowTemplates(false); setShowTrash(false); setShowTripJournal(false); setShowLinkPicker(false); setPhotoDeleteMode(false); setShareMenu(null); localStorage.setItem(onboardKey, "1"); tSpinSpd.current = 0.002; if (isPlaying) stopPlay(); }
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey && !showAdd && !editing) { e.preventDefault(); dispatch({ type: "UNDO" }); showToast("Undone", "↩", 1500); }
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && e.shiftKey && !showAdd && !editing) { e.preventDefault(); dispatch({ type: "REDO" }); showToast("Redone", "↪", 1500); }
      if (e.key === "?" && !showAdd && !editing && !showSettings) setShowShortcuts(v => !v);
      if (e.key === "f" && !showAdd && !editing && !showSettings) { setShowFilter(v => { if (v) { setMarkerFilter("all"); setLocationList(null); } return !v; }); }
      if (e.key === "i" && !showAdd && !editing && !showSettings) setShowStats(v => !v);
      if (e.key === "s" && !showAdd && !editing && !showSettings && !showSearch) { e.preventDefault(); setShowSearch(true); }
      if (e.key === "g" && !showAdd && !editing && !showSettings) setShowGallery(v => !v);
      if (e.key === "t" && !showAdd && !editing && !showSettings) setSliderDate(todayStr());
      if (e.key === "p" && !showAdd && !editing && !showSettings && !showSearch) saveGlobeScreenshot();
      if (e.key === "r" && !showAdd && !editing && !showSettings && !showSearch) {
        const pool = data.entries.filter(en => en.lat != null && en.lng != null);
        if (pool.length > 1) {
          const pick = pool[Math.floor(Math.random() * pool.length)];
          tZm.current = 4.5;
          const t1 = setTimeout(() => { flyTo(pick.lat, pick.lng, 2.2); const t2 = setTimeout(() => { setSelected(pick); setPhotoIdx(0); setCardTab("overview"); }, 600); surpriseTimers.current.push(t2); }, 400);
          surpriseTimers.current.push(t1);
        }
      }
      if (e.key === " " && !showAdd && !editing && !showSettings && !showSearch) { e.preventDefault(); if (isPlaying) stopPlay(); else if ((isPartnerWorld ? togetherList : sorted).length > 0) playStory(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stepDay, isPlaying, showAdd, editing, showSettings, showSearch, stopPlay, playStory, togetherList, sorted, isPartnerWorld, showToast]);

  // ---- YEAR-IN-REVIEW RECAP ----
  const [recapAutoPlay, setRecapAutoPlay] = useState(false);
  const [recapPhase, setRecapPhase] = useState('title'); // 'title' | 'stats' | 'journey' | 'summary'
  const [recapStatIdx, setRecapStatIdx] = useState(0); // animated stat reveal counter

  const startRecap = useCallback((year) => {
    const yearEntries = sorted.filter(e => e.dateStart?.startsWith(String(year)));
    if (yearEntries.length === 0) return;
    setShowRecap(true);
    setRecapYear(year);
    setRecapIdx(-1);
    setRecapPhase('title');
    setRecapStatIdx(0);
    setRecapAutoPlay(false);
    setShowStats(false);
    setSelected(null);
  }, [sorted]);

  const recapEntries = useMemo(() => {
    if (!recapYear) return [];
    return sorted.filter(e => e.dateStart?.startsWith(String(recapYear)));
  }, [recapYear, sorted]);

  const recapYearStats = useMemo(() => {
    if (!recapEntries.length) return null;
    const countries = new Set();
    const cities = new Set();
    const months = new Set();
    const cityVisits = {};
    let totalDays = 0, photos = 0, totalMiles = 0, favorites = 0;
    let longestTrip = { days: 0, entry: null };
    const allPhotos = [];
    recapEntries.forEach((e, i) => {
      if (e.country) countries.add(e.country);
      if (e.city) { cities.add(e.city); cityVisits[e.city] = (cityVisits[e.city] || 0) + 1; }
      (e.stops || []).forEach(s => { if (s.country) countries.add(s.country); if (s.city) cities.add(s.city); });
      if (e.dateStart) months.add(e.dateStart.slice(5, 7));
      const d = Math.max(1, daysBetween(e.dateStart, e.dateEnd || e.dateStart));
      totalDays += d;
      if (d > longestTrip.days) longestTrip = { days: d, entry: e };
      const pLen = (e.photos || []).length;
      photos += pLen;
      if (pLen > 0) (e.photos || []).forEach(url => allPhotos.push({ url, city: e.city }));
      if (e.favorite) favorites++;
      if (i > 0) totalMiles += haversine(recapEntries[i - 1].lat, recapEntries[i - 1].lng, e.lat, e.lng);
    });
    const topCity = Object.entries(cityVisits).sort((a, b) => b[1] - a[1])[0];
    const firstTrip = recapEntries[0]; // sorted oldest-first
    const lastTrip = recapEntries[recapEntries.length - 1];
    return {
      countries: countries.size, countryNames: [...countries],
      cities: cities.size, entries: recapEntries.length, totalDays, photos, totalMiles,
      months: months.size, favorites,
      longestTrip, topCity: topCity ? { name: topCity[0], count: topCity[1] } : null,
      firstTrip, lastTrip, allPhotos: allPhotos.slice(0, 20),
    };
  }, [recapEntries]);

  // Animated stat reveal for recap stats phase
  useEffect(() => {
    if (!showRecap || recapPhase !== 'stats' || recapStatIdx >= 5) return;
    const t = setTimeout(() => setRecapStatIdx(i => i + 1), 300);
    return () => clearTimeout(t);
  }, [showRecap, recapPhase, recapStatIdx]);

  // Auto-play timer for recap journey phase
  useEffect(() => {
    if (!recapAutoPlay || !showRecap || recapPhase !== 'journey') return;
    const t = setTimeout(() => {
      if (recapIdx >= recapEntries.length - 1) { setRecapPhase('summary'); setRecapAutoPlay(false); }
      else { const next = recapIdx + 1; setRecapIdx(next); const e = recapEntries[next]; if (e) { setSliderDate(e.dateStart); flyTo(e.lat, e.lng, 2.4); } }
    }, 4500);
    return () => clearTimeout(t);
  }, [recapAutoPlay, showRecap, recapPhase, recapIdx, recapEntries, flyTo]);

  // ---- GALLERY DATA ----
  const allPhotos = useMemo(() => {
    const out = [];
    sorted.forEach(e => (e.photos || []).forEach(url => out.push({ url, id: e.id, city: e.city, country: e.country, date: e.dateStart })));
    return out;
  }, [sorted]);

  const allPhotoCaptions = useMemo(() => {
    const map = {};
    for (const e of data.entries) {
      if (e.photoCaptions) Object.assign(map, e.photoCaptions);
    }
    return map;
  }, [data.entries]);

  // ---- PHOTO JOURNEY AUTO-PLAY ----
  useEffect(() => {
    if (!pjAutoPlay || !showPhotoJourney) return;
    const t = setTimeout(() => {
      if (pjIndex >= allPhotos.length - 1) { setShowPhotoJourney(false); setPjAutoPlay(false); showToast("Photo journey complete", "🎞", 3000); }
      else setPjIndex(i => i + 1);
    }, 3500);
    return () => clearTimeout(t);
  }, [pjAutoPlay, showPhotoJourney, pjIndex, allPhotos.length]);

  // ---- EXPORT / IMPORT ----
  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify({ data, config }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "our-world-backup.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Backup exported", "📥", 2000);
  }, [data, config, showToast]);

  const importData = useCallback(() => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json";
    input.onchange = ev => {
      const file = ev.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = re => {
        try {
          const parsed = JSON.parse(re.target.result);
          if (parsed.data?.entries) {
            dispatch({ type: "LOAD", entries: parsed.data.entries });
            // Save entries to Supabase in batches of 10
            const entries = parsed.data.entries;
            (async () => {
              for (let i = 0; i < entries.length; i += 10) {
                const batch = await Promise.allSettled(entries.slice(i, i + 10).map(e => db.saveEntry(e))); batch.forEach((r, bi) => { if (r.status === "rejected") console.error("[import] save failed:", r.reason) });
              }
              showToast(`Imported ${entries.length} entries`, "📥", 3000);
            })().catch(err => console.error("Import save failed:", err));
          }
          if (parsed.config) { setConfig({ ...DEFAULT_CONFIG, ...parsed.config }); }
        } catch (err) { console.error("Import failed:", err); }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setConfig, db, dispatch]);

  // Photo slideshow

  // ---- THREE SETUP (via custom hook) ----
  const {
    sceneReady, rendRef, scnRef, camRef, globeRef, heartRef,
    starsRef, particlesRef, particles2Ref, auroraRef, nightShadowRef,
    glowLayersRef, shootingStarsRef, pulseRingPoolRef, burstParticlePoolRef,
  } = useGlobeScene(mountRef, {
    loading,
    SC,
    P,
    isPartnerWorld,
    isSharedWorld,
    selectedRef,
    searchMatchIdsRef,
    mkRef,
    routesRef,
    mouseRef,
    atmosphereRef,
    cometRef,
    easterEggRef,
    dragR,
    rot,
    tRot,
    zmR,
    tZm,
    spinSpd,
    tSpinSpd,
    frameRef,
    animRef,
    playRef,
    photoTimerRef,
    stepDayTimer,
    surpriseTimers,
    dismissTimers,
    pulseRingsRef,
    rtRef,
    loveThreadRef,
    constellationRef,
    tripRouteRef,
    tripStopMkRef,
    milestoneRef,
    setReady,
    setIntroComplete,
  });

  // Seasonal tinting
  useEffect(() => {
    if (!glowLayersRef.current.length) return;
    const s = season;
    glowLayersRef.current.forEach((mesh, i) => {
      mesh.material.color.set(i < 2 ? s.glow : P.cream);
    });
    if (particlesRef.current) particlesRef.current.material.color.set(isPartnerWorld && isAnniversary ? P.heart : s.particle);
    if (isPartnerWorld && isAnniversary && particlesRef.current) particlesRef.current.material.opacity = 0.35;
    else if (particlesRef.current) particlesRef.current.material.opacity = 0.18;
  }, [season, isAnniversary]);

  // ---- MARKERS & OVERLAYS — extracted to useGlobeMarkers ----
  const { locationGroups } = useGlobeMarkers({
    globeRef, mkRef, rtRef, heartRef, loveThreadRef, constellationRef, routesRef,
    data, sceneReady, sliderDate, getPositions, areTogether,
    isPartnerWorld, isMyWorld, showLoveThread, loveThreadData,
    showConstellation, constellationData, showRoutes, isPlaying, routeData,
    config, selected, TYPES, P,
  });


  // ---- POINTER / TOUCH / ZOOM — extracted to useGlobeInteraction ----
  const { flyTo, hoverLabel, setHoverLabel, saveGlobeScreenshot, onDown, onMove, onUp } = useGlobeInteraction({
    camRef, mkRef, rendRef, scnRef, mountRef,
    dragR, prevR, rot, tRot, tZm,
    spinSpd, tSpinSpd,
    clickSR, tDistR,
    longPressRef, lastTapRef, hoverThrottleRef, mouseRef,
    rayRef, mRef,
    sceneReady,
    dataEntries: data.entries, locationGroups, config,
    setSelected, setPhotoIdx, setCardTab, setLocationList,
    setSliderDate, setShowLetter, setShowZoomHint,
    showToast, isMyWorld, isPartnerWorld, worldType,
    thumbnail,
  });

  const fileInputRef = useRef(null);
  const photoEntryIdRef = useRef(null);
  const dbRef = useRef(db);
  const dispatchRef = useRef(dispatch);
  dbRef.current = db;
  dispatchRef.current = dispatch;

  // Safari-safe photo upload — input must be in DOM
  useEffect(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.style.display = "none";
    document.body.appendChild(input);
    fileInputRef.current = input;

    const handler = () => {
      const files = Array.from(input.files);
      const id = photoEntryIdRef.current;
      if (files.length === 0 || !id) return;
      // Queue upload behind any in-progress upload to prevent read/merge/write race
      uploadLockRef.current = uploadLockRef.current.then(async () => {
        const curDb = dbRef.current;
        const curDispatch = dispatchRef.current;
        setUploading(true);
        setUploadProgress({ done: 0, total: files.length });

        // Step 1: Upload files to Supabase storage
        const urls = [];
        for (let i = 0; i < files.length; i++) {
          try {
            const compressed = await compressImage(files[i]);
            const url = await curDb.uploadPhoto(compressed, id);
            if (url && typeof url === 'string') urls.push(url);
          } catch (err) { /* skip failed uploads */ }
          setUploadProgress({ done: i + 1, total: files.length });
        }
        if (urls.length === 0) { setUploading(false); input.value = ""; return; }

        // Step 2: Read current photos from DB (sequenced — no concurrent reads)
        const current = await curDb.readPhotos(id);
        const existing = current.ok ? current.photos : [];

        // Step 3: Merge and save directly to DB
        const merged = [...existing, ...urls];
        const saveResult = await curDb.savePhotos(id, merged);

        // Step 4: Update local state
        curDispatch({ type: "ADD_PHOTOS", id, urls });

        // Step 5: Show result
        if (saveResult.ok) {
          showToast(`${urls.length} photo${urls.length > 1 ? "s" : ""} saved (${merged.length} total)`, "✅", 3000);
        } else {
          showToast(`Photo save failed: ${saveResult.error}`, "⚠️", 8000);
        }

        setUploading(false);
        input.value = "";
      }).catch(err => { console.error('[photoUpload] queue error:', err); setUploading(false); });
    };

    input.addEventListener("change", handler);
    return () => {
      input.removeEventListener("change", handler);
      document.body.removeChild(input);
    };
  }, []);

  const handlePhotos = useCallback((id) => {
    if (!navigator.onLine) { showToast("Photos can't be uploaded while offline", "📵", 3000); return; }
    photoEntryIdRef.current = id;
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // reset
      fileInputRef.current.click();
    }
  }, [showToast]);

  const cur = selected ? data.entries.find(e => e.id === selected.id) : null;
  const allStickersMap = useMemo(() => {
    const map = {};
    const sorted = [...data.entries].sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));
    const firstByCountry = {};
    for (const e of sorted) {
      if (e.country && !firstByCountry[e.country]) firstByCountry[e.country] = e.id;
    }
    const firstId = sorted.length > 0 ? sorted[0].id : null;
    for (const entry of data.entries) {
      const stickers = [];
      if (entry.id === firstId) stickers.push({ emoji: "⭐", label: "First Entry" });
      if (entry.country && firstByCountry[entry.country] === entry.id) stickers.push({ emoji: "🏳️", label: "New Country" });
      if (entry.favorite) stickers.push({ emoji: "💛", label: "Favorite" });
      if ((entry.photos || []).length >= 5) stickers.push({ emoji: "📸", label: "Photo Album" });
      if (entry.dateStart && entry.dateEnd) {
        const days = Math.round((new Date(entry.dateEnd) - new Date(entry.dateStart)) / 86400000) + 1;
        if (days >= 14) stickers.push({ emoji: "🗺️", label: "Epic Journey" });
        else if (days >= 7) stickers.push({ emoji: "🧳", label: "Long Trip" });
      }
      if (worldType === "partner" && entry.type === "special") stickers.push({ emoji: "💝", label: "Special Moment" });
      if ((entry.stops || []).length >= 3) stickers.push({ emoji: "🛤️", label: "Road Trip" });
      if (entry.musicUrl) stickers.push({ emoji: "🎵", label: "Has Soundtrack" });
      if ((entry.notes || "").length >= 100) stickers.push({ emoji: "📝", label: "Journal Entry" });
      if (stickers.length > 0) map[entry.id] = stickers;
    }
    return map;
  }, [data.entries, worldType]);
  const entryStickers = cur ? (allStickersMap[cur.id] || []) : [];
  const totalDays = Math.max(1, daysBetween(effectiveStartDate, todayStr()));
  const sliderVal = daysBetween(effectiveStartDate, sliderDate);

  if (loading) return <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: SC.bg, fontFamily: "Georgia,serif", color: P.textFaint }}>
    <div style={{ fontSize: 48, animation: "heartPulse 2s ease infinite", marginBottom: 16 }}>🌍</div>
    <div style={{ fontSize: 14, letterSpacing: ".2em", opacity: 0.7 }}>Loading your world<span style={{ animation: "ellipsis 1.5s infinite" }}>...</span></div>
    <div style={{ fontSize: 10, opacity: 0.6, marginTop: 12, letterSpacing: ".15em" }}>v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '9.0'}</div>
    <style>{`@keyframes ellipsis{0%{opacity:0}50%{opacity:1}100%{opacity:0}} @keyframes fadeInLabel{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>
  </div>;

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative", overflow: "hidden", background: `linear-gradient(155deg,${P.cream} 0%,${P.blush} 40%,${P.lavMist} 100%)`, fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", color: P.text, userSelect: "none", transition: "background .6s ease, color .4s ease" }}>

      <div ref={mountRef} style={{ width: "100%", height: "100%", touchAction: "none" }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} />

      {/* Hover label — floating city name + photo peek near cursor */}
      {hoverLabel && !selected && (
        <div style={{
          position: "fixed",
          left: Math.min(hoverLabel.x + 14, window.innerWidth - 200),
          top: Math.max(8, hoverLabel.y - (hoverLabel.photo ? 80 : 28)),
          pointerEvents: "none", zIndex: 20,
          background: `${P.text}cc`, backdropFilter: "blur(12px)",
          borderRadius: hoverLabel.photo ? 10 : 8,
          padding: hoverLabel.photo ? "4px 4px 6px" : "5px 10px",
          boxShadow: `0 4px 20px ${P.text}40`,
          animation: "fadeInLabel 0.2s ease",
          maxWidth: 180,
        }}>
          {hoverLabel.photo && (
            <div style={{
              width: 160, height: 90, borderRadius: 7, overflow: "hidden", marginBottom: 4,
              background: `${P.text}40`,
            }}>
              <img src={thumbnail(hoverLabel.photo, 200)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          )}
          <div style={{ padding: hoverLabel.photo ? "0 4px" : 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: P.cream, letterSpacing: ".04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hoverLabel.city}</div>
            {hoverLabel.date && <div style={{ fontSize: 10, color: `${P.cream}aa`, marginTop: 1, whiteSpace: "nowrap" }}>{hoverLabel.date}</div>}
          </div>
        </div>
      )}

      {/* TITLE */}
      <div style={{ position: "absolute", top: 22, left: 0, right: 0, textAlign: "center", zIndex: 10, pointerEvents: "none", opacity: ready ? 1 : 0, transform: ready ? "none" : "translateY(-12px)", transition: "all 1.8s cubic-bezier(.23,1,.32,1)" }}>
        <h1 style={{ fontSize: 28, fontWeight: 400, margin: 0, letterSpacing: ".2em", textTransform: "uppercase", color: "#f0e8d8", textShadow: "0 1px 12px rgba(0,0,0,0.5), 0 0 40px rgba(255,255,255,0.12)" }}>{config.title}</h1>
        <p style={{ fontSize: 12, color: "#d8cebb", marginTop: 3, letterSpacing: ".3em", fontStyle: "italic", textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>{config.subtitle}</p>
        {isPartnerWorld && isAnniversary && <div style={{ fontSize: 11, color: P.heart, marginTop: 6, letterSpacing: ".15em", animation: "heartPulse 2s ease infinite" }}>✨ Happy Anniversary ✨</div>}
      </div>

      {/* MOBILE ZOOM BUTTONS */}
      {isMobile && introComplete && (
        <div style={{ position: "absolute", bottom: 130, right: 14, zIndex: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <button aria-label="Zoom in" onClick={() => { tZm.current = clamp(tZm.current - 0.4, MIN_Z, MAX_Z); }} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${P.textFaint}25`, background: P.glass, backdropFilter: "blur(12px)", fontSize: 20, color: P.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 8px ${P.text}10` }}>+</button>
          <button aria-label="Zoom out" onClick={() => { tZm.current = clamp(tZm.current + 0.4, MIN_Z, MAX_Z); }} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${P.textFaint}25`, background: P.glass, backdropFilter: "blur(12px)", fontSize: 20, color: P.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 8px ${P.text}10` }}>−</button>
        </div>
      )}

      {/* OFFLINE INDICATOR */}
      {isOffline && introComplete && (
        <div style={{ position: "absolute", top: isMobile ? 70 : 80, left: "50%", transform: "translateX(-50%)", zIndex: 15, pointerEvents: "none", animation: "fadeIn .4s ease" }}>
          <div style={{ fontSize: 10, color: "#e8c070", letterSpacing: ".1em", background: "rgba(40,30,20,0.75)", backdropFilter: "blur(8px)", borderRadius: 12, padding: "4px 14px", border: "1px solid rgba(200,170,110,0.2)" }}>Offline — changes won't save</div>
        </div>
      )}

      {/* ZOOM HINT — fades after 4 seconds */}
      {showZoomHint && introComplete && !selected && (
        <div style={{ position: "absolute", bottom: isMobile ? 115 : 130, left: "50%", transform: "translateX(-50%)", zIndex: 10, pointerEvents: "none", opacity: 0.8, animation: "fadeIn .6s ease", transition: "opacity 1s ease" }}>
          <div style={{ fontSize: 11, color: P.text, letterSpacing: ".12em", textAlign: "center", background: "rgba(250,248,244,0.8)", backdropFilter: "blur(8px)", borderRadius: 16, padding: "5px 14px", textShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
            {isMobile ? "Pinch to zoom · Double-tap to zoom in" : "Scroll to zoom · Click markers to explore"}
          </div>
        </div>
      )}

      {/* RIGHT PANEL — distance + stats */}
      <div style={{ position: "absolute", top: isMobile ? 14 : 22, right: isMobile ? 12 : 22, zIndex: 10, textAlign: "right", opacity: introComplete ? .8 : 0, transition: "opacity 1s ease", maxWidth: isMobile ? 130 : 180 }}>
        {isPartnerWorld && dist !== null && (
          <div style={{ marginBottom: 4 }}>
            {areTogether ? <div style={{ fontSize: 16, color: P.heart, animation: "heartPulse 1.5s ease infinite" }}>💕 Together</div>
              : <div style={{ fontSize: 13, color: P.textMid }}><span style={{ color: P.rose }}>♥</span> {dist.toLocaleString()} mi apart{dist > 3000 ? <div style={{ fontSize: 9, color: P.rose, opacity: 0.7, marginTop: 2, fontStyle: "italic" }}>across the world</div> : dist > 500 ? <div style={{ fontSize: 9, color: P.rose, opacity: 0.7, marginTop: 2, fontStyle: "italic" }}>missing you</div> : null}</div>}
          </div>
        )}
        {isPartnerWorld && nextTogether && !areTogether && (
          <div style={{ fontSize: 10, color: P.goldWarm, letterSpacing: ".08em", marginBottom: 4, fontWeight: 500, textShadow: "0 1px 3px rgba(0,0,0,.15)" }}>
            {daysBetween(todayStr(), nextTogether.dateStart)} days until together 💛
          </div>
        )}
        {!isMobile && data.entries.length > 0 && <div style={{ fontSize: 8, color: P.textMid, letterSpacing: ".08em", lineHeight: 1.6, textShadow: "0 1px 6px rgba(0,0,0,0.2)" }}>
          {isMyWorld
            ? <>{data.entries.length} trips · {stats.countries} countries<br />{stats.totalMiles.toLocaleString()} miles explored</>
            : isPartnerWorld
            ? <>{stats.daysTog} days together<br />{stats.trips} adventures · {stats.countries} countries<br />{stats.totalMiles.toLocaleString()} miles traveled</>
            : <>{data.entries.length} trips · {stats.countries} countries<br />{stats.totalMiles.toLocaleString()} miles traveled</>
          }
        </div>}
        {/* Entry type filter + scrollable entry list */}
        {data.entries.length > 0 && (
          <div style={{ marginTop: 10, position: "relative" }}>
            <button onClick={() => setShowFilter(v => !v)} style={{ background: showFilter ? P.blush : "rgba(255,255,255,.6)", border: `1px solid ${P.rose}20`, borderRadius: 8, padding: "8px 12px", fontSize: 9, cursor: "pointer", fontFamily: "inherit", color: P.textMid, letterSpacing: ".06em", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
              {markerFilter === "all" ? "🌍 All Entries" : markerFilter === "favorites" ? "♥ Favorites" : `${(TYPES[markerFilter] || {}).icon || "✨"} ${(TYPES[markerFilter] || {}).label || markerFilter}`}
              <span style={{ fontSize: 6, opacity: 0.5 }}>{showFilter ? "▲" : "▼"}</span>
            </button>
            {showFilter && (
              <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: P.card, backdropFilter: "blur(16px)", borderRadius: 10, boxShadow: "0 8px 28px rgba(61,53,82,.12)", border: `1px solid ${P.rose}10`, overflow: "hidden", minWidth: 150, zIndex: 20 }}>
                {[{ key: "all", icon: "🌍", label: "All Entries", count: data.entries.length },
                  { key: "favorites", icon: "♥", label: "Favorites", count: favorites.length },
                  ...Object.entries(TYPES).map(([k, v]) => ({ key: k, icon: v.icon, label: v.label, count: data.entries.filter(e => e.type === k).length }))
                ].filter(f => f.count > 0 || f.key === "favorites").map(f => (
                  <button key={f.key} onClick={() => { setMarkerFilter(f.key); setShowFilter(false); setListRenderLimit(100); }}
                    style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "10px 12px", border: "none", borderBottom: `1px solid ${P.parchment}`, background: markerFilter === f.key ? P.blush : "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 10, color: markerFilter === f.key ? P.text : P.textMid, textAlign: "left" }}
                    onMouseEnter={e => { if (markerFilter !== f.key) e.currentTarget.style.background = P.lavMist; }}
                    onMouseLeave={e => { if (markerFilter !== f.key) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span>{f.icon}</span>
                    <span style={{ flex: 1 }}>{f.label}</span>
                    <span style={{ fontSize: 10, color: P.textFaint, background: `${P.parchment}`, borderRadius: 10, padding: "1px 5px" }}>{f.count}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Scrollable entry list — grouped by trip when possible */}
            {filteredList.length > 0 && (() => {
              const entryRow = (e) => (
                <button key={e.id} onClick={() => {
                  setSelected(e); setPhotoIdx(0); setCardTab("overview"); setLocationList(null); setSliderDate(e.dateStart);
                  flyTo(e.lat, e.lng, 2.5);
                }}
                  style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "7px 10px", border: "none", borderBottom: `1px solid ${P.parchment}60`, background: selected?.id === e.id ? P.blush : "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background .15s" }}
                  onMouseEnter={ev => { if (selected?.id !== e.id) ev.currentTarget.style.background = P.lavMist; }}
                  onMouseLeave={ev => { if (selected?.id !== e.id) ev.currentTarget.style.background = "transparent"; }}
                >
                  {(e.photos || []).length > 0 ? (
                    <img loading="lazy" src={thumbnail(e.photos[0], 64)} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0, border: `1px solid ${P.rose}15` }} />
                  ) : (
                    <span style={{ fontSize: 14, flexShrink: 0, width: 32, textAlign: "center" }}>{(TYPES[e.type] || {}).icon || "📍"}</span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 400, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.city}{(e.stops || []).length > 0 ? ` + ${e.stops.length} stop${e.stops.length > 1 ? "s" : ""}` : ""}</div>
                    <div style={{ fontSize: 8, color: P.textFaint }}>{fmtDate(e.dateStart)}{e.dateEnd && e.dateEnd !== e.dateStart ? ` → ${fmtDate(e.dateEnd)}` : ""}{(e.stops || []).length > 0 ? ` · ${[...new Set(e.stops.map(s => s.country).filter(Boolean))].join(", ")}` : ""}</div>
                    {allStickersMap[e.id] && <div style={{ display: "flex", gap: 2, marginTop: 1 }}>{allStickersMap[e.id].map((s, i) => <span key={s.emoji + '-' + i} style={{ fontSize: 8 }} title={s.label}>{s.emoji}</span>)}</div>}
                  </div>
                  {(e.photos || []).length > 1 && <span style={{ fontSize: 10, color: P.textFaint }}>📸{(e.photos || []).length}</span>}
                  {isSharedWorld && e.addedBy && memberNameMap[e.addedBy] && (
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: `linear-gradient(135deg, ${P.rose}35, ${P.sky}35)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: P.text, flexShrink: 0 }} title={`Added by ${memberNameMap[e.addedBy]}`}>
                      {memberNameMap[e.addedBy].charAt(0).toUpperCase()}
                    </div>
                  )}
                  {e.favorite && <span style={{ fontSize: 9, color: P.heart }}>♥</span>}
                </button>
              );
              return (
              <div style={{ marginTop: 6, background: P.card, backdropFilter: "blur(12px)", borderRadius: 10, border: `1px solid ${P.rose}10`, maxHeight: "calc(100vh - 340px)", overflowY: "auto", boxShadow: "0 4px 16px rgba(61,53,82,.06)" }}>
                <div style={{ padding: "6px 10px 4px", fontSize: 10, color: P.textFaint, letterSpacing: ".12em", textTransform: "uppercase", borderBottom: `1px solid ${P.parchment}`, position: "sticky", top: 0, background: P.card, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>{filteredList.length} {markerFilter === "all" ? "entries" : markerFilter === "favorites" ? "favorites" : (TYPES[markerFilter]?.label || "entries").toLowerCase()}</span>
                  <select value={listSortMode} onChange={e => setListSortMode(e.target.value)}
                    style={{ background: "none", border: "none", color: P.textFaint, fontSize: 10, fontFamily: "inherit", cursor: "pointer", letterSpacing: ".08em", textTransform: "uppercase", outline: "none", padding: 0 }}>
                    <option value="newest">newest</option>
                    <option value="oldest">oldest</option>
                    <option value="alpha">A→Z</option>
                    <option value="country">country</option>
                  </select>
                </div>
                {filteredList.slice(0, listRenderLimit).map(e => entryRow(e))}
                {filteredList.length > listRenderLimit && (
                  <button onClick={() => setListRenderLimit(v => v + 100)}
                    style={{ width: "100%", padding: "8px", border: "none", background: P.lavMist, cursor: "pointer", fontSize: 9, color: P.textMid, fontFamily: "inherit", letterSpacing: ".06em" }}>
                    Show more ({filteredList.length - listRenderLimit} remaining)
                  </button>
                )}
              </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* TOOLBAR */}
      <div role="toolbar" aria-label="World tools" style={{ position: "absolute", top: 22, left: 22, zIndex: 20, display: "flex", flexDirection: "column", gap: 7, opacity: introComplete ? 1 : 0, transition: "opacity .8s ease" }}>

        {/* — Core actions — */}
        {!isViewer && <TBtn onClick={() => setShowAdd(true)} accent tip="Add Entry">＋</TBtn>}
        {!isViewer && <TBtn onClick={() => setQuickAddMode(true)} tip="Quick Add">⚡</TBtn>}

        {/* — Draft indicator — */}
        {!isViewer && (hasDraft(`cosmos-draft-add-${worldId || worldMode}`) || hasDraft(`cosmos-draft-quick-${worldId || worldMode}`)) && (
          <TBtn onClick={() => {
            if (hasDraft(`cosmos-draft-add-${worldId || worldMode}`)) setShowAdd(true);
            else setQuickAddMode(true);
          }} tip={(() => {
            const d = getDraftSummary(`cosmos-draft-add-${worldId || worldMode}`) || getDraftSummary(`cosmos-draft-quick-${worldId || worldMode}`);
            return d ? `Resume draft${d.city ? `: ${d.city}` : ""}` : "Resume draft";
          })()}>
            <span style={{ position: "relative" }}>📝<span style={{ position: "absolute", top: -4, right: -6, width: 7, height: 7, borderRadius: "50%", background: "#c9a96e", border: "1.5px solid rgba(255,255,255,.9)", animation: "pulse 2s infinite" }} /></span>
          </TBtn>
        )}

        {!isViewer && <TBtn onClick={() => { setShowSettings(true); }} tip="Settings">⚙️</TBtn>}

        {/* — divider — */}
        {data.entries.length > 0 && <div style={{ width: 20, height: 1, background: `${P.textFaint}18`, margin: "1px auto" }} />}

        {/* — Explore — */}
        {data.entries.length > 0 && <TBtn a={showSearch} onClick={() => setShowSearch(v => !v)} tip="Search Entries">🔍</TBtn>}
        {data.entries.length > 0 && <TBtn a={showStats} onClick={() => setShowStats(v => !v)} tip="Stats & Insights">📊</TBtn>}

        {/* — Discover group — */}
        {data.entries.length > 0 && (
          <TBtnGroup icon="✨" label="discover">
            {data.entries.length > 2 && <TBtn a={showConstellation} onClick={() => setShowConstellation(v => !v)} tip="Constellation">⭐</TBtn>}
            {sorted.length > 1 && <TBtn a={showRoutes} onClick={() => setShowRoutes(v => !v)} tip="Travel Routes">🛤</TBtn>}
            {data.entries.length > 0 && <TBtn a={showMilestones} onClick={() => setShowMilestones(v => !v)} tip="Milestones">✨</TBtn>}
            {data.entries.length > 2 && <TBtn a={showTravelStats} onClick={() => setShowTravelStats(v => !v)} tip="Travel Stats">📈</TBtn>}
            {isPartnerWorld && togetherList.length > 1 && <TBtn a={showLoveThread} onClick={() => setShowLoveThread(v => !v)} tip="Love Thread">🧵</TBtn>}
            <TBtn a={showDreams} onClick={() => setShowDreams(v => !v)} tip={isMyWorld ? "Bucket List" : isPartnerWorld ? "Dream Destinations" : "Wish List"}>{isMyWorld ? "🗺️" : "✦"}</TBtn>
          </TBtnGroup>
        )}

        {/* — Photos group — */}
        {allPhotos.length > 0 && (
          <TBtnGroup icon="📸" label="scrapbook">
            <TBtn a={showGallery} onClick={() => setShowGallery(v => !v)} tip="Scrapbook">📸</TBtn>
            {allPhotos.length > 2 && <TBtn onClick={() => { setShowPhotoJourney(true); setPjIndex(0); }} tip="Photo Journey">🎞</TBtn>}
            <TBtn a={showPhotoMap} onClick={() => setShowPhotoMap(v => !v)} tip="Photo Map">📍</TBtn>
          </TBtnGroup>
        )}

        {/* — Play group — */}
        {data.entries.length > 1 && (
          <TBtnGroup icon="▶" label="play">
            {(isPartnerWorld ? togetherList.length > 0 : sorted.length > 0) && !isPlaying && <TBtn onClick={playStory} tip={isPartnerWorld ? "Play Our Story" : "Play Story"}>▶</TBtn>}
            {isPlaying && <TBtn onClick={stopPlay} a tip="Stop Playback">⏹</TBtn>}
            <TBtn onClick={() => {
              const pool = data.entries.filter(e => e.lat != null && e.lng != null);
              if (!pool.length) return;
              const pick = pool[Math.floor(Math.random() * pool.length)];
              tZm.current = 4.5;
              setTimeout(() => {
                flyTo(pick.lat, pick.lng, 2.2);
                setTimeout(() => { setSelected(pick); setPhotoIdx(0); setCardTab("overview"); }, 600);
              }, 400);
            }} tip="Surprise Me">🎲</TBtn>
            {config.ambientMusicUrl && <TBtn a={ambientPlaying} onClick={() => {
              const au = ambientRef.current;
              if (!au) return;
              if (ambientPlaying) { au.pause(); setAmbientPlaying(false); }
              else { au.play().catch(() => {}); setAmbientPlaying(true); }
            }} tip={ambientPlaying ? "Pause Ambient Music" : "Play Ambient Music"}>{ambientPlaying ? "🔊" : "🎵"}</TBtn>}
          </TBtnGroup>
        )}

        {/* — divider — */}
        <div style={{ width: 20, height: 1, background: `${P.textFaint}18`, margin: "1px auto" }} />

        {/* — Undo/Redo — */}
        {!isViewer && (data.undoStack?.length > 0 || data.redoStack?.length > 0) && <>
          {data.undoStack?.length > 0 && <TBtn onClick={() => dispatch({ type: "UNDO" })} tip={`Undo (${data.undoStack.length})`}>↩</TBtn>}
          {data.redoStack?.length > 0 && <TBtn onClick={() => dispatch({ type: "REDO" })} tip={`Redo (${data.redoStack.length})`}>↪</TBtn>}
        </>}

        {/* — More group (keeps toolbar short) — */}
        <TBtnGroup icon="⋯" label="more">
          <TBtn onClick={saveGlobeScreenshot} tip="Save Globe Screenshot">📷</TBtn>
          {!isViewer && <TBtn onClick={() => setShowTemplates(true)} tip="Entry Templates">📋</TBtn>}
          {data.entries.length >= 2 && <TBtn onClick={() => setShowTripJournal(true)} tip="Trip Journal">📖</TBtn>}
          {data.entries.length > 0 && <TBtn onClick={() => setShowExportHub(true)} tip="Export & Import">📤</TBtn>}
          {data.entries.length > 0 && <TBtn onClick={() => setShowYearReview(true)} tip="Year in Review">🎬</TBtn>}
          {recentlyDeleted.length > 0 && <TBtn onClick={() => setShowTrash(true)} tip={`Recently Deleted (${recentlyDeleted.length})`}>🗑</TBtn>}
        </TBtnGroup>

        {isSharedWorld && <NotificationCenter
          notifications={notifications}
          palette={P}
          onDismiss={id => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
          onDismissAll={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
          onClickNotification={n => {
            if (n.entryId) {
              const entry = data.entries.find(e => e.id === n.entryId);
              if (entry) { setSelected(entry); setPhotoIdx(0); setCardTab("overview"); flyTo(entry.lat, entry.lng, 2.5); }
            }
            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
          }}
        />}
        {onSwitchWorld && <TBtn onClick={() => { flushConfigSave(); onSwitchWorld(); }} tip="Switch World">🔄</TBtn>}
        {pendingOffline > 0 && <SyncIndicator isConnected={true} lastSync={lastSync} pendingOffline={pendingOffline} palette={{ bg: SC.bg, text: P.text }} style={{ margin: '4px auto' }} />}
        <TBtn onClick={() => setConfirmModal({ message: "Sign out of My Cosmos?", onConfirm: () => signOut() })} tip="Sign Out">🚪</TBtn>
      </div>

      {/* PRESENCE INDICATOR — who's exploring this world right now */}
      {isSharedWorld && otherOnlineUsers.length > 0 && (
        <div style={{ position: "absolute", top: 14, right: 14, zIndex: 18, display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: `${P.card}cc`, backdropFilter: "blur(12px)", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,.12)", animation: "fadeIn .4s ease" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade8088", flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: P.textMid, fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", whiteSpace: "nowrap" }}>
            {otherOnlineUsers.length === 1
              ? `${otherOnlineUsers[0].name} is here`
              : `${otherOnlineUsers.map(u => u.name).join(", ")} are here`
            }
          </span>
        </div>
      )}

      {/* AMBIENT MUSIC — persistent audio element with state sync */}
      {config.ambientMusicUrl && <audio ref={ambientRef} src={config.ambientMusicUrl} loop preload="none" style={{ display: "none" }}
        onPause={() => setAmbientPlaying(false)} onPlay={() => setAmbientPlaying(true)}
        onError={() => { setAmbientPlaying(false); console.warn('[ambient] failed to load:', config.ambientMusicUrl); }} />}

      {/* SEARCH PANEL */}
      {showSearch && (
        <div style={{ position: "absolute", top: 22, left: 66, zIndex: 22, width: isMobile ? "calc(100% - 80px)" : 300, animation: "fadeIn .2s ease" }}>
          <div style={{ position: "relative" }}>
            <input autoFocus value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setSearchHl(-1); }}
              onKeyDown={e => {
                if (e.key === "ArrowDown") { e.preventDefault(); setSearchHl(h => Math.min(h + 1, searchResults.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setSearchHl(h => Math.max(h - 1, -1)); }
                else if (e.key === "Enter" && searchHl >= 0 && searchHl < searchResults.length) {
                  e.preventDefault();
                  const se = searchResults[searchHl];
                  setSelected(se); setPhotoIdx(0); setCardTab("overview"); setShowSearch(false); setSearchQuery(""); setSearchHl(-1);
                  setSliderDate(se.dateStart); flyTo(se.lat, se.lng, 2.5);
                }
                else if (e.key === "Escape") { setShowSearch(false); setSearchQuery(""); setSearchHl(-1); setSearchDateFrom(""); setSearchDateTo(""); setSearchTypeFilter("all"); setSearchSort("date-desc"); }
              }}
              placeholder="Search cities, notes, highlights..."
              style={{ width: "100%", padding: "9px 28px 9px 12px", border: `1px solid ${P.rose}25`, borderRadius: 10, fontSize: 11, fontFamily: "inherit", color: P.text, background: P.card, backdropFilter: "blur(16px)", boxShadow: "0 4px 16px rgba(0,0,0,.08)", outline: "none", boxSizing: "border-box" }}
            />
            {searchQuery.length > 0 && (
              <button onClick={() => { setSearchQuery(""); setSearchHl(-1); }} style={{ position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: P.textFaint, fontSize: 15, cursor: "pointer", padding: "6px 10px", lineHeight: 1 }}>×</button>
            )}
          </div>
          {/* Filter row: date range, type, sort */}
          <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
            <input type="date" value={searchDateFrom} onChange={e => setSearchDateFrom(e.target.value)} title="From date"
              style={{ flex: 1, minWidth: 90, padding: "5px 6px", border: `1px solid ${P.rose}20`, borderRadius: 7, fontSize: 9, fontFamily: "inherit", color: P.text, background: P.card, backdropFilter: "blur(12px)", outline: "none" }} />
            <span style={{ fontSize: 9, color: P.textFaint }}>→</span>
            <input type="date" value={searchDateTo} onChange={e => setSearchDateTo(e.target.value)} title="To date"
              style={{ flex: 1, minWidth: 90, padding: "5px 6px", border: `1px solid ${P.rose}20`, borderRadius: 7, fontSize: 9, fontFamily: "inherit", color: P.text, background: P.card, backdropFilter: "blur(12px)", outline: "none" }} />
            <select value={searchTypeFilter} onChange={e => setSearchTypeFilter(e.target.value)} title="Filter by type"
              style={{ padding: "5px 4px", border: `1px solid ${P.rose}20`, borderRadius: 7, fontSize: 9, fontFamily: "inherit", color: P.text, background: P.card, outline: "none", maxWidth: 90 }}>
              <option value="all">All types</option>
              {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
            <select value={searchSort} onChange={e => setSearchSort(e.target.value)} title="Sort results"
              style={{ padding: "5px 4px", border: `1px solid ${P.rose}20`, borderRadius: 7, fontSize: 9, fontFamily: "inherit", color: P.text, background: P.card, outline: "none", maxWidth: 80 }}>
              <option value="date-desc">Newest</option>
              <option value="date-asc">Oldest</option>
              <option value="alpha">A→Z</option>
              <option value="country">Country</option>
            </select>
            {(searchDateFrom || searchDateTo || searchTypeFilter !== "all") && (
              <button onClick={() => { setSearchDateFrom(""); setSearchDateTo(""); setSearchTypeFilter("all"); setSearchSort("date-desc"); }}
                style={{ background: "none", border: "none", color: P.rose, fontSize: 9, cursor: "pointer", padding: "2px 4px", fontFamily: "inherit" }}>Clear filters</button>
            )}
          </div>
          {hasSearchFilters && (
            <div style={{ marginTop: 4, background: P.card, backdropFilter: "blur(16px)", borderRadius: 10, maxHeight: 300, overflowY: "auto", boxShadow: "0 8px 28px rgba(61,53,82,.12)", border: `1px solid ${P.rose}10`, animation: "fadeIn .2s ease" }}>
              {searchResults.length === 0 && (
                <div style={{ padding: "14px 16px", fontSize: 10, color: P.textFaint, textAlign: "center" }}>{searchQuery.length >= 2 ? <>No matches for &ldquo;{searchQuery}&rdquo;</> : "No entries match these filters"}</div>
              )}
              {searchResults.length > 0 && (
                <div style={{ padding: "6px 14px 2px", fontSize: 8, color: P.textFaint, letterSpacing: "0.5px" }}>{searchResults.length} {searchResults.length === 1 ? "result" : "results"}</div>
              )}
              {searchResults.slice(0, 50).map((e, ri) => {
                const t = TYPES[e.type] || DEFAULT_TYPE;
                const isHl = ri === searchHl;
                return (
                  <button key={e.id} onClick={() => {
                    setSelected(e); setPhotoIdx(0); setCardTab("overview"); setShowSearch(false); setSearchQuery(""); setSearchHl(-1);
                    setSliderDate(e.dateStart);
                    flyTo(e.lat, e.lng, 2.5);
                  }} style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "9px 14px", border: "none", borderBottom: `1px solid ${P.parchment}`, background: isHl ? P.blush : "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                    onMouseEnter={ev => { ev.currentTarget.style.background = P.blush; setSearchHl(ri); }}
                    onMouseLeave={ev => { if (ri !== searchHl) ev.currentTarget.style.background = "transparent"; }}
                  >
                    {(e.photos || []).length > 0
                      ? <img loading="lazy" src={thumbnail(e.photos[0], 64)} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />
                      : <span style={{ fontSize: 14, width: 28, textAlign: "center", flexShrink: 0 }}>{t.icon}</span>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.city}{e.favorite ? " ♥" : ""}</div>
                      <div style={{ fontSize: 8, color: P.textFaint }}>{fmtDate(e.dateStart)} · {e.country}{isSharedWorld && e.addedBy && memberNameMap[e.addedBy] ? ` · ${memberNameMap[e.addedBy]}` : ""}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* LOVE LETTER TRIGGERS — small ❀ markers in bottom-right (partner only) */}
      {isPartnerWorld && (config.loveLetters || []).length > 0 && (
        <div style={{ position: "absolute", bottom: 118, right: 22, zIndex: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          {(config.loveLetters || []).map((lt) => (
            <button key={lt.id} onClick={() => setShowLetter(lt.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, opacity: 0.22, transition: "opacity .5s", padding: 2 }}
              onMouseEnter={e => e.currentTarget.style.opacity = 0.55} onMouseLeave={e => e.currentTarget.style.opacity = 0.22}
              title={lt.city || "Love letter"}>❀</button>
          ))}
        </div>
      )}
      {isPartnerWorld && !isViewer && (<>
        <button onClick={() => { setEditLetter(true); setLetterDraft(""); setLetterEditId(null); setLetterCity(""); setLetterLat(""); setLetterLng(""); }} style={{ position: "absolute", bottom: 118, right: (config.loveLetters || []).length > 0 ? 50 : 22, zIndex: 12, background: P.glass, border: `1px dashed ${P.rose}40`, borderRadius: 7, cursor: "pointer", fontSize: 9, color: P.textMuted, padding: "3px 9px", fontFamily: "inherit", transition: "right .3s" }}>+ Love Letter</button>
        {(config.loveLetters || []).filter(l => l.draft && l.author === userId).length > 0 && (
          <div style={{ position: "absolute", bottom: 138, right: (config.loveLetters || []).length > 0 ? 50 : 22, zIndex: 12, fontSize: 8, color: P.gold, letterSpacing: ".06em" }}>📝 {(config.loveLetters || []).filter(l => l.draft && l.author === userId).length} draft{(config.loveLetters || []).filter(l => l.draft && l.author === userId).length > 1 ? "s" : ""}</div>
        )}
      </>)}

      {/* SLIDER */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: P.glass, backdropFilter: "blur(16px)", borderTop: `1px solid ${P.rose}10`, zIndex: 15, display: "flex", flexDirection: "column", justifyContent: "center", padding: "12px 22px", paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
          <button onClick={() => jumpNext(-1)} disabled={isAnimating} style={navStyle()} title={isPartnerWorld ? "Previous together" : "Previous entry"}>{isPartnerWorld ? "💕◂" : "⏮"}</button>
          <button onClick={() => stepDay(-1)} disabled={isAnimating} style={navStyle()}>◂</button>
          <div style={{ minWidth: 150, textAlign: "center" }}>
            <div style={{ fontSize: 15, color: P.text, fontWeight: 400 }}>{fmtDate(sliderDate)}</div>
            <div style={{ fontSize: 9, color: isMyWorld ? P.textMid : (isPartnerWorld && areTogether ? P.heart : P.textFaint), letterSpacing: ".1em", marginTop: 1 }}>
              {isMyWorld
                ? (pos.seth?.entry?.city ? `📍 ${pos.seth.entry.city}` : "Add entries to begin")
                : isPartnerWorld
                ? (areTogether ? `✨ ${pos.together?.city || "Together"} ✨` : pos.seth && pos.rosie ? `${pos.seth.entry?.city || "?"} ↔ ${pos.rosie.entry?.city || "?"}` : "Add entries to begin")
                : (data.entries.length > 0 ? `📍 ${data.entries[0]?.city || ""}` : "Add entries to begin")
              }
            </div>
          </div>
          <button onClick={() => stepDay(1)} disabled={isAnimating} style={navStyle()}>▸</button>
          <button onClick={() => jumpNext(1)} disabled={isAnimating} style={navStyle()} title={isPartnerWorld ? "Next together" : "Next entry"}>{isPartnerWorld ? "▸💕" : "⏭"}</button>
        </div>
        <div style={{ position: "relative", width: "100%", height: 24, display: "flex", alignItems: "center" }}>
          <input type="range" min={0} max={totalDays} value={clamp(sliderVal, 0, totalDays)}
            onChange={e => { if (!isAnimating) setSliderDate(addDays(effectiveStartDate, parseInt(e.target.value))); }}
            style={{ width: "100%", height: 4, appearance: "none", WebkitAppearance: "none", background: `linear-gradient(90deg,${P.sky},${P.rose})`, borderRadius: 2, outline: "none", cursor: "pointer", opacity: 0.5, touchAction: "manipulation" }} />
          {sorted.map(e => {
            const d = daysBetween(effectiveStartDate, e.dateStart);
            const pct = totalDays > 0 ? (d / totalDays) * 100 : 0;
            if (pct < 0 || pct > 100) return null;
            const typeColor = (TYPES[e.type] || DEFAULT_TYPE).color;
            const isBig = isMyWorld ? true : e.who === "both";
            const isActive = selected?.id === e.id;
            return <div key={e.id} onClick={() => {
              setSelected(e); setPhotoIdx(0); setCardTab("overview"); setSliderDate(e.dateStart);
              flyTo(e.lat, e.lng, 2.5);
            }} title={`${e.city} · ${fmtDate(e.dateStart)}`} style={{ position: "absolute", left: `${pct}%`, top: isActive ? 2 : isBig ? 5 : 6, width: isActive ? 8 : isBig ? 5 : 3, height: isActive ? 8 : isBig ? 5 : 3, borderRadius: "50%", background: typeColor, transform: "translateX(-50%)", cursor: "pointer", boxShadow: isActive ? `0 0 8px ${typeColor}, 0 0 16px ${typeColor}60` : `0 0 4px ${typeColor}40`, opacity: isActive ? 1 : isBig ? 0.85 : 0.5, transition: "all .2s ease", zIndex: isActive ? 3 : 1, border: isActive ? "1.5px solid #fff" : "none" }} />;
          })}
          {milestones.map(m => (
            <div key={m.days} style={{ position: "absolute", left: `${m.pct}%`, top: 2, transform: "translateX(-50%)", pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 6, height: 6, background: P.gold, transform: "rotate(45deg)", boxShadow: `0 0 6px ${P.gold}60` }} />
              <div style={{ fontSize: 6, color: P.goldWarm, marginTop: 2, whiteSpace: "nowrap", letterSpacing: ".05em" }}>{m.label}</div>
            </div>
          ))}
          {(config.chapters || []).map((ch, i) => {
            const cStart = daysBetween(effectiveStartDate, ch.startDate || effectiveStartDate);
            const cEnd = daysBetween(effectiveStartDate, ch.endDate || todayStr());
            const pctStart = totalDays > 0 ? (cStart / totalDays) * 100 : 0;
            const pctEnd = totalDays > 0 ? (cEnd / totalDays) * 100 : 100;
            if (pctStart > 100 || pctEnd < 0) return null;
            return <div key={ch.label + '-' + i} style={{ position: "absolute", left: `${clamp(pctStart, 0, 100)}%`, width: `${clamp(pctEnd - pctStart, 0, 100 - pctStart)}%`, top: -14, height: 12, background: `${[P.rose, P.sky, P.sage, P.gold, P.lavender][i % 5]}30`, borderRadius: 3, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 10, color: P.textMuted, letterSpacing: ".06em", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", padding: "0 2px" }}>{ch.label}</span>
            </div>;
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: P.textFaint, letterSpacing: ".1em", marginTop: 1 }}>
          <span>{fmtDate(effectiveStartDate)}</span>
          <span>today</span>
        </div>
      </div>

      {/* LOCATION LIST — multiple chapters at same place */}
      {locationList && !selected && (
        <div style={isMobile
          ? { position: "absolute", bottom: 105, left: 0, right: 0, zIndex: 25, background: P.card, backdropFilter: "blur(24px)", borderRadius: "16px 16px 0 0", maxHeight: "45vh", boxShadow: "0 -8px 32px rgba(61,53,82,.1)", border: `1px solid ${P.rose}10`, animation: "fadeIn .3s ease", overflow: "hidden", display: "flex", flexDirection: "column" }
          : { position: "absolute", top: "42%", right: 18, transform: "translateY(-50%)", zIndex: 25, background: P.card, backdropFilter: "blur(24px)", borderRadius: 16, maxWidth: 300, minWidth: 220, boxShadow: "0 12px 44px rgba(61,53,82,.1)", border: `1px solid ${P.rose}10`, animation: "cardIn .5s ease", overflow: "hidden", display: "flex", flexDirection: "column" }
        }>
          <div style={{ padding: "14px 18px 10px" }}>
            <button aria-label="Close location list" onClick={() => setLocationList(null)} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", fontSize: 16, color: P.textFaint, cursor: "pointer", zIndex: 5 }}>×</button>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 400 }}>{locationList.city}</h2>
            <p style={{ fontSize: 9, color: P.textFaint, marginTop: 2, letterSpacing: ".1em" }}>{locationList.entries.length} entries here</p>
          </div>
          <div style={{ padding: "0 14px 14px", maxHeight: 280, overflowY: "auto" }}>
            {[...locationList.entries].sort((a, b) => a.dateStart.localeCompare(b.dateStart)).map(e => {
              const t = TYPES[e.type] || DEFAULT_TYPE;
              return (
                <button key={e.id} onClick={() => {
                  setSelected(e); setPhotoIdx(0); setCardTab("overview"); setLocationList(null); setCardGallery(false);
                  setSliderDate(e.dateStart);
                }} style={{
                  display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
                  background: "none", border: "none", borderBottom: `1px solid ${P.rose}08`,
                  cursor: "pointer", fontFamily: "inherit", transition: "background .15s", borderRadius: 6,
                }}
                  onMouseEnter={ev => ev.currentTarget.style.background = P.blush}
                  onMouseLeave={ev => ev.currentTarget.style.background = "none"}
                >
                  <div style={{ fontSize: 11, color: P.text, marginBottom: 2 }}>{t.icon} {e.city}</div>
                  <div style={{ fontSize: 9, color: P.textMuted }}>{fmtDate(e.dateStart)}{e.dateEnd ? ` → ${fmtDate(e.dateEnd)}` : ""}</div>
                  {e.notes && <div style={{ fontSize: 9, color: P.textFaint, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.notes.slice(0, 60)}{e.notes.length > 60 ? "…" : ""}</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAIL CARD */}
      {cur && !editing && (
        <DetailCard
          entry={cur}
          data={data}
          dispatch={dispatch}
          db={db}
          isMyWorld={isMyWorld}
          isPartnerWorld={isPartnerWorld}
          isSharedWorld={isSharedWorld}
          isViewer={isViewer}
          worldId={worldId}
          worldType={worldType}
          TYPES={TYPES}
          DEFAULT_TYPE={DEFAULT_TYPE}
          FIELD_LABELS={FIELD_LABELS}
          sorted={sorted}
          firstBadges={firstBadges}
          entryStickers={entryStickers}
          memberNameMap={memberNameMap}
          config={config}
          handwrittenMode={handwrittenMode}
          userId={userId}
          userDisplayName={userDisplayName}
          flyTo={flyTo}
          showToast={showToast}
          handlePhotos={handlePhotos}
          onClose={() => { setSelected(null); tSpinSpd.current = 0.002; }}
          onSelectEntry={(entry) => { setSelected(entry); setSliderDate(entry.dateStart); }}
          onEdit={(entry) => setEditing({ ...entry })}
          onDuplicate={(entry) => {
            const dup = { ...entry, id: `e-${Date.now()}`, dateStart: todayStr(), dateEnd: "", photos: [], notes: entry.notes ? `(Copy) ${entry.notes}` : "" };
            dispatch({ type: "ADD", entry: dup });
            setSelected(dup); showToast("Entry duplicated", "\ud83d\udccb", 2000);
          }}
          onTripCard={(entry) => setTripCardEntry(entry)}
          onConfirmDelete={(id) => setConfirmDelete(id)}
          worldReactions={worldReactions}
          setWorldReactions={setWorldReactions}
          entryComments={entryComments}
          setEntryComments={setEntryComments}
          uploadLockRef={uploadLockRef}
          setUploading={setUploading}
          setUploadProgress={setUploadProgress}
          isMobile={isMobile}
          setSliderDate={setSliderDate}
          togetherIndex={togetherIndex}
        />
      )}

      {/* ADD / EDIT / SETTINGS / LETTER overlays */}
      {showAdd && <div role="dialog" aria-modal="true" aria-label="Add entry" onClick={() => setShowAdd(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }}><div onClick={e => e.stopPropagation()}><AddForm types={TYPES} defaultType={isMyWorld ? "adventure" : "together"} defaultWho={isMyWorld ? "solo" : "both"} fieldLabels={FIELD_LABELS} isMyWorld={isMyWorld} worldName={worldName} draftKey={`cosmos-draft-add-${worldId || worldMode}`} onAdd={entry => { const isFirst = data.entries.length === 0; dispatch({ type: "ADD", entry }); setShowAdd(false); if (isFirst) { setCelebrationData({ type: 'first', message: 'Your First Entry!', sub: isMyWorld ? 'Your world has its first marker. Keep adding adventures to light up your globe.' : 'Your shared world has its first marker. This is where your story begins.' }); setShowCelebration(true); setTimeout(() => setShowCelebration(false), 6000); } showToast(`${entry.city} added to your world`, "🌍", 2500); flyTo(entry.lat, entry.lng, 2.6); setTimeout(() => { setSelected(entry); setPhotoIdx(0); setCardTab("overview"); }, 400); }} onClose={() => setShowAdd(false)} /></div></div>}
      {quickAddMode && <div role="dialog" aria-modal="true" aria-label="Quick add entry" onClick={() => setQuickAddMode(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }}><div onClick={e => e.stopPropagation()}><QuickAddForm types={TYPES} draftKey={`cosmos-draft-quick-${worldId || worldMode}`} onAdd={entry => { const isFirst = data.entries.length === 0; dispatch({ type: "ADD", entry }); setQuickAddMode(false); if (isFirst) { setCelebrationData({ type: 'first', message: 'Your First Entry!', sub: isMyWorld ? 'Your world has its first marker. Keep adding adventures to light up your globe.' : 'Your shared world has its first marker. This is where your story begins.' }); setShowCelebration(true); setTimeout(() => setShowCelebration(false), 6000); } showToast(`${entry.city} added to your world ⚡`, "⚡", 2500); flyTo(entry.lat, entry.lng, 2.6); setTimeout(() => { setSelected(entry); setPhotoIdx(0); setCardTab("overview"); }, 400); }} onClose={() => setQuickAddMode(false)} /></div></div>}

      {editing && <div role="dialog" aria-modal="true" aria-label="Edit entry" onClick={() => setEditing(null)} style={{ position: "fixed", inset: 0, zIndex: 29 }}><div onClick={e => e.stopPropagation()}><EditForm entry={editing} types={TYPES} fieldLabels={FIELD_LABELS} onChange={setEditing}
        onSave={() => { dispatch({ type: "UPDATE", id: editing.id, data: editing }); setSelected(editing); setCardTab("overview"); setEditing(null); showToast("Entry saved", "✓", 2000); }}
        onClose={() => setEditing(null)}
        onDelete={() => setConfirmDelete(editing.id)}
        onSaveTemplate={() => { saveTemplate(isMyWorld ? "my" : (worldType || "partner"), { name: `${editing.city || "Entry"} template`, type: editing.type, country: editing.country || "", highlights: editing.highlights || [], museums: editing.museums || [], restaurants: editing.restaurants || [], notes: editing.notes || "" }); showToast("Saved as template", "📋", 2000); }}
        onAddStop={stop => { const updated = { ...editing, stops: [...(editing.stops || []), stop] }; setEditing(updated); dispatch({ type: "UPDATE", id: editing.id, data: { stops: updated.stops } }); }} /></div></div>}

      {confirmDelete && (
        <div role="dialog" aria-modal="true" aria-label="Confirm delete" onClick={() => setConfirmDelete(null)} style={{ position: "fixed", inset: 0, zIndex: 60, background: `linear-gradient(135deg, rgba(22,16,40,.82), rgba(30,24,48,.88))`, backdropFilter: "blur(20px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .2s ease" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: P.card, borderRadius: 20, padding: 32, maxWidth: 340, textAlign: "center", boxShadow: "0 1px 3px rgba(61,53,82,.04), 0 8px 24px rgba(61,53,82,.06), 0 20px 56px rgba(61,53,82,.1)" }}>
            <p style={{ fontSize: 14, margin: "0 0 6px" }}>Delete this memory forever?</p>
            {(() => { const d = data.entries.find(e => e.id === confirmDelete); return d ? <p style={{ fontSize: 11, color: P.textFaint, margin: "0 0 16px", fontStyle: "italic" }}>{d.city}{d.country ? `, ${d.country}` : ""}{d.dateStart ? ` · ${fmtDate(d.dateStart)}` : ""}</p> : null; })()}
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => {
                const deletedEntry = data.entries.find(e => e.id === confirmDelete);
                dispatch({ type: "DELETE", id: confirmDelete });
                setConfirmDelete(null); setEditing(null); setSelected(null); tSpinSpd.current = 0.002;
                if (deletedEntry) {
                  // Move to recently deleted trash (30-day recovery)
                  const trashKey = `cosmos_trash_${worldId || worldMode}`;
                  const trashItem = { ...deletedEntry, deletedAt: Date.now() };
                  const newTrash = [trashItem, ...recentlyDeleted].slice(0, 50);
                  setRecentlyDeleted(newTrash);
                  localStorage.setItem(trashKey, JSON.stringify(newTrash));
                  showToast("Moved to trash (30 days)", "🗑", 5000, () => {
                    dispatch({ type: "ADD", entry: deletedEntry, _skipUndo: true });
                    const restored = newTrash.filter(t => t.id !== deletedEntry.id);
                    setRecentlyDeleted(restored);
                    localStorage.setItem(trashKey, JSON.stringify(restored));
                    showToast("Entry restored!", "↩️", 2000);
                  });
                }
              }} style={{ padding: "8px 20px", background: "#c9777a", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Delete</button>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: "8px 20px", background: "transparent", border: `1px solid ${P.textFaint}40`, borderRadius: 7, cursor: "pointer", fontSize: 12, fontFamily: "inherit", color: P.textMuted }}>Keep</button>
            </div>
          </div>
        </div>
      )}

      {isPartnerWorld && showLetter && (() => {
        const letter = (config.loveLetters || []).find(l => l.id === showLetter);
        if (!letter) return null;
        const isMyLetter = !letter.author || letter.author === userId;
        if (letter.draft && !isMyLetter) return null;
        return (
        <div role="dialog" aria-modal="true" aria-label="Love letter" onClick={() => setShowLetter(null)} style={{ position: "absolute", inset: 0, zIndex: 50, background: `linear-gradient(135deg, rgba(22,16,40,.84), rgba(30,24,48,.90))`, backdropFilter: "blur(30px)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", animation: "fadeIn .8s ease" }}>
          <div style={{ maxWidth: 460, padding: 36, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            {letter.draft && <div style={{ display: "inline-block", padding: "2px 10px", borderRadius: 10, background: `${P.gold}20`, color: P.gold, fontSize: 9, letterSpacing: ".08em", marginBottom: 10 }}>📝 Draft — only you can see this</div>}
            <div style={{ fontSize: 30, marginBottom: 14 }}>💌</div>
            {letter.city && <div style={{ fontSize: 9, color: "#a098b0", letterSpacing: ".12em", marginBottom: 8 }}>found near {letter.city}</div>}
            <p style={{ fontSize: 14, lineHeight: 2, color: "#e8dcd0", whiteSpace: "pre-wrap", fontStyle: "italic" }}>{letter.text}</p>
            <p style={{ fontSize: 10, color: "#a098b0", marginTop: 20, letterSpacing: ".15em" }}>— {config.youName || "You"}</p>
            {isMyLetter && <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
              <button onClick={() => { setLetterEditId(letter.id); setLetterDraft(letter.text); setLetterCity(letter.city || ""); setLetterLat(letter.lat?.toString() || ""); setLetterLng(letter.lng?.toString() || ""); setEditLetter(true); setShowLetter(null); }} style={{ background: "none", border: `1px solid ${P.rose}28`, borderRadius: 5, padding: "4px 12px", fontSize: 9, color: P.textMuted, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
              {letter.draft && <button onClick={() => { setConfig({ loveLetters: (config.loveLetters || []).map(l => l.id === letter.id ? { ...l, draft: false } : l) }); setShowLetter(null); showToast("Letter sent! 💌", "💌", 2500); }} style={{ background: `${P.rose}20`, border: `1px solid ${P.rose}40`, borderRadius: 5, padding: "4px 12px", fontSize: 9, color: P.rose, cursor: "pointer", fontFamily: "inherit" }}>Send 💌</button>}
              <button onClick={() => { setConfig({ loveLetters: (config.loveLetters || []).filter(l => l.id !== letter.id) }); setShowLetter(null); }} style={{ background: "none", border: `1px solid #c97a7a28`, borderRadius: 5, padding: "4px 12px", fontSize: 9, color: "#c97a7a", cursor: "pointer", fontFamily: "inherit" }}>Remove</button>
            </div>}
          </div>
        </div>);
      })()}

      {isPartnerWorld && editLetter && (
        <div role="dialog" aria-modal="true" aria-label="Edit love letter" onClick={() => setEditLetter(false)} style={{ position: "fixed", inset: 0, zIndex: 55, background: "rgba(22,16,40,.82)", backdropFilter: "blur(20px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .2s ease" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 420, maxWidth: "92vw", padding: 28, background: P.card, borderRadius: 16, boxShadow: "0 14px 48px rgba(61,53,82,.1)" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 400 }}>💌 {letterEditId ? "Edit" : "New"} Love Letter</h3>
            <p style={{ fontSize: 9, color: P.textMuted, marginBottom: 12, fontStyle: "italic" }}>Hidden as an easter egg ❀ on the globe — {config.partnerName || "your partner"} will discover it!</p>
            <div style={{ marginBottom: 8, position: "relative" }}>
              <label style={{ fontSize: 10, color: P.textFaint, letterSpacing: ".13em", textTransform: "uppercase", display: "block", marginBottom: 2 }}>Place on globe near...</label>
              <input value={letterCity} onChange={e => {
                const v = e.target.value; setLetterCity(v);
                if (v.length >= 2) { geocodeSearch(v, m => setLetterCitySugg(m)); } else setLetterCitySugg([]);
              }} placeholder="Type a city..." style={inputStyle()} />
              {letterCitySugg.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: P.card, border: `1px solid ${P.textFaint}40`, borderRadius: 6, maxHeight: 120, overflowY: "auto", zIndex: 10, boxShadow: "0 6px 16px rgba(0,0,0,.1)" }}>
                  {letterCitySugg.map((c, i) => (
                    <button key={c[0] + "-" + c[2]} onClick={() => { setLetterCity(c[0]); setLetterLat(c[2].toString()); setLetterLng(c[3].toString()); setLetterCitySugg([]); }}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", border: "none", borderBottom: `1px solid ${P.textFaint}15`, background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10, color: P.textMid }}
                      onMouseEnter={e => e.currentTarget.style.background = P.blush} onMouseLeave={e => e.currentTarget.style.background = "none"}>
                      <span style={{ fontWeight: 500 }}>{c[0]}</span> <span style={{ color: P.textFaint }}>{c[1]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <textarea value={letterDraft} onChange={e => setLetterDraft(e.target.value)} rows={8} placeholder={`Dear ${config.partnerName || "Partner"}...`} style={{ ...inputStyle(), resize: "vertical", lineHeight: 1.8 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => {
                const lat = parseFloat(letterLat) || (20 + Math.random() * 40);
                const lng = parseFloat(letterLng) || (-120 + Math.random() * 240);
                const letterObj = { text: letterDraft, city: letterCity, lat, lng, author: userId, draft: false };
                if (letterEditId) {
                  setConfig({ loveLetters: (config.loveLetters || []).map(l => l.id === letterEditId ? { ...l, ...letterObj } : l) });
                } else {
                  setConfig({ loveLetters: [...(config.loveLetters || []), { id: `ll-${Date.now()}`, ...letterObj }] });
                }
                setEditLetter(false);
                showToast(letterEditId ? "Letter updated 💌" : "Letter hidden on the globe ❀", "💌", 2500);
              }} disabled={!letterDraft.trim()} style={{ flex: 1, padding: "10px", background: letterDraft.trim() ? `linear-gradient(135deg, ${P.rose}, ${P.sky})` : `${P.textFaint}60`, color: "#fff", border: "none", borderRadius: 12, cursor: letterDraft.trim() ? "pointer" : "default", fontSize: 11, fontFamily: "inherit", letterSpacing: ".04em", boxShadow: letterDraft.trim() ? `0 2px 8px ${P.rose}30` : "none", transition: "all .25s" }}>
                {letterEditId ? "Update & Send" : "Hide on Globe"} 💌
              </button>
              <button onClick={() => {
                const lat = parseFloat(letterLat) || (20 + Math.random() * 40);
                const lng = parseFloat(letterLng) || (-120 + Math.random() * 240);
                const letterObj = { text: letterDraft, city: letterCity, lat, lng, author: userId, draft: true };
                if (letterEditId) {
                  setConfig({ loveLetters: (config.loveLetters || []).map(l => l.id === letterEditId ? { ...l, ...letterObj } : l) });
                } else {
                  setConfig({ loveLetters: [...(config.loveLetters || []), { id: `ll-${Date.now()}`, ...letterObj }] });
                }
                setEditLetter(false);
                showToast("Draft saved 📝", "📝", 2000);
              }} disabled={!letterDraft.trim()} style={{ padding: "10px 14px", background: letterDraft.trim() ? `${P.textFaint}20` : `${P.textFaint}10`, color: letterDraft.trim() ? P.textMuted : P.textFaint, border: `1px solid ${P.textFaint}30`, borderRadius: 12, cursor: letterDraft.trim() ? "pointer" : "default", fontSize: 10, fontFamily: "inherit", transition: "all .2s" }}>
                📝 Draft
              </button>
              <button onClick={() => setEditLetter(false)} style={{ padding: "10px 16px", background: "transparent", border: `1px solid ${P.textFaint}30`, borderRadius: 12, cursor: "pointer", fontSize: 11, fontFamily: "inherit", color: P.textMuted, transition: "all .2s" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* GALLERY PANEL — slides out from left, not a full overlay */}
      {showGallery && (
        <div style={{ position: "absolute", top: 72, left: 22, zIndex: 22, background: P.card, backdropFilter: "blur(28px)", borderRadius: 18, width: 290, maxHeight: "calc(100vh - 200px)", boxShadow: "0 1px 3px rgba(61,53,82,.04), 0 8px 24px rgba(61,53,82,.06), 0 20px 48px rgba(61,53,82,.08)", border: `1px solid ${P.rose}08`, animation: "fadeIn .4s ease", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 14px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, borderBottom: `1px solid ${P.rose}08` }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 400 }}>📸 Scrapbook</div>
              <div style={{ fontSize: 8, color: P.textFaint, letterSpacing: ".1em", marginTop: 1 }}>{allPhotos.length} memories</div>
            </div>
            <button aria-label="Close gallery" onClick={() => setShowGallery(false)} style={{ background: "none", border: "none", fontSize: 15, color: P.textFaint, cursor: "pointer" }}>×</button>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 10px 4px" }}>
            <button onClick={() => setPolaroidMode(v => !v)} style={{ background: polaroidMode ? `${P.goldWarm}18` : "none", border: `1px solid ${polaroidMode ? P.goldWarm + "30" : P.textFaint + "20"}`, borderRadius: 6, padding: "6px 10px", fontSize: 10, cursor: "pointer", fontFamily: "inherit", color: polaroidMode ? P.goldWarm : P.textFaint }}>{polaroidMode ? "📸 Polaroid" : "▦ Grid"}</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: polaroidMode ? "1fr 1fr" : "1fr 1fr 1fr", gap: polaroidMode ? 14 : 4, padding: polaroidMode ? "4px 6px" : 0 }}>
              {allPhotos.map((ph, i) => (
                <button key={ph.url + "-" + ph.id} onClick={() => {
                  const entry = data.entries.find(e => e.id === ph.id);
                  if (entry) {
                    setSelected(entry); setPhotoIdx(0); setCardTab("overview"); setShowGallery(false);
                    flyTo(entry.lat, entry.lng, 2.5);
                    setSliderDate(entry.dateStart);
                  }
                }} style={polaroidMode ? { padding: "5px 5px 20px", background: "#fff", border: "none", cursor: "pointer", borderRadius: 2, boxShadow: "0 2px 8px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.06)", transform: `rotate(${(i % 5 - 2) * 2}deg)`, transition: "transform .2s", overflow: "hidden", position: "relative" } : { padding: 0, border: "none", background: "none", cursor: "pointer", borderRadius: 4, overflow: "hidden", aspectRatio: "1", position: "relative" }}>
                  <img loading="lazy" src={thumbnail(ph.url, 160)} alt="Travel photo" style={polaroidMode ? { width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" } : { width: "100%", height: "100%", objectFit: "cover", borderRadius: 4, transition: "transform .2s" }}
                    onMouseEnter={e => { if (!polaroidMode) e.currentTarget.style.transform = "scale(1.05)"; else e.currentTarget.parentElement.style.transform = `rotate(0deg) scale(1.05)`; }}
                    onMouseLeave={e => { if (!polaroidMode) e.currentTarget.style.transform = "scale(1)"; else e.currentTarget.parentElement.style.transform = `rotate(${(i % 5 - 2) * 2}deg)`; }} />
                  <div style={polaroidMode ? { fontSize: 8, color: "#666", textAlign: "center", padding: "4px 3px 0", letterSpacing: ".03em", fontFamily: allPhotoCaptions[ph.url] ? "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif" : "inherit", fontStyle: allPhotoCaptions[ph.url] ? "italic" : "normal", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : { position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 3px 2px", background: "linear-gradient(transparent, rgba(0,0,0,.5))", fontSize: 6, color: "#fff", textAlign: "center", letterSpacing: ".05em" }}>{polaroidMode && allPhotoCaptions[ph.url] ? allPhotoCaptions[ph.url] : ph.city}</div>
                </button>
              ))}
            </div>
            {allPhotos.length === 0 && <div style={{ textAlign: "center", padding: "32px 16px" }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>📸</div>
              <div style={{ fontSize: 11, color: P.textFaint, lineHeight: 1.7, fontStyle: "italic", fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif" }}>Your scrapbook is empty.<br/>Add photos to your entries and they'll appear here.</div>
            </div>}
          </div>
        </div>
      )}

      {/* ON THIS DAY — memory from a previous year */}
      {onThisDayEntry && (() => {
        const e = onThisDayEntry;
        const yearsAgo = new Date().getFullYear() - parseInt(e.dateStart.slice(0, 4));
        return (
          <div style={{ position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 45, animation: "fadeIn .8s ease" }}>
            <button onClick={() => {
              setSelected(e); setPhotoIdx(0); setCardTab("overview"); setSliderDate(e.dateStart);
              flyTo(e.lat, e.lng, 2.5); setOnThisDayEntry(null);
            }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: P.card, backdropFilter: "blur(16px)", borderRadius: 16, border: `1px solid ${P.goldWarm}20`, boxShadow: `0 4px 20px rgba(0,0,0,.1), 0 0 30px ${P.goldWarm}08`, cursor: "pointer", fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", maxWidth: "90vw" }}>
              {e.photos?.length > 0 && <img loading="lazy" src={thumbnail(e.photos[0], 72)} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", border: "2px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,.15)" }} />}
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 8, color: P.goldWarm, letterSpacing: ".12em", textTransform: "uppercase" }}>On this day · {yearsAgo} year{yearsAgo > 1 ? "s" : ""} ago</div>
                <div style={{ fontSize: 12, color: P.text, fontStyle: "italic", marginTop: 1 }}>You were in {e.city}</div>
              </div>
              <button onClick={ev => { ev.stopPropagation(); setOnThisDayEntry(null); }} style={{ background: "none", border: "none", color: P.textFaint, fontSize: 14, cursor: "pointer", padding: "0 0 0 4px", lineHeight: 1 }}>×</button>
            </button>
          </div>
        );
      })()}

      {/* UPLOAD INDICATOR */}
      {uploading && (
        <div style={{ position: "absolute", top: 70, left: 0, right: 0, textAlign: "center", zIndex: 50, pointerEvents: "none" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 18px", background: P.card, backdropFilter: "blur(12px)", borderRadius: 20, fontSize: 11, color: P.textMid, letterSpacing: ".1em", boxShadow: "0 4px 16px rgba(0,0,0,.08)" }}>
            <span>📸 Uploading {uploadProgress.total > 1 ? `${uploadProgress.done}/${uploadProgress.total}` : ""}...</span>
            {uploadProgress.total > 1 && <div style={{ width: 60, height: 4, background: "rgba(255,255,255,.1)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%`, height: "100%", background: P.rose, borderRadius: 2, transition: "width .3s ease" }} />
            </div>}
          </div>
        </div>
      )}

      {/* CINEMA OVERLAY — Play Our Story */}
      {isPlaying && cinemaEntry && (() => {
        const ce = cinemaEntry;
        const ct = TYPES[ce.type] || DEFAULT_TYPE;
        const photos = ce.photos || [];
        const hasPhotos = photos.length > 0;
        return (
          <div style={{ position: "absolute", inset: 0, zIndex: 12, pointerEvents: "none" }}>
            {/* Top bar: title + progress */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "12px clamp(12px, 4vw, 24px) 10px", background: `linear-gradient(180deg, ${SC.bg || '#0c0a12'}cc, transparent)`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 8, letterSpacing: ".2em", color: P.goldWarm, textTransform: "uppercase", opacity: 0.7 }}>
                  {isMyWorld ? "My Story" : isPartnerWorld ? "Our Story" : "Our Journey"}
                </div>
                <div style={{ fontSize: 9, color: P.textFaint }}>{cinemaIdx + 1} / {cinemaTotal}</div>
              </div>
              <button onClick={stopPlay} style={{ pointerEvents: "auto", background: P.glass, backdropFilter: "blur(12px)", border: `1px solid ${P.textFaint}20`, borderRadius: 16, padding: "4px 14px", fontSize: 9, color: P.textMid, cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = P.rose} onMouseLeave={e => e.currentTarget.style.borderColor = `${P.textFaint}20`}>
                ⏹ Stop
              </button>
            </div>

            {/* Progress bar */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `${P.textFaint}15`, zIndex: 2 }}>
              <div style={{ height: "100%", background: `linear-gradient(90deg, ${P.goldWarm}, ${P.rose})`, width: `${cinemaProgress * 100}%`, transition: "width .8s ease", borderRadius: "0 1px 1px 0" }} />
            </div>

            {/* Bottom cinema card */}
            <div style={{ position: "absolute", bottom: "max(24px, 5vh)", left: 0, right: 0, display: "flex", justifyContent: "center", padding: "0 4vw" }}>
              <div style={{
                maxWidth: "min(440px, 92vw)", width: "100%", borderRadius: 18, overflow: "hidden",
                background: P.card, backdropFilter: "blur(20px)",
                boxShadow: `0 8px 32px ${SC.bg || '#0c0a12'}50`,
                border: `1px solid ${P.rose}08`,
                opacity: cinemaPhase === 'show' ? 1 : cinemaPhase === 'fly' ? 0 : 0,
                transform: cinemaPhase === 'show' ? 'translateY(0)' : 'translateY(20px)',
                transition: "all .6s cubic-bezier(0.16,1,0.3,1)",
              }}>
                {/* Photo with crossfade */}
                {hasPhotos && (
                  <div style={{ position: "relative", height: "min(180px, 28vh)", overflow: "hidden" }}>
                    {photos.map((url, i) => (
                      <img key={url} src={url} alt="" style={{
                        position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
                        opacity: i === cinemaPhotoIdx ? 1 : 0,
                        transition: "opacity 1s ease",
                      }} />
                    ))}
                    {/* Photo gradient overlay */}
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: `linear-gradient(transparent, ${P.card})` }} />
                    {photos.length > 1 && (
                      <div style={{ position: "absolute", bottom: 8, right: 12, display: "flex", gap: 3, alignItems: "center" }}>
                        {photos.slice(0, 8).map((_, i) => (
                          <div key={"cdot-" + i} style={{ width: 4, height: 4, borderRadius: 2, background: i === cinemaPhotoIdx ? P.goldWarm : `${P.textFaint}40`, transition: "background .4s" }} />
                        ))}
                        {photos.length > 8 && <div style={{ fontSize: 10, color: `${P.textFaint}60`, marginLeft: 1 }}>+{photos.length - 8}</div>}
                      </div>
                    )}
                  </div>
                )}

                {/* Entry info */}
                <div style={{ padding: hasPhotos ? "8px clamp(12px, 4vw, 20px) 14px" : "16px clamp(12px, 4vw, 20px) 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, minWidth: 0 }}>
                    <span style={{ fontSize: "clamp(20px, 5vw, 26px)", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.15))", flexShrink: 0 }}>{ct.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "clamp(14px, 4vw, 18px)", fontWeight: 400, color: P.text, letterSpacing: ".02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ce.city}</div>
                      <div style={{ fontSize: "clamp(9px, 2.5vw, 10px)", color: P.textMuted, letterSpacing: ".03em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {fmtDate(ce.dateStart)}{ce.dateEnd && ce.dateEnd !== ce.dateStart ? ` → ${fmtDate(ce.dateEnd)}` : ""}{ce.country ? `  ·  ${ce.country}` : ""}
                      </div>
                    </div>
                  </div>
                  {ce.notes && <p style={{ fontSize: "clamp(10px, 2.8vw, 11px)", color: P.textMid, margin: "6px 0 0", lineHeight: 1.6, maxHeight: 36, overflow: "hidden", opacity: 0.85 }}>{ce.notes}</p>}
                  {ce.loveNote && isPartnerWorld && <p style={{ fontSize: "clamp(9px, 2.5vw, 10px)", color: P.heart, margin: "4px 0 0", fontStyle: "italic", opacity: 0.8 }}>"{ce.loveNote}"</p>}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* DREAM DESTINATIONS PANEL */}
      {showDreams && (() => {
        const dreams = config.dreamDestinations || [];
        const visitedCount = config.dreamsVisited || 0;
        const totalDreams = dreams.length + visitedCount;
        const progressPct = totalDreams > 0 ? Math.round((visitedCount / totalDreams) * 100) : 0;
        const catMap = {};
        DREAM_CATEGORIES.forEach(c => { catMap[c.key] = c; });
        return (
        <div role="dialog" aria-modal="true" aria-label="Dream destinations" onClick={() => setShowDreams(false)} style={{ position: "absolute", inset: 0, zIndex: 45, background: `linear-gradient(135deg, rgba(22,16,40,.82), rgba(30,24,48,.88))`, backdropFilter: "blur(24px)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", animation: "fadeIn .4s ease" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 440, maxWidth: "92vw", maxHeight: "85vh", overflowY: "auto", padding: 32, background: P.card, borderRadius: 22, boxShadow: "0 1px 3px rgba(61,53,82,.04), 0 8px 24px rgba(61,53,82,.06), 0 24px 64px rgba(61,53,82,.1)", cursor: "default" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 400, letterSpacing: ".08em" }}>{isMyWorld ? "🗺 Bucket List" : "✦ Dream Destinations"}</h2>
              <button aria-label="Close dreams" onClick={() => setShowDreams(false)} style={{ background: "none", border: "none", fontSize: 18, color: P.textFaint, cursor: "pointer", transition: "color .2s" }}>×</button>
            </div>

            {/* Progress bar */}
            {totalDreams > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: P.textFaint, fontStyle: "italic" }}>{visitedCount} of {totalDreams} dreams realized</span>
                  <span style={{ fontSize: 10, color: P.goldWarm, fontWeight: 500 }}>{progressPct}%</span>
                </div>
                <div style={{ height: 4, background: `${P.textFaint}15`, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progressPct}%`, background: `linear-gradient(90deg, ${P.goldWarm}, ${P.rose})`, borderRadius: 2, transition: "width .6s ease" }} />
                </div>
              </div>
            )}

            <p style={{ fontSize: 10, color: P.textFaint, marginBottom: 14, fontStyle: "italic" }}>{isMyWorld ? "Places on your bucket list. They appear as golden ghost markers on the globe." : "Places you dream of visiting together. They appear as golden ghost markers on the globe."}</p>

            {dreams.map((dream) => {
              const cat = dream.category ? catMap[dream.category] : null;
              const hasTarget = !!dream.targetDate;
              const daysUntil = hasTarget ? Math.ceil((new Date(dream.targetDate) - new Date()) / 86400000) : null;
              return (
              <div key={dream.id} style={{ padding: "10px 12px", background: `${P.gold}08`, borderRadius: 10, marginBottom: 6, borderLeft: `3px solid ${P.goldWarm}40` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{cat ? cat.icon : "✦"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 400 }}>{dream.city}</div>
                    <div style={{ fontSize: 9, color: P.textFaint, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span>{dream.country}</span>
                      {cat && <span style={{ padding: "1px 5px", background: `${P.goldWarm}12`, borderRadius: 6, fontSize: 8 }}>{cat.label}</span>}
                      {hasTarget && <span style={{ color: daysUntil > 0 ? P.textMuted : P.heart, fontSize: 8 }}>{daysUntil > 0 ? `${daysUntil}d away` : daysUntil === 0 ? "Today!" : "Past target"}</span>}
                    </div>
                    {dream.notes && <div style={{ fontSize: 9, color: P.textMuted, marginTop: 2, fontStyle: "italic" }}>{dream.notes}</div>}
                  </div>
                  {!isViewer && (<>
                    <button onClick={() => {
                      const defaultType = isMyWorld ? "adventure" : isPartnerWorld ? "together" : worldType === "friends" ? "group-trip" : worldType === "family" ? "family-trip" : "together";
                      const defaultWho = isMyWorld ? "solo" : isPartnerWorld ? "both" : "group";
                      const entry = { id: `e${Date.now()}`, city: dream.city, country: dream.country, lat: dream.lat, lng: dream.lng, dateStart: todayStr(), type: defaultType, who: defaultWho, notes: dream.notes || "", memories: [], museums: [], restaurants: [], highlights: [], photos: [], stops: [] };
                      dispatch({ type: "ADD", entry });
                      setConfig({ dreamDestinations: dreams.filter(d => d.id !== dream.id), dreamsVisited: visitedCount + 1 });
                      showToast(`${dream.city} is now real! ✨`, "🎉", 3000);
                      setShowDreams(false);
                      flyTo(dream.lat, dream.lng, 2.5);
                      setTimeout(() => { setSelected(entry); setPhotoIdx(0); setCardTab("overview"); }, 400);
                    }} style={{ background: P.rose, color: "#fff", border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 8, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>✓ Visited!</button>
                    <button onClick={() => setConfig({ dreamDestinations: dreams.filter(d => d.id !== dream.id) })} style={{ background: "none", border: "none", color: P.textFaint, cursor: "pointer", fontSize: 12 }}>×</button>
                  </>)}
                </div>
              </div>
              );
            })}

            {dreams.length === 0 && <div style={{ textAlign: "center", padding: "24px 0", color: P.textFaint, fontSize: 11 }}>{isMyWorld ? "No bucket list items yet" : "No dream destinations yet"}{visitedCount > 0 && <div style={{ marginTop: 6, fontSize: 10, color: P.goldWarm }}>🎉 All {visitedCount} dreams realized!</div>}</div>}

            {!isViewer && <DreamAddForm isMyWorld={isMyWorld} onAdd={dream => {
              setConfig({ dreamDestinations: [...dreams, { ...dream, id: `d${Date.now()}` }] });
              showToast(isMyWorld ? `${dream.city} added to bucket list 🗺` : `${dream.city} added to dreams ✦`, "✦", 2000);
            }} />}
          </div>
        </div>
        );
      })()}

      {showSettings && !isViewer && (
        <SettingsPanel
          config={config}
          onConfigChange={setConfig}
          palette={P}
          worldType={worldType}
          isMyWorld={isMyWorld}
          isPartnerWorld={isPartnerWorld}
          isSharedWorld={isSharedWorld}
          worldId={worldId}
          userId={userId}
          members={worldMembers}
          setMembers={setWorldMembers}
          worldRole={worldRole}
          worldName={worldName}
          onClose={() => setShowSettings(false)}
          showToast={showToast}
          flushConfigSave={flushConfigSave}
          handwrittenMode={handwrittenMode}
          setHandwrittenMode={setHandwrittenMode}
          ambientRef={ambientRef}
          ambientPlaying={ambientPlaying}
          exportData={exportData}
          importData={importData}
          onSwitchWorld={onSwitchWorld}
          setShowOnboarding={setShowOnboarding}
          setOnboardStep={setOnboardStep}
          onboardKey={onboardKey}
          setConfirmModal={setConfirmModal}
        />
      )}

      {data.entries.length === 0 && introComplete && !showAdd && (() => {
        const emptyMsg = {
          partner: { icon: "💫", title: "Your story begins here", desc: "Add your first memory together to bring your shared world to life.", hint: "Every pin on this globe is a chapter in your story." },
          friends: { icon: "🗺", title: "Adventures await", desc: "Add your first trip to start mapping your crew's adventures together.", hint: "Track every road trip, festival, and reunion." },
          family:  { icon: "🏡", title: "Every journey starts here", desc: "Add your first memory to start building your family's travel story.", hint: "From weekend getaways to dream vacations." },
        };
        const msg = isMyWorld
          ? { icon: "🌍", title: "Your world awaits", desc: "Add your first trip to start building your personal travel map.", hint: "Track every adventure, from weekend escapes to distant horizons." }
          : emptyMsg[worldType] || emptyMsg.partner;
        return (
          <div style={{ position: "absolute", top: "46%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 12, textAlign: "center", maxWidth: 380, animation: "fadeIn 1.2s ease" }}>
            <div style={{ position: "relative", width: 110, height: 110, margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(circle, ${P.rose}18, transparent 70%)`, animation: "heartPulse 3s ease-in-out infinite" }} />
              <div style={{ position: "absolute", inset: 6, borderRadius: "50%", border: `1px dashed ${P.rose}20`, animation: "emptyOrbit 12s linear infinite" }} />
              <div style={{ position: "absolute", inset: 16, borderRadius: "50%", border: `1px dashed ${P.sky}15`, animation: "emptyOrbit 8s linear infinite reverse" }} />
              <div style={{ position: "absolute", inset: 28, borderRadius: "50%", border: `1px dashed ${P.gold}10`, animation: "emptyOrbit 16s linear infinite" }} />
              <div style={{ fontSize: 44, position: "relative", zIndex: 1, animation: "emptyFloat 4s ease-in-out infinite" }}>{msg.icon}</div>
            </div>
            <div style={{ fontSize: 22, color: P.text, letterSpacing: ".06em", fontWeight: 500, opacity: 0.9 }}>{msg.title}</div>
            <div style={{ fontSize: 13, color: P.textMuted, marginTop: 10, lineHeight: 1.8, letterSpacing: ".04em", maxWidth: 320, margin: "10px auto 0" }}>{msg.desc}</div>
            {!isViewer && (
              <button onClick={() => setShowAdd(true)} style={{
                marginTop: 24, padding: "13px 32px", background: `linear-gradient(135deg, ${P.rose}35, ${P.sky}35)`,
                border: `1px solid ${P.rose}20`, borderRadius: 24, color: P.text, fontSize: 13,
                fontFamily: "inherit", cursor: "pointer", letterSpacing: ".06em", transition: "all .3s",
                boxShadow: `0 2px 12px ${P.rose}15, 0 4px 20px ${P.sky}10`,
              }}
              onMouseEnter={e => { e.target.style.background = `linear-gradient(135deg, ${P.rose}50, ${P.sky}50)`; e.target.style.transform = "translateY(-1px)"; e.target.style.boxShadow = `0 4px 16px ${P.rose}25, 0 8px 28px ${P.sky}15`; }}
              onMouseLeave={e => { e.target.style.background = `linear-gradient(135deg, ${P.rose}35, ${P.sky}35)`; e.target.style.transform = "none"; e.target.style.boxShadow = `0 2px 12px ${P.rose}15, 0 4px 20px ${P.sky}10`; }}>
                + {isMyWorld ? "Add Your First Trip" : worldType === "friends" ? "Add Your First Trip" : "Add Your First Memory"}
              </button>
            )}
            <div style={{ fontSize: 11, color: P.textFaint, marginTop: 20, letterSpacing: ".05em", lineHeight: 1.6, opacity: 0.7, fontStyle: "italic" }}>{msg.hint}</div>
            {!isMobile && !isViewer && (
              <div style={{ fontSize: 9, color: P.textFaint, marginTop: 16, letterSpacing: ".08em", opacity: 0.4 }}>
                press <span style={{ background: `${P.rose}12`, padding: "2px 6px", borderRadius: 4, fontSize: 8 }}>N</span> to quick-add &nbsp;·&nbsp; <span style={{ background: `${P.rose}12`, padding: "2px 6px", borderRadius: 4, fontSize: 8 }}>?</span> for shortcuts
              </div>
            )}
          </div>
        );
      })()}

      {/* STATS DASHBOARD */}
      {showStats && <StatsOverlay P={P} stats={stats} expandedStats={expandedStats} reunionStats={reunionStats} milestones={milestones} isMyWorld={isMyWorld} isPartnerWorld={isPartnerWorld} fmtDate={fmtDate} startRecap={startRecap} onClose={() => setShowStats(false)} setTripCardEntry={setTripCardEntry} />}

      {/* YEAR-IN-REVIEW RECAP — Full-screen cinematic */}
      {showRecap && recapEntries.length > 0 && recapYearStats && <RecapOverlay
        P={P} SC={SC} TYPES={TYPES} DEFAULT_TYPE={DEFAULT_TYPE} thumbnail={thumbnail} fmtDate={fmtDate} navStyle={navStyle}
        recapYear={recapYear} recapYearStats={recapYearStats} recapEntries={recapEntries}
        recapPhase={recapPhase} recapIdx={recapIdx} recapStatIdx={recapStatIdx} recapAutoPlay={recapAutoPlay}
        setRecapPhase={setRecapPhase} setRecapIdx={setRecapIdx} setRecapStatIdx={setRecapStatIdx} setRecapAutoPlay={setRecapAutoPlay}
        setSliderDate={setSliderDate} setSelected={setSelected} setPhotoIdx={setPhotoIdx} setCardTab={setCardTab} setTripCardEntry={setTripCardEntry}
        onClose={() => { setShowRecap(false); setRecapYear(null); setRecapAutoPlay(false); setRecapPhase('title'); }} flyTo={flyTo}
      />}

      {/* TOAST NOTIFICATIONS (stacked) */}
      <div aria-live="polite" role="status" style={{ position: "absolute", bottom: 120, left: "50%", transform: "translateX(-50%)", zIndex: 55, display: toasts.length > 0 ? "flex" : "none", flexDirection: "column-reverse", gap: 6, alignItems: "center", maxHeight: "30vh", overflow: "hidden", maxWidth: "90vw" }}>
          {toasts.map((t, i) => (
            <div key={t.key} style={{ pointerEvents: t.undoAction ? "auto" : "none", animation: t.exiting ? undefined : "fadeIn .3s ease", opacity: t.exiting ? 0 : (i < toasts.length - 1 ? 0.7 : 1), transform: `scale(${t.exiting ? 0.9 : (i < toasts.length - 1 ? 0.95 : 1)})${t.exiting ? " translateY(8px)" : ""}`, transition: "opacity .3s, transform .3s" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", background: P.card, backdropFilter: "blur(16px)", borderRadius: 24, boxShadow: "0 4px 20px rgba(0,0,0,.1)", border: `1px solid ${P.rose}15`, fontSize: 12, color: P.text, letterSpacing: ".05em", whiteSpace: "nowrap" }}>
                <span>{t.icon}</span>
                <span>{t.message}</span>
                {t.undoAction && <button onClick={() => handleUndo(t)} style={{ marginLeft: 6, padding: "2px 8px", background: P.sky, color: "#fff", border: "none", borderRadius: 12, fontSize: 9, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>Undo</button>}
              </div>
            </div>
          ))}
      </div>

      {/* ON THIS DAY — scrapbook card */}
      {onThisDay.length > 0 && introComplete && !showStats && !showRecap && toasts.length === 0 && !selected && !editing && !showAdd && !dismissOnThisDay && (() => {
        const mem = onThisDay[0];
        const typeInfo = TYPES[mem.type] || DEFAULT_TYPE;
        const yearsLabel = mem.yearsAgo === 1 ? "1 year ago" : `${mem.yearsAgo} years ago`;
        const hasPhoto = mem.photos && mem.photos.length > 0;
        return (
          <div style={{ position: "absolute", bottom: 140, left: 20, zIndex: 12, maxWidth: 280, background: P.card + "ee", backdropFilter: "blur(16px)", border: `1px solid ${P.gold}25`, borderRadius: 16, padding: "14px 16px", boxShadow: "0 4px 24px rgba(0,0,0,.10)", animation: "onThisDaySlideUp .5s ease both", fontFamily: "inherit" }}>
            {/* Dismiss button */}
            <button onClick={() => setDismissOnThisDay(true)} style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", color: P.textFaint, cursor: "pointer", fontSize: 14, padding: "2px 4px", lineHeight: 1, fontFamily: "inherit" }} aria-label="Dismiss">×</button>
            {/* Header */}
            <div style={{ fontSize: 10, fontVariant: "all-small-caps", letterSpacing: ".12em", color: P.gold, marginBottom: 8 }}>💫 On This Day</div>
            {/* Entry row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {hasPhoto && (
                <img src={thumbnail(mem.photos[0], 96)} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: `1px solid ${P.gold}20` }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9, color: P.textMuted, letterSpacing: ".05em", marginBottom: 2 }}>{yearsLabel}</div>
                <div style={{ fontSize: 13, color: P.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {typeInfo.icon} {mem.city}{mem.country ? `, ${mem.country}` : ""}
                </div>
              </div>
            </div>
            {/* More memories count */}
            {onThisDay.length > 1 && (
              <div style={{ fontSize: 9, color: P.textMuted, marginTop: 8, letterSpacing: ".04em" }}>+{onThisDay.length - 1} more {onThisDay.length - 1 === 1 ? "memory" : "memories"}</div>
            )}
            {/* Revisit button */}
            <button onClick={() => {
              const entry = data.entries.find(e => e.id === mem.id);
              if (entry) {
                setSelected(entry); setPhotoIdx(0); setCardTab("overview");
                setSliderDate(entry.dateStart);
                flyTo(entry.lat, entry.lng, 2.5);
              }
              setDismissOnThisDay(true);
            }} style={{ marginTop: 10, width: "100%", padding: "6px 0", background: P.rose, color: "#fff", border: "none", borderRadius: 10, fontSize: 10, fontWeight: 600, letterSpacing: ".06em", cursor: "pointer", fontFamily: "inherit", transition: "opacity .2s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >Revisit</button>
          </div>
        );
      })()}

      {/* ONBOARDING OVERLAY */}
      {showOnboarding && introComplete && <OnboardingOverlay worldName={worldName} worldType={worldType} isSharedWorld={isSharedWorld} isPartnerWorld={isPartnerWorld} isMyWorld={isMyWorld} onboardStep={onboardStep} setOnboardStep={setOnboardStep} onClose={() => setShowOnboarding(false)} onboardKey={onboardKey} startDate={config.startDate} onStartDateChange={(d) => { setConfig(prev => ({ ...prev, startDate: d })); db.saveConfig({ ...config, startDate: d }); }} />}


      {/* FIRST ENTRY CELEBRATION */}
      {showCelebration && (() => {
        const cd = celebrationData || { type: 'first', message: 'Your First Entry!', sub: '' };
        const isAnniv = cd.type === 'anniversary';
        const isMilestone = cd.type === 'milestone';
        const showConfetti = isAnniv || isMilestone;
        const celebIcon = isAnniv ? "💕" : isMilestone ? (cd.message.includes("Countries") ? "🗺" : cd.message.includes("Miles") ? "🚀" : "✨") : "✨";
        const accentColor = isAnniv ? P.heart : isMilestone ? P.goldWarm : P.goldWarm;
        return (
          <div role="alert" aria-label="Celebration" style={{ position: "fixed", inset: 0, zIndex: 250, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "auto", cursor: "pointer", background: showConfetti ? `radial-gradient(ellipse at center, ${accentColor}15, transparent 70%)` : 'transparent', animation: "fadeIn .4s ease" }}
            onClick={() => setShowCelebration(false)}>
            {/* Confetti particles */}
            {showConfetti && Array.from({ length: isMilestone ? 16 : 24 }, (_, i) => (
              <div key={"confetti-" + i} style={{
                position: "absolute",
                left: `${10 + Math.random() * 80}%`,
                top: "-5%",
                width: 6 + Math.random() * 6,
                height: 6 + Math.random() * 6,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
                background: [P.heart, P.goldWarm, P.rose, P.sky, P.lavender, '#f0c0d0'][i % 6],
                opacity: 0.8,
                animation: `confettiFall ${2 + Math.random() * 3}s ${Math.random() * 1.5}s ease-in forwards`,
              }} />
            ))}
            <div style={{ textAlign: "center", animation: "celebrationPop .6s cubic-bezier(0.34, 1.56, 0.64, 1)", zIndex: 1 }}>
              <div style={{ fontSize: isAnniv ? 80 : 64, marginBottom: 12, filter: `drop-shadow(0 0 20px ${accentColor}60)`, animation: isAnniv ? "heartPulse 1.5s ease infinite" : "none" }}>
                {celebIcon}
              </div>
              <div style={{ fontSize: isAnniv ? 28 : isMilestone ? 24 : 22, fontWeight: isAnniv ? 300 : 500, color: P.text, letterSpacing: isAnniv ? ".12em" : "1px", textShadow: `0 0 30px ${accentColor}40, 0 2px 10px rgba(0,0,0,0.6)`, marginBottom: 8, fontFamily: "'Palatino Linotype', Georgia, serif" }}>
                {cd.message}
              </div>
              {cd.sub && <div style={{ fontSize: 12, color: P.textMid, lineHeight: 1.7, maxWidth: 320, margin: "0 auto", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>{cd.sub}</div>}
              {isAnniv && config.startDate && (
                <div style={{ fontSize: 10, color: P.textFaint, marginTop: 12, letterSpacing: ".1em" }}>
                  Since {fmtDate(config.startDate)}
                </div>
              )}
              <div style={{ fontSize: 9, color: P.textFaint, marginTop: 16, opacity: 0.5 }}>tap anywhere to continue</div>
            </div>
          </div>
        );
      })()}
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes celebrationPop {
          0% { transform: scale(0.3); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes emptyOrbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes emptyFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      `}</style>

      {/* PHOTO JOURNEY MODE */}
      {showPhotoJourney && allPhotos.length > 0 && (() => {
        const ph = allPhotos[pjIndex];
        const prevPh = pjIndex > 0 ? allPhotos[pjIndex - 1] : null;
        const entry = sorted.find(e => e.id === ph.id);
        const note = entry?.notes || '';
        const caption = entry?.photoCaptions?.[ph.url] || '';
        return (
          <div role="dialog" aria-modal="true" aria-label="Photo journey" style={{ position: "fixed", inset: 0, zIndex: 200, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => { if (pjAutoPlay) { setPjAutoPlay(false); } else if (pjIndex < allPhotos.length - 1) setPjIndex(i => i + 1); else { setShowPhotoJourney(false); setPjAutoPlay(false); } }}>
            {/* Crossfade: previous image fades out behind current */}
            {prevPh && <img src={prevPh.url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: 0, transition: "opacity 0.8s ease", pointerEvents: "none" }} />}
            <img key={ph.url} src={ph.url} alt="Travel photo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", animation: "fadeIn .8s ease", transition: "opacity .8s ease" }} />
            {/* Bottom info overlay */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.85))", padding: "60px 24px 28px", pointerEvents: "none" }}>
              <div style={{ fontSize: 18, color: "#e8e0d0", fontFamily: "'Palatino Linotype',serif", letterSpacing: ".08em", textShadow: "0 2px 12px rgba(0,0,0,0.8)", textAlign: "center" }}>{ph.city}</div>
              <div style={{ fontSize: 11, color: "#a098a8", marginTop: 4, textShadow: "0 1px 8px rgba(0,0,0,0.8)", textAlign: "center" }}>{ph.date}{ph.country ? ` · ${ph.country}` : ''}</div>
              {caption && <div style={{ fontSize: 14, color: "#e8dcc8", marginTop: 10, textAlign: "center", maxWidth: 420, margin: "10px auto 0", lineHeight: 1.5, fontStyle: "italic", fontFamily: "'Palatino Linotype',serif", letterSpacing: ".04em", opacity: 0.95 }}>{caption}</div>}
              {note && <div style={{ fontSize: 11, color: "#c8c0b0", marginTop: caption ? 6 : 10, textAlign: "center", maxWidth: 400, margin: `${caption ? 6 : 10}px auto 0`, lineHeight: 1.6, fontStyle: "italic", opacity: 0.85 }}>"{note}"</div>}
            </div>
            {/* Progress bar */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.1)" }}>
              <div style={{ height: "100%", width: `${((pjIndex + 1) / allPhotos.length) * 100}%`, background: `linear-gradient(90deg, ${P.goldWarm}, ${P.rose || P.accent})`, transition: "width .5s ease" }} />
            </div>
            {/* Counter + auto-play toggle */}
            <div style={{ position: "absolute", top: 14, right: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={(e) => { e.stopPropagation(); setPjAutoPlay(a => !a); }}
                style={{ background: pjAutoPlay ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)", border: "none", borderRadius: 6, padding: "5px 10px", color: pjAutoPlay ? "#e8e0d0" : "#686070", fontSize: 11, cursor: "pointer", fontFamily: "inherit", transition: "all .3s" }}>
                {pjAutoPlay ? "⏸ Pause" : "▶ Auto"}
              </button>
              <span style={{ fontSize: 11, color: "#686070" }}>{pjIndex + 1} / {allPhotos.length}</span>
            </div>
            {/* Close */}
            <button onClick={(e) => { e.stopPropagation(); setShowPhotoJourney(false); setPjAutoPlay(false); }}
              style={{ position: "absolute", top: 12, left: 16, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: "6px 14px", color: "#a098a8", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>
              ✕ Close
            </button>
            {/* Navigation arrows */}
            {pjIndex > 0 && (
              <button onClick={(e) => { e.stopPropagation(); setPjIndex(i => i - 1); }}
                style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 44, height: 44, color: "#e8e0d0", fontSize: 18, cursor: "pointer", transition: "background .2s" }}>
                &#9664;
              </button>
            )}
            {pjIndex < allPhotos.length - 1 && (
              <button onClick={(e) => { e.stopPropagation(); setPjIndex(i => i + 1); }}
                style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 44, height: 44, color: "#e8e0d0", fontSize: 18, cursor: "pointer", transition: "background .2s" }}>
                &#9654;
              </button>
            )}
          </div>
        );
      })()}

      {/* EASTER EGG — visible when zoomed all the way out (partner worlds only) */}
      {isPartnerWorld && isSharedWorld && (
        <div ref={easterEggRef} style={{ position: "absolute", top: "12%", left: "50%", transform: "translateX(-50%)", zIndex: 5, textAlign: "center", pointerEvents: "none", opacity: 0, transition: "opacity .8s" }}>
          <div style={{ fontSize: 14, color: "#c9a96e", letterSpacing: "6px", fontWeight: 300, textShadow: "0 0 20px rgba(200,170,110,0.4), 0 0 40px rgba(200,170,110,0.2)", fontFamily: "'Palatino Linotype',serif" }}>
            you are my world
          </div>
        </div>
      )}

      {/* KEYBOARD SHORTCUTS OVERLAY */}
      {showShortcuts && <Suspense fallback={<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(8,6,18,0.7)",backdropFilter:"blur(8px)"}}><div style={{color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Palatino Linotype',Georgia,serif",letterSpacing:".05em"}}>Loading…</div></div>}><KeyboardShortcuts onClose={() => setShowShortcuts(false)} palette={P} worldMode={worldMode} /></Suspense>}


      {/* LAZY-LOADED OVERLAYS — code-split, only fetched when opened */}
      {showPhotoMap && <OverlayBoundary onClose={() => setShowPhotoMap(false)}><Suspense fallback={<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(8,6,18,0.7)",backdropFilter:"blur(8px)"}}><div style={{color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Palatino Linotype',Georgia,serif",letterSpacing:".05em"}}>Loading…</div></div>}><PhotoMap entries={data.entries} palette={P} onClose={() => setShowPhotoMap(false)} worldMode={worldMode} /></Suspense></OverlayBoundary>}
      {showMilestones && <OverlayBoundary onClose={() => setShowMilestones(false)}><Suspense fallback={<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(8,6,18,0.7)",backdropFilter:"blur(8px)"}}><div style={{color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Palatino Linotype',Georgia,serif",letterSpacing:".05em"}}>Loading…</div></div>}><Milestones entries={data.entries} palette={P} onClose={() => setShowMilestones(false)} worldMode={worldMode} config={config} /></Suspense></OverlayBoundary>}
      {showTravelStats && <OverlayBoundary onClose={() => setShowTravelStats(false)}><Suspense fallback={<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(8,6,18,0.7)",backdropFilter:"blur(8px)"}}><div style={{color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Palatino Linotype',Georgia,serif",letterSpacing:".05em"}}>Loading…</div></div>}><TravelStats entries={data.entries} stats={stats} palette={P} onClose={() => setShowTravelStats(false)} worldMode={worldMode} config={config} /></Suspense></OverlayBoundary>}
      {showExportHub && <OverlayBoundary onClose={() => setShowExportHub(false)}><Suspense fallback={<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(8,6,18,0.7)",backdropFilter:"blur(8px)"}}><div style={{color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Palatino Linotype',Georgia,serif",letterSpacing:".05em"}}>Loading…</div></div>}><ExportHub entries={data.entries} config={config} stats={stats} palette={P} onClose={() => setShowExportHub(false)} worldMode={worldMode} travelerName={isPartnerWorld ? (config.youName || '') : (config.travelerName || '')} onImport={!isViewer ? (entries) => {
                let count = 0;
                entries.forEach(entry => {
                  const id = entry.id || `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                  dispatch({ type: "ADD", entry: { ...entry, id } });
                  count++;
                });
                showToast(`Imported ${count} entries`, "📥", 4000);
                setShowExportHub(false);
              } : undefined} /></Suspense></OverlayBoundary>}
      {tripCardEntry && <OverlayBoundary onClose={() => setTripCardEntry(null)}><Suspense fallback={<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(8,6,18,0.7)",backdropFilter:"blur(8px)"}}><div style={{color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Palatino Linotype',Georgia,serif",letterSpacing:".05em"}}>Loading…</div></div>}><TripCard entry={tripCardEntry} palette={P} onClose={() => setTripCardEntry(null)} worldMode={worldMode} /></Suspense></OverlayBoundary>}
      {showYearReview && <OverlayBoundary onClose={() => setShowYearReview(false)}><Suspense fallback={<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(8,6,18,0.7)",backdropFilter:"blur(8px)"}}><div style={{color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Palatino Linotype',Georgia,serif",letterSpacing:".05em"}}>Loading…</div></div>}><YearInReview entries={data.entries} stats={stats} palette={P} onClose={() => setShowYearReview(false)} worldMode={worldMode} config={config} /></Suspense></OverlayBoundary>}

      {/* ENTRY TEMPLATES */}
      {showTemplates && <EntryTemplates palette={P} worldType={isMyWorld ? "my" : (worldType || "partner")} onApplyTemplate={tpl => {
        setShowTemplates(false);
        // Create a pre-filled entry from the template
        const entry = { id: `e-${Date.now()}`, city: "", country: tpl.country || "", lat: 0, lng: 0, dateStart: todayStr(), dateEnd: "", type: tpl.type || "adventure", who: isMyWorld ? "solo" : "both", notes: tpl.notes || "", highlights: [...(tpl.highlights || [])], museums: [...(tpl.museums || [])], restaurants: [...(tpl.restaurants || [])], photos: [], favorite: false };
        setEditing(entry);
        showToast(`Template "${tpl.name || "entry"}" applied — fill in the details`, "📋", 3000);
      }} onClose={() => setShowTemplates(false)} />}

      {/* TRIP JOURNAL */}
      {showTripJournal && <Suspense fallback={null}><TripJournal entries={data.entries} palette={P} types={TYPES} onClose={() => setShowTripJournal(false)} onSelectEntry={e => { setShowTripJournal(false); setSelected(e); setPhotoIdx(0); setCardTab("overview"); }} flyTo={flyTo} /></Suspense>}

      {/* RECENTLY DELETED TRASH */}
      {showTrash && (
        <div role="dialog" aria-modal="true" aria-label="Recently deleted entries" onClick={() => setShowTrash(false)} style={{ position: "fixed", inset: 0, zIndex: 310, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .2s ease" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: P.card, borderRadius: 16, padding: "24px 28px", maxWidth: 400, width: "90vw", maxHeight: "70vh", overflowY: "auto", border: `1px solid ${P.rose}20`, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: P.text }}>🗑 Recently Deleted</div>
              <button onClick={() => setShowTrash(false)} style={{ background: "none", border: "none", color: P.textFaint, fontSize: 18, cursor: "pointer" }}>×</button>
            </div>
            <p style={{ fontSize: 10, color: P.textFaint, margin: "0 0 12px", letterSpacing: ".04em" }}>Entries are kept for 30 days. Click to restore.</p>
            {recentlyDeleted.length === 0 && <p style={{ fontSize: 12, color: P.textMuted, textAlign: "center", padding: "20px 0", fontStyle: "italic" }}>Trash is empty</p>}
            {recentlyDeleted.map(t => {
              const daysLeft = Math.max(1, Math.ceil((30 * 24 * 60 * 60 * 1000 - (Date.now() - t.deletedAt)) / (24 * 60 * 60 * 1000)));
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: `${P.rose}08`, border: `1px solid ${P.rose}12`, marginBottom: 6, cursor: "pointer", transition: "background .15s" }}
                  onClick={() => {
                    dispatch({ type: "ADD", entry: { ...t, deletedAt: undefined }, _skipUndo: true });
                    const updated = recentlyDeleted.filter(x => x.id !== t.id);
                    setRecentlyDeleted(updated);
                    localStorage.setItem(`cosmos_trash_${worldId || worldMode}`, JSON.stringify(updated));
                    showToast(`${t.city} restored!`, "↩️", 2500);
                    if (updated.length === 0) setShowTrash(false);
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = `${P.rose}18`}
                  onMouseLeave={e => e.currentTarget.style.background = `${P.rose}08`}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{(TYPES[t.type] || {}).icon || "📍"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.city}{t.country ? `, ${t.country}` : ""}</div>
                    <div style={{ fontSize: 9, color: P.textFaint }}>{fmtDate(t.dateStart)} · {daysLeft}d left</div>
                  </div>
                  <span style={{ fontSize: 9, color: P.rose, fontWeight: 500 }}>Restore</span>
                </div>
              );
            })}
            {recentlyDeleted.length > 0 && (
              <button onClick={() => {
                setRecentlyDeleted([]);
                localStorage.removeItem(`cosmos_trash_${worldId || worldMode}`);
                showToast("Trash emptied", "🗑", 2000);
                setShowTrash(false);
              }} style={{ marginTop: 10, width: "100%", padding: "8px", background: "transparent", border: `1px solid ${P.textFaint}30`, borderRadius: 8, cursor: "pointer", fontSize: 10, color: P.textFaint, fontFamily: "inherit" }}>Empty Trash Permanently</button>
            )}
          </div>
        </div>
      )}

      {/* CONFIRM MODAL — replaces browser confirm() */}
      {confirmModal && (
        <div role="dialog" aria-modal="true" aria-label="Confirm action" style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .2s ease" }}
          onClick={() => setConfirmModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: P.card, borderRadius: 16, padding: "24px 28px", maxWidth: 360, width: "90%", boxShadow: "0 12px 48px rgba(0,0,0,.25)", border: `1px solid ${P.rose}15`, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: P.text, lineHeight: 1.6, marginBottom: 20, fontFamily: "inherit" }}>{confirmModal.message}</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setConfirmModal(null)} style={{ padding: "8px 20px", background: "transparent", border: `1px solid ${P.textFaint}30`, borderRadius: 10, color: P.textMuted, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={() => { const cb = confirmModal.onConfirm; setConfirmModal(null); cb(); }} style={{ padding: "8px 20px", background: `${P.rose}18`, border: `1px solid ${P.rose}30`, borderRadius: 10, color: P.rose, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes onThisDaySlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes cardIn{from{opacity:0;transform:translateY(-50%) translateX(18px)}to{opacity:1;transform:translateY(-50%) translateX(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes heartPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
        @keyframes lbFadeOpacity{from{opacity:0}to{opacity:1}}
        @keyframes kenBurns{0%{transform:scale(1) translate(0,0)}100%{transform:scale(1.04) translate(-0.5%,-0.3%)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes heartFloat0{0%{opacity:1;transform:translate(-50%,-50%)}100%{opacity:0;transform:translate(-14px,-28px) scale(1.2)}}
        @keyframes heartFloat1{0%{opacity:1;transform:translate(-50%,-50%)}100%{opacity:0;transform:translate(10px,-26px) scale(0.9)}}
        @keyframes heartFloat2{0%{opacity:1;transform:translate(-50%,-50%)}100%{opacity:0;transform:translate(-6px,-32px) scale(1.1)}}
        @keyframes heartFloat3{0%{opacity:1;transform:translate(-50%,-50%)}100%{opacity:0;transform:translate(16px,-20px) scale(0.8)}}
        @keyframes heartFloat4{0%{opacity:1;transform:translate(-50%,-50%)}100%{opacity:0;transform:translate(-18px,-22px) scale(1.0)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${P.textFaint}22;border-radius:2px}
        input:focus:not(:focus-visible),textarea:focus:not(:focus-visible),select:focus:not(:focus-visible){outline:none;border-color:${P.rose}!important}
        input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid var(--accent,${P.rose});outline-offset:2px;border-color:${P.rose}!important}
        button,a,[role="button"],[data-action]{cursor:pointer!important}
        input,textarea{cursor:text}
        select{cursor:pointer}
        input[type=range]{-webkit-appearance:none;appearance:none}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:${P.rose};cursor:pointer;border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.2);margin-top:-9px}
        input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:2px}
        input[type=range]::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:${P.rose};cursor:pointer;border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.2)}
        @media(max-width:600px){
          h1{font-size:20px!important;letter-spacing:.12em!important}
          h1+p{font-size:11px!important}
        }
      `}</style>
    </div>
  );
}

// ---- WRAPPED EXPORT WITH ERROR BOUNDARY ----
export default function OurWorld({ worldMode, worldId, worldName, worldRole, worldType, onSwitchWorld }) {
  return <OurWorldErrorBoundary><OurWorldInner worldMode={worldMode} worldId={worldId} worldName={worldName} worldRole={worldRole} worldType={worldType} onSwitchWorld={onSwitchWorld} /></OurWorldErrorBoundary>;
}
