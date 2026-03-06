import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { createWorld, loadMyWorlds, createInvite, createInviteWithLetter, acceptInvite, createViewerInvite, getSentInvites, loadCrossWorldActivity, loadWorldEntryCounts, loadMyWorldEntryCount, searchCrossWorld } from "./supabaseWorlds.js";
import { sendConnectionRequest, acceptConnection, declineConnection, getMyConnections, getPendingRequests } from "./supabaseConnections.js";
import { sendWelcomeLetter } from "./supabaseWelcomeLetters.js";

/* WorldSelector.jsx — "My Cosmos" world chooser
   My World is the central orb. Shared worlds orbit it.
   Friend worlds orbit at a further distance.
   Camera can be dragged/orbited to view from any angle. */

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
  family:  { color: "#cc7450", glowColor: "#e8a880", emissive: "#803018" },   // rich terracotta — matches family palette
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

export default function WorldSelector({ onSelect, onSignOut, worlds = [], onWorldsChange, userId, userEmail, userDisplayName, connections = [], onConnectionsChange, pendingRequests = [], onPendingRequestsChange, pendingWorldInvites = [], onPendingWorldInvitesChange, myWorldSubtitle = '' }) {
  const mountRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [ready, setReady] = useState(false);
  const labelRefsMap = useRef({});
  const dragRef = useRef({ dragging: false, moved: false, prevX: 0, prevY: 0 });
  const camAngleRef = useRef({ theta: 0.3, phi: 1.2, radius: 5.8 });

  // Cosmos tour (first visit)
  const [showCosmosTour, setShowCosmosTour] = useState(() => !localStorage.getItem("cosmos_tour_done"));
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
  const [sharedStep, setSharedStep] = useState(0);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLetter, setInviteLetter] = useState("");
  const [creatingShared, setCreatingShared] = useState(false);
  const [createdWorldId, setCreatedWorldId] = useState(null);
  const [generatedLink, setGeneratedLink] = useState("");

  // Invite from existing world
  const [inviteLink, setInviteLink] = useState("");
  const [inviteGenerating, setInviteGenerating] = useState(false);
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
    // Build subtitle: prefer partner names, then config subtitle, then type-based default
    const namesSub = (w.youName && w.partnerName) ? `${w.youName} & ${w.partnerName}` : null;
    const configSub = w.subtitle || null;
    const typeDefaults = { partner: "every moment, every adventure", friends: "adventures together", family: "family adventures" };
    const roleBadge = w.role === "viewer" ? " (viewing)" : "";
    const displaySub = namesSub || configSub || typeDefaults[w.type] || "shared world";
    return {
      id: w.id,
      label: w.name,
      sub: displaySub + roleBadge,
      isViewer: w.role === "viewer",
      worldType: w.type || "shared",
      ...typeColors,
      ...orbit,
      ...(w.role === "viewer" ? { size: 0.22, orbitRadius: (orbit.orbitRadius || 2.6) + 0.4 } : {}),
      ...(w.palette?.color ? { color: w.palette.color } : {}),
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

  // Load activity data for cosmos dashboard
  useEffect(() => {
    if (!userId) return;
    const worldIds = worlds.map(w => w.id);
    if (worldIds.length > 0) {
      loadCrossWorldActivity(worldIds, 15).then(setActivityData).catch(() => {});
      loadWorldEntryCounts(worldIds).then(setEntryCounts).catch(() => {});
    }
    loadMyWorldEntryCount(userId).then(setMyEntryCount).catch(() => {});
  }, [userId, worlds]);

  // World name map for activity feed
  const worldNameMap = useMemo(() => {
    const m = { my: "My World" };
    worlds.forEach(w => { m[w.id] = w.name; });
    return m;
  }, [worlds]);

  // ---- THREE.JS SCENE ----
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let W = mount.clientWidth, H = mount.clientHeight;

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
    const starCount = 900;
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
    const bsP = new Float32Array(60 * 3);
    for (let i = 0; i < 60; i++) {
      const r = 14 + Math.random() * 20, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      bsP[i*3] = r*Math.sin(ph)*Math.cos(th); bsP[i*3+1] = r*Math.sin(ph)*Math.sin(th); bsP[i*3+2] = r*Math.cos(ph);
    }
    const bsG = new THREE.BufferGeometry(); bsG.setAttribute("position", new THREE.BufferAttribute(bsP, 3));
    scene.add(new THREE.Points(bsG, new THREE.PointsMaterial({ color: "#f8f0e0", size: 0.09, transparent: true, opacity: 0.8 })));

    // Center orb
    const centerOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 48, 48),
      new THREE.MeshPhongMaterial({ color: CENTER.color, emissive: CENTER.emissive, emissiveIntensity: 1.2, shininess: 30 })
    );
    scene.add(centerOrb);
    [0.74, 0.78, 0.84, 0.92, 1.02, 1.15, 1.35, 1.6, 1.9].forEach((r, i) => {
      const op = [0.35, 0.30, 0.24, 0.20, 0.16, 0.12, 0.08, 0.05, 0.03][i];
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24),
        new THREE.MeshBasicMaterial({ color: CENTER.glowColor, transparent: true, opacity: op, side: THREE.BackSide })));
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.72, 32, 32),
      new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.12, side: THREE.FrontSide })));

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
      scene.add(orb);
      return { mesh: orb, world: w, angleOffset: (idx / Math.max(ALL_ORBS.length, 1)) * Math.PI * 2 };
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
      orbs.forEach((o, i) => {
        const angle = o.angleOffset + t * o.world.orbitSpeed;
        o.mesh.position.set(Math.cos(angle) * o.world.orbitRadius, Math.sin(angle * 0.7) * 0.15, Math.sin(angle) * o.world.orbitRadius);
        o.mesh.rotation.y += 0.008;
        o.mesh.scale.setScalar(1 + Math.sin(t * 2 + i * 1.5) * 0.03);
      });
      // Pulse orbit rings gently
      orbitRings.forEach((r, i) => { r.mat.opacity = r.baseOp + Math.sin(t * 0.8 + i * 2) * 0.02; });
      // Slow star field rotation for parallax
      stars.rotation.y = t * 0.003;
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
      rend.dispose();
      if (mount.contains(rend.domElement)) mount.removeChild(rend.domElement);
    };
  }, [ALL_ORBS.map(o => o.id).join(',')]);

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
        if (id === "my") { onSelect("my"); }
        else if (id.startsWith("friend-")) {
          const friendUserId = id.replace("friend-", "");
          const fw = friendWorlds.find(f => f.friendUserId === friendUserId);
          onSelect("friend", friendUserId, fw?.name || "Friend's World", "viewer");
        }
        else { const w = worlds.find(w => w.id === id); onSelect("our", id, w?.name || "Shared World", w?.role || "member", w?.type || "shared"); }
        return;
      }
    }
  }, [onSelect, worlds, friendWorlds]);

  const handleMove = useCallback((e) => {
    if (dragRef.current.dragging) { setHovered(null); return; }
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
    setHovered(found);
    for (const [id, el] of Object.entries(labelRefsMap.current)) { if (el) el.dataset.hov = (id === found) ? "true" : "false"; }
  }, []);

  const makeLabelRef = useCallback((id) => (el) => { labelRefsMap.current[id] = el; }, []);

  // ---- HANDLERS ----

  const handleCreatePersonal = async () => {
    if (!personalName.trim()) return;
    setCreatingPersonal(true);
    const world = await createWorld(userId, personalName.trim(), "personal");
    setCreatingPersonal(false);
    if (world) {
      const updated = await loadMyWorlds(userId);
      if (onWorldsChange) onWorldsChange(updated);
      setShowCreatePersonal(false);
      setPersonalName("");
      onSelect("our", world.id, world.name, "owner", "personal");
    } else { alert("Failed to create world. Please try again."); }
  };

  const handleCreateShared = async () => {
    if (!sharedName.trim()) return;
    setCreatingShared(true);
    const world = await createWorld(userId, sharedName.trim(), sharedType, {
      youName: sharedYouName.trim(),
      partnerName: sharedPartnerName.trim(),
    });
    setCreatingShared(false);
    if (!world) { alert("Failed to create world."); return; }
    setCreatedWorldId(world.id);
    setSharedStep(1);
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      alert("Please enter a valid email address.");
      return;
    }
    setCreatingShared(true);
    const result = await createInviteWithLetter(
      createdWorldId, userId, userDisplayName || "Someone special", inviteEmail.trim(), inviteLetter
    );
    setCreatingShared(false);
    if (result) {
      setGeneratedLink(result.inviteLink);
      setSharedStep(2);
    } else { alert("Failed to generate invite."); }
  };

  const handleFinishShared = async () => {
    const updated = await loadMyWorlds(userId);
    if (onWorldsChange) onWorldsChange(updated);
    setShowCreateShared(false);
    setSharedName(""); setSharedType("partner"); setSharedStep(0); setInviteEmail(""); setInviteLetter(""); setGeneratedLink("");
    const w = updated.find(w => w.id === createdWorldId);
    onSelect("our", createdWorldId, w?.name || "Shared World", "owner", w?.type || sharedType);
  };

  const handleGenerateInvite = async () => {
    const refreshInvites = () => getSentInvites(showInviteModal.id, userId).then(setSentInvites).catch(() => {});
    if (!existingInviteEmail.trim()) {
      setInviteGenerating(true);
      const inv = await createInvite(showInviteModal.id, userId, existingInviteRole);
      setInviteGenerating(false);
      if (inv) { setInviteLink(`${window.location.origin}?invite=${inv.token}`); refreshInvites(); }
      else alert("Failed to generate invite.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(existingInviteEmail.trim())) {
      alert("Please enter a valid email address.");
      return;
    }
    setInviteGenerating(true);
    if (existingInviteRole === "viewer") {
      const result = await createViewerInvite(
        showInviteModal.id, userId, existingInviteEmail.trim(), existingInviteLetter, userDisplayName
      );
      setInviteGenerating(false);
      if (result) { setInviteLink(result.inviteLink); refreshInvites(); }
      else { alert("Failed to generate invite."); }
    } else {
      const result = await createInviteWithLetter(
        showInviteModal.id, userId, userDisplayName || "Someone special", existingInviteEmail.trim(), existingInviteLetter
      );
      setInviteGenerating(false);
      if (result) { setInviteLink(result.inviteLink); refreshInvites(); }
      else { alert("Failed to generate invite."); }
    }
  };

  // Invite to Cosmos (platform invite with optional letter)
  const handleCosmosInvite = async () => {
    if (!cosmosInviteEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cosmosInviteEmail.trim())) {
      alert("Please enter a valid email address.");
      return;
    }
    setCosmosInviteSending(true);
    try {
      await sendWelcomeLetter(userId, userDisplayName || "A friend", cosmosInviteEmail.trim(), cosmosInviteLetter || `I'd love for you to join me on Little Cosmos — a place to map our adventures and memories on a beautiful 3D globe. Sign up at ${window.location.origin}`);
      setCosmosInviteSent(true);
    } catch (err) {
      console.error('[cosmosInvite]', err);
      alert("Failed to send invite.");
    }
    setCosmosInviteSending(false);
  };

  // Add a Friend (connection request)
  const handleAddFriend = async () => {
    if (!friendEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(friendEmail.trim())) {
      alert("Please enter a valid email address.");
      return;
    }
    setFriendSending(true);
    const result = await sendConnectionRequest(userId, userDisplayName || "", friendEmail.trim(), true, friendLetter);
    setFriendSending(false);
    if (result) {
      setFriendSent(true);
    } else {
      alert("Failed to send friend request.");
    }
  };

  // Accept/decline pending requests
  const handleAcceptRequest = async (req) => {
    const result = await acceptConnection(req.id);
    if (result?.ok) {
      if (onPendingRequestsChange) onPendingRequestsChange(prev => prev.filter(r => r.id !== req.id));
      const conn = await getMyConnections(userId);
      if (onConnectionsChange) onConnectionsChange(conn);
    } else {
      alert(result?.error || "Failed to accept request.");
    }
  };

  const handleDeclineRequest = async (req) => {
    const ok = await declineConnection(req.id);
    if (ok) {
      if (onPendingRequestsChange) onPendingRequestsChange(prev => prev.filter(r => r.id !== req.id));
    }
  };

  const handleSearch = useCallback((q) => {
    setSearchQuery(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!q.trim()) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      const worldIds = worlds.map(w => w.id);
      const results = await searchCrossWorld(worldIds, userId, q);
      setSearchResults(results);
      setSearching(false);
    }, 400);
  }, [worlds, userId]);

  const closeAllModals = () => {
    setShowAddMenu(false); setShowCreatePersonal(false); setShowCreateShared(false);
    setShowInviteModal(null); setShowInviteCosmos(false); setShowAddFriend(false); setShowPendingRequests(false); setShowWorldInvites(false); setShowActivity(false); setShowSearch(false);
    setPersonalName(""); setSharedName(""); setSharedType("partner"); setSharedYouName(""); setSharedPartnerName(""); setSharedStep(0); setInviteEmail("");
    setInviteLetter(""); setGeneratedLink("");
    setInviteLink(""); setExistingInviteEmail(""); setExistingInviteLetter(""); setExistingInviteRole("member");
    setCosmosInviteEmail(""); setCosmosInviteLetter(""); setCosmosInviteSent(false);
    setFriendEmail(""); setFriendLetter(""); setFriendSent(false);
    setInviteGenerating(false); setSentInvites([]);
  };

  // Style constants
  const modalBg = { position: "fixed", inset: 0, background: "rgba(4,2,10,0.65)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 };
  const modalBox = { background: "rgba(22,16,32,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "32px 28px", width: 400, maxWidth: "90vw", fontFamily: F, boxShadow: "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)" };
  const inputSt = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, color: "#e8e0d0", fontSize: 14, fontFamily: F, outline: "none", boxSizing: "border-box", transition: "border-color .2s" };
  const textareaSt = { ...inputSt, minHeight: 100, resize: "vertical", lineHeight: 1.6 };
  const btnP = { background: "linear-gradient(135deg, #c9a96e, #b8944f)", border: "none", borderRadius: 12, padding: "10px 24px", color: "#1a1520", fontSize: 13, fontWeight: 600, fontFamily: F, cursor: "pointer", letterSpacing: "0.04em", boxShadow: "0 2px 12px rgba(200,170,110,0.2)" };
  const btnS = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "8px 20px", color: "#a098a8", fontSize: 12, fontFamily: F, cursor: "pointer", transition: "all .2s" };
  const optionCard = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px", textAlign: "left", cursor: "pointer", transition: "all .2s" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0c0a12", fontFamily: F, cursor: hovered ? "pointer" : "grab", overflow: "hidden" }}
      onClick={handleClick} onMouseMove={handleMove}>

      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {/* Title */}
      <div style={{ position: "absolute", top: "4%", left: 0, right: 0, textAlign: "center", opacity: ready ? 1 : 0, transition: "opacity 1.2s", pointerEvents: "none" }}>
        <div style={{ fontSize: 11, letterSpacing: "6px", color: "#c8c0d8", textTransform: "uppercase", fontWeight: 400, textShadow: "0 0 20px rgba(180,160,220,0.3), 0 1px 8px rgba(0,0,0,0.4)" }}>My Cosmos</div>
      </div>

      {/* Center label */}
      <div ref={makeLabelRef("my")} data-hov="false" style={{ position: "absolute", left: 0, top: 0, transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none", transition: "opacity .15s", opacity: 0 }}>
        <div style={{ fontSize: hovered === "my" ? 24 : 20, fontWeight: 500, color: "#e8dcc8", letterSpacing: "2px", textShadow: "0 0 24px rgba(208,176,128,0.5), 0 2px 10px rgba(0,0,0,0.6)", transition: "font-size .2s" }}>My World</div>
        <div style={{ fontSize: 10, color: "#b0a890", marginTop: 4, letterSpacing: "1.5px", fontWeight: 400, textTransform: "uppercase", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>{myWorldSubtitle || "Travel Diary"}</div>
        {myEntryCount > 0 && (
          <div style={{ fontSize: 8, color: "#a09880", marginTop: 3, letterSpacing: "0.5px" }}>{myEntryCount} {myEntryCount === 1 ? "entry" : "entries"}</div>
        )}
      </div>

      {/* Orbiting world labels (shared + friend) */}
      {ALL_ORBS.map(w => (
        <div key={w.id} ref={makeLabelRef(w.id)} data-hov="false" style={{ position: "absolute", left: 0, top: 0, transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none", transition: "opacity .15s", opacity: 0 }}>
          <div style={{ fontSize: hovered === w.id ? 19 : 15, fontWeight: 500, color: w.id.startsWith("friend-") ? "#c8d8e8" : w.glowColor || "#f0d8e8", letterSpacing: "1.2px", textShadow: `0 0 20px ${w.color}80, 0 2px 8px rgba(0,0,0,0.6)`, transition: "font-size .2s" }}>{w.label}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 2 }}>
            <div style={{ fontSize: 11, color: w.id.startsWith("friend-") ? "#a0b0c0" : `${w.color}cc`, letterSpacing: "0.8px", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>{w.sub}</div>
            {!w.id.startsWith("friend-") && w.worldType && w.worldType !== "shared" && (
              <div style={{ fontSize: 8, letterSpacing: "0.8px", textTransform: "uppercase", color: `${w.color}aa`, background: `${w.color}18`, border: `1px solid ${w.color}30`, borderRadius: 6, padding: "1px 6px", fontWeight: 600 }}>
                {{ partner: "Partner", friends: "Friends", family: "Family" }[w.worldType] || w.worldType}
              </div>
            )}
          </div>
          {entryCounts[w.id] > 0 && (
            <div style={{ fontSize: 8, color: `${w.color}99`, marginTop: 2, letterSpacing: "0.5px" }}>{entryCounts[w.id]} {entryCounts[w.id] === 1 ? "entry" : "entries"}</div>
          )}
          {hovered === w.id && !w.id.startsWith("friend-") && (
            <button onClick={(e) => { e.stopPropagation(); const ww = worlds.find(x => x.id === w.id); setShowInviteModal(ww); setInviteLink(""); setExistingInviteEmail(""); setExistingInviteLetter(""); getSentInvites(ww.id, userId).then(setSentInvites).catch(() => setSentInvites([])); }}
              style={{ marginTop: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "3px 10px", color: "#c0b8c8", fontSize: 9, fontFamily: F, cursor: "pointer", pointerEvents: "auto", letterSpacing: "0.5px" }}>
              Invite
            </button>
          )}
        </div>
      ))}

      {/* Pending requests notification — glassmorphic */}
      {pendingRequests.length > 0 && (
        <button onClick={(e) => { e.stopPropagation(); setShowPendingRequests(true); }}
          style={{ position: "absolute", top: 16, left: 16, background: "rgba(200,170,110,0.10)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(200,170,110,0.2)", borderRadius: 14, padding: "6px 14px", color: "#c9a96e", fontSize: 10, fontFamily: F, cursor: "pointer", opacity: ready ? 1 : 0, transition: "all .5s", zIndex: 10, letterSpacing: "0.6px", boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
          {pendingRequests.length} sharing invite{pendingRequests.length > 1 ? "s" : ""}
        </button>
      )}

      {/* Pending world invite notification — glassmorphic */}
      {pendingWorldInvites.length > 0 && (
        <button onClick={(e) => { e.stopPropagation(); setShowWorldInvites(true); }}
          style={{ position: "absolute", top: pendingRequests.length > 0 ? 48 : 16, left: 16, background: "rgba(232,184,208,0.10)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(232,184,208,0.2)", borderRadius: 14, padding: "6px 14px", color: "#e8b8d0", fontSize: 10, fontFamily: F, cursor: "pointer", opacity: ready ? 1 : 0, transition: "all .5s", zIndex: 10, letterSpacing: "0.6px", boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
          {pendingWorldInvites.length} world invite{pendingWorldInvites.length > 1 ? "s" : ""}
        </button>
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
            Share Worlds
          </button>
          <button onClick={(e) => { e.stopPropagation(); setShowInviteCosmos(true); }}
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "7px 18px", color: "#908898", fontSize: 10, fontFamily: F, letterSpacing: "1px", cursor: "pointer", transition: "all .3s" }}
            onMouseEnter={e => { e.target.style.color = "#c0b8c8"; e.target.style.borderColor = "rgba(255,255,255,0.18)"; }}
            onMouseLeave={e => { e.target.style.color = "#908898"; e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}>
            Invite to Cosmos
          </button>
        </div>
        <div style={{ fontSize: 9, color: "#605868", marginTop: 8, letterSpacing: "1.5px", textAlign: "center", textTransform: "uppercase" }}>drag to orbit · scroll to zoom</div>
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
        <button onClick={(e) => { e.stopPropagation(); if (window.confirm("Sign out of My Cosmos?")) onSignOut(); }}
          style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "5px 14px", color: "#706878", fontSize: 9, fontFamily: F, letterSpacing: "0.8px", cursor: "pointer", transition: "all .3s", textTransform: "uppercase" }}
          onMouseEnter={e => { e.target.style.color = "#b0a8b8"; e.target.style.borderColor = "rgba(255,255,255,0.15)"; }}
          onMouseLeave={e => { e.target.style.color = "#706878"; e.target.style.borderColor = "rgba(255,255,255,0.06)"; }}>
          Sign Out
        </button>
      </div>

      {/* Activity feed panel */}
      {showActivity && (
        <div style={{ position: "absolute", top: 50, right: 16, width: 290, maxHeight: "60vh", background: "rgba(20,16,28,0.88)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(200,170,140,0.06)", borderRadius: 18, padding: "18px", zIndex: 20, overflowY: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.1), 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,245,230,0.03)", animation: "fadeIn .3s ease" }}
          onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 9, letterSpacing: "2px", textTransform: "uppercase", color: "#807888", marginBottom: 12, fontFamily: F }}>Recent Activity</div>
          {activityData.length === 0 && (
            <div style={{ fontSize: 12, color: "#605868", padding: "20px 0", textAlign: "center", fontFamily: F }}>
              No activity yet. Add entries to your worlds to see them here.
            </div>
          )}
          {activityData.map((a, i) => (
            <div key={a.id || i} style={{ display: "flex", gap: 10, padding: "8px 6px", borderBottom: i < activityData.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", alignItems: "flex-start" }}>
              {a.photos && a.photos.length > 0 ? (
                <img src={a.photos[0]} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                  🌍
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "#d0c8d8", fontFamily: F, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a.city}{a.country ? `, ${a.country}` : ""}
                </div>
                <div style={{ fontSize: 9, color: "#686070", fontFamily: F, marginTop: 2 }}>
                  {worldNameMap[a.world_id] || "Shared World"} · {a.date_start ? new Date(a.date_start + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                </div>
              </div>
            </div>
          ))}
          {activityData.length > 0 && (
            <div style={{ fontSize: 9, color: "#504860", textAlign: "center", marginTop: 10, fontFamily: F, letterSpacing: "0.5px" }}>
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
                if (r.source === "my") { onSelect("my"); }
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
        <div style={modalBg} onClick={(e) => { e.stopPropagation(); closeAllModals(); }}>
          <div style={{ ...modalBox, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>Add a World</div>
            <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 24 }}>
              What kind of world would you like to create?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={optionCard}
                onClick={() => { setShowAddMenu(false); setShowCreatePersonal(true); }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(160,192,232,0.3)"; e.currentTarget.style.background = "rgba(160,192,232,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#c0d8f0", marginBottom: 4 }}>Personal World</div>
                <div style={{ fontSize: 11, color: "#807888", lineHeight: 1.5 }}>Another private travel diary, just for you. Great for separating trips by category or time period.</div>
              </div>
              <div style={optionCard}
                onClick={() => { setShowAddMenu(false); setShowCreateShared(true); }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(232,184,208,0.3)"; e.currentTarget.style.background = "rgba(232,184,208,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#e8b8d0", marginBottom: 4 }}>Shared World</div>
                <div style={{ fontSize: 11, color: "#807888", lineHeight: 1.5 }}>A travel diary with someone special — a partner, friend, or family. Invite them by email.</div>
              </div>
            </div>
            <button onClick={closeAllModals} style={{ ...btnS, marginTop: 20 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ====== CREATE PERSONAL WORLD ====== */}
      {showCreatePersonal && (
        <div style={modalBg} onClick={(e) => { e.stopPropagation(); closeAllModals(); }}>
          <div style={{ ...modalBox, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>Create a Personal World</div>
            <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 20 }}>
              This world will be private to you, orbiting your My World in your cosmos.
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
        <div style={modalBg} onClick={(e) => { e.stopPropagation(); if (sharedStep < 2) closeAllModals(); }}>
          <div style={{ ...modalBox, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            {sharedStep === 0 && (<>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>Create a Shared World</div>
              <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 16 }}>
                What kind of shared world is this?
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16, justifyContent: "center", flexWrap: "wrap" }}>
                {[
                  { key: "partner", label: "Partner", icon: "\u{1F495}", desc: "A romantic partner", accent: "#e8b8d0", accentBg: "rgba(232,184,208,0.12)", accentBorder: "rgba(232,184,208,0.4)" },
                  { key: "friends", label: "Friends", icon: "\u{1F91D}", desc: "Close friends", accent: "#9898e0", accentBg: "rgba(108,108,204,0.12)", accentBorder: "rgba(108,108,204,0.4)" },
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
              <div style={{ fontSize: 10, color: "#807888", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, textAlign: "left" }}>
                {sharedType === "partner" ? "Who's sharing this world?" : "Names (shows on your cosmos)"}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input value={sharedYouName} onChange={e => setSharedYouName(e.target.value)}
                  placeholder="Your name" style={{ ...inputSt, flex: 1 }} />
                <input value={sharedPartnerName} onChange={e => setSharedPartnerName(e.target.value)}
                  placeholder={sharedType === "partner" ? "Partner's name" : sharedType === "friends" ? "Friend / group" : "Family member"}
                  style={{ ...inputSt, flex: 1 }}
                  onKeyDown={e => { if (e.key === "Enter") handleCreateShared(); }} />
              </div>
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
                Enter their email to invite them. You can also write a personal letter they'll see when they first open the app.
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
                <button onClick={() => navigator.clipboard.writeText(generatedLink)} style={btnP}>Copy Link</button>
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
        <div style={modalBg} onClick={(e) => { e.stopPropagation(); closeAllModals(); }}>
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
        <div style={modalBg} onClick={(e) => { e.stopPropagation(); closeAllModals(); }}>
          <div style={{ ...modalBox, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            {!friendSent ? (<>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>Share Worlds</div>
              <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 20 }}>
                Send an invite to share worlds with a friend. Once both of you approve, your worlds will appear in each other's cosmos.
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
        <div style={modalBg} onClick={(e) => { e.stopPropagation(); closeAllModals(); }}>
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
        <div style={modalBg} onClick={(e) => { e.stopPropagation(); closeAllModals(); }}>
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
                      const result = await acceptInvite(inv.token);
                      if (result?.ok) {
                        const updated = await loadMyWorlds(userId);
                        if (onWorldsChange) onWorldsChange(updated);
                        if (onPendingWorldInvitesChange) onPendingWorldInvitesChange(prev => prev.filter((_, i) => i !== idx));
                        closeAllModals();
                        const joined = updated.find(w => w.id === result.world_id);
                        onSelect("our", result.world_id, inv.worldName, joined?.role || "member", inv.worldType || joined?.type || "shared");
                      } else { alert(result?.error || "Failed to accept invite."); }
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
        <div style={modalBg} onClick={(e) => { e.stopPropagation(); closeAllModals(); }}>
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
              <button onClick={() => navigator.clipboard.writeText(inviteLink)} style={{ ...btnP, marginBottom: 8 }}>Copy Link</button>
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
          <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(4,2,10,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .5s ease" }}
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
                  else { setShowCosmosTour(false); localStorage.setItem("cosmos_tour_done", "1"); }
                }}
                  style={{ padding: "9px 24px", background: "linear-gradient(135deg, #c9a96e, #b8944f)", border: "none", borderRadius: 12, color: "#1a1520", fontSize: 13, fontWeight: 600, fontFamily: F, cursor: "pointer", boxShadow: "0 2px 12px rgba(200,170,110,0.2)" }}>
                  {cosmosTourStep < steps.length - 1 ? "Next" : "Explore My Cosmos"}
                </button>
              </div>
              {cosmosTourStep === 0 && (
                <button onClick={() => { setShowCosmosTour(false); localStorage.setItem("cosmos_tour_done", "1"); }}
                  style={{ marginTop: 14, background: "none", border: "none", color: "#605868", fontSize: 11, fontFamily: F, cursor: "pointer", letterSpacing: "0.3px" }}>
                  Skip tour
                </button>
              )}
            </div>
          </div>
        );
      })()}

      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  );
}
