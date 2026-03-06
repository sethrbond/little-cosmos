import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { createWorld, loadMyWorlds, createInvite, createInviteWithLetter, acceptInvite, createViewerInvite } from "./supabaseWorlds.js";
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
  color: "#a0c0e8",
  glowColor: "#d0e4ff",
  emissive: "#4060a0",
};

const ORB_PRESETS = [
  { color: "#e8b8d0", glowColor: "#fce0f0", emissive: "#a05080", orbitRadius: 2.4, orbitSpeed: 0.25, size: 0.32 },
  { color: "#b8e0c0", glowColor: "#d8f4e0", emissive: "#408060", orbitRadius: 2.8, orbitSpeed: 0.20, size: 0.28 },
  { color: "#e0d0a0", glowColor: "#f4ecc8", emissive: "#806830", orbitRadius: 3.2, orbitSpeed: 0.18, size: 0.26 },
  { color: "#c0b8e8", glowColor: "#e0d8f8", emissive: "#504080", orbitRadius: 2.6, orbitSpeed: 0.22, size: 0.30 },
  { color: "#e0a0a0", glowColor: "#f8d0d0", emissive: "#804040", orbitRadius: 3.0, orbitSpeed: 0.16, size: 0.27 },
  { color: "#a0d0e0", glowColor: "#c8e8f4", emissive: "#406080", orbitRadius: 2.5, orbitSpeed: 0.23, size: 0.29 },
];

const FRIEND_ORB_PRESETS = [
  { color: "#c8d8e8", glowColor: "#e0ecf8", emissive: "#405870", orbitRadius: 4.0, orbitSpeed: 0.12, size: 0.20 },
  { color: "#d8c8e0", glowColor: "#ece0f0", emissive: "#584070", orbitRadius: 4.3, orbitSpeed: 0.10, size: 0.18 },
  { color: "#c8e0d0", glowColor: "#e0f0e8", emissive: "#406850", orbitRadius: 4.6, orbitSpeed: 0.11, size: 0.19 },
  { color: "#e0d8c8", glowColor: "#f0ece0", emissive: "#685840", orbitRadius: 4.1, orbitSpeed: 0.13, size: 0.20 },
];

const F = "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif";

