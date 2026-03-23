import { usePlayStory } from "./usePlayStory.js";
import { useToasts } from "./useToasts.js";
import { useRecap } from "./useRecap.js";
import { usePhotoUpload } from "./usePhotoUpload.js";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts.js";
import { useCelebrations } from "./useCelebrations.js";
import { reducer, getFirstBadges } from "./entryReducer.js";
import { useState, useEffect, useRef, useCallback, useMemo, useReducer, Component, lazy, Suspense } from "react";
import * as THREE from "three";
import { ll2v, lerp, haversine, daysBetween, addDays, fmtDate, todayStr, clamp, LAND, COAST_DATA } from "./geodata.js";
import { createOurWorldDB, createSharedWorldDB } from "./supabase.js";
import { createMyWorldDB, createFriendWorldDB } from "./supabaseMyWorld.js";
import { useAuth } from "./AuthContext.jsx";
import { firePartnerNotification } from "./useNotifications.js";
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
const SearchPanel = lazy(() => import("./SearchPanel.jsx"));
const WorldToolbar = lazy(() => import("./WorldToolbar.jsx"));
const CinemaOverlay = lazy(() => import("./CinemaOverlay.jsx"));
const DreamPanel = lazy(() => import("./DreamPanel.jsx"));
const GalleryPanel = lazy(() => import("./GalleryPanel.jsx"));
const DetailCard = lazy(() => import("./DetailCard.jsx"));
const TimelineSlider = lazy(() => import("./TimelineSlider.jsx"));
const LoveLetterOverlay = lazy(() => import("./LoveLetterOverlay.jsx"));
const TimeCapsuleOverlay = lazy(() => import("./TimeCapsuleOverlay.jsx"));
const EntryListPanel = lazy(() => import("./EntryListPanel.jsx"));
const TrashPanel = lazy(() => import("./TrashPanel.jsx"));
const ConfirmModal = lazy(() => import("./ConfirmModal.jsx"));
const OnThisDayCard = lazy(() => import("./OnThisDayCard.jsx"));
const PhotoLightbox = lazy(() => import("./PhotoLightbox.jsx"));
const PhotoJourneyOverlay = lazy(() => import("./PhotoJourneyOverlay.jsx"));
const CelebrationOverlay = lazy(() => import("./CelebrationOverlay.jsx"));
const ReunionToast = lazy(() => import("./ReunionToast.jsx"));
const EmptyState = lazy(() => import("./EmptyState.jsx"));
const LocationListPopup = lazy(() => import("./LocationListPopup.jsx"));
import { EntryTemplates, saveTemplate } from "./EntryTemplates.jsx";
import useRealtimeSync, { useRealtimePresence } from "./useRealtimeSync.js";
import { shareGlobeCard } from "./ShareCard.js";
import { useGlobeInteraction } from "./useGlobeInteraction.js";
import { useGlobeMarkers } from "./useGlobeMarkers.js";
import { useGlobeScene } from "./useGlobeScene.js";
import { supabase } from "./supabaseClient.js";
import { geocodeSearch } from "./geocode.js";
import { navStyle, imageNavBtn, renderList, StarRating, FONT_FAMILY } from "./formUtils.jsx";
import { QuickAddForm, DreamAddForm, DREAM_CATEGORIES, AddForm, EditForm, OverlayBoundary } from "./formComponents.jsx";
import {
  OUR_WORLD_PALETTE, MY_WORLD_PALETTE,
  OUR_WORLD_TYPES, MY_WORLD_TYPES,
  OUR_WORLD_DEFAULT_CONFIG, MY_WORLD_DEFAULT_CONFIG,
  OUR_WORLD_FIELDS, MY_WORLD_FIELDS,
  OUR_WORLD_SCENE, MY_WORLD_SCENE,
  FRIENDS_TYPES, FRIENDS_FIELDS, FRIENDS_DEFAULT_CONFIG,
  FAMILY_TYPES, FAMILY_FIELDS, FAMILY_DEFAULT_CONFIG,
  getSeasonalHue, resolveTypes, getSharedWorldConfig,
} from "./worldConfigs.js";
import { loadComments, addComment, deleteComment, loadAllWorldReactions, toggleReaction, getWorldMembers, loadMyWorlds, shareEntryToWorld, getPersonalWorldId } from "./supabaseWorlds.js";
import { thumbnail } from "./imageUtils.js";
import StatsOverlay from "./StatsOverlay.jsx";
import RecapOverlay from "./RecapOverlay.jsx";
import OnboardingOverlay from "./OnboardingOverlay.jsx";
const SettingsPanel = lazy(() => import("./SettingsPanel.jsx"));

/* =================================================================
   🌍 OUR WORLD / MY WORLD — Multi-World Globe Engine
   v9.0 — dual world support, earth-tone My World palette
   ================================================================= */

// Mutable palette ref — stored on window to survive Vite production bundling
// (Vite may convert top-level `let` to `const`, making reassignment throw)
// External form components (inpSt, TBtn, Fld, etc.) read from P so they get correct world colors.
// Initialized with Our World palette but mutated in-place by _paletteBase useMemo to match current world.
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
const P = window.__cosmosP;



// Location search powered by OpenStreetMap Nominatim — see geocode.js
// ---- REDUCER (with Supabase persistence + undo history) ----

