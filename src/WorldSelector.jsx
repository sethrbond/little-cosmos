import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { createWorld, loadMyWorlds, createInvite, createInviteWithLetter, acceptInvite, declineWorldInvite, createViewerInvite, getSentInvites, loadCrossWorldActivity, loadWorldEntryCounts, loadMyWorldEntryCount, searchCrossWorld, deleteWorld, leaveWorld, getPersonalWorldId } from "./supabaseWorlds.js";
import { sendConnectionRequest, acceptConnection, declineConnection, getMyConnections, getPendingRequests } from "./supabaseConnections.js";
import { sendWelcomeLetter } from "./supabaseWelcomeLetters.js";

/* WorldSelector.jsx — "My Cosmos" world chooser
   My World is the central orb. Shared worlds orbit it.
   Friend worlds orbit at a further distance.
   Camera can be dragged/orbited to view from any angle. */

const isTouchDevice = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

const CENTER = {
  id: "my",
  label: "My World",
  sub: "Travel Diary",
  color: "#d0b080",      // warm amber — matches My World palette accent
  glowColor: "#e8d0a8",
  emissive: "#806030",
};

// Type-aware orb colors — each world type has a distinct visual identity on the cosmos screen
const ORB_BY_TYPE = {
  partner: { color: "#d8a0c0", glowColor: "#f0d0e4", emissive: "#884870" },   // rose — matches refreshed partner palette
  friends: { color: "#7880c0", glowColor: "#a8b0d8", emissive: "#343c80" },   // deep sapphire — matches friends palette
  family:  { color: "#d05030", glowColor: "#e87058", emissive: "#8c2010" },   // vivid terracotta-red — matches refreshed family palette
  shared:  { color: "#d8a0c0", glowColor: "#f0d0e4", emissive: "#884870" },   // fallback = partner
};
const ORB_ORBIT_PRESETS = [
  { orbitRadius: 2.4, orbitSpeed: 0.25, size: 0.32 },
  { orbitRadius: 2.8, orbitSpeed: 0.20, size: 0.28 },
  { orbitRadius: 3.2, orbitSpeed: 0.18, size: 0.26 },
  { orbitRadius: 2.6, orbitSpeed: 0.22, size: 0.30 },
  { orbitRadius: 3.0, orbitSpeed: 0.16, size: 0.27 },
  { orbitRadius: 2.5, orbitSpeed: 0.23, size: 0.29 },
];

const FRIEND_ORB_PRESETS = [
  { color: "#c8d8e8", glowColor: "#e0ecf8", emissive: "#405870", orbitRadius: 4.0, orbitSpeed: 0.12, size: 0.20 },
  { color: "#d8c8e0", glowColor: "#ece0f0", emissive: "#584070", orbitRadius: 4.3, orbitSpeed: 0.10, size: 0.18 },
  { color: "#c8e0d0", glowColor: "#e0f0e8", emissive: "#406850", orbitRadius: 4.6, orbitSpeed: 0.11, size: 0.19 },
  { color: "#e0d8c8", glowColor: "#f0ece0", emissive: "#685840", orbitRadius: 4.1, orbitSpeed: 0.13, size: 0.20 },
];

const F = "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif";

// Style constants (module-scope — no state dependency, avoids re-creation each render)
const _modalBg = { position: "fixed", inset: 0, background: "rgba(4,2,10,0.65)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 };
const _modalBox = { background: "rgba(22,16,32,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "32px 28px", width: 400, maxWidth: "90vw", fontFamily: F, boxShadow: "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)" };
const _inputSt = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, color: "#e8e0d0", fontSize: 14, fontFamily: F, outline: "none", boxSizing: "border-box", transition: "border-color .2s" };
const _textareaSt = { ..._inputSt, minHeight: 100, resize: "vertical", lineHeight: 1.6 };
const _btnP = { background: "linear-gradient(135deg, #c9a96e, #b8944f)", border: "none", borderRadius: 12, padding: "10px 24px", color: "#1a1520", fontSize: 13, fontWeight: 600, fontFamily: F, cursor: "pointer", letterSpacing: "0.04em", boxShadow: "0 2px 12px rgba(200,170,110,0.2)" };
const _btnS = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "8px 20px", color: "#a098a8", fontSize: 12, fontFamily: F, cursor: "pointer", transition: "all .2s" };
const _optionCard = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px", textAlign: "left", cursor: "pointer", transition: "all .2s" };