export default function WorldSelector({ onSelect, onSignOut, worlds = [], onWorldsChange, userId, userEmail, userDisplayName, connections = [], onConnectionsChange, pendingRequests = [], onPendingRequestsChange }) {
  const mountRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [ready, setReady] = useState(false);
  const labelRefsMap = useRef({});
  const dragRef = useRef({ dragging: false, moved: false, prevX: 0, prevY: 0 });
  const camAngleRef = useRef({ theta: 0.3, phi: 1.2, radius: 5.8 });

  // Modal states
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showCreatePersonal, setShowCreatePersonal] = useState(false);
  const [showCreateShared, setShowCreateShared] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(null);
  const [showInviteCosmos, setShowInviteCosmos] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showPendingRequests, setShowPendingRequests] = useState(false);

  // Create personal world
  const [personalName, setPersonalName] = useState("");
  const [creatingPersonal, setCreatingPersonal] = useState(false);

  // Create shared world
  const [sharedName, setSharedName] = useState("");
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

  // Invite to Cosmos (platform invite)
  const [cosmosInviteEmail, setCosmosInviteEmail] = useState("");
  const [cosmosInviteLetter, setCosmosInviteLetter] = useState("");
  const [cosmosInviteSending, setCosmosInviteSending] = useState(false);
  const [cosmosInviteSent, setCosmosInviteSent] = useState(false);

  // Add a Friend
  const [friendEmail, setFriendEmail] = useState("");
  const [friendShareBack, setFriendShareBack] = useState(false);
  const [friendLetter, setFriendLetter] = useState("");
  const [friendSending, setFriendSending] = useState(false);
  const [friendSent, setFriendSent] = useState(false);

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

  // Build orbiting worlds from props
  const WORLDS = useMemo(() => worlds.map((w, i) => ({
    id: w.id,
    label: w.name,
    sub: w.role === "owner" ? "Owner" : w.role === "viewer" ? "Viewing" : "Member",
    isViewer: w.role === "viewer",
    ...ORB_PRESETS[i % ORB_PRESETS.length],
    ...(w.role === "viewer" ? { size: 0.22, orbitRadius: (ORB_PRESETS[i % ORB_PRESETS.length]?.orbitRadius || 2.6) + 0.4 } : {}),
    ...(w.palette?.color ? { color: w.palette.color } : {}),
  })), [worlds]);

  // Build friend orbs
  const FRIEND_ORBS = useMemo(() => friendWorlds.map((fw, i) => ({
    id: fw.id,
    friendUserId: fw.friendUserId,
    label: fw.name,
    sub: "Following",
    ...FRIEND_ORB_PRESETS[i % FRIEND_ORB_PRESETS.length],
  })), [friendWorlds]);

  const ALL_ORBS = useMemo(() => [...WORLDS, ...FRIEND_ORBS], [WORLDS, FRIEND_ORBS]);

  // ---- THREE.JS SCENE ----
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let W = mount.clientWidth, H = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0c0a12");
    scene.fog = new THREE.FogExp2("#0c0a12", 0.012);
    const cam = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    const rend = new THREE.WebGLRenderer({ antialias: true });
    rend.setSize(W, H);
    rend.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(rend.domElement);

    scene.add(new THREE.AmbientLight("#f8f0f8", 0.9));
    const sun = new THREE.DirectionalLight("#fffff0", 1.5);
    sun.position.set(3, 3, 4); scene.add(sun);
    const pl1 = new THREE.PointLight("#f0e0f0", 0.8, 18); pl1.position.set(-3, -1, 2); scene.add(pl1);
    const pl2 = new THREE.PointLight("#e0d8f8", 0.5, 14); pl2.position.set(0, 2, -3); scene.add(pl2);
    const pl3 = new THREE.PointLight("#d0c0e0", 0.4, 12); pl3.position.set(0, -2, -3); scene.add(pl3);

    // Stars
    const sP = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const r = 15 + Math.random() * 25, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      sP[i*3] = r*Math.sin(ph)*Math.cos(th); sP[i*3+1] = r*Math.sin(ph)*Math.sin(th); sP[i*3+2] = r*Math.cos(ph);
    }
    const sG = new THREE.BufferGeometry(); sG.setAttribute("position", new THREE.BufferAttribute(sP, 3));
    scene.add(new THREE.Points(sG, new THREE.PointsMaterial({ color: "#f0e8d8", size: 0.04, transparent: true, opacity: 0.5 })));

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

    if (ALL_ORBS.length > 0) {
      const avgRadius = ALL_ORBS.reduce((s, w) => s + w.orbitRadius, 0) / ALL_ORBS.length;
      const ring = new THREE.Mesh(new THREE.RingGeometry(avgRadius - 0.03, avgRadius + 0.03, 80),
        new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.04, side: THREE.DoubleSide }));
      ring.rotation.x = Math.PI * 0.5; scene.add(ring);
    }

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
  }, [ALL_ORBS.length]);

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
        else { const w = worlds.find(w => w.id === id); onSelect("our", id, w?.name || "Shared World", w?.role || "member"); }
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
      onSelect("our", world.id, world.name, "owner");
    } else { alert("Failed to create world. Please try again."); }
  };

  const handleCreateShared = async () => {
    if (!sharedName.trim()) return;
    setCreatingShared(true);
    const world = await createWorld(userId, sharedName.trim(), "shared");
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
    setSharedName(""); setSharedStep(0); setInviteEmail(""); setInviteLetter(""); setGeneratedLink("");
    const w = updated.find(w => w.id === createdWorldId);
    onSelect("our", createdWorldId, w?.name || "Shared World", "owner");
  };

  const handleGenerateInvite = async () => {
    if (!existingInviteEmail.trim()) {
      setInviteGenerating(true);
      const inv = await createInvite(showInviteModal.id, userId, existingInviteRole);
      setInviteGenerating(false);
      if (inv) setInviteLink(`${window.location.origin}?invite=${inv.token}`);
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
      if (result) { setInviteLink(result.inviteLink); }
      else { alert("Failed to generate invite."); }
    } else {
      const result = await createInviteWithLetter(
        showInviteModal.id, userId, userDisplayName || "Someone special", existingInviteEmail.trim(), existingInviteLetter
      );
      setInviteGenerating(false);
      if (result) { setInviteLink(result.inviteLink); }
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
    const result = await sendConnectionRequest(userId, userDisplayName || "", friendEmail.trim(), friendShareBack, friendLetter);
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

  const closeAllModals = () => {
    setShowAddMenu(false); setShowCreatePersonal(false); setShowCreateShared(false);
    setShowInviteModal(null); setShowInviteCosmos(false); setShowAddFriend(false); setShowPendingRequests(false);
    setPersonalName(""); setSharedName(""); setSharedStep(0); setInviteEmail("");
    setInviteLetter(""); setGeneratedLink("");
    setInviteLink(""); setExistingInviteEmail(""); setExistingInviteLetter(""); setExistingInviteRole("member");
    setCosmosInviteEmail(""); setCosmosInviteLetter(""); setCosmosInviteSent(false);
    setFriendEmail(""); setFriendShareBack(false); setFriendLetter(""); setFriendSent(false);
  };

  // Style constants
  const modalBg = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 };
  const modalBox = { background: "#1a1424", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "32px 28px", width: 400, maxWidth: "90vw", fontFamily: F };
  const inputSt = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#e8e0d0", fontSize: 14, fontFamily: F, outline: "none", boxSizing: "border-box" };
  const textareaSt = { ...inputSt, minHeight: 100, resize: "vertical", lineHeight: 1.6 };
  const btnP = { background: "linear-gradient(135deg, #c9a96e, #b8944f)", border: "none", borderRadius: 10, padding: "10px 24px", color: "#1a1520", fontSize: 13, fontWeight: 600, fontFamily: F, cursor: "pointer", letterSpacing: "0.04em" };
  const btnS = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 20px", color: "#a098a8", fontSize: 12, fontFamily: F, cursor: "pointer" };
  const optionCard = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "18px 20px", textAlign: "left", cursor: "pointer", transition: "all .2s" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0c0a12", fontFamily: F, cursor: hovered ? "pointer" : "grab", overflow: "hidden" }}
      onClick={handleClick} onMouseMove={handleMove}>

      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {/* Title */}
      <div style={{ position: "absolute", top: "4%", left: 0, right: 0, textAlign: "center", opacity: ready ? 1 : 0, transition: "opacity 1.2s", pointerEvents: "none" }}>
        <div style={{ fontSize: 13, letterSpacing: "4px", color: "#d0c8e0", textTransform: "uppercase", fontWeight: 500, textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>My Cosmos</div>
      </div>

      {/* Center label */}
      <div ref={makeLabelRef("my")} data-hov="false" style={{ position: "absolute", left: 0, top: 0, transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none", transition: "opacity .15s", opacity: 0 }}>
        <div style={{ fontSize: hovered === "my" ? 26 : 22, fontWeight: 600, color: "#e0eaff", letterSpacing: "1.5px", textShadow: "0 0 30px rgba(120,160,240,0.6), 0 2px 10px rgba(0,0,0,0.6)", transition: "font-size .2s" }}>My World</div>
        <div style={{ fontSize: 12, color: "#b8c8e0", marginTop: 3, letterSpacing: "1.2px", fontWeight: 400, textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>Travel Diary</div>
      </div>

      {/* Orbiting world labels (shared + friend) */}
      {ALL_ORBS.map(w => (
        <div key={w.id} ref={makeLabelRef(w.id)} data-hov="false" style={{ position: "absolute", left: 0, top: 0, transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none", transition: "opacity .15s", opacity: 0 }}>
          <div style={{ fontSize: hovered === w.id ? 22 : 17, fontWeight: 600, color: w.id.startsWith("friend-") ? "#c8d8e8" : "#f0d8e8", letterSpacing: "0.8px", textShadow: `0 0 24px ${w.color}90, 0 2px 10px rgba(0,0,0,0.6)`, transition: "font-size .2s" }}>{w.label}</div>
          <div style={{ fontSize: 11, color: w.id.startsWith("friend-") ? "#a0b0c0" : "#e0c8d8", marginTop: 2, letterSpacing: "0.8px", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>{w.sub}</div>
          {hovered === w.id && !w.id.startsWith("friend-") && (
            <button onClick={(e) => { e.stopPropagation(); setShowInviteModal(worlds.find(ww => ww.id === w.id)); setInviteLink(""); setExistingInviteEmail(""); setExistingInviteLetter(""); }}
              style={{ marginTop: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "3px 10px", color: "#c0b8c8", fontSize: 9, fontFamily: F, cursor: "pointer", pointerEvents: "auto", letterSpacing: "0.5px" }}>
              Invite
            </button>
          )}
        </div>
      ))}

      {/* Pending requests notification */}
      {pendingRequests.length > 0 && (
        <button onClick={(e) => { e.stopPropagation(); setShowPendingRequests(true); }}
          style={{ position: "absolute", top: 16, left: 16, background: "rgba(200,170,110,0.15)", border: "1px solid rgba(200,170,110,0.3)", borderRadius: 12, padding: "6px 14px", color: "#c9a96e", fontSize: 11, fontFamily: F, cursor: "pointer", opacity: ready ? 1 : 0, transition: "all .5s", zIndex: 10, letterSpacing: "0.5px" }}>
          {pendingRequests.length} friend request{pendingRequests.length > 1 ? "s" : ""}
        </button>
      )}

      {/* Bottom controls */}
      <div style={{ position: "absolute", bottom: "5%", left: 0, right: 0, textAlign: "center", opacity: ready ? 1 : 0, transition: "opacity 1.5s" }}>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={(e) => { e.stopPropagation(); setShowAddMenu(true); }}
            style={{ background: "linear-gradient(135deg, rgba(200,170,110,0.15), rgba(200,170,110,0.08))", border: "1px solid rgba(200,170,110,0.25)", borderRadius: 20, padding: "8px 22px", color: "#c9a96e", fontSize: 11, fontFamily: F, letterSpacing: "1px", cursor: "pointer", transition: "all .3s" }}
            onMouseEnter={e => { e.target.style.borderColor = "rgba(200,170,110,0.5)"; }}
            onMouseLeave={e => { e.target.style.borderColor = "rgba(200,170,110,0.25)"; }}>
            + Add a World
          </button>
          <button onClick={(e) => { e.stopPropagation(); setShowAddFriend(true); }}
            style={{ background: "rgba(160,192,232,0.08)", border: "1px solid rgba(160,192,232,0.2)", borderRadius: 20, padding: "8px 22px", color: "#a0c0e8", fontSize: 11, fontFamily: F, letterSpacing: "1px", cursor: "pointer", transition: "all .3s" }}
            onMouseEnter={e => { e.target.style.borderColor = "rgba(160,192,232,0.4)"; }}
            onMouseLeave={e => { e.target.style.borderColor = "rgba(160,192,232,0.2)"; }}>
            Add a Friend
          </button>
          <button onClick={(e) => { e.stopPropagation(); setShowInviteCosmos(true); }}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "8px 22px", color: "#908898", fontSize: 11, fontFamily: F, letterSpacing: "1px", cursor: "pointer", transition: "all .3s" }}
            onMouseEnter={e => { e.target.style.color = "#c0b8c8"; }}
            onMouseLeave={e => { e.target.style.color = "#908898"; }}>
            Invite to Cosmos
          </button>
        </div>
        <div style={{ fontSize: 10, color: "#807888", marginTop: 8, letterSpacing: "0.8px" }}>drag to orbit · scroll to zoom</div>
      </div>

      {/* Sign out */}
      <button onClick={(e) => { e.stopPropagation(); if (window.confirm("Sign out of My Cosmos?")) onSignOut(); }}
        style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "5px 12px", color: "#807888", fontSize: 10, fontFamily: F, letterSpacing: "0.5px", cursor: "pointer", opacity: ready ? 1 : 0, transition: "all .5s", zIndex: 10 }}
        onMouseEnter={e => { e.target.style.color = "#c0b8c8"; }}
        onMouseLeave={e => { e.target.style.color = "#807888"; }}>
        Sign Out
      </button>

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
              <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 20 }}>
                Name your shared world. You'll invite someone to join in the next step.
              </div>
              <input value={sharedName} onChange={e => setSharedName(e.target.value)}
                placeholder="World name (e.g. Our Adventures)"
                style={{ ...inputSt, marginBottom: 16 }}
                onKeyDown={e => { if (e.key === "Enter") handleCreateShared(); }} autoFocus />
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
              <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>Add a Friend</div>
              <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 20 }}>
                Send a friend request to follow someone's world in your cosmos. They'll need to accept before their world appears.
              </div>
              <input value={friendEmail} onChange={e => setFriendEmail(e.target.value)}
                placeholder="Their email address"
                type="email"
                style={{ ...inputSt, marginBottom: 14 }} autoFocus />
              <div onClick={() => setFriendShareBack(!friendShareBack)}
                style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 14px", background: friendShareBack ? "rgba(160,192,232,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${friendShareBack ? "rgba(160,192,232,0.25)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, marginBottom: 14, transition: "all .2s" }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${friendShareBack ? "#a0c0e8" : "#504858"}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s", flexShrink: 0 }}>
                  {friendShareBack && <div style={{ width: 10, height: 10, borderRadius: 2, background: "#a0c0e8" }} />}
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 12, color: friendShareBack ? "#c0d8f0" : "#a098a8", fontWeight: 500 }}>Also share your world with them</div>
                  <div style={{ fontSize: 10, color: "#686070", marginTop: 2 }}>They'll see your My World in their cosmos too</div>
                </div>
              </div>
              <div style={{ textAlign: "left", marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: "#807888", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Write a note (optional)</div>
              </div>
              <textarea value={friendLetter} onChange={e => setFriendLetter(e.target.value)}
                placeholder="Hey! I'd love to follow your travels..."
                style={{ ...textareaSt, minHeight: 70, marginBottom: 16 }} />
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={closeAllModals} style={btnS}>Cancel</button>
                <button onClick={handleAddFriend} disabled={friendSending || !friendEmail.trim()}
                  style={{ ...btnP, opacity: friendSending || !friendEmail.trim() ? 0.5 : 1 }}>
                  {friendSending ? "Sending..." : "Send Request"}
                </button>
              </div>
            </>) : (<>
              <div style={{ fontSize: 44, marginBottom: 12 }}>&#128075;</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>Request Sent!</div>
              <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 16 }}>
                {friendEmail} will see your request next time they open their cosmos.
                {friendShareBack ? " If they accept, you'll both see each other's worlds." : " Once they accept, their world will appear in your cosmos."}
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
            <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 6 }}>Friend Requests</div>
            <div style={{ fontSize: 12, color: "#a098a8", lineHeight: 1.6, marginBottom: 20 }}>
              People who want to follow your world in their cosmos.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 300, overflowY: "auto" }}>
              {pendingRequests.map(req => (
                <div key={req.id} style={{ ...optionCard, cursor: "default" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e0d8e8", marginBottom: 2 }}>
                    {req.requester_name || "Someone"} wants to follow your world
                  </div>
                  <div style={{ fontSize: 10, color: "#807888", marginBottom: 4 }}>{req.target_email}</div>
                  {req.share_back && (
                    <div style={{ fontSize: 10, color: "#a0c0e8", marginBottom: 4, fontStyle: "italic" }}>
                      They're also sharing their world with you
                    </div>
                  )}
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
            <div style={{ marginTop: 16 }}>
              <button onClick={closeAllModals} style={btnS}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