// ---- ERROR BOUNDARY ----
class OurWorldErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  static getDerivedStateFromProps(props, state) {
    // Reset error state when world changes (e.g. switching between worlds)
    if (state.hasError && state._worldId !== props.children?.props?.worldId) {
      return { hasError: false, error: null, _worldId: props.children?.props?.worldId };
    }
    return { _worldId: props.children?.props?.worldId };
  }
  componentDidCatch(err, info) { console.error("OurWorld error:", err, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ width: "100%", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c0a12", fontFamily: '"Palatino Linotype", Georgia, serif', textAlign: "center", padding: 40 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 400, color: "#e8e0d0", marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 12, color: "#958ba8", marginBottom: 16 }}>Your data is safe — try refreshing the page.</p>
            <button onClick={() => window.location.reload()} style={{ padding: "8px 24px", background: "rgba(200,170,110,0.15)", border: "1px solid rgba(200,170,110,0.3)", color: "#e8e0d0", borderRadius: 8, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Refresh</button>
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
        const [entries, cfg] = await Promise.all([db.loadEntries(), db.loadConfig()]);
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

  // Mobile detection + landscape
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  const [isLandscape, setIsLandscape] = useState(window.innerHeight < window.innerWidth && window.innerHeight < 500);
  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 600);
      setIsLandscape(window.innerHeight < window.innerWidth && window.innerHeight < 500);
    };
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
  const frameRef = useRef(0);
  const easterEggRef = useRef(null);
  const musicRef = useRef(null);
  const ambientRef = useRef(null);
  const [ambientPlaying, setAmbientPlaying] = useState(false);

  // Mutable container for flyTo — breaks circular dependency between
  // usePlayStory → flyTo → useGlobeInteraction → locationGroups → useGlobeMarkers → isPlaying → usePlayStory
  // Filled after useGlobeInteraction runs; safe because consumers only call it from callbacks/effects (after render).
  const _flyTo = useRef(null);

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
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  // Keep selected entry in sync with latest data (e.g. after reducer UPDATE from realtime sync)
  useEffect(() => {
    if (!selected) return;
    const fresh = data.entries.find(e => e.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [data.entries]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-play music when selecting an entry with musicUrl
  useEffect(() => {
    if (!selected?.musicUrl) {
      if (musicRef.current) { musicRef.current.pause(); musicRef.current.currentTime = 0; }
      return;
    }
    const t = setTimeout(() => { if (musicRef.current) musicRef.current.play().catch(() => {}); }, 600);
    return () => clearTimeout(t);
  }, [selected?.id, selected?.musicUrl]);

  // zoom tracked via zmR ref (used in animation loop directly)
  const [ready, setReady] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const onboardKey = isSharedWorld ? `v3_cosmos_onboarded_${worldId}` : isMyWorld ? `v3_cosmos_onboarded_my_${userId}` : `v3_cosmos_onboarded_${userId}`;
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(onboardKey));
  const [onboardStep, setOnboardStep] = useState(0);
  const [celebrationData, setCelebrationData] = useState(null); // { type: 'first'|'anniversary'|'milestone', message, sub }
  const [pjIndex, setPjIndex] = useState(0);
  const [pjAutoPlay, setPjAutoPlay] = useState(false);
  const [editing, setEditing] = useState(null);
  const { toasts, showToast, dismissToast, handleUndo, modals, modalDispatch } = useToasts();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [showLetter, setShowLetter] = useState(null); // letter id to show, or null
  const [letterDraft, setLetterDraft] = useState("");
  const [letterEditId, setLetterEditId] = useState(null); // null = new letter
  const [letterCity, setLetterCity] = useState("");
  const [letterLat, setLetterLat] = useState("");
  const [letterLng, setLetterLng] = useState("");
  const [showCapsule, setShowCapsule] = useState(null); // capsule id to show, or null
  const [showCreateCapsule, setShowCreateCapsule] = useState(false);
  const [worldMembers, setWorldMembers] = useState([]);
  const [sliderDate, setSliderDate] = useState(todayStr());
  const [isAnimating, setIsAnimating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [markerFilter, setMarkerFilter] = useState("all"); // "all", "together", "special", "home-seth", "home-rosie", "seth-solo", "rosie-solo"
  const [listRenderLimit, setListRenderLimit] = useState(100);
  const [locationList, setLocationList] = useState(null); // for multi-entry popup
  // Comments & Reactions (shared/viewer worlds)
  const [entryComments, setEntryComments] = useState([]);
  const [worldReactions, setWorldReactions] = useState([]);
  const [showZoomHint, setShowZoomHint] = useState(true);
  // Share entry to another world
  const [shareWorlds, setShareWorlds] = useState(null); // loaded on first open
  const [monthlyPromptShown, setMonthlyPromptShown] = useState(false);
  const [tripCardEntry, setTripCardEntry] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [recentlyDeleted, setRecentlyDeleted] = useState(() => {
    try { const raw = localStorage.getItem(`cosmos_trash_${worldId || worldMode}`); return raw ? JSON.parse(raw).filter(t => Date.now() - t.deletedAt < 30 * 24 * 60 * 60 * 1000) : []; } catch { return []; }
  });
  const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm }
  const [handwrittenMode, setHandwrittenMode] = useState(() => { try { return localStorage.getItem("cosmos_handwritten") === "1"; } catch { return false; } });
  const [linkedEntryId, setLinkedEntryId] = useState(null); // entry id being linked
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
  const animRef = useRef(null);
  const surpriseTimers = useRef([]);

  const RAD = 1; const MIN_Z = 1.15; const MAX_Z = 6;

  // ---- THREE SETUP (extracted to useGlobeScene) ----
  const {
    sceneReady, rendRef, scnRef, camRef, globeRef, heartRef,
    glowLayersRef, particlesRef, particles2Ref,
    starsRef, shootingStarsRef, auroraRef, nightShadowRef,
  } = useGlobeScene(mountRef, {
    loading, SC, RAD, P, LAND, COAST_DATA,
    isPartnerWorld, isSharedWorld,
    setReady, setIntroComplete,
    frameRef, spinSpd, tSpinSpd, dragR, selectedRef,
    rot, tRot, zmR, tZm,
    easterEggRef, searchMatchIdsRef, mkRef, routesRef,
    mouseRef, atmosphereRef, pulseRingsRef, cometRef,
    animRef, surpriseTimers,
  });

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
      const ringGeo = new THREE.RingGeometry(0.02, 0.035, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: typeColor, transparent: true, opacity: 0.25,
        side: THREE.DoubleSide, depthTest: false
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.lookAt(pos.clone().multiplyScalar(2));
      ring.renderOrder = 5;
      g.add(ring);
      pulseRingsRef.current.push({ mesh: ring, age: 0 });
      // Second ring with slight delay for layered effect
      const ring2Timer = setTimeout(() => {
        if (!globeRef.current) return;
        const ring2Geo = new THREE.RingGeometry(0.015, 0.025, 32);
        const ring2Mat = new THREE.MeshBasicMaterial({
          color: typeColor, transparent: true, opacity: 0.18,
          side: THREE.DoubleSide, depthTest: false
        });
        const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
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
          historyBuf: new Float32Array(TRAIL_LEN * 3), historyIdx: 0, historyCount: 0,
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
    loadAllWorldReactions(worldId).then(setWorldReactions).catch(() => {});
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
      // Browser notification when someone else adds an entry
      if (entry.addedBy && entry.addedBy !== userId) {
        const name = memberNameMapRef.current?.[entry.addedBy] || "Your partner";
        firePartnerNotification(name, entry.city);
      }
    }, []),
    onUpdate: useCallback((entry) => { _dispatch({ type: 'UPDATE', id: entry.id, data: entry, _skipSave: true }); }, []),
    onDelete: useCallback(({ id }) => { _dispatch({ type: 'DELETE', id, _skipSave: true }); setSelected(prev => prev?.id === id ? null : prev); }, []),
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
        if (sel?.id) loadComments(worldId, sel.id).then(setEntryComments).catch(() => {});
        if (payload.eventType === 'INSERT' && payload.new?.user_id !== userId) {
          setNotifications(prev => [{ id: `n-${Date.now()}`, type: 'comment', message: `New comment on an entry`, timestamp: new Date().toISOString(), entryId: payload.new?.entry_id, read: false }, ...prev].slice(0, 100));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entry_reactions', filter: `world_id=eq.${worldId}` }, (payload) => {
        loadAllWorldReactions(worldId).then(setWorldReactions).catch(() => {});
        if (payload.eventType === 'INSERT' && payload.new?.user_id !== userId) {
          setNotifications(prev => [{ id: `n-${Date.now()}`, type: 'reaction', message: `Someone reacted to an entry`, timestamp: new Date().toISOString(), entryId: payload.new?.entry_id, read: false }, ...prev].slice(0, 100));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isSharedWorld, worldId]);


  // ---- DERIVED ----
  const sorted = useMemo(() => [...data.entries].sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || "")), [data.entries]);
  // Fallback startDate for timeline when config.startDate isn't set (common in shared worlds)
  const effectiveStartDate = useMemo(() => {
    if (config.startDate) return config.startDate;
    if (sorted.length > 0 && sorted[0].dateStart) return sorted[0].dateStart;
    return todayStr();
  }, [config.startDate, sorted]);
  // Trip grouping — cluster entries within 3 days of each other
  // Entries listed individually; stops shown inside each entry's detail card

  const togetherList = useMemo(() => sorted.filter(e => e.who === "both"), [sorted]);
  const { isPlaying, cinemaEntry, cinemaPhotoIdx, cinemaProgress, cinemaTotal, cinemaIdx, cinemaPhase, stopPlay, playStory, playRef, photoTimerRef } = usePlayStory({ sorted, togetherList, isPartnerWorld, flyTo: (...a) => _flyTo.current?.(...a), tSpinSpd, showToast, setSelected, setShowGallery: (v) => modalDispatch({ type: v ? 'OPEN' : 'CLOSE', name: 'showGallery' }), setPhotoIdx: () => {}, setCardTab: () => {}, setSliderDate, tZm });
  const firstBadges = useMemo(() => isPartnerWorld ? getFirstBadges(data.entries) : {}, [data.entries, isPartnerWorld]);
  const memberNameMap = useMemo(() => Object.fromEntries(worldMembers.map(m => [m.user_id, m.display_name || "Member"])), [worldMembers]);
  const memberNameMapRef = useRef(memberNameMap);
  memberNameMapRef.current = memberNameMap;
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

  // Anniversary check
  const isAnniversary = useMemo(() => {
    if (!config.startDate) return false;
    const sd = config.startDate.slice(5);
    const today = sliderDate.slice(5);
    return sd === today && sliderDate !== config.startDate;
  }, [sliderDate, config.startDate]);

  // Seasonal tinting (must be after season + isAnniversary declarations)
  useEffect(() => {
    if (!glowLayersRef.current.length) return;
    const s = season;
    glowLayersRef.current.forEach((mesh, i) => {
      mesh.material.color.set(i < 2 ? s.glow : P.cream);
    });
    if (particlesRef.current) particlesRef.current.material.color.set(isAnniversary ? P.heart : s.particle);
    if (isAnniversary && particlesRef.current) particlesRef.current.material.opacity = 0.35;
    else if (particlesRef.current) particlesRef.current.material.opacity = 0.18;
  }, [season, isAnniversary]);

  // Auto-trigger anniversary/milestone celebration (once per session per world)
  useEffect(() => {
    if (!introComplete || !isAnniversary) return;
    const annivKey = `v2_anniv_${worldId || userId}_${todayStr()}`;
    if (localStorage.getItem(annivKey)) return;
    localStorage.setItem(annivKey, '1');
    const years = Math.floor(daysBetween(config.startDate, todayStr()) / 365);
    // Personalize anniversary message per world type
    let annivLabel;
    if (isPartnerWorld && config.youName && config.partnerName) {
      annivLabel = years === 1 ? `${config.youName} & ${config.partnerName}'s 1st Year` : `${config.youName} & ${config.partnerName} — ${years} Years`;
    } else if (isPartnerWorld) {
      annivLabel = years === 1 ? '1 Year Together' : `${years} Years Together`;
    } else if (worldType === "friends") {
      annivLabel = years === 1 ? `${worldName || "The Crew"}'s 1st Year` : `${worldName || "The Crew"} — ${years} Years`;
    } else if (worldType === "family") {
      annivLabel = years === 1 ? `${worldName || "Family"}'s 1st Year` : `${worldName || "Family"} — ${years} Years`;
    } else if (isMyWorld) {
      annivLabel = years === 1 ? 'Your 1st Year of Adventures' : `${years} Years of Adventures`;
    } else {
      annivLabel = years === 1 ? '1 Year Together' : `${years} Years Together`;
    }
    setCelebrationData({
      type: 'anniversary',
      message: annivLabel,
      sub: `${stats.trips} adventures, ${stats.countries} countries, ${Math.round(stats.totalMiles).toLocaleString()} miles`,
    });
    modalDispatch({ type: 'OPEN', name: 'showCelebration' });
    const t = setTimeout(() => modalDispatch({ type: 'CLOSE', name: 'showCelebration' }), 8000);
    return () => clearTimeout(t);
  }, [introComplete, isAnniversary, config.startDate, worldId, userId, stats.trips, stats.countries, stats.totalMiles]);

  // Milestone celebrations — celebrate round-number moments (all world types)
  const milestoneRef = useRef(null);
  useEffect(() => {
    if (!introComplete || data.entries.length < 2) return;
    const n = data.entries.length;
    const c = stats.countries;
    const m = Math.round(stats.totalMiles);
    const msConfig = getMilestoneConfig(worldType, isMyWorld);

    // Build personalized name prefix for milestone messages
    let namePrefix = "";
    if (isPartnerWorld && config.youName && config.partnerName) {
      namePrefix = `${config.youName} & ${config.partnerName}'s `;
    } else if (worldType === "friends" && worldName) {
      namePrefix = `${worldName}'s `;
    } else if (worldType === "family" && worldName) {
      namePrefix = `${worldName}'s `;
    } else if (isMyWorld) {
      namePrefix = "Your ";
    }

    const milestones = [
      ...msConfig.entries.map(ms => ({ check: n === ms.count, msg: namePrefix ? `${namePrefix}${ms.msg}` : ms.msg, sub: ms.sub, icon: ms.icon })),
      ...msConfig.countries.map(ms => ({ check: c === ms.count, msg: namePrefix ? `${namePrefix}${ms.msg}` : ms.msg, sub: ms.sub, icon: ms.icon })),
      ...msConfig.distance.map(ms => ({ check: m >= ms.miles && milestoneRef.current !== `${ms.miles}mi`, msg: namePrefix ? `${namePrefix}${ms.msg}` : ms.msg, sub: ms.sub, icon: ms.icon })),
    ];
    const hit = milestones.find(ms => ms.check);
    if (!hit) return;
    const key = `v2_milestone_${worldId || userId}_${hit.msg}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    if (m >= 25000) milestoneRef.current = '25000mi';
    else if (m >= 10000) milestoneRef.current = '10000mi';
    else if (m >= 1000) milestoneRef.current = '1000mi';
    setCelebrationData({ type: 'milestone', message: hit.msg, sub: hit.sub });
    modalDispatch({ type: 'OPEN', name: 'showCelebration' });
    const t = setTimeout(() => modalDispatch({ type: 'CLOSE', name: 'showCelebration' }), 5000);
    return () => clearTimeout(t);
  }, [introComplete, data.entries.length, stats.countries, stats.totalMiles, worldId, userId]);

  // "On This Day" — surface memories from the same date in previous years
  const [onThisDayEntry, setOnThisDayEntry] = useState(null);
  useEffect(() => {
    if (!introComplete || data.entries.length < 2) return;
    const today = todayStr();
    const md = today.slice(5); // "MM-DD"
    const thisYear = today.slice(0, 4);
    const matches = data.entries.filter(e => {
      if (!e.dateStart) return false;
      const eYear = e.dateStart.slice(0, 4);
      if (eYear === thisYear) return false; // only past years
      // Check if today falls within the entry's date range
      const eMd = e.dateStart.slice(5);
      if (eMd === md) return true;
      if (e.dateEnd) {
        const endMd = e.dateEnd.slice(5);
        if (eMd <= md && endMd >= md) return true;
      }
      return false;
    });
    if (matches.length === 0) return;
    const otdKey = `otd_${worldId || userId}_${today}`;
    if (localStorage.getItem(otdKey)) return;
    localStorage.setItem(otdKey, '1');
    const pick = matches[Math.floor(Math.random() * matches.length)];
    setOnThisDayEntry(pick);
    const t = setTimeout(() => setOnThisDayEntry(null), 12000);
    return () => clearTimeout(t);
  }, [introComplete, data.entries, worldId, userId]);

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

  // ---- TOAST SYSTEM (queue/stack with undo support) ----

  // ---- SAVE ERROR NOTIFICATION ----
  useEffect(() => {
    const handler = (e) => showToast(`Failed to save ${e.detail?.city || 'entry'} — check your connection`, '⚠️', 8000)
    window.addEventListener('cosmos-save-error', handler)
    return () => window.removeEventListener('cosmos-save-error', handler)
  }, [showToast])

  // ---- OFFLINE AWARENESS ----
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const goOffline = () => { setIsOffline(true); showToast("You're offline — changes will sync when you reconnect", "⚠️", 5000); };
    const goOnline = () => { setIsOffline(false); showToast("Back online", "✅", 2000); };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, [showToast]);

  // ---- "ON THIS DAY" MEMORIES ----
  const onThisDay = useMemo(() => {
    const today = todayStr();
    const md = today.slice(5); // "MM-DD"
    return data.entries.filter(e => {
      if (!e.dateStart) return false;
      const eMd = e.dateStart.slice(5);
      const eYear = parseInt(e.dateStart.slice(0, 4));
      const thisYear = parseInt(today.slice(0, 4));
      return eMd === md && eYear < thisYear;
    }).map(e => ({
      ...e,
      yearsAgo: parseInt(today.slice(0, 4)) - parseInt(e.dateStart.slice(0, 4))
    }));
  }, [data.entries]);

  // Show "On This Day" toast on load (once per session)
  // Note: TYPES/DEFAULT_TYPE are stable per world session (derived from worldType prop)
  const onThisDayShownRef = useRef(false);
  useEffect(() => {
    if (onThisDayShownRef.current) return;
    if (onThisDay.length > 0 && introComplete) {
      onThisDayShownRef.current = true;
      const mem = onThisDay[0];
      const label = mem.yearsAgo === 1 ? "1 year ago today" : `${mem.yearsAgo} years ago today`;
      const icon = (TYPES[mem.type] || DEFAULT_TYPE).icon;
      showToast(`${label}: ${mem.city} ${icon}`, "💫", 5000);
    }
  }, [onThisDay, introComplete, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- TIME CAPSULE OPEN DETECTION ----
  const capsuleOpenCheckedRef = useRef(false);
  useEffect(() => {
    if (capsuleOpenCheckedRef.current || !introComplete) return;
    const capsules = config.timeCapsules || [];
    if (capsules.length === 0) return;
    capsuleOpenCheckedRef.current = true;
    const today = new Date().toISOString().slice(0, 10);
    const sessionKey = `cosmos_capsule_opened_${worldId || userId}_${today}`;
    if (localStorage.getItem(sessionKey)) return;
    const justOpened = capsules.filter(c => c.unlockDate === today || (c.unlockDate <= today && !c._notified));
    if (justOpened.length > 0) {
      localStorage.setItem(sessionKey, "1");
      const c = justOpened[0];
      setTimeout(() => {
        showToast(`A time capsule just opened! 💫 ${c.city || ""}`, "🔮", 6000);
      }, 3000);
    }
  }, [introComplete, config.timeCapsules, worldId, userId, showToast]);

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
  }, [introComplete, data.entries, isSharedWorld, isMyWorld, worldId, userId]); // flyTo via _flyTo ref (stable)

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
    if (!modals.showLoveThread) return [];
    return togetherList.slice(1).map((e, i) => {
      const prev = togetherList[i];
      return { from: { lat: prev.lat, lng: prev.lng }, to: { lat: e.lat, lng: e.lng } };
    });
  }, [togetherList, modals.showLoveThread]);

  // ---- CONSTELLATION DATA (optimized MST) ----
  const constellationData = useMemo(() => {
    if (!modals.showConstellation) return [];
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
  }, [data.entries, modals.showConstellation]);

  // ---- TRAVEL ROUTES — chronological dotted paths between entries ----
  const routeData = useMemo(() => {
    if (!modals.showRoutes && !isPlaying) return [];
    const s = sorted.filter(e => e.dateStart && e.dateStart <= sliderDate);
    if (s.length < 2) return [];
    const pairs = [];
    for (let i = 1; i < s.length; i++) {
      if (s[i].lat === s[i - 1].lat && s[i].lng === s[i - 1].lng) continue;
      pairs.push({ from: s[i - 1], to: s[i] });
    }
    return pairs;
  }, [sorted, modals.showRoutes, isPlaying, sliderDate]);

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
        setTimeout(() => { setSelected(target); }, 500);
      }
    };
    animRef.current = requestAnimationFrame(anim);
  }, [sliderDate, togetherList, sorted, isPartnerWorld, isAnimating]); // flyTo via _flyTo ref (stable)

  // ---- PLAY OUR STORY ----
  // Cinema state for Play Story overlay

  // Keyboard shortcuts (extracted to useKeyboardShortcuts)
  useKeyboardShortcuts({
    stepDay, flushConfigSave, setSelected, setEditing, modalDispatch, modals,
    setShowLetter, setShowCapsule, setShowCreateCapsule, setMarkerFilter,
    setLocationList, setConfirmDelete, setLightboxOpen, setShowOnboarding,
    setConfirmModal, setTripCardEntry, onboardKey, tSpinSpd, isPlaying, stopPlay,
    dispatch, showToast, editing, setSliderDate, saveGlobeScreenshot,
    data, tZm, flyTo, surpriseTimers, playStory, togetherList, sorted, isPartnerWorld,
  });

  // Year-in-review recap (extracted to useRecap)
  const {
    recapAutoPlay, setRecapAutoPlay, recapPhase, setRecapPhase,
    recapStatIdx, setRecapStatIdx, recapYear, recapIdx, setRecapIdx,
    startRecap, recapEntries, recapYearStats, closeRecap,
  } = useRecap({ sorted, modals, modalDispatch, setSelected, setSliderDate, flyTo });

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
                await Promise.all(entries.slice(i, i + 10).map(e => db.saveEntry(e)));
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



  // ---- MARKERS (extracted to useGlobeMarkers hook) ----
  const { locationGroups } = useGlobeMarkers({
    data, TYPES,
    globeRef, mkRef, rtRef, heartRef,
    loveThreadRef, constellationRef, routesRef,
    sceneReady, sliderDate, getPositions, areTogether,
    isPartnerWorld, isMyWorld,
    showLoveThread: modals.showLoveThread, loveThreadData,
    showConstellation: modals.showConstellation, constellationData,
    showRoutes: modals.showRoutes, isPlaying, routeData,
    config, selected,
  });

  // ---- Globe interaction (pointer, touch, zoom, hover, flyTo, screenshot) ----
  const { flyTo, hoverLabel, setHoverLabel, saveGlobeScreenshot, onDown, onMove, onUp } = useGlobeInteraction({
    mountRef, camRef, rendRef, scnRef, mkRef,
    dragR, prevR, rot, tRot, tZm, spinSpd, tSpinSpd,
    mouseRef, hoverThrottleRef, longPressRef, lastTapRef, clickSR, tDistR,
    entries: data.entries, locationGroups, config, sceneReady,
    isMyWorld, isPartnerWorld, worldType, showToast,
    setSelected, setLocationList, setSliderDate, setShowLetter, setShowCapsule, setShowZoomHint,
  });
  _flyTo.current = flyTo;

  // ---- Share card (generate + download/share a styled globe image) ----
  const handleShareCard = useCallback(async () => {
    const rend = rendRef.current, scn = scnRef.current, cam = camRef.current;
    if (!rend) { showToast("Globe not ready yet", "\u26A0\uFE0F", 3000); return; }
    try {
      const displayName = config.title
        || (isPartnerWorld && config.youName && config.partnerName
          ? `${config.youName} & ${config.partnerName}'s Cosmos`
          : isMyWorld ? "My World"
          : worldName || "Our World");
      const result = await shareGlobeCard({
        rendererCanvas: rend.domElement,
        renderer: rend, scene: scn, camera: cam,
        worldName: displayName,
        entryCount: stats.trips,
        countryCount: stats.countries,
        totalMiles: stats.totalMiles,
        startDate: config.startDate,
        isPartnerWorld,
      });
      if (result.shared) showToast("Shared!", "\u{1F30D}", 2500);
      else if (result.downloaded) showToast("Image saved to downloads", "\u{1F4F7}", 2500);
    } catch (err) {
      console.error("[share-card]", err);
      showToast("Couldn't generate share image", "\u26A0\uFE0F", 3000);
    }
  }, [config.title, config.youName, config.partnerName, config.startDate, isMyWorld, isPartnerWorld, worldName, stats, showToast]);

  // Photo upload (extracted to usePhotoUpload)
  const { uploading, setUploading, uploadProgress, setUploadProgress, handlePhotos, uploadLockRef } = usePhotoUpload({ db, dispatch, showToast });

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

      <div ref={mountRef} aria-label="3D globe showing your travel memories" style={{ width: "100%", height: "100%", touchAction: "none" }}
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
      <div style={{ position: "absolute", top: "max(22px, env(safe-area-inset-top, 22px))", left: 0, right: 0, textAlign: "center", zIndex: 10, pointerEvents: "none", opacity: ready ? 1 : 0, transform: ready ? "none" : "translateY(-12px)", transition: "all 1.8s cubic-bezier(.23,1,.32,1)" }}>
        <h1 style={{ fontSize: 28, fontWeight: 400, margin: 0, letterSpacing: ".2em", textTransform: "uppercase", color: "#f0e8d8", textShadow: "0 1px 12px rgba(0,0,0,0.5), 0 0 40px rgba(255,255,255,0.12)" }}>{config.title}</h1>
        <p style={{ fontSize: 12, color: "#d8cebb", marginTop: 3, letterSpacing: ".3em", fontStyle: "italic", textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>{config.subtitle}</p>
        {isAnniversary && <div style={{ fontSize: 11, color: P.heart, marginTop: 6, letterSpacing: ".15em", animation: "heartPulse 2s ease infinite" }}>✨ Happy Anniversary ✨</div>}
      </div>

      {/* MOBILE ZOOM BUTTONS */}
      {isMobile && introComplete && (
        <div style={{ position: "absolute", bottom: 130, right: "max(14px, env(safe-area-inset-right, 14px))", zIndex: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <button aria-label="Zoom in" onClick={() => { tZm.current = clamp(tZm.current - 0.4, MIN_Z, MAX_Z); }} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${P.textFaint}25`, background: P.glass, backdropFilter: "blur(12px)", fontSize: 20, color: P.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 8px ${P.text}10` }}>+</button>
          <button aria-label="Zoom out" onClick={() => { tZm.current = clamp(tZm.current + 0.4, MIN_Z, MAX_Z); }} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${P.textFaint}25`, background: P.glass, backdropFilter: "blur(12px)", fontSize: 20, color: P.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 8px ${P.text}10` }}>−</button>
        </div>
      )}

      {/* OFFLINE INDICATOR */}
      {isOffline && introComplete && (
        <div style={{ position: "absolute", top: isMobile ? 70 : 80, left: "50%", transform: "translateX(-50%)", zIndex: 15, pointerEvents: "none", animation: "fadeIn .4s ease" }}>
          <div style={{ fontSize: 10, color: "#e8c070", letterSpacing: ".1em", background: "rgba(40,30,20,0.75)", backdropFilter: "blur(8px)", borderRadius: 12, padding: "4px 14px", border: "1px solid rgba(200,170,110,0.2)" }}>Offline — changes will sync when you reconnect</div>
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

      {/* RIGHT PANEL — distance + stats + entry list */}
      <Suspense fallback={null}><EntryListPanel
        entries={data.entries} sorted={sorted} togetherList={togetherList} favorites={favorites}
        selected={selected} onSelectEntry={e => { setSelected(e); setLocationList(null); setSliderDate(e.dateStart); flyTo(e.lat, e.lng, 2.5); }}
        markerFilter={markerFilter} setMarkerFilter={setMarkerFilter}
        showFilter={modals.showFilter} onToggleFilter={() => modalDispatch({ type: 'TOGGLE', name: 'showFilter' })} onCloseFilter={() => modalDispatch({ type: 'CLOSE', name: 'showFilter' })}
        TYPES={TYPES} P={P} config={config}
        isMobile={isMobile} isPartnerWorld={isPartnerWorld} isMyWorld={isMyWorld} isSharedWorld={isSharedWorld}
        fmtDate={fmtDate} stats={stats} dist={dist} nextTogether={nextTogether} areTogether={areTogether}
        allStickersMap={allStickersMap} memberNameMap={memberNameMap} worldName={worldName} introComplete={introComplete}
      /></Suspense>

      {/* TOOLBAR */}
      <Suspense fallback={null}><WorldToolbar
        worldId={worldId} worldMode={worldMode} isViewer={isViewer}
        isSharedWorld={isSharedWorld} isPartnerWorld={isPartnerWorld} isMyWorld={isMyWorld}
        entries={data.entries} allPhotos={allPhotos} togetherList={togetherList}
        sorted={sorted} recentlyDeleted={recentlyDeleted}
        undoCount={data.undoStack?.length || 0} redoCount={data.redoStack?.length || 0}
        notifications={notifications}
        isPlaying={isPlaying} ambientPlaying={ambientPlaying}
        ambientMusicUrl={config.ambientMusicUrl}
        showSearch={modals.showSearch} showStats={modals.showStats}
        showConstellation={modals.showConstellation} showRoutes={modals.showRoutes}
        showMilestones={modals.showMilestones} showTravelStats={modals.showTravelStats}
        showLoveThread={modals.showLoveThread} showDreams={modals.showDreams}
        showGallery={modals.showGallery} showPhotoMap={modals.showPhotoMap}
        onAdd={() => modalDispatch({ type: 'OPEN', name: 'showAdd' })}
        onQuickAdd={() => modalDispatch({ type: 'OPEN', name: 'quickAddMode' })}
        onResumeDraft={() => {
          const dk = `cosmos-draft-add-${worldId || worldMode}`;
          try { if (localStorage.getItem(dk) && JSON.parse(localStorage.getItem(dk)).city) { modalDispatch({ type: 'OPEN', name: 'showAdd' }); return; } } catch {}
          modalDispatch({ type: 'OPEN', name: 'quickAddMode' });
        }}
        onSettings={() => modalDispatch({ type: 'OPEN', name: 'showSettings' })}
        onToggleSearch={() => modalDispatch({ type: 'TOGGLE', name: 'showSearch' })}
        onToggleStats={() => modalDispatch({ type: 'TOGGLE', name: 'showStats' })}
        onToggleConstellation={() => modalDispatch({ type: 'TOGGLE', name: 'showConstellation' })}
        onToggleRoutes={() => modalDispatch({ type: 'TOGGLE', name: 'showRoutes' })}
        onToggleMilestones={() => modalDispatch({ type: 'TOGGLE', name: 'showMilestones' })}
        onToggleTravelStats={() => modalDispatch({ type: 'TOGGLE', name: 'showTravelStats' })}
        onToggleLoveThread={() => modalDispatch({ type: 'TOGGLE', name: 'showLoveThread' })}
        onToggleDreams={() => modalDispatch({ type: 'TOGGLE', name: 'showDreams' })}
        onToggleGallery={() => modalDispatch({ type: 'TOGGLE', name: 'showGallery' })}
        onPhotoJourney={() => { modalDispatch({ type: 'OPEN', name: 'showPhotoJourney' }); setPjIndex(0); }}
        onTogglePhotoMap={() => modalDispatch({ type: 'TOGGLE', name: 'showPhotoMap' })}
        onPlayStory={playStory}
        onStopPlay={stopPlay}
        onSurpriseMe={() => {
          const pool = data.entries.filter(e => e.lat != null && e.lng != null);
          if (!pool.length) return;
          const pick = pool[Math.floor(Math.random() * pool.length)];
          tZm.current = 4.5;
          setTimeout(() => {
            flyTo(pick.lat, pick.lng, 2.2);
            setTimeout(() => { setSelected(pick); }, 600);
          }, 400);
        }}
        onToggleAmbient={() => {
          const au = ambientRef.current;
          if (!au) return;
          if (ambientPlaying) { au.pause(); setAmbientPlaying(false); }
          else { au.play().catch(() => {}); setAmbientPlaying(true); }
        }}
        onUndo={() => dispatch({ type: "UNDO" })}
        onRedo={() => dispatch({ type: "REDO" })}
        onScreenshot={saveGlobeScreenshot}
        onShare={handleShareCard}
        onTemplates={() => modalDispatch({ type: 'OPEN', name: 'showTemplates' })}
        onTripJournal={() => modalDispatch({ type: 'OPEN', name: 'showTripJournal' })}
        onExportHub={() => modalDispatch({ type: 'OPEN', name: 'showExportHub' })}
        onYearReview={() => modalDispatch({ type: 'OPEN', name: 'showYearReview' })}
        onTrash={() => modalDispatch({ type: 'OPEN', name: 'showTrash' })}
        onTimeCapsule={() => setShowCreateCapsule(true)}
        onDismissNotification={id => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
        onDismissAllNotifications={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
        onClickNotification={n => {
          if (n.entryId) {
            const entry = data.entries.find(e => e.id === n.entryId);
            if (entry) { setSelected(entry); flyTo(entry.lat, entry.lng, 2.5); }
          }
          setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
        }}
        onSwitchWorld={onSwitchWorld ? () => { flushConfigSave(); onSwitchWorld(); } : null}
        onSignOut={() => setConfirmModal({ message: "Sign out of My Cosmos?", onConfirm: () => signOut() })}
        syncProps={{ isConnected: realtimeConnected, lastSync, pendingOffline, palette: { bg: SC.bg, text: P.text } }}
        introComplete={introComplete}
        isMobile={isMobile}
      /></Suspense>

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
      {modals.showSearch && (
        <Suspense fallback={null}>
          <SearchPanel
            entries={data.entries}
            types={TYPES}
            defaultType={DEFAULT_TYPE}
            isMobile={isMobile}
            searchMatchIdsRef={searchMatchIdsRef}
            isSharedWorld={isSharedWorld}
            memberNameMap={memberNameMap}
            onSelectEntry={(e) => {
              setSelected(e); modalDispatch({ type: 'CLOSE', name: 'showSearch' });
              setSliderDate(e.dateStart); flyTo(e.lat, e.lng, 2.5);
            }}
            onClose={() => modalDispatch({ type: 'CLOSE', name: 'showSearch' })}
          />
        </Suspense>
      )}

      {/* LETTER TRIGGERS — small markers in bottom-right (all world types) */}
      {(() => {
        const _lmi = isMyWorld || worldType === "personal" ? "✦" : worldType === "friends" ? "✧" : worldType === "family" ? "♥" : "❀";
        const _lbl = isMyWorld || worldType === "personal" ? "Note" : worldType === "friends" ? "Note" : worldType === "family" ? "Note" : "Love Letter";
        return <>
          {(config.loveLetters || []).length > 0 && (
            <div style={{ position: "absolute", bottom: 118, right: 22, zIndex: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              {(config.loveLetters || []).map((lt) => (
                <button key={lt.id} onClick={() => setShowLetter(lt.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, opacity: 0.22, transition: "opacity .5s", padding: 2 }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 0.55} onMouseLeave={e => e.currentTarget.style.opacity = 0.22}
                  title={lt.city || _lbl}>{_lmi}</button>
              ))}
            </div>
          )}
          {!isViewer && (<>
            <button onClick={() => { modalDispatch({ type: 'OPEN', name: 'editLetter' }); setLetterDraft(""); setLetterEditId(null); setLetterCity(""); setLetterLat(""); setLetterLng(""); }} style={{ position: "absolute", bottom: 118, right: (config.loveLetters || []).length > 0 ? 50 : 22, zIndex: 12, background: P.glass, border: `1px dashed ${P.rose}40`, borderRadius: 7, cursor: "pointer", fontSize: 9, color: P.textMuted, padding: "3px 9px", fontFamily: "inherit", transition: "right .3s" }}>+ {_lbl}</button>
            {(config.loveLetters || []).filter(l => l.draft && l.author === userId).length > 0 && (
              <div style={{ position: "absolute", bottom: 138, right: (config.loveLetters || []).length > 0 ? 50 : 22, zIndex: 12, fontSize: 10, color: P.gold, letterSpacing: ".06em" }}>📝 {(config.loveLetters || []).filter(l => l.draft && l.author === userId).length} draft{(config.loveLetters || []).filter(l => l.draft && l.author === userId).length > 1 ? "s" : ""}</div>
            )}
          </>)}
        </>;
      })()}

      {/* TIME CAPSULE TRIGGERS — bottom-right, below love letters */}
      {(() => {
        const capsules = config.timeCapsules || [];
        const today = new Date().toISOString().slice(0, 10);
        const letterCount = (config.loveLetters || []).length;
        const capsuleBottom = letterCount > 0 ? 90 : 118;
        return <>
          {capsules.length > 0 && (
            <div style={{ position: "absolute", bottom: capsuleBottom, right: 22, zIndex: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              {capsules.map((c) => {
                const isSealed = c.unlockDate > today;
                return (
                  <button key={c.id} onClick={() => setShowCapsule(c.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, opacity: 0.28, transition: "opacity .5s", padding: 2, filter: isSealed ? "none" : "saturate(1.5)" }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 0.6} onMouseLeave={e => e.currentTarget.style.opacity = 0.28}
                    title={`${c.city || "Time Capsule"} — ${isSealed ? `sealed until ${c.unlockDate}` : "opened!"}`}>
                    {isSealed ? "🔒" : "🔮"}
                  </button>
                );
              })}
            </div>
          )}
          {!isViewer && (
            <button onClick={() => setShowCreateCapsule(true)} style={{ position: "absolute", bottom: capsuleBottom, right: capsules.length > 0 ? 50 : 22, zIndex: 12, background: P.glass, border: `1px dashed rgba(200,168,96,.35)`, borderRadius: 7, cursor: "pointer", fontSize: 9, color: P.textMuted, padding: "3px 9px", fontFamily: "inherit", transition: "right .3s" }}>+ Capsule</button>
          )}
        </>;
      })()}

      {/* SLIDER */}
      <Suspense fallback={null}><TimelineSlider
        sliderDate={sliderDate}
        sliderVal={sliderVal}
        totalDays={totalDays}
        effectiveStartDate={effectiveStartDate}
        sorted={sorted}
        milestones={milestones}
        chapters={config.chapters}
        selectedId={selected?.id}
        isMyWorld={isMyWorld}
        isPartnerWorld={isPartnerWorld}
        isAnimating={isAnimating}
        areTogether={areTogether}
        pos={pos}
        entryCount={data.entries.length}
        firstEntryCity={data.entries[0]?.city}
        TYPES={TYPES}
        DEFAULT_TYPE={DEFAULT_TYPE}
        isMobile={isMobile}
        onJumpNext={jumpNext}
        onStepDay={stepDay}
        onSliderChange={setSliderDate}
        onSelectEntry={(e) => {
          setSelected(e); setSliderDate(e.dateStart);
          flyTo(e.lat, e.lng, 2.5);
        }}
      /></Suspense>

      {/* LOCATION LIST — multiple chapters at same place */}
      {locationList && !selected && (
        <Suspense fallback={null}><LocationListPopup
          locationList={locationList} setLocationList={setLocationList}
          TYPES={TYPES} DEFAULT_TYPE={DEFAULT_TYPE} P={P}
          isMobile={isMobile} isLandscape={isLandscape}
          fmtDate={fmtDate} setSelected={setSelected} setSliderDate={setSliderDate}
        /></Suspense>
      )}

      {/* DETAIL CARD */}
      {cur && !editing && (
        <Suspense fallback={null}><DetailCard
          entry={cur}
          data={data}
          dispatch={dispatch}
          db={db}
          isMyWorld={isMyWorld}
          isPartnerWorld={isPartnerWorld}
          isSharedWorld={isSharedWorld}
          isViewer={isViewer}
          worldId={worldId}
          userId={userId}
          TYPES={TYPES}
          DEFAULT_TYPE={DEFAULT_TYPE}
          FIELD_LABELS={FIELD_LABELS}
          sorted={sorted}
          firstBadges={firstBadges}
          togetherIndex={togetherIndex}
          entryStickers={entryStickers}
          handwrittenMode={handwrittenMode}
          memberNameMap={memberNameMap}
          worldReactions={worldReactions}
          setWorldReactions={setWorldReactions}
          entryComments={entryComments}
          setEntryComments={setEntryComments}
          userDisplayName={userDisplayName}
          shareWorlds={shareWorlds}
          setShareWorlds={setShareWorlds}
          isMobile={isMobile}
          isLandscape={isLandscape}
          flyTo={flyTo}
          showToast={showToast}
          onClose={() => { setSelected(null); setLightboxOpen(false); tSpinSpd.current = 0.002; }}
          onEdit={entry => setEditing(entry)}
          onSelectEntry={entry => setSelected(entry)}
          onDuplicate={entry => {
            const dup = { ...entry, id: `e-${Date.now()}`, dateStart: todayStr(), dateEnd: "", photos: [], notes: entry.notes ? `(Copy) ${entry.notes}` : "" };
            dispatch({ type: "ADD", entry: dup });
            setSelected(dup); showToast("Entry duplicated", "📋", 2000);
          }}
          onTripCard={entry => setTripCardEntry(entry)}
          handlePhotos={handlePhotos}
          uploadLockRef={uploadLockRef}
          setUploading={setUploading}
          setUploadProgress={setUploadProgress}
          showLinkPicker={modals.showLinkPicker}
          setShowLinkPicker={(v) => modalDispatch({ type: v ? 'OPEN' : 'CLOSE', name: 'showLinkPicker' })}
          linkedEntryId={linkedEntryId}
          setLinkedEntryId={setLinkedEntryId}
          setLightboxOpen={setLightboxOpen}
          setLightboxIdx={setLightboxIdx}
          setSliderDate={setSliderDate}
          loadAllWorldReactions={loadAllWorldReactions}
          toggleReaction={toggleReaction}
          loadComments={loadComments}
          addComment={addComment}
          deleteComment={deleteComment}
          loadMyWorlds={loadMyWorlds}
          shareEntryToWorld={shareEntryToWorld}
          getPersonalWorldId={getPersonalWorldId}
          musicRef={musicRef}
        /></Suspense>
      )}

      {/* ADD / EDIT / SETTINGS / LETTER overlays */}
      {modals.showAdd && <div role="dialog" aria-modal="true" aria-label="Add entry" onClick={() => modalDispatch({ type: 'CLOSE', name: 'showAdd' })} style={{ position: "fixed", inset: 0, zIndex: 39 }}><div onClick={e => e.stopPropagation()}><AddForm types={TYPES} defaultType={isMyWorld ? "adventure" : "together"} defaultWho={isMyWorld ? "solo" : "both"} fieldLabels={FIELD_LABELS} isMyWorld={isMyWorld} worldName={worldName} worldType={worldType} draftKey={`cosmos-draft-add-${worldId || worldMode}`} onAdd={entry => { const isFirst = data.entries.length === 0; dispatch({ type: "ADD", entry }); modalDispatch({ type: 'CLOSE', name: 'showAdd' }); if (isFirst) { setCelebrationData({ type: 'first', message: 'Your First Entry!', sub: isMyWorld ? 'Your world has its first marker. Keep adding adventures to light up your globe.' : 'Your shared world has its first marker. This is where your story begins.' }); modalDispatch({ type: 'OPEN', name: 'showCelebration' }); setTimeout(() => modalDispatch({ type: 'CLOSE', name: 'showCelebration' }), 6000); } showToast(`${entry.city} added to your world`, "🌍", 2500); flyTo(entry.lat, entry.lng, 2.6); setTimeout(() => { setSelected(entry); }, 400); }} onClose={() => modalDispatch({ type: 'CLOSE', name: 'showAdd' })} /></div></div>}
      {modals.quickAddMode && <div role="dialog" aria-modal="true" aria-label="Quick add entry" onClick={() => modalDispatch({ type: 'CLOSE', name: 'quickAddMode' })} style={{ position: "fixed", inset: 0, zIndex: 39 }}><div onClick={e => e.stopPropagation()}><QuickAddForm types={TYPES} draftKey={`cosmos-draft-quick-${worldId || worldMode}`} onAdd={entry => { const isFirst = data.entries.length === 0; dispatch({ type: "ADD", entry }); modalDispatch({ type: 'CLOSE', name: 'quickAddMode' }); if (isFirst) { setCelebrationData({ type: 'first', message: 'Your First Entry!', sub: isMyWorld ? 'Your world has its first marker. Keep adding adventures to light up your globe.' : 'Your shared world has its first marker. This is where your story begins.' }); modalDispatch({ type: 'OPEN', name: 'showCelebration' }); setTimeout(() => modalDispatch({ type: 'CLOSE', name: 'showCelebration' }), 6000); } showToast(`${entry.city} added to your world ⚡`, "⚡", 2500); flyTo(entry.lat, entry.lng, 2.6); setTimeout(() => { setSelected(entry); }, 400); }} onClose={() => modalDispatch({ type: 'CLOSE', name: 'quickAddMode' })} /></div></div>}

      {editing && <div role="dialog" aria-modal="true" aria-label="Edit entry" onClick={() => setEditing(null)} style={{ position: "fixed", inset: 0, zIndex: 29 }}><div onClick={e => e.stopPropagation()}><EditForm entry={editing} types={TYPES} fieldLabels={FIELD_LABELS} worldType={worldType} isMyWorld={isMyWorld} onChange={setEditing}
        onSave={() => { dispatch({ type: "UPDATE", id: editing.id, data: editing }); setSelected(editing); setEditing(null); showToast("Entry saved", "✓", 2000); }}
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

      {(showLetter || modals.editLetter) && <Suspense fallback={null}><LoveLetterOverlay
        showLetterId={showLetter}
        editLetter={modals.editLetter}
        letters={config.loveLetters || []}
        config={{...config, worldName}}
        userId={userId}
        letterEditId={letterEditId}
        initialDraft={letterDraft}
        initialCity={letterCity}
        initialLat={letterLat}
        initialLng={letterLng}
        worldType={worldType}
        isMyWorld={isMyWorld}
        onCloseLetter={() => setShowLetter(null)}
        onCloseEdit={() => modalDispatch({ type: 'CLOSE', name: 'editLetter' })}
        onEditLetter={(letter) => { setLetterEditId(letter.id); setLetterDraft(letter.text); setLetterCity(letter.city || ""); setLetterLat(letter.lat?.toString() || ""); setLetterLng(letter.lng?.toString() || ""); modalDispatch({ type: 'OPEN', name: 'editLetter' }); setShowLetter(null); }}
        onSendLetter={(letter) => { setConfig({ loveLetters: (config.loveLetters || []).map(l => l.id === letter.id ? { ...l, draft: false } : l) }); setShowLetter(null); showToast(isPartnerWorld ? "Letter sent! 💌" : "Note sent! ✉️", isPartnerWorld ? "💌" : "✉️", 2500); }}
        onRemoveLetter={(letter) => { setConfig({ loveLetters: (config.loveLetters || []).filter(l => l.id !== letter.id) }); setShowLetter(null); }}
        onSaveLetter={(editId, letterObj) => {
          if (editId) {
            setConfig({ loveLetters: (config.loveLetters || []).map(l => l.id === editId ? { ...l, ...letterObj } : l) });
          } else {
            setConfig({ loveLetters: [...(config.loveLetters || []), { id: `ll-${Date.now()}`, author: userId, ...letterObj }] });
          }
          modalDispatch({ type: 'CLOSE', name: 'editLetter' });
          const _mi = isMyWorld || worldType === "personal" ? "✦" : worldType === "friends" ? "✧" : worldType === "family" ? "♥" : "❀";
          const _ei = isPartnerWorld ? "💌" : "✉️";
          showToast(editId ? `Updated ${_ei}` : `Hidden on the globe ${_mi}`, _ei, 2500);
        }}
        onSaveDraft={(editId, letterObj) => {
          if (editId) {
            setConfig({ loveLetters: (config.loveLetters || []).map(l => l.id === editId ? { ...l, ...letterObj } : l) });
          } else {
            setConfig({ loveLetters: [...(config.loveLetters || []), { id: `ll-${Date.now()}`, author: userId, ...letterObj }] });
          }
          modalDispatch({ type: 'CLOSE', name: 'editLetter' });
          showToast("Draft saved 📝", "📝", 2000);
        }}
      /></Suspense>}

      {/* TIME CAPSULE OVERLAY */}
      {(showCapsule || showCreateCapsule) && <Suspense fallback={null}><TimeCapsuleOverlay
        showCapsuleId={showCapsule}
        showCreate={showCreateCapsule}
        capsules={config.timeCapsules || []}
        config={config}
        isViewer={isViewer}
        worldType={worldType}
        isMyWorld={isMyWorld}
        onCloseView={() => setShowCapsule(null)}
        onCloseCreate={() => setShowCreateCapsule(false)}
        onSaveCapsule={(capsule) => {
          setConfig({ timeCapsules: [...(config.timeCapsules || []), capsule] });
          setShowCreateCapsule(false);
          showToast("Time capsule sealed! 🔮", "🔮", 3000);
        }}
        onRemoveCapsule={(capsule) => {
          setConfig({ timeCapsules: (config.timeCapsules || []).filter(c => c.id !== capsule.id) });
          setShowCapsule(null);
          showToast("Time capsule removed", "🗑", 2000);
        }}
      /></Suspense>}

      {/* GALLERY PANEL — slides out from left, not a full overlay */}
      {modals.showGallery && <Suspense fallback={null}><GalleryPanel
        allPhotos={allPhotos}
        allPhotoCaptions={allPhotoCaptions}
        polaroidMode={false}
        onTogglePolaroid={() => {}}
        isMobile={isMobile}
        onSelectPhoto={(ph) => {
          const entry = data.entries.find(e => e.id === ph.id);
          if (entry) {
            setSelected(entry); modalDispatch({ type: 'CLOSE', name: 'showGallery' });
            flyTo(entry.lat, entry.lng, 2.5);
            setSliderDate(entry.dateStart);
          }
        }}
        onClose={() => modalDispatch({ type: 'CLOSE', name: 'showGallery' })}
      /></Suspense>}

      {/* ON THIS DAY — memory from a previous year */}
      {onThisDayEntry && (() => {
        const e = onThisDayEntry;
        const yearsAgo = new Date().getFullYear() - parseInt(e.dateStart.slice(0, 4));
        return (
          <div style={{ position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 45, animation: "fadeIn .8s ease" }}>
            <button onClick={() => {
              setSelected(e); setSliderDate(e.dateStart);
              flyTo(e.lat, e.lng, 2.5); setOnThisDayEntry(null);
            }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: P.card, backdropFilter: "blur(16px)", borderRadius: 16, border: `1px solid ${P.goldWarm}20`, boxShadow: `0 4px 20px rgba(0,0,0,.1), 0 0 30px ${P.goldWarm}08`, cursor: "pointer", fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", maxWidth: "90vw" }}>
              {e.photos?.length > 0 && <img loading="lazy" src={thumbnail(e.photos[0], 72)} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", border: "2px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,.15)" }} />}
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 10, color: P.goldWarm, letterSpacing: ".12em", textTransform: "uppercase" }}>On this day · {yearsAgo} year{yearsAgo > 1 ? "s" : ""} ago</div>
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
      {isPlaying && cinemaEntry && <Suspense fallback={null}><CinemaOverlay
        entry={cinemaEntry}
        typeInfo={TYPES[cinemaEntry.type] || DEFAULT_TYPE}
        photoIdx={cinemaPhotoIdx}
        progress={cinemaProgress}
        total={cinemaTotal}
        currentIdx={cinemaIdx}
        phase={cinemaPhase}
        sceneColors={SC}
        isMyWorld={isMyWorld}
        isPartnerWorld={isPartnerWorld}
        onStop={stopPlay}
      /></Suspense>}

      {/* DREAM DESTINATIONS PANEL */}
      {modals.showDreams && <Suspense fallback={null}><DreamPanel
        dreams={config.dreamDestinations || []}
        visitedCount={config.dreamsVisited || 0}
        isMyWorld={isMyWorld}
        isPartnerWorld={isPartnerWorld}
        worldType={worldType}
        isViewer={isViewer}
        onClose={() => modalDispatch({ type: 'CLOSE', name: 'showDreams' })}
        onMarkVisited={(dream) => {
          const defaultType = isMyWorld ? "adventure" : isPartnerWorld ? "together" : worldType === "friends" ? "group-trip" : worldType === "family" ? "family-trip" : "together";
          const defaultWho = isMyWorld ? "solo" : isPartnerWorld ? "both" : "group";
          const entry = { id: `e${Date.now()}`, city: dream.city, country: dream.country, lat: dream.lat, lng: dream.lng, dateStart: todayStr(), type: defaultType, who: defaultWho, notes: dream.notes || "", memories: [], museums: [], restaurants: [], highlights: [], photos: [], stops: [] };
          dispatch({ type: "ADD", entry });
          setConfig({ dreamDestinations: (config.dreamDestinations || []).filter(d => d.id !== dream.id), dreamsVisited: (config.dreamsVisited || 0) + 1 });
          showToast(`${dream.city} is now real! ✨`, "🎉", 3000);
          modalDispatch({ type: 'CLOSE', name: 'showDreams' });
          flyTo(dream.lat, dream.lng, 2.5);
          setTimeout(() => { setSelected(entry); }, 400);
        }}
        onRemoveDream={(dream) => setConfig({ dreamDestinations: (config.dreamDestinations || []).filter(d => d.id !== dream.id) })}
        onAddDream={(dream) => {
          setConfig({ dreamDestinations: [...(config.dreamDestinations || []), { ...dream, id: `d${Date.now()}` }] });
          showToast(isMyWorld ? `${dream.city} added to bucket list 🗺` : `${dream.city} added to dreams ✦`, "✦", 2000);
        }}
      /></Suspense>}

      {modals.showSettings && !isViewer && <Suspense fallback={null}><SettingsPanel
        config={config} setConfig={setConfig}
        isMyWorld={isMyWorld} isPartnerWorld={isPartnerWorld} isSharedWorld={isSharedWorld} worldType={worldType}
        worldId={worldId} userId={userId} worldRole={worldRole} worldName={worldName}
        handwrittenMode={handwrittenMode} setHandwrittenMode={setHandwrittenMode}
        ambientRef={ambientRef} ambientPlaying={ambientPlaying}
        onClose={() => modalDispatch({ type: 'CLOSE', name: 'showSettings' })}
        showToast={showToast} flushConfigSave={flushConfigSave}
        exportData={exportData} importData={importData}
        onSwitchWorld={onSwitchWorld} setConfirmModal={setConfirmModal}
        onboardKey={onboardKey} setShowOnboarding={setShowOnboarding} setOnboardStep={setOnboardStep}
      /></Suspense>}

      {data.entries.length === 0 && introComplete && !modals.showAdd && (
        <Suspense fallback={null}><EmptyState
          P={P} config={config} isViewer={isViewer} worldType={worldType}
          isMyWorld={isMyWorld} modalDispatch={modalDispatch} isMobile={isMobile}
        /></Suspense>
      )}

      {/* STATS DASHBOARD */}
      {modals.showStats && <StatsOverlay P={P} stats={stats} expandedStats={expandedStats} reunionStats={reunionStats} milestones={milestones} isMyWorld={isMyWorld} isPartnerWorld={isPartnerWorld} fmtDate={fmtDate} startRecap={startRecap} onClose={() => modalDispatch({ type: 'CLOSE', name: 'showStats' })} setTripCardEntry={setTripCardEntry} config={config} worldName={worldName} worldType={worldType} />}

      {/* YEAR-IN-REVIEW RECAP — Full-screen cinematic */}
      {modals.showRecap && recapEntries.length > 0 && recapYearStats && <RecapOverlay
        P={P} SC={SC} TYPES={TYPES} DEFAULT_TYPE={DEFAULT_TYPE} thumbnail={thumbnail} fmtDate={fmtDate} navSt={navStyle}
        recapYear={recapYear} recapYearStats={recapYearStats} recapEntries={recapEntries}
        recapPhase={recapPhase} recapIdx={recapIdx} recapStatIdx={recapStatIdx} recapAutoPlay={recapAutoPlay}
        setRecapPhase={setRecapPhase} setRecapIdx={setRecapIdx} setRecapStatIdx={setRecapStatIdx} setRecapAutoPlay={setRecapAutoPlay}
        setSliderDate={setSliderDate} setSelected={setSelected} setPhotoIdx={() => {}} setCardTab={() => {}} setTripCardEntry={setTripCardEntry}
        onClose={closeRecap} flyTo={flyTo}
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

      {/* ON THIS DAY — anniversary replay card */}
      {onThisDay.length > 0 && introComplete && !modals.showStats && !modals.showRecap && toasts.length === 0 && !selected && !editing && !modals.showAdd && !dismissOnThisDay && <Suspense fallback={null}><OnThisDayCard onThisDay={onThisDay} dismissOnThisDay={dismissOnThisDay} setDismissOnThisDay={setDismissOnThisDay} selected={selected} editing={editing} modals={modals} TYPES={TYPES} DEFAULT_TYPE={DEFAULT_TYPE} P={P} config={config} isPartnerWorld={isPartnerWorld} worldType={worldType} flyTo={flyTo} setSliderDate={setSliderDate} setSelected={setSelected} playStory={playStory} introComplete={introComplete} fmtDate={fmtDate} entries={data.entries} /></Suspense>}

      {/* ONBOARDING OVERLAY */}
      {showOnboarding && introComplete && <OnboardingOverlay worldName={worldName} worldType={worldType} isSharedWorld={isSharedWorld} isPartnerWorld={isPartnerWorld} isMyWorld={isMyWorld} onboardStep={onboardStep} setOnboardStep={setOnboardStep} onClose={() => setShowOnboarding(false)} onboardKey={onboardKey} />}


      {/* FIRST ENTRY CELEBRATION */}
      {modals.showCelebration && <Suspense fallback={null}><CelebrationOverlay celebrationData={celebrationData} onClose={() => modalDispatch({ type: 'CLOSE', name: 'showCelebration' })} P={P} config={config} /></Suspense>}
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
      {modals.showPhotoJourney && allPhotos.length > 0 && <Suspense fallback={null}><PhotoJourneyOverlay allPhotos={allPhotos} sortedEntries={sorted} pjIndex={pjIndex} setPjIndex={setPjIndex} pjAutoPlay={pjAutoPlay} setPjAutoPlay={setPjAutoPlay} onClose={() => modalDispatch({ type: 'CLOSE', name: 'showPhotoJourney' })} showToast={showToast} P={P} /></Suspense>}

      {/* EASTER EGG — visible when zoomed all the way out (partner worlds only) */}
      {isPartnerWorld && isSharedWorld && (
        <div ref={easterEggRef} style={{ position: "absolute", top: "12%", left: "50%", transform: "translateX(-50%)", zIndex: 5, textAlign: "center", pointerEvents: "none", opacity: 0, transition: "opacity .8s" }}>
          <div style={{ fontSize: 14, color: "#c9a96e", letterSpacing: "6px", fontWeight: 300, textShadow: "0 0 20px rgba(200,170,110,0.4), 0 0 40px rgba(200,170,110,0.2)", fontFamily: "'Palatino Linotype',serif" }}>
            you are my world
          </div>
        </div>
      )}

      {/* KEYBOARD SHORTCUTS OVERLAY */}
      {modals.showShortcuts && <Suspense fallback={<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(8,6,18,0.7)",backdropFilter:"blur(8px)"}}><div style={{color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Palatino Linotype',Georgia,serif",letterSpacing:".05em"}}>Loading…</div></div>}><KeyboardShortcuts onClose={() => modalDispatch({ type: 'CLOSE', name: 'showShortcuts' })} palette={P} worldMode={worldMode} /></Suspense>}

      {/* FULLSCREEN PHOTO LIGHTBOX */}
      {lightboxOpen && cur?.photos?.length > 0 && <Suspense fallback={null}><PhotoLightbox photos={cur.photos} lightboxIdx={lightboxIdx} setLightboxIdx={setLightboxIdx} onClose={() => setLightboxOpen(false)} isViewer={isViewer} dispatch={dispatch} entryId={cur.id} photoCaptions={cur.photoCaptions} P={P} city={cur.city} country={cur.country} /></Suspense>}

      {/* LAZY-LOADED OVERLAYS{/* LAZY-LOADED OVERLAYS — code-split, only fetched when opened */}
      {modals.showPhotoMap && <OverlayBoundary onClose={() => modalDispatch({ type: 'CLOSE', name: 'showPhotoMap' })}><Suspense fallback={<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(8,6,18,0.7)",backdropFilter:"blur(8px)"}}><div style={{color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Palatino Linotype',Georgia,serif",letterSpacing:".05em"}}>Loading…</div></div>}><PhotoMap entries={data.entries} palette={P} onClose={() => modalDispatch({ type: 'CLOSE', name: 'showPhotoMap' })} worldMode={worldMode} /></Suspense></OverlayBoundary>}
      {modals.showMilestones && <OverlayBoundary onClose={() => modalDispatch({ type: 'CLOSE', name: 'showMilestones' })}><Suspense fallback={<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(8,6,18,0.7)",backdropFilter:"blur(8px)"}}><div style={{color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Palatino Linotype',Georgia,serif",letterSpacing:".05em"}}>Loading…</div></div>}><Milestones entries={data.entries} palette={P} onClose={() => modalDispatch({ type: 'CLOSE', name: 'showMilestones' })} worldMode={worldMode} config={config} /></Suspense></OverlayBoundary>}
      {modals.showTravelStats && <OverlayBoundary onClose={() => modalDispatch({ type: 'CLOSE', name: 'showTravelStats' })}><Suspense fallback={<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(8,6,18,0.7)",backdropFilter:"blur(8px)"}}><div style={{color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Palatino Linotype',Georgia,serif",letterSpacing:".05em"}}>Loading…</div></div>}><TravelStats entries={data.entries} stats={stats} palette={P} onClose={() => modalDispatch({ type: 'CLOSE', name: 'showTravelStats' })} worldMode={worldMode} config={config} /></Suspense></OverlayBoundary>}
      {modals.showExportHub && <OverlayBoundary onClose={() => modalDispatch({ type: 'CLOSE', name: 'showExportHub' })}><Suspense fallback={<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(8,6,18,0.7)",backdropFilter:"blur(8px)"}}><div style={{color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Palatino Linotype',Georgia,serif",letterSpacing:".05em"}}>Loading…</div></div>}><ExportHub entries={data.entries} config={config} stats={stats} palette={P} onClose={() => modalDispatch({ type: 'CLOSE', name: 'showExportHub' })} worldMode={worldMode} travelerName={isPartnerWorld ? (config.youName || '') : (config.travelerName || '')} onImport={!isViewer ? (entries) => {
                let count = 0;
                entries.forEach(entry => {
                  const id = entry.id || `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                  dispatch({ type: "ADD", entry: { ...entry, id } });
                  count++;
                });
                showToast(`Imported ${count} entries`, "📥", 4000);
              } : undefined} /></Suspense></OverlayBoundary>}
      {tripCardEntry && <OverlayBoundary onClose={() => setTripCardEntry(null)}><Suspense fallback={<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(8,6,18,0.7)",backdropFilter:"blur(8px)"}}><div style={{color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Palatino Linotype',Georgia,serif",letterSpacing:".05em"}}>Loading…</div></div>}><TripCard entry={tripCardEntry} palette={P} onClose={() => setTripCardEntry(null)} worldMode={worldMode} /></Suspense></OverlayBoundary>}
      {modals.showYearReview && <OverlayBoundary onClose={() => modalDispatch({ type: 'CLOSE', name: 'showYearReview' })}><Suspense fallback={<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(8,6,18,0.7)",backdropFilter:"blur(8px)"}}><div style={{color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Palatino Linotype',Georgia,serif",letterSpacing:".05em"}}>Loading…</div></div>}><YearInReview entries={data.entries} stats={stats} palette={P} onClose={() => modalDispatch({ type: 'CLOSE', name: 'showYearReview' })} worldMode={worldMode} config={config} /></Suspense></OverlayBoundary>}

      {/* ENTRY TEMPLATES */}
      {modals.showTemplates && <EntryTemplates palette={P} worldType={isMyWorld ? "my" : (worldType || "partner")} onApplyTemplate={tpl => {
        modalDispatch({ type: 'CLOSE', name: 'showTemplates' });
        // Create a pre-filled entry from the template
        const entry = { id: `e-${Date.now()}`, city: "", country: tpl.country || "", lat: 0, lng: 0, dateStart: todayStr(), dateEnd: "", type: tpl.type || "adventure", who: isMyWorld ? "solo" : "both", notes: tpl.notes || "", highlights: [...(tpl.highlights || [])], museums: [...(tpl.museums || [])], restaurants: [...(tpl.restaurants || [])], photos: [], favorite: false };
        setEditing(entry);
        showToast(`Template "${tpl.name || "entry"}" applied — fill in the details`, "📋", 3000);
      }} onClose={() => modalDispatch({ type: 'CLOSE', name: 'showTemplates' })} />}

      {/* TRIP JOURNAL */}
      {modals.showTripJournal && <Suspense fallback={null}><TripJournal entries={data.entries} palette={P} types={TYPES} onClose={() => modalDispatch({ type: 'CLOSE', name: 'showTripJournal' })} onSelectEntry={e => { modalDispatch({ type: 'CLOSE', name: 'showTripJournal' }); setSelected(e); }} flyTo={flyTo} /></Suspense>}

      {/* RECENTLY DELETED TRASH */}
      {modals.showTrash && <Suspense fallback={null}><TrashPanel recentlyDeleted={recentlyDeleted} setRecentlyDeleted={setRecentlyDeleted} dispatch={dispatch} TYPES={TYPES} P={P} fmtDate={fmtDate} onClose={() => modalDispatch({ type: 'CLOSE', name: 'showTrash' })} showToast={showToast} worldId={worldId || worldMode} /></Suspense>}

      {/* CONFIRM MODAL */}
      {confirmModal && <Suspense fallback={null}><ConfirmModal confirmModal={confirmModal} onClose={() => setConfirmModal(null)} P={P} /></Suspense>}

      {/* REUNION TOAST — detects when both partners are online simultaneously */}
      {isPartnerWorld && isSharedWorld && <Suspense fallback={null}><ReunionToast onlineUsers={onlineUsers} worldId={worldId} userId={userId} isPartnerWorld={isPartnerWorld} /></Suspense>}

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
        input:focus,textarea:focus,select:focus{outline:none;border-color:${P.rose}!important}
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