export default function WorldSelector({ onSelect, onSignOut, worlds = [], onWorldsChange, userId, userEmail, userDisplayName, connections = [], onConnectionsChange, pendingRequests = [], onPendingRequestsChange, pendingWorldInvites = [], onPendingWorldInvitesChange, myWorldSubtitle = '', myWorldColors = null, personalWorldId = null }) {
  const mountRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const hoveredRef = useRef(null);
  const [ready, setReady] = useState(false);
  const labelRefsMap = useRef({});
  const dragRef = useRef({ dragging: false, moved: false, prevX: 0, prevY: 0 });
  const pinchRef = useRef({ active: false, startDist: 0 });
  const camAngleRef = useRef({ theta: 0.3, phi: 1.2, radius: 5.8 });
  const mountedRef = useRef(true);
  const toastTimerRef = useRef(null);
  const linkCopiedTimerRef = useRef(null);

  // Stable key for myWorldColors to avoid scene teardown on every parent render
  const colorKey = useMemo(() => JSON.stringify(myWorldColors || {}), [myWorldColors]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (linkCopiedTimerRef.current) clearTimeout(linkCopiedTimerRef.current);
    };
  }, []);

  // Cosmos tour (first visit, per-user) — versioned so bumping ONBOARD_VERSION resets for all
  const cosmosTourKey = userId ? `v3_cosmos_tour_done_${userId}` : "v3_cosmos_tour_done";
  const [showCosmosTour, setShowCosmosTour] = useState(() => { try { return !localStorage.getItem(cosmosTourKey); } catch { return true; } });
  const [cosmosTourStep, setCosmosTourStep] = useState(0);

  // Modal states
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showCreatePersonal, setShowCreatePersonal] = useState(false);
  const [showCreateShared, setShowCreateShared] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(null);
  const [showInviteCosmos, setShowInviteCosmos] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showPendingRequests, setShowPendingRequests] = useState(false);
  const [showWorldInvites, setShowWorldInvites] = useState(false);

  // Create personal world
  const [personalName, setPersonalName] = useState("");
  const [creatingPersonal, setCreatingPersonal] = useState(false);

  // Create shared world
  const [sharedName, setSharedName] = useState("");
  const [sharedType, setSharedType] = useState("partner");
  const [sharedYouName, setSharedYouName] = useState("");
  const [sharedPartnerName, setSharedPartnerName] = useState("");
  const [sharedMembers, setSharedMembers] = useState([{ name: "" }, { name: "" }]);
  const [sharedStep, setSharedStep] = useState(0);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLetter, setInviteLetter] = useState("");
  const [creatingShared, setCreatingShared] = useState(false);
  const [createdWorldId, setCreatedWorldId] = useState(null);
  const [generatedLink, setGeneratedLink] = useState("");

  // Invite from existing world
  const [inviteLink, setInviteLink] = useState("");
  const [inviteGenerating, setInviteGenerating] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [existingInviteEmail, setExistingInviteEmail] = useState("");
  const [existingInviteLetter, setExistingInviteLetter] = useState("");
  const [existingInviteRole, setExistingInviteRole] = useState("member");
  const [sentInvites, setSentInvites] = useState([]);

  // Invite to Cosmos (platform invite)
  const [cosmosInviteEmail, setCosmosInviteEmail] = useState("");
  const [cosmosInviteLetter, setCosmosInviteLetter] = useState("");
  const [cosmosInviteSending, setCosmosInviteSending] = useState(false);
  const [cosmosInviteSent, setCosmosInviteSent] = useState(false);

  // Add a Friend
  const [friendEmail, setFriendEmail] = useState("");
  const [friendLetter, setFriendLetter] = useState("");
  const [friendSending, setFriendSending] = useState(false);
  const [friendSent, setFriendSent] = useState(false);

  // Activity feed
  const [showActivity, setShowActivity] = useState(false);
  const [activityData, setActivityData] = useState([]);
  const [entryCounts, setEntryCounts] = useState({});
  const [myEntryCount, setMyEntryCount] = useState(0);

  // Cross-world search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef(null);
  const searchSeqRef = useRef(0);

  // Build friend worlds from connections
  const friendWorlds = useMemo(() => {
    return connections.map(c => {
      const iAmRequester = c.requester_id === userId;
      const friendName = iAmRequester ? (c.target_email?.split('@')[0] || 'Friend') : (c.requester_name || 'Friend');
      const friendId = iAmRequester ? c.target_user_id : c.requester_id;
      // Can I view their world?
      const canView = iAmRequester || c.share_back;
      if (!canView || !friendId) return null;
      return { id: `friend-${friendId}`, friendUserId: friendId, name: `${friendName}'s World`, type: 'friend' };
    }).filter(Boolean);
  }, [connections, userId]);

  // Build orbiting worlds from props — orb colors match world type palette
  const WORLDS = useMemo(() => worlds.map((w, i) => {
    const typeColors = ORB_BY_TYPE[w.type] || ORB_BY_TYPE.shared;
    const orbit = ORB_ORBIT_PRESETS[i % ORB_ORBIT_PRESETS.length];
    // Build subtitle: user-saved subtitle takes priority; only fall back to auto-generated if subtitle is null/undefined (never saved)
    const configSub = w.subtitle;
    const memberNames = (w.members || []).map(m => m.name).filter(Boolean);
    const namesSub = memberNames.length > 0
      ? w.type === 'family' ? `The ${memberNames[0]} Family`
        : memberNames.length <= 3 ? memberNames.join(', ')
        : `${memberNames.slice(0, 2).join(', ')} & ${memberNames.length - 2} more`
      : (w.youName && w.partnerName) ? `${w.youName} & ${w.partnerName}` : null;
    const typeDefaults = { partner: "every moment, every adventure", friends: "adventures together", family: "family adventures" };
    const roleBadge = w.role === "viewer" ? " (viewing)" : "";
    const displaySub = configSub != null ? configSub : (namesSub ?? typeDefaults[w.type] ?? "shared world");
    return {
      id: w.id,
      label: w.name,
      sub: displaySub + roleBadge,
      isViewer: w.role === "viewer",
      role: w.role || "member",
      worldType: w.type || "shared",
      ...typeColors,
      ...orbit,
      ...(w.role === "viewer" ? { size: 0.22, orbitRadius: (orbit.orbitRadius || 2.6) + 0.4 } : {}),
      ...(w.customScene?.sphereColor ? { color: w.customScene.sphereColor } : w.customPalette?.rose ? { color: w.customPalette.rose } : w.palette?.color ? { color: w.palette.color } : {}),
      ...(w.customScene?.sphereEmissive ? { emissive: w.customScene.sphereEmissive } : {}),
      ...(w.customScene?.particleColor ? { glowColor: w.customScene.particleColor } : w.customPalette?.rose ? { glowColor: w.customPalette.rose + "80" } : {}),
    };
  }), [worlds]);

  // Build friend orbs
  const FRIEND_ORBS = useMemo(() => friendWorlds.map((fw, i) => ({
    id: fw.id,
    friendUserId: fw.friendUserId,
    label: fw.name,
    sub: "Following",
    ...FRIEND_ORB_PRESETS[i % FRIEND_ORB_PRESETS.length],
  })), [friendWorlds]);

  const ALL_ORBS = useMemo(() => [...WORLDS, ...FRIEND_ORBS], [WORLDS, FRIEND_ORBS]);
  const orbIdsKey = useMemo(() => ALL_ORBS.map(o => o.id).join(','), [ALL_ORBS]);

  // Stable key so activity doesn't reload on worlds reference change
  const worldIdsKey = useMemo(() => worlds.map(w => w.id).join(','), [worlds]);

  // Load activity data for cosmos dashboard
  useEffect(() => {
    if (!userId) return;
    const worldIds = worlds.map(w => w.id);
    const allIds = personalWorldId ? [...new Set([...worldIds, personalWorldId])] : worldIds;
    if (allIds.length > 0) {
      loadCrossWorldActivity(allIds, 15).then(d => { if (mountedRef.current) setActivityData(d); }).catch(() => {});
      loadWorldEntryCounts(worldIds).then(d => { if (mountedRef.current) setEntryCounts(d); }).catch(() => {});
    }
    loadMyWorldEntryCount(userId).then(d => { if (mountedRef.current) setMyEntryCount(d); }).catch(() => {});
  }, [userId, worldIdsKey, personalWorldId]);

  // World name map for activity feed
  const worldNameMap = useMemo(() => {
    const m = {};
    if (personalWorldId) m[personalWorldId] = "My World";
    worlds.forEach(w => { m[w.id] = w.name; });
    return m;
  }, [worlds, personalWorldId]);

  // ---- THREE.JS SCENE ----
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let W = mount.clientWidth, H = mount.clientHeight;

    let testCanvas = document.createElement("canvas");
    const gl = testCanvas.getContext("webgl2") || testCanvas.getContext("webgl");
    if (!gl) { testCanvas = null; mount.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#e8e0d0;font-family:serif;font-size:16px;text-align:center;padding:20px">Your browser doesn\'t support WebGL.<br/>Please use a modern browser to view My Cosmos.</div>'; return; }
    const loseCtx = gl.getExtension('WEBGL_lose_context'); if (loseCtx) loseCtx.loseContext();
    testCanvas = null;

    // Performance tier detection
    const cores = navigator.hardwareConcurrency || 2;
    const screenW = window.screen?.width || window.innerWidth;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false;
    const isLowEnd = cores <= 2 || screenW < 400;
    const isMidRange = !isLowEnd && (cores <= 4 || screenW < 768);
    // Particle counts scaled by tier
    const tierStarCount = isLowEnd ? 360 : isMidRange ? 630 : 900;
    const tierAccentStars = isLowEnd ? 24 : isMidRange ? 42 : 60;
    const tierDenseStarCount = isLowEnd ? 400 : isMidRange ? 700 : 1000;
    const tierDustCount = isLowEnd ? 100 : isMidRange ? 180 : 250;
    const tierEnableNebula = !isLowEnd;
    const tierEnableShootingStars = !isLowEnd;
    const tierShootingStarInterval = isMidRange ? 14 : 8; // base seconds between shooting stars

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#08060e");
    scene.fog = new THREE.FogExp2("#08060e", 0.008);
    const cam = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    const rend = new THREE.WebGLRenderer({ antialias: true });
    rend.setSize(W, H);
    rend.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(rend.domElement);

    scene.add(new THREE.AmbientLight("#f0e8f4", 0.7));
    const sun = new THREE.DirectionalLight("#fff8f0", 1.6);
    sun.position.set(3, 3, 4); scene.add(sun);
    const pl1 = new THREE.PointLight("#d8b0e0", 0.7, 20); pl1.position.set(-4, -1, 2); scene.add(pl1);
    const pl2 = new THREE.PointLight("#b0c8e8", 0.5, 16); pl2.position.set(2, 3, -4); scene.add(pl2);
    const pl3 = new THREE.PointLight("#e8c898", 0.4, 14); pl3.position.set(0, -3, -3); scene.add(pl3);

    // Nebula ambient glow — large soft spheres for depth
    [
      { pos: [-6, 2, -10], color: "#2a1838", r: 5, op: 0.12 },
      { pos: [5, -3, -8], color: "#1a2030", r: 4, op: 0.10 },
      { pos: [0, 4, -12], color: "#281828", r: 6, op: 0.08 },
    ].forEach(n => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(n.r, 16, 16),
        new THREE.MeshBasicMaterial({ color: n.color, transparent: true, opacity: n.op, side: THREE.BackSide }));
      m.position.set(...n.pos); scene.add(m);
    });

    // Stars — more, varied sizes, with twinkling
    const starCount = tierStarCount;
    const sP = new Float32Array(starCount * 3);
    const sSizes = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      const r = 12 + Math.random() * 30, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      sP[i*3] = r*Math.sin(ph)*Math.cos(th); sP[i*3+1] = r*Math.sin(ph)*Math.sin(th); sP[i*3+2] = r*Math.cos(ph);
      sSizes[i] = 0.02 + Math.random() * 0.06;
    }
    const sG = new THREE.BufferGeometry(); sG.setAttribute("position", new THREE.BufferAttribute(sP, 3));
    sG.setAttribute("size", new THREE.BufferAttribute(sSizes, 1));
    const starMat = new THREE.PointsMaterial({ color: "#e8e0d0", size: 0.05, transparent: true, opacity: 0.6, sizeAttenuation: true });
    const stars = new THREE.Points(sG, starMat);
    scene.add(stars);
    // Brighter accent stars (fewer, larger)
    const accentCount = tierAccentStars;
    const bsP = new Float32Array(accentCount * 3);
    for (let i = 0; i < accentCount; i++) {
      const r = 14 + Math.random() * 20, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      bsP[i*3] = r*Math.sin(ph)*Math.cos(th); bsP[i*3+1] = r*Math.sin(ph)*Math.sin(th); bsP[i*3+2] = r*Math.cos(ph);
    }
    const bsG = new THREE.BufferGeometry(); bsG.setAttribute("position", new THREE.BufferAttribute(bsP, 3));
    scene.add(new THREE.Points(bsG, new THREE.PointsMaterial({ color: "#f8f0e0", size: 0.09, transparent: true, opacity: 0.8 })));

    // === VISUAL ENHANCEMENT A: Dense twinkling starfield ===
    const denseStarCount = tierDenseStarCount;
    const dsPos = new Float32Array(denseStarCount * 3);
    const dsSizes = new Float32Array(denseStarCount);
    const dsPhases = new Float32Array(denseStarCount);
    const dsTwinkle = new Uint8Array(denseStarCount); // 1 = twinkles, 0 = static
    const dsColors = new Float32Array(denseStarCount * 3);
    for (let i = 0; i < denseStarCount; i++) {
      const r = 8 + Math.random() * 35, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      dsPos[i*3] = r*Math.sin(ph)*Math.cos(th); dsPos[i*3+1] = r*Math.sin(ph)*Math.sin(th); dsPos[i*3+2] = r*Math.cos(ph);
      dsSizes[i] = 0.3 + Math.random() * 1.2;
      dsPhases[i] = Math.random() * Math.PI * 2;
      dsTwinkle[i] = Math.random() < 0.3 ? 1 : 0; // 30% of stars twinkle
      // Warm/cool white variation
      const warmth = Math.random();
      if (warmth < 0.4) { dsColors[i*3] = 0.95; dsColors[i*3+1] = 0.90; dsColors[i*3+2] = 0.80; } // warm
      else if (warmth < 0.7) { dsColors[i*3] = 0.85; dsColors[i*3+1] = 0.90; dsColors[i*3+2] = 0.98; } // cool
      else { dsColors[i*3] = 0.92; dsColors[i*3+1] = 0.88; dsColors[i*3+2] = 0.95; } // neutral lavender
    }
    const dsGeo = new THREE.BufferGeometry();
    dsGeo.setAttribute("position", new THREE.BufferAttribute(dsPos, 3));
    dsGeo.setAttribute("color", new THREE.BufferAttribute(dsColors, 3));
    const dsMat = new THREE.PointsMaterial({ size: 0.06, transparent: true, opacity: 0.7, vertexColors: true, sizeAttenuation: true, depthWrite: false });
    const denseStars = new THREE.Points(dsGeo, dsMat);
    scene.add(denseStars);

    // === VISUAL ENHANCEMENT B: Nebula cloud sprites (skipped on low-end) ===
    const nebulaSprites = [];
    if (tierEnableNebula) {
      const makeNebulaTexture = (color) => {
        const c = document.createElement("canvas"); c.width = 256; c.height = 256;
        const ctx = c.getContext("2d");
        const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        grad.addColorStop(0, color + "40");
        grad.addColorStop(0.3, color + "20");
        grad.addColorStop(0.7, color + "08");
        grad.addColorStop(1, color + "00");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
        const tex = new THREE.CanvasTexture(c);
        return tex;
      };
      const nebulaConfigs = [
        { pos: [-8, 3, -14], color: "#2a1045", scale: 12, baseOp: 0.15, driftSpeed: 0.0003 },
        { pos: [7, -4, -11], color: "#0a1628", scale: 10, baseOp: 0.12, driftSpeed: 0.0005 },
        { pos: [3, 6, -16], color: "#1a0a1a", scale: 14, baseOp: 0.10, driftSpeed: 0.0004 },
        { pos: [-5, -5, -9], color: "#180c28", scale: 8, baseOp: 0.13, driftSpeed: 0.0006 },
      ];
      nebulaConfigs.forEach(nc => {
        const tex = makeNebulaTexture(nc.color);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: nc.baseOp, depthWrite: false, blending: THREE.AdditiveBlending });
        const sprite = new THREE.Sprite(mat);
        sprite.position.set(...nc.pos);
        sprite.scale.set(nc.scale, nc.scale, 1);
        scene.add(sprite);
        nebulaSprites.push({ sprite, mat, tex, config: nc, angle: Math.random() * Math.PI * 2 });
      });
    }

    // === VISUAL ENHANCEMENT C: Shooting stars (skipped on low-end and reduced-motion) ===
    const shootingStars = [];
    let nextShootTime = tierShootingStarInterval + Math.random() * 7;
    const spawnShootingStar = () => {
      if (!tierEnableShootingStars || prefersReducedMotion) return;
      // Random start position on a sphere shell
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      const r = 10 + Math.random() * 8;
      const sx = r*Math.sin(ph)*Math.cos(th), sy = r*Math.sin(ph)*Math.sin(th), sz = r*Math.cos(ph);
      // Direction: partially toward center with randomness
      const dx = -sx * 0.3 + (Math.random() - 0.5) * 4;
      const dy = -sy * 0.3 + (Math.random() - 0.5) * 4;
      const dz = -sz * 0.3 + (Math.random() - 0.5) * 4;
      const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
      const speed = 6 + Math.random() * 4;
      const ndx = dx/len * speed, ndy = dy/len * speed, ndz = dz/len * speed;
      const tailLen = 0.8 + Math.random() * 0.6;
      const positions = new Float32Array([sx, sy, sz, sx - ndx * tailLen * 0.05, sy - ndy * tailLen * 0.05, sz - ndz * tailLen * 0.05]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({ color: "#f0e8d0", transparent: true, opacity: 0.9, linewidth: 1 });
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      shootingStars.push({ line, geo, mat, x: sx, y: sy, z: sz, dx: ndx, dy: ndy, dz: ndz, life: 0, maxLife: 0.4 + Math.random() * 0.3, tailLen });
    };

    // === VISUAL ENHANCEMENT D: Cosmic dust particle field ===
    const dustCount = tierDustCount;
    const dustPos = new Float32Array(dustCount * 3);
    const dustVel = new Float32Array(dustCount * 3);
    const dustPhase = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      const r = 3 + Math.random() * 12, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      dustPos[i*3] = r*Math.sin(ph)*Math.cos(th); dustPos[i*3+1] = r*Math.sin(ph)*Math.sin(th); dustPos[i*3+2] = r*Math.cos(ph);
      dustVel[i*3] = (Math.random() - 0.5) * 0.003; dustVel[i*3+1] = (Math.random() - 0.5) * 0.002; dustVel[i*3+2] = (Math.random() - 0.5) * 0.003;
      dustPhase[i] = Math.random() * Math.PI * 2;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({ color: "#c8b8d8", size: 0.025, transparent: true, opacity: 0.3, sizeAttenuation: true, depthWrite: false });
    const cosmicDust = new THREE.Points(dustGeo, dustMat);
    scene.add(cosmicDust);

    // Center orb — use custom colors if user has set them (parsed from stable colorKey)
    const parsedColors = JSON.parse(colorKey);
    const myScene = parsedColors?.customScene || {};
    const myPal = parsedColors?.customPalette || {};
    const centerColor = myScene.sphereColor || myPal.rose || CENTER.color;
    const centerEmissive = myScene.sphereEmissive || CENTER.emissive;
    const centerGlow = myScene.particleColor || myPal.rose || CENTER.glowColor;
    const centerOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 48, 48),
      new THREE.MeshPhongMaterial({ color: centerColor, emissive: centerEmissive, emissiveIntensity: 1.2, shininess: 30 })
    );
    scene.add(centerOrb);
    [0.74, 0.78, 0.84, 0.92, 1.02, 1.15, 1.35, 1.6, 1.9].forEach((r, i) => {
      const op = [0.35, 0.30, 0.24, 0.20, 0.16, 0.12, 0.08, 0.05, 0.03][i];
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24),
        new THREE.MeshBasicMaterial({ color: centerGlow, transparent: true, opacity: op, side: THREE.BackSide })));
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.72, 32, 32),
      new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.12, side: THREE.FrontSide })));

    // Surface sparkle particles for center orb
    const centerSparkleCount = 40;
    const cSparkPos = new Float32Array(centerSparkleCount * 3);
    const cSparkPhase = new Float32Array(centerSparkleCount); // random phase offsets
    for (let i = 0; i < centerSparkleCount; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      const r = 0.72;
      cSparkPos[i*3] = r*Math.sin(ph)*Math.cos(th); cSparkPos[i*3+1] = r*Math.sin(ph)*Math.sin(th); cSparkPos[i*3+2] = r*Math.cos(ph);
      cSparkPhase[i] = Math.random() * Math.PI * 2;
    }
    const cSparkGeo = new THREE.BufferGeometry();
    cSparkGeo.setAttribute("position", new THREE.BufferAttribute(cSparkPos, 3));
    const cSparkMat = new THREE.PointsMaterial({ color: centerGlow, size: 0.04, transparent: true, opacity: 0.9, depthWrite: false });
    const centerSparkles = new THREE.Points(cSparkGeo, cSparkMat);
    centerOrb.add(centerSparkles);

    // Type-specific sparkle configs
    const SPARKLE_BY_TYPE = {
      partner:  { count: 24, size: 0.018, speed: 1.8, spread: 1.15 },  // warm, intimate shimmer
      friends:  { count: 32, size: 0.014, speed: 2.8, spread: 1.25 },  // energetic, lively
      family:   { count: 20, size: 0.020, speed: 1.2, spread: 1.10 },  // gentle, steady glow
      shared:   { count: 24, size: 0.016, speed: 2.0, spread: 1.20 },  // balanced
      friend:   { count: 16, size: 0.012, speed: 1.5, spread: 1.15 },  // subtle distant shimmer
    };

    // Orbiting worlds (shared + friend)
    const orbs = ALL_ORBS.map((w, idx) => {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(w.size, 32, 32),
        new THREE.MeshPhongMaterial({ color: w.color, emissive: w.emissive, emissiveIntensity: 1.2, shininess: 30 }));
      [0.08, 0.16, 0.28, 0.44, 0.65].forEach((d, i) => {
        const op = [0.35, 0.25, 0.16, 0.10, 0.05][i];
        orb.add(new THREE.Mesh(new THREE.SphereGeometry(w.size + d, 24, 24),
          new THREE.MeshBasicMaterial({ color: w.glowColor, transparent: true, opacity: op, side: THREE.BackSide })));
      });
      orb.add(new THREE.Mesh(new THREE.SphereGeometry(w.size * 0.98, 24, 24),
        new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.10, side: THREE.FrontSide })));

      // Type-specific surface sparkle particles
      const wType = w.worldType || (w.id?.startsWith("friend-") ? "friend" : "shared");
      const sparkCfg = SPARKLE_BY_TYPE[wType] || SPARKLE_BY_TYPE.shared;
      const sCount = sparkCfg.count;
      const sPos = new Float32Array(sCount * 3);
      const sPhase = new Float32Array(sCount);
      for (let i = 0; i < sCount; i++) {
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        const r = w.size * sparkCfg.spread;
        sPos[i*3] = r*Math.sin(ph)*Math.cos(th); sPos[i*3+1] = r*Math.sin(ph)*Math.sin(th); sPos[i*3+2] = r*Math.cos(ph);
        sPhase[i] = Math.random() * Math.PI * 2;
      }
      const sGeo = new THREE.BufferGeometry();
      sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
      const sMat = new THREE.PointsMaterial({ color: w.glowColor, size: sparkCfg.size, transparent: true, opacity: 0.8, depthWrite: false });
      const sparkles = new THREE.Points(sGeo, sMat);
      orb.add(sparkles);

      scene.add(orb);
      return { mesh: orb, world: w, angleOffset: (idx / Math.max(ALL_ORBS.length, 1)) * Math.PI * 2, sparkles, sparkMat: sMat, sparkPhase: sPhase, sparkCfg };
    });

    // Per-orbit glowing rings — each world gets its own subtle ring
    const orbitRings = [];
    const seenRadii = new Set();
    ALL_ORBS.forEach(w => {
      const rKey = Math.round(w.orbitRadius * 10);
      if (seenRadii.has(rKey)) return;
      seenRadii.add(rKey);
      const ringGeo = new THREE.RingGeometry(w.orbitRadius - 0.015, w.orbitRadius + 0.015, 96);
      const ringMat = new THREE.MeshBasicMaterial({ color: w.glowColor || "#ffffff", transparent: true, opacity: 0.05, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI * 0.5;
      scene.add(ring);
      orbitRings.push({ mesh: ring, mat: ringMat, baseOp: 0.05 });
    });

    let t = 0, frameId;
    const updateCamera = () => {
      const a = camAngleRef.current;
      cam.position.set(a.radius * Math.sin(a.phi) * Math.cos(a.theta), a.radius * Math.cos(a.phi), a.radius * Math.sin(a.phi) * Math.sin(a.theta));
      cam.lookAt(0, 0, 0);
    };
    updateCamera();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      t += 0.006;
      centerOrb.rotation.y += 0.002;
      centerOrb.scale.setScalar(1 + Math.sin(t * 1.2) * 0.03);
      // Center sparkle twinkle — individual particles fade in/out
      if (centerSparkles.geometry.attributes.position) {
        const sizes = [];
        for (let i = 0; i < centerSparkleCount; i++) {
          const tw = Math.sin(t * 3.0 + cSparkPhase[i]) * 0.5 + 0.5; // 0-1 twinkle
          sizes.push(0.02 + tw * 0.04);
        }
        cSparkMat.size = 0.04; // base size
        cSparkMat.opacity = 0.5 + Math.sin(t * 1.5) * 0.3;
      }
      orbs.forEach((o, i) => {
        const angle = o.angleOffset + t * o.world.orbitSpeed;
        o.mesh.position.set(Math.cos(angle) * o.world.orbitRadius, Math.sin(angle * 0.7) * 0.15, Math.sin(angle) * o.world.orbitRadius);
        o.mesh.rotation.y += 0.008;
        o.mesh.scale.setScalar(1 + Math.sin(t * 2 + i * 1.5) * 0.03);
        // Per-world sparkle twinkle with type-specific speed
        if (o.sparkMat) {
          const sp = o.sparkCfg.speed;
          o.sparkMat.opacity = 0.4 + Math.sin(t * sp + i * 2.0) * 0.4;
          o.sparkMat.size = o.sparkCfg.size * (0.8 + Math.sin(t * sp * 1.3 + i) * 0.4);
        }
      });
      // Pulse orbit rings gently
      orbitRings.forEach((r, i) => { r.mat.opacity = r.baseOp + Math.sin(t * 0.8 + i * 2) * 0.02; });
      // Slow star field rotation for parallax (skip if reduced motion)
      if (!prefersReducedMotion) {
        stars.rotation.y = t * 0.003;
        denseStars.rotation.y = t * 0.001;
        denseStars.rotation.x = Math.sin(t * 0.2) * 0.002;

        // Dense star twinkle — fluctuate opacity for twinkling subset
        dsMat.opacity = 0.6 + Math.sin(t * 0.7) * 0.1;

        // Nebula drift
        nebulaSprites.forEach(ns => {
          ns.angle += ns.config.driftSpeed;
          ns.sprite.position.x = ns.config.pos[0] + Math.sin(ns.angle) * 0.5;
          ns.sprite.position.y = ns.config.pos[1] + Math.cos(ns.angle * 0.7) * 0.3;
          ns.mat.opacity = ns.config.baseOp + Math.sin(t * 0.3 + ns.angle) * 0.03;
          ns.sprite.material.rotation += ns.config.driftSpeed * 0.5;
        });

        // Shooting stars update
        const dt = 0.006; // matches t += 0.006
        nextShootTime -= dt;
        if (nextShootTime <= 0) {
          spawnShootingStar();
          nextShootTime = tierShootingStarInterval + Math.random() * 7;
        }
        for (let si = shootingStars.length - 1; si >= 0; si--) {
          const s = shootingStars[si];
          s.life += dt;
          const progress = s.life / s.maxLife;
          s.x += s.dx * dt; s.y += s.dy * dt; s.z += s.dz * dt;
          const tailX = s.x - s.dx * s.tailLen * 0.05;
          const tailY = s.y - s.dy * s.tailLen * 0.05;
          const tailZ = s.z - s.dz * s.tailLen * 0.05;
          const posArr = s.geo.attributes.position.array;
          posArr[0] = s.x; posArr[1] = s.y; posArr[2] = s.z;
          posArr[3] = tailX; posArr[4] = tailY; posArr[5] = tailZ;
          s.geo.attributes.position.needsUpdate = true;
          // Fade in then out
          s.mat.opacity = progress < 0.2 ? progress / 0.2 : (1 - (progress - 0.2) / 0.8);
          if (s.life >= s.maxLife) {
            scene.remove(s.line); s.geo.dispose(); s.mat.dispose();
            shootingStars.splice(si, 1);
          }
        }

        // Cosmic dust drift
        const dpa = dustGeo.attributes.position.array;
        for (let i = 0; i < dustCount; i++) {
          dpa[i*3] += dustVel[i*3]; dpa[i*3+1] += dustVel[i*3+1]; dpa[i*3+2] += dustVel[i*3+2];
          // Gentle wobble
          dpa[i*3+1] += Math.sin(t * 0.5 + dustPhase[i]) * 0.0005;
        }
        dustGeo.attributes.position.needsUpdate = true;
        dustMat.opacity = 0.25 + Math.sin(t * 0.4) * 0.05;
      }

      const allItems = [{ id: "my", mesh: centerOrb }, ...orbs.map(o => ({ id: o.world.id, mesh: o.mesh }))];
      allItems.forEach(({ id, mesh }) => {
        const el = labelRefsMap.current[id];
        if (!el) return;
        const v = mesh.position.clone().project(cam);
        el.style.left = (v.x * 0.5 + 0.5) * W + "px";
        el.style.top = (-v.y * 0.5 + 0.5) * H + "px";
        el.style.opacity = v.z < 1 ? (el.dataset.hov === "true" ? "1" : "0.8") : "0";
      });
      rend.render(scene, cam);
    };
    animate();

    const onDown = (e) => { dragRef.current = { dragging: true, moved: false, prevX: e.clientX, prevY: e.clientY }; };
    const onMoveEvt = (e) => {
      if (!dragRef.current.dragging) return;
      const dx = e.clientX - dragRef.current.prevX, dy = e.clientY - dragRef.current.prevY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragRef.current.moved = true;
      camAngleRef.current.theta -= dx * 0.005;
      camAngleRef.current.phi = Math.max(0.3, Math.min(2.8, camAngleRef.current.phi + dy * 0.005));
      dragRef.current.prevX = e.clientX; dragRef.current.prevY = e.clientY;
      updateCamera();
    };
    const onUp = () => { dragRef.current.dragging = false; };
    const onWheelEvt = (e) => {
      e.preventDefault();
      camAngleRef.current.radius = Math.max(3.5, Math.min(10, camAngleRef.current.radius + e.deltaY * 0.005));
      updateCamera();
    };
    mount.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMoveEvt);
    window.addEventListener("pointerup", onUp);
    mount.addEventListener("wheel", onWheelEvt, { passive: false });

    // Pinch-to-zoom for mobile
    const getTouchDist = (t) => {
      const dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };
    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchRef.current = { active: true, startDist: getTouchDist(e.touches) };
      }
    };
    const onTouchMove = (e) => {
      if (e.touches.length === 2 && pinchRef.current.active) {
        e.preventDefault();
        const dist = getTouchDist(e.touches);
        const delta = pinchRef.current.startDist - dist;
        camAngleRef.current.radius = Math.max(3.5, Math.min(10, camAngleRef.current.radius + delta * 0.015));
        pinchRef.current.startDist = dist;
        updateCamera();
      }
    };
    const onTouchEnd = (e) => {
      if (e.touches.length < 2) pinchRef.current.active = false;
    };
    mount.addEventListener("touchstart", onTouchStart, { passive: false });
    mount.addEventListener("touchmove", onTouchMove, { passive: false });
    mount.addEventListener("touchend", onTouchEnd);

    const onResize = () => { W = mount.clientWidth; H = mount.clientHeight; cam.aspect = W / H; cam.updateProjectionMatrix(); rend.setSize(W, H); };
    window.addEventListener("resize", onResize);
    setTimeout(() => setReady(true), 400);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMoveEvt);
      window.removeEventListener("pointerup", onUp);
      mount.removeEventListener("pointerdown", onDown);
      mount.removeEventListener("wheel", onWheelEvt);
      mount.removeEventListener("touchstart", onTouchStart);
      mount.removeEventListener("touchmove", onTouchMove);
      mount.removeEventListener("touchend", onTouchEnd);
      // Clean up shooting stars still in flight
      shootingStars.forEach(s => { scene.remove(s.line); s.geo.dispose(); s.mat.dispose(); });
      shootingStars.length = 0;
      // Clean up nebula textures
      nebulaSprites.forEach(ns => { ns.tex.dispose(); ns.mat.dispose(); });
      // Traverse disposes all remaining geometries/materials
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else { if (obj.material.map) obj.material.map.dispose(); obj.material.dispose(); }
        }
      });
      rend.dispose();
      if (mount.contains(rend.domElement)) mount.removeChild(rend.domElement);
    };
  }, [orbIdsKey, colorKey]);

  // ---- CLICK / HOVER HANDLERS ----
  const handleClick = useCallback((e) => {
    if (dragRef.current.moved) return;
    const rect = mountRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    for (const [id, el] of Object.entries(labelRefsMap.current)) {
      if (!el) continue;
      const lx = parseFloat(el.style.left), ly = parseFloat(el.style.top);
      if (isNaN(lx)) continue;
      if (Math.sqrt((cx - lx) ** 2 + (cy - ly) ** 2) < 75 && parseFloat(el.style.opacity) > 0.1) {
        // On touch devices: first tap shows actions, second tap enters world
        if (isTouchDevice && hoveredRef.current !== id && !id.startsWith("friend-") && id !== "my") {
          hoveredRef.current = id; setHovered(id); return;
        }
        if (id === "my") { onSelect("my", personalWorldId); }
        else if (id.startsWith("friend-")) {
          const friendUserId = id.replace("friend-", "");
          const fw = friendWorlds.find(f => f.friendUserId === friendUserId);
          getPersonalWorldId(friendUserId).then(fwId => {
            if (fwId) onSelect("friend", fwId, fw?.name || "Friend's World", "viewer");
          });
        }
        else { const w = worlds.find(w => w.id === id); onSelect("our", id, w?.name || "Shared World", w?.role || "member", w?.type || "shared"); }
        return;
      }
    }
    // Tapped empty space — clear hovered
    if (isTouchDevice && hoveredRef.current) { hoveredRef.current = null; setHovered(null); }
  }, [onSelect, worlds, friendWorlds, personalWorldId]);

  const handleMove = useCallback((e) => {
    if (dragRef.current.dragging) {
      if (hoveredRef.current !== null) { hoveredRef.current = null; setHovered(null); }
      return;
    }
    const rect = mountRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    let found = null;
    for (const [id, el] of Object.entries(labelRefsMap.current)) {
      if (!el) continue;
      const lx = parseFloat(el.style.left), ly = parseFloat(el.style.top);
      if (isNaN(lx)) continue;
      if (Math.sqrt((cx - lx) ** 2 + (cy - ly) ** 2) < 75 && parseFloat(el.style.opacity) > 0.1) { found = id; break; }
    }
    if (found !== hoveredRef.current) {
      hoveredRef.current = found;
      setHovered(found);
    }
    for (const [id, el] of Object.entries(labelRefsMap.current)) { if (el) el.dataset.hov = (id === found) ? "true" : "false"; }
  }, []);

  const makeLabelRef = useCallback((id) => (el) => { labelRefsMap.current[id] = el; }, []);

  // ---- HANDLERS ----

  const handleCreatePersonal = async () => {
    if (!personalName.trim()) return;
    setCreatingPersonal(true);
    const world = await createWorld(userId, personalName.trim(), "personal");
    if (!mountedRef.current) return;
    setCreatingPersonal(false);
    if (!world || world._error) {
      showToast("Failed to create world: " + (world?._error || "unknown error"));
    } else {
      const updated = await loadMyWorlds(userId);
      if (!mountedRef.current) return;
      if (onWorldsChange) onWorldsChange(updated);
      setShowCreatePersonal(false);
      setPersonalName("");
      onSelect("our", world.id, world.name, "owner", "personal");
    }
  };

  const handleCreateShared = async () => {
    if (!sharedName.trim()) return;
    setCreatingShared(true);
    const isGroupType = sharedType === 'friends' || sharedType === 'family';
    const world = await createWorld(userId, sharedName.trim(), sharedType, {
      youName: isGroupType ? '' : sharedYouName.trim(),
      partnerName: isGroupType ? '' : sharedPartnerName.trim(),
      members: isGroupType ? sharedMembers.filter(m => m.name.trim()).map(m => ({ name: m.name.trim() })) : [],
    });
    if (!mountedRef.current) return;
    setCreatingShared(false);
    if (!world || world._error) { showToast("Failed to create world: " + (world?._error || "unknown error")); return; }
    setCreatedWorldId(world.id);
    setSharedStep(1);
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      showToast("Please enter a valid email address.");
      return;
    }
    setCreatingShared(true);
    const result = await createInviteWithLetter(
      createdWorldId, userId, userDisplayName || "Someone special", inviteEmail.trim(), inviteLetter
    );
    if (!mountedRef.current) return;
    setCreatingShared(false);
    if (result) {
      setGeneratedLink(result.inviteLink);
      setSharedStep(2);
    } else { showToast("Failed to generate invite."); }
  };

  const handleFinishShared = async () => {
    const updated = await loadMyWorlds(userId);
    if (!mountedRef.current) return;
    if (onWorldsChange) onWorldsChange(updated);
    setShowCreateShared(false);
    setSharedName(""); setSharedType("partner"); setSharedStep(0); setInviteEmail(""); setInviteLetter(""); setGeneratedLink("");
    const w = updated.find(w => w.id === createdWorldId);
    onSelect("our", createdWorldId, w?.name || "Shared World", "owner", w?.type || sharedType);
  };

  const handleGenerateInvite = async () => {
    const refreshInvites = () => getSentInvites(showInviteModal.id, userId).then(d => { if (mountedRef.current) setSentInvites(d); }).catch(() => {});
    if (!existingInviteEmail.trim()) {
      setInviteGenerating(true);
      const inv = await createInvite(showInviteModal.id, userId, existingInviteRole);
      if (!mountedRef.current) return;
      setInviteGenerating(false);
      if (inv) { setInviteLink(`${window.location.origin}?invite=${inv.token}`); refreshInvites(); }
      else showToast("Failed to generate invite.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(existingInviteEmail.trim())) {
      showToast("Please enter a valid email address.");
      return;
    }
    setInviteGenerating(true);
    if (existingInviteRole === "viewer") {
      const result = await createViewerInvite(
        showInviteModal.id, userId, existingInviteEmail.trim(), existingInviteLetter, userDisplayName
      );
      if (!mountedRef.current) return;
      setInviteGenerating(false);
      if (result) { setInviteLink(result.inviteLink); refreshInvites(); }
      else { showToast("Failed to generate invite."); }
    } else {
      const result = await createInviteWithLetter(
        showInviteModal.id, userId, userDisplayName || "Someone special", existingInviteEmail.trim(), existingInviteLetter
      );
      if (!mountedRef.current) return;
      setInviteGenerating(false);
      if (result) { setInviteLink(result.inviteLink); refreshInvites(); }
      else { showToast("Failed to generate invite."); }
    }
  };

  // Invite to Cosmos (platform invite with optional letter)
  const handleCosmosInvite = async () => {
    if (!cosmosInviteEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cosmosInviteEmail.trim())) {
      showToast("Please enter a valid email address.");
      return;
    }
    setCosmosInviteSending(true);
    try {
      await sendWelcomeLetter(userId, userDisplayName || "A friend", cosmosInviteEmail.trim(), cosmosInviteLetter || `I'd love for you to join me on Little Cosmos — a place to map our adventures on a beautiful 3D globe. Sign up at ${window.location.origin}`);
      if (!mountedRef.current) return;
      setCosmosInviteSent(true);
    } catch (err) {
      console.error('[cosmosInvite]', err);
      if (!mountedRef.current) return;
      showToast("Failed to send invite.");
    }
    if (mountedRef.current) setCosmosInviteSending(false);
  };

  // Add a Friend (connection request)
  const handleAddFriend = async () => {
    if (!friendEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(friendEmail.trim())) {
      showToast("Please enter a valid email address.");
      return;
    }
    setFriendSending(true);
    const result = await sendConnectionRequest(userId, userDisplayName || "", friendEmail.trim(), true, friendLetter);
    if (!mountedRef.current) return;
    setFriendSending(false);
    if (result && !result._error) {
      setFriendSent(true);
      showToast("Friend request sent!");
    } else {
      showToast("Failed to send friend request" + (result?._error ? ": " + result._error : "."));
    }
  };

  // Toast system
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const showToast = useCallback((msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => { setToast(null); toastTimerRef.current = null; }, 3000);
  }, []);

  // Accept/decline pending requests
  const handleAcceptRequest = async (req) => {
    const result = await acceptConnection(req.id);
    if (!mountedRef.current) return;
    if (result?.ok) {
      if (onPendingRequestsChange) onPendingRequestsChange(prev => prev.filter(r => r.id !== req.id));
      const conn = await getMyConnections(userId);
      if (!mountedRef.current) return;
      if (onConnectionsChange) onConnectionsChange(conn);
      showToast(`You and ${req.requester_name || "your friend"} are now connected!`);
    } else {
      showToast(result?.error || "Failed to accept request.");
    }
  };

  const handleDeclineRequest = async (req) => {
    const ok = await declineConnection(req.id);
    if (!mountedRef.current) return;
    if (ok) {
      if (onPendingRequestsChange) onPendingRequestsChange(prev => prev.filter(r => r.id !== req.id));
      showToast("Request declined.");
    }
  };

  const handleSearch = useCallback((q) => {
    setSearchQuery(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!q.trim()) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    const seq = ++searchSeqRef.current;
    searchTimerRef.current = setTimeout(async () => {
      const worldIds = worlds.map(w => w.id);
      const results = await searchCrossWorld(worldIds, userId, q);
      if (seq === searchSeqRef.current) { setSearchResults(results); setSearching(false); }
    }, 400);
  }, [worlds, userId]);

  // Check if any modal has unsaved user input worth protecting
  const hasUnsavedInput = useCallback(() => {
    if (personalName.trim()) return true
    if (sharedName.trim() || sharedYouName.trim() || sharedPartnerName.trim()) return true
    if (sharedMembers.some(m => m.name?.trim())) return true
    if (inviteEmail.trim() || inviteLetter.trim()) return true
    if (existingInviteEmail.trim() || existingInviteLetter.trim()) return true
    if (cosmosInviteEmail.trim() || cosmosInviteLetter.trim()) return true
    if (friendEmail.trim() || friendLetter.trim()) return true
    return false
  }, [personalName, sharedName, sharedYouName, sharedPartnerName, sharedMembers, inviteEmail, inviteLetter, existingInviteEmail, existingInviteLetter, cosmosInviteEmail, cosmosInviteLetter, friendEmail, friendLetter])

  const closeAllModals = useCallback(() => {
    setShowAddMenu(false); setShowCreatePersonal(false); setShowCreateShared(false);
    setShowInviteModal(null); setShowInviteCosmos(false); setShowAddFriend(false); setShowPendingRequests(false); setShowWorldInvites(false); setShowActivity(false); setShowSearch(false);
    setPersonalName(""); setSharedName(""); setSharedType("partner"); setSharedYouName(""); setSharedPartnerName(""); setSharedMembers([{ name: "" }, { name: "" }]); setSharedStep(0); setInviteEmail("");
    setInviteLetter(""); setGeneratedLink(""); setCreatedWorldId(null);
    setInviteLink(""); setExistingInviteEmail(""); setExistingInviteLetter(""); setExistingInviteRole("member");
    setCosmosInviteEmail(""); setCosmosInviteLetter(""); setCosmosInviteSent(false);
    setFriendEmail(""); setFriendLetter(""); setFriendSent(false);
    setInviteGenerating(false); setSentInvites([]); setLinkCopied(false);
  }, []);

  // safeDismiss: used on backdrop clicks — confirms if there's unsaved input
  const safeDismiss = useCallback(() => {
    if (hasUnsavedInput()) {
      setConfirmModal({ message: "You have unsaved changes. Are you sure you want to close?", confirmLabel: "Discard", onConfirm: () => closeAllModals() });
      return
    }
    closeAllModals()
  }, [hasUnsavedInput, closeAllModals])

  // Use module-scope style constants (no state dependency)
  const modalBg = _modalBg;
  const modalBox = _modalBox;
  const inputSt = _inputSt;
  const textareaSt = _textareaSt;
  const btnP = _btnP;
  const btnS = _btnS;
  const optionCard = _optionCard;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0c0a12", fontFamily: F, cursor: hovered ? "pointer" : "grab", overflow: "hidden" }}
      onClick={handleClick} onMouseMove={handleMove}>

      <div ref={mountRef} style={{ position: "absolute", inset: 0, touchAction: "none" }} />

      {/* Title + greeting */}
      <div style={{ position: "absolute", top: "4%", left: 0, right: 0, textAlign: "center", opacity: ready ? 1 : 0, transition: "opacity 1.2s", pointerEvents: "none" }}>
        <div style={{ fontSize: 12, letterSpacing: "6px", color: "#dcd4ec", textTransform: "uppercase", fontWeight: 500, textShadow: "0 0 24px rgba(180,160,220,0.4), 0 2px 12px rgba(0,0,0,0.6)" }}>My Cosmos</div>
        {userDisplayName && (() => {
          const h = new Date().getHours();
          const greeting = h < 5 ? "Night owl" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Night owl";
          const totalEntries = myEntryCount + Object.values(entryCounts).reduce((s, n) => s + n, 0);
          const worldCount = worlds.length + 1; // +1 for My World
          return (
            <div style={{ marginTop: 6, animation: "fadeIn 1.5s ease" }}>
              <div style={{ fontSize: 11, color: "#a098b0", letterSpacing: "1px", fontWeight: 300, textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
                {greeting}, {userDisplayName.split(' ')[0]}
              </div>
              {totalEntries > 0 && (
                <div style={{ fontSize: 9, color: "#706878", marginTop: 3, letterSpacing: "1.5px", textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
                  {totalEntries} {totalEntries === 1 ? "adventure" : "adventures"} across {worldCount} {worldCount === 1 ? "world" : "worlds"}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Center label */}
      <div ref={makeLabelRef("my")} data-hov="false" style={{ position: "absolute", left: 0, top: 0, transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none", transition: "opacity .15s", opacity: 0 }}>
        <div style={{ background: "radial-gradient(ellipse at center, rgba(10,8,18,0.75) 0%, rgba(10,8,18,0.35) 55%, transparent 85%)", padding: "16px 32px", borderRadius: 24 }}>
          <div style={{ fontSize: hovered === "my" ? 24 : 20, fontWeight: 500, color: "#f0e8d4", letterSpacing: "2px", textShadow: "0 0 24px rgba(208,176,128,0.5), 0 2px 10px rgba(0,0,0,0.8)", transition: "font-size .2s" }}>My World</div>
          <div style={{ fontSize: 12, color: "#e8dcc4", marginTop: 4, letterSpacing: "1.5px", fontWeight: 400, textTransform: "uppercase", textShadow: "0 0 12px rgba(208,176,128,0.5), 0 1px 6px rgba(0,0,0,0.8)" }}>{myWorldSubtitle ?? "Travel Diary"}</div>
          {myEntryCount > 0 && (
            <div style={{ fontSize: 10, color: "#dcd0b4", marginTop: 3, letterSpacing: "0.5px", textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>{myEntryCount} {myEntryCount === 1 ? "entry" : "entries"}</div>
          )}
        </div>
      </div>

      {/* Orbiting world labels (shared + friend) */}
      {ALL_ORBS.map(w => (
        <div key={w.id} ref={makeLabelRef(w.id)} data-hov="false" style={{ position: "absolute", left: 0, top: 0, transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none", transition: "opacity .15s", opacity: 0 }}>
          <div style={{ background: "radial-gradient(ellipse at center, rgba(10,8,18,0.7) 0%, rgba(10,8,18,0.3) 55%, transparent 85%)", padding: "12px 24px", borderRadius: 20 }}>
          <div style={{ fontSize: hovered === w.id ? 19 : 15, fontWeight: 500, color: w.id.startsWith("friend-") ? "#d4e0f0" : w.glowColor || "#f0d8e8", letterSpacing: "1.2px", textShadow: `0 0 20px ${w.color}80, 0 2px 8px rgba(0,0,0,0.8)`, transition: "font-size .2s" }}>{w.label}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 2 }}>
            <div style={{ fontSize: 12, color: w.id.startsWith("friend-") ? "#d0dce8" : (w.glowColor || "#e8d8e0"), letterSpacing: "0.8px", fontWeight: 400, textShadow: `0 0 10px ${w.color}60, 0 1px 6px rgba(0,0,0,0.8)` }}>{w.sub}</div>
            {!w.id.startsWith("friend-") && w.worldType && w.worldType !== "shared" && (
              <div style={{ fontSize: 8, letterSpacing: "0.8px", textTransform: "uppercase", color: `${w.color}aa`, background: `${w.color}18`, border: `1px solid ${w.color}30`, borderRadius: 6, padding: "1px 6px", fontWeight: 600 }}>
                {{ partner: "Partner", friends: "Friends", family: "Family" }[w.worldType] || w.worldType}
              </div>
            )}
          </div>
          {entryCounts[w.id] > 0 && (
            <div style={{ fontSize: 10, color: `${w.glowColor || w.color}`, marginTop: 2, letterSpacing: "0.5px", opacity: 0.9, textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>{entryCounts[w.id]} {entryCounts[w.id] === 1 ? "entry" : "entries"}</div>
          )}
          </div>
          {hovered === w.id && !w.id.startsWith("friend-") && (
            <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "center" }}>
              {!w.isViewer && <button onClick={(e) => { e.stopPropagation(); const ww = worlds.find(x => x.id === w.id); if (!ww) return; setShowInviteModal(ww); setInviteLink(""); setExistingInviteEmail(""); setExistingInviteLetter(""); getSentInvites(ww.id, userId).then(setSentInvites).catch(() => setSentInvites([])); }}
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "3px 10px", color: "#c0b8c8", fontSize: 9, fontFamily: F, cursor: "pointer", pointerEvents: "auto", letterSpacing: "0.5px" }}>
                Invite
              </button>}
              <button onClick={(e) => {
                  e.stopPropagation();
                  const ww = worlds.find(x => x.id === w.id);
                  if (!ww) return;
                  if (w.role === "owner") {
                    setConfirmModal({ message: `Permanently delete "${w.label}"? All entries, photos, and settings will be lost forever. This cannot be undone.`, confirmLabel: "Delete Forever", onConfirm: async () => {
                      const ok = await deleteWorld(w.id, userId);
                      if (ok) { onWorldsChange(worlds.filter(x => x.id !== w.id)); }
                      else { showToast("Failed to delete world."); }
                    }});
                  } else {
                    setConfirmModal({ message: `Leave "${w.label}"? You'll lose access to this world.`, confirmLabel: "Leave World", onConfirm: async () => {
                      const ok = await leaveWorld(w.id, userId);
                      if (ok) { onWorldsChange(worlds.filter(x => x.id !== w.id)); }
                      else { showToast("Failed to leave world."); }
                    }});
                  }
                }}
                style={{ background: "rgba(200,100,100,0.08)", border: "1px solid rgba(200,100,100,0.20)", borderRadius: 12, padding: "3px 10px", color: "#c09090", fontSize: 9, fontFamily: F, cursor: "pointer", pointerEvents: "auto", letterSpacing: "0.5px" }}>
                {w.role === "owner" ? "Delete" : "Leave"}
              </button>
              {isTouchDevice && <div style={{ width: "100%", textAlign: "center", fontSize: 8, color: "rgba(200,192,210,0.5)", marginTop: 4, letterSpacing: "0.3px" }}>tap again to enter</div>}
            </div>
          )}
        </div>
      ))}

      {/* Notification badges — prominent, top-left */}
      {(pendingRequests.length > 0 || pendingWorldInvites.length > 0) && (
        <div style={{ position: "absolute", top: 16, left: 16, display: "flex", flexDirection: "column", gap: 8, opacity: ready ? 1 : 0, transition: "all .5s", zIndex: 10 }}>
          {pendingRequests.length > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setShowPendingRequests(true); }}
              style={{ background: "rgba(200,170,110,0.15)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(200,170,110,0.35)", borderRadius: 16, padding: "10px 18px", color: "#c9a96e", fontSize: 12, fontFamily: F, cursor: "pointer", letterSpacing: "0.5px", boxShadow: "0 4px 20px rgba(200,170,110,0.15), 0 2px 8px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", gap: 8, transition: "all .3s", animation: "notifySlideIn 0.6s ease forwards" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(200,170,110,0.5)"; e.currentTarget.style.background = "rgba(200,170,110,0.22)"; e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(200,170,110,0.35)"; e.currentTarget.style.background = "rgba(200,170,110,0.15)"; e.currentTarget.style.transform = "scale(1)"; }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#c9a96e", display: "inline-block", animation: "pulse 1.5s ease-in-out infinite", boxShadow: "0 0 6px rgba(200,170,110,0.6)" }} />
              {pendingRequests.length} friend request{pendingRequests.length > 1 ? "s" : ""}
            </button>
          )}
          {pendingWorldInvites.length > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setShowWorldInvites(true); }}
              style={{ background: "rgba(232,184,208,0.15)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(232,184,208,0.35)", borderRadius: 16, padding: "10px 18px", color: "#e8b8d0", fontSize: 12, fontFamily: F, cursor: "pointer", letterSpacing: "0.5px", boxShadow: "0 4px 20px rgba(232,184,208,0.15), 0 2px 8px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", gap: 8, transition: "all .3s", animation: "notifySlideIn 0.8s ease forwards" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(232,184,208,0.5)"; e.currentTarget.style.background = "rgba(232,184,208,0.22)"; e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(232,184,208,0.35)"; e.currentTarget.style.background = "rgba(232,184,208,0.15)"; e.currentTarget.style.transform = "scale(1)"; }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#e8b8d0", display: "inline-block", animation: "pulse 1.5s ease-in-out infinite", boxShadow: "0 0 6px rgba(232,184,208,0.6)" }} />
              {pendingWorldInvites.length} world invite{pendingWorldInvites.length > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      {/* Bottom controls — glassmorphic bar */}
      <div style={{ position: "absolute", bottom: "4%", left: "50%", transform: "translateX(-50%)", opacity: ready ? 1 : 0, transition: "opacity 1.5s" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "8px 16px", background: "rgba(20,16,30,0.5)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
          <button onClick={(e) => { e.stopPropagation(); setShowAddMenu(true); }}
            style={{ background: "linear-gradient(135deg, rgba(200,170,110,0.18), rgba(200,170,110,0.06))", border: "1px solid rgba(200,170,110,0.2)", borderRadius: 16, padding: "7px 18px", color: "#c9a96e", fontSize: 10, fontFamily: F, letterSpacing: "1px", cursor: "pointer", transition: "all .3s" }}
            onMouseEnter={e => { e.target.style.borderColor = "rgba(200,170,110,0.45)"; e.target.style.background = "linear-gradient(135deg, rgba(200,170,110,0.25), rgba(200,170,110,0.10))"; }}
            onMouseLeave={e => { e.target.style.borderColor = "rgba(200,170,110,0.2)"; e.target.style.background = "linear-gradient(135deg, rgba(200,170,110,0.18), rgba(200,170,110,0.06))"; }}>
            + Add a World
          </button>
          <button onClick={(e) => { e.stopPropagation(); setShowAddFriend(true); }}
            style={{ background: "rgba(160,192,232,0.06)", border: "1px solid rgba(160,192,232,0.15)", borderRadius: 16, padding: "7px 18px", color: "#a0c0e8", fontSize: 10, fontFamily: F, letterSpacing: "1px", cursor: "pointer", transition: "all .3s" }}
            onMouseEnter={e => { e.target.style.borderColor = "rgba(160,192,232,0.35)"; }}
            onMouseLeave={e => { e.target.style.borderColor = "rgba(160,192,232,0.15)"; }}>
            Add a Friend
          </button>
          <button onClick={(e) => { e.stopPropagation(); setShowInviteCosmos(true); }}
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "7px 18px", color: "#908898", fontSize: 10, fontFamily: F, letterSpacing: "1px", cursor: "pointer", transition: "all .3s" }}
            onMouseEnter={e => { e.target.style.color = "#c0b8c8"; e.target.style.borderColor = "rgba(255,255,255,0.18)"; }}
            onMouseLeave={e => { e.target.style.color = "#908898"; e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}>
            Invite to Cosmos
          </button>
        </div>
        <div style={{ fontSize: 10, color: "#9890a8", marginTop: 8, letterSpacing: "1.5px", textAlign: "center", textTransform: "uppercase", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>drag to orbit · scroll or pinch to zoom</div>
      </div>

      {/* Top right controls — glassmorphic */}
      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8, opacity: ready ? 1 : 0, transition: "all .5s", zIndex: 10 }}>
        <button onClick={(e) => { e.stopPropagation(); setShowSearch(!showSearch); setShowActivity(false); if (!showSearch) setTimeout(() => document.getElementById("cosmos-search-input")?.focus(), 100); }}
          style={{ background: showSearch ? "rgba(160,192,232,0.12)" : "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: `1px solid ${showSearch ? "rgba(160,192,232,0.25)" : "rgba(255,255,255,0.06)"}`, borderRadius: 12, padding: "5px 14px", color: showSearch ? "#a0c0e8" : "#706878", fontSize: 9, fontFamily: F, letterSpacing: "0.8px", cursor: "pointer", transition: "all .3s", textTransform: "uppercase" }}
          onMouseEnter={e => { if (!showSearch) { e.target.style.color = "#b0a8b8"; e.target.style.borderColor = "rgba(255,255,255,0.15)"; }}}
          onMouseLeave={e => { if (!showSearch) { e.target.style.color = "#706878"; e.target.style.borderColor = "rgba(255,255,255,0.06)"; }}}>
          Search
        </button>
        <button onClick={(e) => { e.stopPropagation(); setShowActivity(!showActivity); setShowSearch(false); }}
          style={{ background: showActivity ? "rgba(200,170,110,0.12)" : "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: `1px solid ${showActivity ? "rgba(200,170,110,0.25)" : "rgba(255,255,255,0.06)"}`, borderRadius: 12, padding: "5px 14px", color: showActivity ? "#c9a96e" : "#706878", fontSize: 9, fontFamily: F, letterSpacing: "0.8px", cursor: "pointer", transition: "all .3s", textTransform: "uppercase" }}
          onMouseEnter={e => { if (!showActivity) { e.target.style.color = "#b0a8b8"; e.target.style.borderColor = "rgba(255,255,255,0.15)"; }}}
          onMouseLeave={e => { if (!showActivity) { e.target.style.color = "#706878"; e.target.style.borderColor = "rgba(255,255,255,0.06)"; }}}>
          Activity
        </button>
        <button onClick={(e) => { e.stopPropagation(); setCosmosTourStep(0); setShowCosmosTour(true); try { localStorage.removeItem(cosmosTourKey); } catch {} }}
          style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "5px 14px", color: "#908898", fontSize: 9, fontFamily: F, letterSpacing: "0.8px", cursor: "pointer", transition: "all .3s", textTransform: "uppercase" }}
          onMouseEnter={e => { e.target.style.color = "#b0a8b8"; e.target.style.borderColor = "rgba(255,255,255,0.15)"; }}
          onMouseLeave={e => { e.target.style.color = "#706878"; e.target.style.borderColor = "rgba(255,255,255,0.06)"; }}>
          Replay Tour
        </button>
        <button onClick={(e) => { e.stopPropagation(); setConfirmModal({ message: "Sign out of My Cosmos?", confirmLabel: "Sign Out", onConfirm: () => onSignOut() }); }}
          style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "5px 14px", color: "#908898", fontSize: 9, fontFamily: F, letterSpacing: "0.8px", cursor: "pointer", transition: "all .3s", textTransform: "uppercase" }}
          onMouseEnter={e => { e.target.style.color = "#b0a8b8"; e.target.style.borderColor = "rgba(255,255,255,0.15)"; }}
          onMouseLeave={e => { e.target.style.color = "#706878"; e.target.style.borderColor = "rgba(255,255,255,0.06)"; }}>
          Sign Out
        </button>
      </div>

      {/* Activity feed panel */}
      {showActivity && (
        <div style={{ position: "absolute", top: 50, right: 16, width: 290, maxHeight: "60vh", background: "rgba(20,16,28,0.88)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(200,170,140,0.06)", borderRadius: 18, padding: "18px", zIndex: 20, overflowY: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.1), 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,245,230,0.03)", animation: "fadeIn .3s ease" }}
          onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 9, letterSpacing: "2px", textTransform: "uppercase", color: "#a098b0", marginBottom: 12, fontFamily: F }}>Recent Activity</div>
          {activityData.length === 0 && (
            <div style={{ fontSize: 12, color: "#908898", padding: "20px 0", textAlign: "center", fontFamily: F }}>
              Your worlds are waiting for their first stories.
            </div>
          )}
          {activityData.map((a, i) => {
            const typeIcons = { together: "💕", special: "⭐", adventure: "🏔", "road-trip": "🚗", city: "🏙", beach: "🏖", cruise: "🚢", nature: "🌲", friends: "👋", family: "👨‍👩‍👧", event: "🎉", work: "💼", home: "🏠", backpacking: "🎒" };
            const icon = typeIcons[a.type] || "📍";
            const ago = a.date_start ? (() => { const d = Math.floor((Date.now() - new Date(a.date_start + "T00:00:00").getTime()) / 86400000); return d === 0 ? "today" : d === 1 ? "yesterday" : d < 30 ? `${d}d ago` : d < 365 ? `${Math.floor(d / 30)}mo ago` : `${Math.floor(d / 365)}y ago`; })() : "";
            return (
            <div key={a.id || i} onClick={() => { const wId = a.world_id; if (!wId) return; if (wId === personalWorldId) { onSelect("my", personalWorldId); } else { const w = worlds.find(x => x.id === wId); if (w) onSelect("our", w.id, w.name, w.role || "member", w.type || "shared"); } }}
              style={{ display: "flex", gap: 10, padding: "10px 8px", borderBottom: i < activityData.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", alignItems: "flex-start", cursor: "pointer", borderRadius: 10, transition: "background .2s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              {a.photos && a.photos.length > 0 ? (
                <img src={a.photos[0]} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(255,255,255,0.06)" }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                  {icon}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "#d0c8d8", fontFamily: F, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a.city}{a.country ? `, ${a.country}` : ""}
                </div>
                <div style={{ fontSize: 9, color: "#888090", fontFamily: F, marginTop: 3, display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ color: "#a098b0" }}>{worldNameMap[a.world_id] || "Shared World"}</span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span>{ago}</span>
                  {a.photos && a.photos.length > 1 && <><span style={{ opacity: 0.4 }}>·</span><span>📷 {a.photos.length}</span></>}
                </div>
              </div>
            </div>
            );
          })}
          {activityData.length > 0 && (
            <div style={{ fontSize: 9, color: "#807090", textAlign: "center", marginTop: 10, fontFamily: F, letterSpacing: "0.5px" }}>
              {Object.values(entryCounts).reduce((s, c) => s + c, 0) + myEntryCount} total entries across {worlds.length + 1} world{worlds.length !== 0 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* Cross-world search panel */}
      {showSearch && (
        <div style={{ position: "absolute", top: 50, right: 16, width: 310, maxHeight: "65vh", background: "rgba(20,16,28,0.88)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(200,170,140,0.06)", borderRadius: 18, padding: "18px", zIndex: 20, overflowY: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.1), 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,245,230,0.03)", animation: "fadeIn .3s ease" }}
          onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 9, letterSpacing: "2px", textTransform: "uppercase", color: "#807888", marginBottom: 10, fontFamily: F }}>Search All Worlds</div>
          <input id="cosmos-search-input" value={searchQuery} onChange={e => handleSearch(e.target.value)}
            placeholder="Search cities, countries, notes..."
            style={{ width: "100%", padding: "10px 14px", background: "rgba(255,245,230,0.04)", border: "1px solid rgba(200,170,140,0.12)", borderRadius: 12, color: "#e8e0d0", fontSize: 13, fontFamily: F, outline: "none", boxSizing: "border-box", marginBottom: 12, transition: "border-color .2s, box-shadow .2s" }}
            onFocus={e => { e.target.style.borderColor = "rgba(200,170,140,0.25)"; e.target.style.boxShadow = "0 0 0 2px rgba(200,170,140,0.06)"; }}
            onBlur={e => { e.target.style.borderColor = "rgba(200,170,140,0.12)"; e.target.style.boxShadow = "none"; }} />
          {searching && <div style={{ fontSize: 11, color: "#686070", textAlign: "center", padding: 10, fontFamily: F }}>Searching...</div>}
          {!searching && searchQuery && searchResults.length === 0 && (
            <div style={{ fontSize: 11, color: "#605868", textAlign: "center", padding: "16px 0", fontFamily: F }}>No results found</div>
          )}
          {searchResults.map((r, i) => (
            <div key={r.id || i}
              onClick={() => {
                if (r.source === "my") { onSelect("my", personalWorldId); }
                else {
                  const w = worlds.find(w => w.id === r.world_id);
                  onSelect("our", r.world_id, w?.name || "Shared World", w?.role || "member", w?.type || "shared");
                }
              }}
              style={{ display: "flex", gap: 10, padding: "8px 6px", borderBottom: i < searchResults.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", alignItems: "flex-start", cursor: "pointer", borderRadius: 8, transition: "background .2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
              {r.photos && r.photos.length > 0 ? (
                <img src={r.photos[0]} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                  📍
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "#d0c8d8", fontFamily: F, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.city}{r.country ? `, ${r.country}` : ""}
                </div>
                <div style={{ fontSize: 9, color: "#686070", fontFamily: F, marginTop: 2 }}>
                  {r.source === "my" ? "My World" : worldNameMap[r.world_id] || "Shared World"}
                  {r.date_start ? ` · ${new Date(r.date_start + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                </div>
                {r.notes && (
                  <div style={{ fontSize: 10, color: "#807888", fontFamily: F, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.notes.substring(0, 60)}{r.notes.length > 60 ? "..." : ""}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ====== ADD A WORLD MENU ====== */}
      {showAddMenu && (
        <div style={modalBg} onClick={(e) => { e.stopPropagation(); safeDismiss(); }}>
          <div style={{ ...modalBox, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>Add a World</div>
            <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 24 }}>
              Every world tells a different story. Which one are you starting?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={optionCard}
                onClick={() => { setShowAddMenu(false); setShowCreatePersonal(true); }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(160,192,232,0.3)"; e.currentTarget.style.background = "rgba(160,192,232,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#c0d8f0", marginBottom: 4 }}>Personal World</div>
                <div style={{ fontSize: 11, color: "#807888", lineHeight: 1.5 }}>A private space just for you — organize trips by theme, year, or however you like.</div>
              </div>
              <div style={optionCard}
                onClick={() => { setShowAddMenu(false); setShowCreateShared(true); }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(232,184,208,0.3)"; e.currentTarget.style.background = "rgba(232,184,208,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#e8b8d0", marginBottom: 4 }}>Shared World</div>
                <div style={{ fontSize: 11, color: "#807888", lineHeight: 1.5 }}>Build a travel diary together — with a partner, friends, or family. You'll invite them by email.</div>
              </div>
            </div>
            <button onClick={closeAllModals} style={{ ...btnS, marginTop: 20 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ====== CREATE PERSONAL WORLD ====== */}
      {showCreatePersonal && (
        <div style={modalBg} onClick={(e) => { e.stopPropagation(); safeDismiss(); }}>
          <div style={{ ...modalBox, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>Create a Personal World</div>
            <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 20 }}>
              A private world, just for your eyes. It'll orbit alongside your other worlds.
            </div>
            <input value={personalName} onChange={e => setPersonalName(e.target.value)}
              placeholder="World name (e.g. Road Trips, Europe 2024)"
              style={{ ...inputSt, marginBottom: 16 }}
              onKeyDown={e => { if (e.key === "Enter") handleCreatePersonal(); }} autoFocus />
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={closeAllModals} style={btnS}>Cancel</button>
              <button onClick={handleCreatePersonal} disabled={creatingPersonal || !personalName.trim()}
                style={{ ...btnP, opacity: creatingPersonal || !personalName.trim() ? 0.5 : 1 }}>
                {creatingPersonal ? "Creating..." : "Create World"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== CREATE SHARED WORLD (multi-step) ====== */}
      {showCreateShared && (
        <div style={modalBg} onClick={(e) => { e.stopPropagation(); if (sharedStep < 2) safeDismiss(); }}>
          <div style={{ ...modalBox, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            {sharedStep === 0 && (<>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>Create a Shared World</div>
              <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 16 }}>
                Who are you sharing this world with?
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16, justifyContent: "center", flexWrap: "wrap" }}>
                {[
                  { key: "partner", label: "Partner", icon: "\u{1F495}", desc: "A romantic partner", accent: "#e8b8d0", accentBg: "rgba(232,184,208,0.12)", accentBorder: "rgba(232,184,208,0.4)" },
                  { key: "friends", label: "Friends", icon: "\u{1FAC2}", desc: "Close friends", accent: "#9898e0", accentBg: "rgba(108,108,204,0.12)", accentBorder: "rgba(108,108,204,0.4)" },
                  { key: "family",  label: "Family",  icon: "\u{1F46A}", desc: "Family members", accent: "#e09070", accentBg: "rgba(208,112,80,0.12)", accentBorder: "rgba(208,112,80,0.4)" },
                ].map(t => (
                  <div key={t.key} onClick={() => setSharedType(t.key)}
                    style={{ flex: "1 1 100px", padding: "12px 10px", borderRadius: 10, cursor: "pointer", textAlign: "center", transition: "all .2s",
                      background: sharedType === t.key ? t.accentBg : "rgba(255,255,255,0.02)",
                      border: `1px solid ${sharedType === t.key ? t.accentBorder : "rgba(255,255,255,0.08)"}` }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{t.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: sharedType === t.key ? t.accent : "#a098a8" }}>{t.label}</div>
                    <div style={{ fontSize: 9, color: "#686070", marginTop: 2 }}>{t.desc}</div>
                  </div>
                ))}
              </div>
              <input value={sharedName} onChange={e => setSharedName(e.target.value)}
                placeholder={sharedType === "partner" ? "World name (e.g. Our Adventures)" : sharedType === "friends" ? "World name (e.g. Squad Trips 2024)" : "World name (e.g. Family Vacations)"}
                style={{ ...inputSt, marginBottom: 10 }} autoFocus />
              {sharedType === "partner" ? (<>
                <div style={{ fontSize: 10, color: "#807888", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, textAlign: "left" }}>
                  Who's sharing this world?
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <input value={sharedYouName} onChange={e => setSharedYouName(e.target.value)}
                    placeholder="Your name" style={{ ...inputSt, flex: 1 }} />
                  <input value={sharedPartnerName} onChange={e => setSharedPartnerName(e.target.value)}
                    placeholder="Partner's name" style={{ ...inputSt, flex: 1 }}
                    onKeyDown={e => { if (e.key === "Enter") handleCreateShared(); }} />
                </div>
              </>) : (<>
                <div style={{ fontSize: 10, color: "#807888", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, textAlign: "left" }}>
                  {sharedType === "family" ? "Family members" : "Who's in this group?"}
                </div>
                <div style={{ marginBottom: 16 }}>
                  {sharedMembers.map((m, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                      <input value={m.name} onChange={e => { const next = [...sharedMembers]; next[i] = { name: e.target.value }; setSharedMembers(next); }}
                        placeholder={sharedType === "family" ? `Member ${i + 1} (e.g. ${["Mom", "Dad", "Sarah", "Jake", "Grandma"][i] || "Name"})` : `Friend ${i + 1}`}
                        style={{ ...inputSt, flex: 1, marginBottom: 0 }}
                        onKeyDown={e => { if (e.key === "Enter") { if (i === sharedMembers.length - 1 && m.name.trim()) setSharedMembers([...sharedMembers, { name: "" }]); else handleCreateShared(); } }} />
                      {sharedMembers.length > 2 && (
                        <button onClick={() => setSharedMembers(sharedMembers.filter((_, j) => j !== i))}
                          style={{ background: "none", border: "none", color: "#685868", fontSize: 16, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>×</button>
                      )}
                    </div>
                  ))}
                  {sharedMembers.length < 20 && (
                    <button onClick={() => setSharedMembers([...sharedMembers, { name: "" }])}
                      style={{ background: "none", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 8, color: "#807888", fontSize: 11, padding: "6px 12px", cursor: "pointer", width: "100%", fontFamily: F, marginTop: 2 }}>
                      + Add {sharedType === "family" ? "family member" : "friend"}
                    </button>
                  )}
                </div>
              </>)}
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={closeAllModals} style={btnS}>Cancel</button>
                <button onClick={handleCreateShared} disabled={creatingShared || !sharedName.trim()}
                  style={{ ...btnP, opacity: creatingShared || !sharedName.trim() ? 0.5 : 1 }}>
                  {creatingShared ? "Creating..." : "Next"}
                </button>
              </div>
            </>)}
            {sharedStep === 1 && (<>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>Invite Someone</div>
              <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 20 }}>
                Share this world with someone special. You can write a welcome letter — it'll be the first thing they see.
              </div>
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="Their email address"
                type="email"
                style={{ ...inputSt, marginBottom: 12 }} autoFocus />
              <div style={{ textAlign: "left", marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: "#807888", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Write them a letter (optional)</div>
              </div>
              <textarea value={inviteLetter} onChange={e => setInviteLetter(e.target.value)}
                placeholder={"Dear ...\n\nI created this world for us to fill with our adventures together.\n\nWith love, ..."}
                style={{ ...textareaSt, marginBottom: 16 }} />
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={() => handleFinishShared()} style={btnS}>Skip for now</button>
                <button onClick={handleSendInvite} disabled={creatingShared || !inviteEmail.trim()}
                  style={{ ...btnP, opacity: creatingShared || !inviteEmail.trim() ? 0.5 : 1 }}>
                  {creatingShared ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </>)}
            {sharedStep === 2 && (<>
              <div style={{ fontSize: 44, marginBottom: 12 }}>&#10024;</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>World Created!</div>
              <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 16 }}>
                "{sharedName}" is ready. Share this link with your person:
              </div>
              <div style={{ ...inputSt, marginBottom: 12, textAlign: "left", wordBreak: "break-all", fontSize: 12, lineHeight: 1.5, background: "rgba(200,170,110,0.08)", borderColor: "rgba(200,170,110,0.25)" }}>
                {generatedLink}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 8 }}>
                <button onClick={() => { navigator.clipboard.writeText(generatedLink); setLinkCopied(true); showToast("Invite link copied!"); if (linkCopiedTimerRef.current) clearTimeout(linkCopiedTimerRef.current); linkCopiedTimerRef.current = setTimeout(() => { setLinkCopied(false); linkCopiedTimerRef.current = null; }, 2000); }}
                  style={{ ...btnP, background: linkCopied ? "linear-gradient(135deg, #7ab87a, #5a9a5a)" : btnP.background, transition: "all .3s" }}>
                  {linkCopied ? "Copied!" : "Copy Link"}
                </button>
              </div>
              <div style={{ fontSize: 10, color: "#807888", marginBottom: 16 }}>
                {inviteLetter ? "Your letter will appear when they first log in." : ""} Link expires in 7 days.
              </div>
              <button onClick={handleFinishShared} style={btnP}>Enter World</button>
            </>)}
          </div>
        </div>
      )}

      {/* ====== INVITE TO COSMOS (platform invite) ====== */}
      {showInviteCosmos && (
        <div style={modalBg} onClick={(e) => { e.stopPropagation(); safeDismiss(); }}>
          <div style={{ ...modalBox, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            {!cosmosInviteSent ? (<>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>Invite to Little Cosmos</div>
              <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 20 }}>
                Invite someone to create their own cosmos. They'll receive your letter when they sign up.
              </div>
              <input value={cosmosInviteEmail} onChange={e => setCosmosInviteEmail(e.target.value)}
                placeholder="Their email address"
                type="email"
                style={{ ...inputSt, marginBottom: 12 }} autoFocus />
              <div style={{ textAlign: "left", marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: "#807888", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Write them a letter (optional)</div>
              </div>
              <textarea value={cosmosInviteLetter} onChange={e => setCosmosInviteLetter(e.target.value)}
                placeholder={"Hey!\n\nI've been using this beautiful app to map all my travels and adventures. I think you'd love it too.\n\nCheck it out!"}
                style={{ ...textareaSt, marginBottom: 16 }} />
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={closeAllModals} style={btnS}>Cancel</button>
                <button onClick={handleCosmosInvite} disabled={cosmosInviteSending || !cosmosInviteEmail.trim()}
                  style={{ ...btnP, opacity: cosmosInviteSending || !cosmosInviteEmail.trim() ? 0.5 : 1 }}>
                  {cosmosInviteSending ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </>) : (<>
              <div style={{ fontSize: 44, marginBottom: 12 }}>&#9993;</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>Invite Sent!</div>
              <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 16 }}>
                Your letter will be waiting for {cosmosInviteEmail} when they sign up at littlecosmos.app
              </div>
              <button onClick={closeAllModals} style={btnP}>Done</button>
            </>)}
          </div>
        </div>
      )}

      {/* ====== ADD A FRIEND ====== */}
      {showAddFriend && (
        <div style={modalBg} onClick={(e) => { e.stopPropagation(); safeDismiss(); }}>
          <div style={{ ...modalBox, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            {!friendSent ? (<>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>Add a Friend</div>
              <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 20 }}>
                Connect with a friend so you can see each other's worlds orbiting in your cosmos.
              </div>
              <input value={friendEmail} onChange={e => setFriendEmail(e.target.value)}
                placeholder="Their email address"
                type="email"
                style={{ ...inputSt, marginBottom: 14 }} autoFocus />
              <div style={{ textAlign: "left", marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: "#807888", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Write a note (optional)</div>
              </div>
              <textarea value={friendLetter} onChange={e => setFriendLetter(e.target.value)}
                placeholder="Hey! I'd love to share our travel worlds..."
                style={{ ...textareaSt, minHeight: 70, marginBottom: 16 }} />
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={closeAllModals} style={btnS}>Cancel</button>
                <button onClick={handleAddFriend} disabled={friendSending || !friendEmail.trim()}
                  style={{ ...btnP, opacity: friendSending || !friendEmail.trim() ? 0.5 : 1 }}>
                  {friendSending ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </>) : (<>
              <div style={{ fontSize: 44, marginBottom: 12 }}>&#128075;</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>Invite Sent!</div>
              <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 16 }}>
                {friendEmail} will see your invite next time they open their cosmos. Once they accept, you'll both see each other's worlds.
              </div>
              <button onClick={closeAllModals} style={btnP}>Done</button>
            </>)}
          </div>
        </div>
      )}

      {/* ====== PENDING FRIEND REQUESTS ====== */}
      {showPendingRequests && (
        <div style={modalBg} onClick={(e) => { e.stopPropagation(); safeDismiss(); }}>
          <div style={{ ...modalBox, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>World Sharing Invites</div>
            <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 20 }}>
              People who want to share worlds with you. Accept to see each other's worlds in your cosmos.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 300, overflowY: "auto" }}>
              {pendingRequests.map(req => (
                <div key={req.id} style={{ ...optionCard, cursor: "default" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e0d8e8", marginBottom: 2 }}>
                    {req.requester_name || "Someone"} wants to share worlds
                  </div>
                  <div style={{ fontSize: 10, color: "#807888", marginBottom: 4 }}>{req.target_email}</div>
                  {req.letter_text && (
                    <div style={{ fontSize: 11, color: "#b0a8b8", marginBottom: 8, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6, fontStyle: "italic", lineHeight: 1.5 }}>
                      "{req.letter_text}"
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => handleDeclineRequest(req)} style={{ ...btnS, padding: "5px 14px", fontSize: 11 }}>Decline</button>
                    <button onClick={() => handleAcceptRequest(req)} style={{ ...btnP, padding: "5px 14px", fontSize: 11 }}>Accept</button>
                  </div>
                </div>
              ))}
              {pendingRequests.length === 0 && (
                <div style={{ fontSize: 12, color: "#686070", padding: 20 }}>No pending requests</div>
              )}
            </div>
            <button onClick={closeAllModals} style={{ ...btnS, marginTop: 16 }}>Close</button>
          </div>
        </div>
      )}

      {/* ====== PENDING WORLD INVITES ====== */}
      {showWorldInvites && (
        <div style={modalBg} onClick={(e) => { e.stopPropagation(); safeDismiss(); }}>
          <div style={{ ...modalBox, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>World Invites</div>
            <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 20 }}>
              You've been invited to join shared worlds.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 300, overflowY: "auto" }}>
              {pendingWorldInvites.map((inv, idx) => (
                <div key={idx} style={{ ...optionCard, cursor: "default" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e0d8e8", marginBottom: 2 }}>
                    {inv.fromName} invited you to "{inv.worldName}"
                  </div>
                  <div style={{ fontSize: 10, color: "#807888", marginBottom: 8 }}>{inv.worldType === "partner" ? "Partner World" : inv.worldType === "friends" ? "Friends World" : inv.worldType === "family" ? "Family World" : "Shared World"}</div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={async () => {
                      await declineWorldInvite(inv.token);
                      if (onPendingWorldInvitesChange) onPendingWorldInvitesChange(prev => prev.filter((_, i) => i !== idx));
                    }} style={{ ...btnS, padding: "5px 14px", fontSize: 11 }}>Decline</button>
                    <button onClick={async (e) => {
                      const btn = e.currentTarget; btn.disabled = true; btn.textContent = "Joining...";
                      const result = await acceptInvite(inv.token);
                      if (result?.ok) {
                        const updated = await loadMyWorlds(userId);
                        if (onWorldsChange) onWorldsChange(updated);
                        if (onPendingWorldInvitesChange) onPendingWorldInvitesChange(prev => prev.filter((_, i) => i !== idx));
                        closeAllModals();
                        const joined = updated.find(w => w.id === result.world_id);
                        onSelect("our", result.world_id, inv.worldName, joined?.role || "member", inv.worldType || joined?.type || "shared");
                      } else { btn.disabled = false; btn.textContent = "Accept & Enter"; showToast(result?.error || "Failed to accept invite."); }
                    }} style={{ ...btnP, padding: "5px 14px", fontSize: 11 }}>Accept & Enter</button>
                  </div>
                </div>
              ))}
              {pendingWorldInvites.length === 0 && (
                <div style={{ fontSize: 12, color: "#686070", padding: 20 }}>No pending invites</div>
              )}
            </div>
            <button onClick={closeAllModals} style={{ ...btnS, marginTop: 16 }}>Close</button>
          </div>
        </div>
      )}

      {/* ====== INVITE FROM EXISTING WORLD ====== */}
      {showInviteModal && (
        <div style={modalBg} onClick={(e) => { e.stopPropagation(); safeDismiss(); }}>
          <div style={{ ...modalBox, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>Invite to "{showInviteModal.name}"</div>
            <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 16 }}>
              Enter their email to send a personal invite, or just generate a link.
            </div>
            {!inviteLink ? (<>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, justifyContent: "center" }}>
                <button onClick={() => setExistingInviteRole("member")}
                  style={{ padding: "6px 16px", borderRadius: 8, fontSize: 12, fontFamily: F, cursor: "pointer", border: "1px solid", transition: "all .2s",
                    ...(existingInviteRole === "member"
                      ? { background: "rgba(200,170,110,0.15)", borderColor: "rgba(200,170,110,0.4)", color: "#c9a96e" }
                      : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "#807888" }) }}>
                  Member (can edit)
                </button>
                <button onClick={() => setExistingInviteRole("viewer")}
                  style={{ padding: "6px 16px", borderRadius: 8, fontSize: 12, fontFamily: F, cursor: "pointer", border: "1px solid", transition: "all .2s",
                    ...(existingInviteRole === "viewer"
                      ? { background: "rgba(160,192,232,0.15)", borderColor: "rgba(160,192,232,0.4)", color: "#a0c0e8" }
                      : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "#807888" }) }}>
                  Viewer (read only)
                </button>
              </div>
              <div style={{ fontSize: 10, color: "#686070", marginBottom: 12, fontStyle: "italic" }}>
                {existingInviteRole === "viewer"
                  ? "Viewers can see all entries and photos, leave comments and reactions, but can't add or edit."
                  : "Members can add entries, upload photos, and edit the world alongside you."}
              </div>
              <input value={existingInviteEmail} onChange={e => setExistingInviteEmail(e.target.value)}
                placeholder="Their email (optional)"
                type="email"
                style={{ ...inputSt, marginBottom: 8 }} autoFocus />
              {existingInviteEmail.trim() && (
                <textarea value={existingInviteLetter} onChange={e => setExistingInviteLetter(e.target.value)}
                  placeholder="Write them a welcome letter (optional)"
                  style={{ ...textareaSt, marginBottom: 12, minHeight: 80 }} />
              )}
              <button onClick={handleGenerateInvite} disabled={inviteGenerating}
                style={{ ...btnP, opacity: inviteGenerating ? 0.5 : 1 }}>
                {inviteGenerating ? "Generating..." : existingInviteEmail.trim() ? "Send Invite" : "Generate Link"}
              </button>
            </>) : (<>
              <div style={{ ...inputSt, marginBottom: 12, textAlign: "left", wordBreak: "break-all", fontSize: 12, lineHeight: 1.5, background: "rgba(200,170,110,0.08)", borderColor: "rgba(200,170,110,0.25)" }}>
                {inviteLink}
              </div>
              <button onClick={() => { navigator.clipboard.writeText(inviteLink); setLinkCopied(true); if (linkCopiedTimerRef.current) clearTimeout(linkCopiedTimerRef.current); linkCopiedTimerRef.current = setTimeout(() => { setLinkCopied(false); linkCopiedTimerRef.current = null; }, 2000); }}
                style={{ ...btnP, marginBottom: 8, background: linkCopied ? "linear-gradient(135deg, #7ab87a, #5a9a5a)" : btnP.background, transition: "all .3s" }}>
                {linkCopied ? "Copied!" : "Copy Link"}
              </button>
              <div style={{ fontSize: 10, color: "#807888", marginTop: 4 }}>
                {existingInviteLetter.trim() ? "Your letter will appear when they first log in. " : ""}Link expires in 7 days.
              </div>
            </>)}
            {/* Sent invites history */}
            {sentInvites.length > 0 && (
              <div style={{ marginTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, textAlign: "left" }}>
                <div style={{ fontSize: 9, color: "#686070", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 8 }}>Sent Invites</div>
                {sentInvites.map(inv => (
                  <div key={inv.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 8, marginBottom: 4, border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#c0b8c8" }}>{inv.toEmail || "Link invite"}</div>
                      <div style={{ fontSize: 8, color: "#686070" }}>{inv.role} · {new Date(inv.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{
                      padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 500, letterSpacing: ".04em",
                      ...(inv.status === "accepted"
                        ? { background: "rgba(100,180,120,0.15)", color: "#7cc88c", border: "1px solid rgba(100,180,120,0.25)" }
                        : { background: "rgba(200,170,110,0.12)", color: "#c9a96e", border: "1px solid rgba(200,170,110,0.2)" })
                    }}>
                      {inv.status === "accepted" ? "Accepted" : "Pending"}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <button onClick={closeAllModals} style={btnS}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ====== COSMOS WELCOME TOUR ====== */}
      {showCosmosTour && ready && (() => {
        const hasWorlds = worlds.length > 0;
        const steps = [
          { title: "Welcome to Your Cosmos",
            body: "This is the center of your universe. Every world you create or join appears here as an orbiting orb. Your personal world sits at the center.",
            icon: "✨", hint: "Your cosmos grows as you add worlds" },
          { title: "Your Central World",
            body: "The glowing orb at the center is your My World — your personal travel diary. Click it anytime to jump in and start adding your adventures.",
            icon: "🌍", hint: "Click the center orb to enter" },
          ...(hasWorlds ? [{ title: "Shared Worlds",
            body: "The orbs orbiting around your center are shared worlds — partner trips, friend adventures, family vacations. Each one is a separate globe you share with others.",
            icon: "💫", hint: "Click any orbiting world to enter it" }] : []),
          { title: "Add & Share",
            body: "Use the controls at the bottom to create new worlds, share worlds with friends, or invite people to join Little Cosmos. Hover over any world to see invite options.",
            icon: "🔗", hint: "Start with \"+ Add a World\"" },
          { title: "Navigate Your Cosmos",
            body: "Drag to orbit around your worlds. Scroll to zoom in and out. Your cosmos is always here waiting — click the cosmos button from any world to return.",
            icon: "🖱", hint: "Drag to explore, scroll to zoom" },
        ];
        const step = steps[cosmosTourStep];
        return (
          <div role="dialog" aria-modal="true" aria-label="Cosmos tour" style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(4,2,10,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .5s ease" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background: "rgba(22,16,32,0.88)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 22, padding: "36px 32px", width: 380, maxWidth: "90vw", textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>{step.icon}</div>
              <div style={{ fontSize: 19, fontWeight: 500, color: "#e8e0d0", marginBottom: 10, letterSpacing: ".04em" }}>{step.title}</div>
              <div style={{ fontSize: 13, color: "#a098a8", lineHeight: 1.7, marginBottom: 12 }}>{step.body}</div>
              {step.hint && <div style={{ fontSize: 10, color: "#c9a96e", letterSpacing: "0.5px", marginBottom: 20, fontStyle: "italic" }}>{step.hint}</div>}
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
                {steps.map((_, i) => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i === cosmosTourStep ? "#c9a96e" : "rgba(255,255,255,0.12)", transition: "background .3s", boxShadow: i === cosmosTourStep ? "0 0 6px rgba(200,170,110,0.4)" : "none" }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                {cosmosTourStep > 0 && (
                  <button onClick={() => setCosmosTourStep(s => s - 1)}
                    style={{ padding: "9px 20px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, color: "#a098a8", fontSize: 13, fontFamily: F, cursor: "pointer" }}>
                    Back
                  </button>
                )}
                <button onClick={() => {
                  if (cosmosTourStep < steps.length - 1) { setCosmosTourStep(s => s + 1); }
                  else { setShowCosmosTour(false); try { localStorage.setItem(cosmosTourKey, "1"); } catch {} }
                }}
                  style={{ padding: "9px 24px", background: "linear-gradient(135deg, #c9a96e, #b8944f)", border: "none", borderRadius: 12, color: "#1a1520", fontSize: 13, fontWeight: 600, fontFamily: F, cursor: "pointer", boxShadow: "0 2px 12px rgba(200,170,110,0.2)" }}>
                  {cosmosTourStep < steps.length - 1 ? "Next" : "Explore My Cosmos"}
                </button>
              </div>
              {cosmosTourStep === 0 && (
                <button onClick={() => { setShowCosmosTour(false); try { localStorage.setItem(cosmosTourKey, "1"); } catch {} }}
                  style={{ marginTop: 14, background: "none", border: "none", color: "#605868", fontSize: 11, fontFamily: F, cursor: "pointer", letterSpacing: "0.3px" }}>
                  Skip tour
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Empty cosmos guidance — show when user has 0 shared worlds */}
      {worlds.length === 0 && connections.length === 0 && ready && (
        <div style={{ position: "absolute", bottom: "16%", left: "50%", transform: "translateX(-50%)", textAlign: "center", opacity: 0, animation: "fadeIn 1.5s 0.8s forwards", maxWidth: 340 }}>
          <div style={{ fontSize: 14, color: "#c0b8c8", fontFamily: F, letterSpacing: "0.4px", lineHeight: 1.8, marginBottom: 16 }}>
            Your cosmos is just beginning.
          </div>
          <div style={{ fontSize: 11, color: "#807888", fontFamily: F, letterSpacing: "0.3px", lineHeight: 1.7, marginBottom: 20 }}>
            Create a world to start mapping your adventures, or invite someone to build one together.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => setShowAddMenu(true)} style={{ padding: "10px 22px", background: "rgba(200,170,110,0.12)", border: "1px solid rgba(200,170,110,0.25)", borderRadius: 20, color: "#c9a96e", fontSize: 11, fontFamily: F, cursor: "pointer", letterSpacing: "0.5px", transition: "all .3s" }}
              onMouseEnter={e => { e.target.style.background = "rgba(200,170,110,0.2)"; e.target.style.borderColor = "rgba(200,170,110,0.4)"; }}
              onMouseLeave={e => { e.target.style.background = "rgba(200,170,110,0.12)"; e.target.style.borderColor = "rgba(200,170,110,0.25)"; }}>
              + Add a World
            </button>
            <button onClick={() => setShowAddFriend(true)} style={{ padding: "10px 22px", background: "rgba(160,192,232,0.08)", border: "1px solid rgba(160,192,232,0.15)", borderRadius: 20, color: "#8898b0", fontSize: 11, fontFamily: F, cursor: "pointer", letterSpacing: "0.5px", transition: "all .3s" }}
              onMouseEnter={e => { e.target.style.background = "rgba(160,192,232,0.15)"; e.target.style.borderColor = "rgba(160,192,232,0.3)"; }}
              onMouseLeave={e => { e.target.style.background = "rgba(160,192,232,0.08)"; e.target.style.borderColor = "rgba(160,192,232,0.15)"; }}>
              Invite a Friend
            </button>
          </div>
        </div>
      )}

      {/* Toast notification */}
      <div aria-live="polite" role="status" style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", background: "rgba(20,16,30,0.85)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(200,170,110,0.25)", borderRadius: 16, padding: "12px 24px", color: "#e8e0d0", fontSize: 13, fontFamily: F, letterSpacing: "0.3px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 100, animation: "fadeIn 0.3s ease", pointerEvents: "none", display: toast ? "block" : "none" }}>
        {toast}
      </div>

      {confirmModal && (
        <div role="dialog" aria-modal="true" aria-label="Confirm action" style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setConfirmModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1e1930", borderRadius: 16, padding: "24px 28px", maxWidth: 360, width: "90%", boxShadow: "0 12px 48px rgba(0,0,0,.25)", border: "1px solid rgba(196,138,168,0.12)", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#e8e0d0", lineHeight: 1.6, marginBottom: 20, fontFamily: F }}>{confirmModal.message}</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setConfirmModal(null)} style={{ padding: "8px 20px", background: "transparent", border: "1px solid rgba(184,174,200,0.2)", borderRadius: 10, color: "#a098a8", fontSize: 11, cursor: "pointer", fontFamily: F }}>Cancel</button>
              <button onClick={() => { setConfirmModal(null); confirmModal.onConfirm(); }} style={{ padding: "8px 20px", background: "rgba(196,138,168,0.12)", border: "1px solid rgba(196,138,168,0.2)", borderRadius: 10, color: "#c48aa8", fontSize: 11, cursor: "pointer", fontFamily: F, fontWeight: 600 }}>{confirmModal.confirmLabel || "Confirm"}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}@keyframes notifySlideIn{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}`}</style>
    </div>
  );
}
