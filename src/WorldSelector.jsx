import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

/* WorldSelector.jsx — "My Cosmos" world chooser
   My World is the central orb. Other worlds orbit it.
   Camera can be dragged/orbited to view from any angle.
   Labels track their orbs in real-time via direct DOM updates.
   Dynamic: only shows worlds the user has created/joined. */

const CENTER = {
  id: "my",
  label: "My World",
  sub: "Travel Diary",
  color: "#a0c0e8",
  glowColor: "#d0e4ff",
  emissive: "#4060a0",
};

// Preset orbital configs for shared worlds
const ORB_PRESETS = [
  { color: "#e8b8d0", glowColor: "#fce0f0", emissive: "#a05080", orbitRadius: 2.4, orbitSpeed: 0.25, size: 0.32 },
  { color: "#b8e0c0", glowColor: "#d8f4e0", emissive: "#408060", orbitRadius: 2.8, orbitSpeed: 0.20, size: 0.28 },
  { color: "#e0d0a0", glowColor: "#f4ecc8", emissive: "#806830", orbitRadius: 3.2, orbitSpeed: 0.18, size: 0.26 },
  { color: "#c0b8e8", glowColor: "#e0d8f8", emissive: "#504080", orbitRadius: 2.6, orbitSpeed: 0.22, size: 0.30 },
];

export default function WorldSelector({ onSelect, onSignOut, worlds = [] }) {
  const mountRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [ready, setReady] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const labelRefsMap = useRef({});
  const dragRef = useRef({ dragging: false, moved: false, prevX: 0, prevY: 0 });
  const camAngleRef = useRef({ theta: 0.3, phi: 1.2, radius: 5.8 });

  // Build orbiting worlds from props (for now, just "Our World" if user has one)
  const WORLDS = worlds.map((w, i) => ({
    id: w.id || "our",
    label: w.label || "Our World",
    sub: w.sub || "Shared World",
    ...ORB_PRESETS[i % ORB_PRESETS.length],
    ...(w.color ? { color: w.color } : {}),
  }));

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
    const rim = new THREE.PointLight("#f0e0f0", 0.8, 18);
    rim.position.set(-3, -1, 2);
    scene.add(rim);
    const fill = new THREE.PointLight("#e0d8f8", 0.5, 14);
    fill.position.set(0, 2, -3);
    scene.add(fill);
    const back = new THREE.PointLight("#d0c0e0", 0.4, 12);
    back.position.set(0, -2, -3);
    scene.add(back);

    // Stars
    const sP = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const r = 15 + Math.random() * 25, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      sP[i*3] = r*Math.sin(ph)*Math.cos(th); sP[i*3+1] = r*Math.sin(ph)*Math.sin(th); sP[i*3+2] = r*Math.cos(ph);
    }
    const sG = new THREE.BufferGeometry(); sG.setAttribute("position", new THREE.BufferAttribute(sP, 3));
    scene.add(new THREE.Points(sG, new THREE.PointsMaterial({ color: "#f0e8d8", size: 0.04, transparent: true, opacity: 0.5 })));

    // Center orb — MY WORLD — radiant glowing sphere
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

    // Orbiting worlds
    const orbs = WORLDS.map((w, idx) => {
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
      return { mesh: orb, world: w, angleOffset: (idx / Math.max(WORLDS.length, 1)) * Math.PI * 2 };
    });

    // Orbit ring (only if there are orbiting worlds)
    if (WORLDS.length > 0) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(2.36, 2.42, 80),
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
        const sx = (v.x * 0.5 + 0.5) * W;
        const sy = (-v.y * 0.5 + 0.5) * H;
        el.style.left = sx + "px";
        el.style.top = sy + "px";
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
  }, [WORLDS.length]);

  const handleClick = useCallback((e) => {
    if (dragRef.current.moved) return;
    const rect = mountRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    for (const [id, el] of Object.entries(labelRefsMap.current)) {
      if (!el) continue;
      const lx = parseFloat(el.style.left), ly = parseFloat(el.style.top);
      if (isNaN(lx)) continue;
      const dist = Math.sqrt((cx - lx) ** 2 + (cy - ly) ** 2);
      if (dist < 75 && parseFloat(el.style.opacity) > 0.1) { onSelect(id); return; }
    }
  }, [onSelect]);

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
    for (const [id, el] of Object.entries(labelRefsMap.current)) {
      if (el) el.dataset.hov = (id === found) ? "true" : "false";
    }
  }, []);

  const F = "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif";
  const makeLabelRef = useCallback((id) => (el) => { labelRefsMap.current[id] = el; }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0c0a12", fontFamily: F, cursor: hovered ? "pointer" : "grab", overflow: "hidden" }}
      onClick={handleClick} onMouseMove={handleMove}>

      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {/* Title */}
      <div style={{ position: "absolute", top: "4%", left: 0, right: 0, textAlign: "center", opacity: ready ? 1 : 0, transition: "opacity 1.2s", pointerEvents: "none" }}>
        <div style={{ fontSize: 13, letterSpacing: "4px", color: "#d0c8e0", textTransform: "uppercase", fontWeight: 500, textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>My Cosmos</div>
      </div>

      {/* Center label — My World */}
      <div ref={makeLabelRef("my")} data-hov="false" style={{
        position: "absolute", left: 0, top: 0, transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none", transition: "opacity .15s", opacity: 0,
      }}>
        <div style={{ fontSize: hovered === "my" ? 26 : 22, fontWeight: 600, color: "#e0eaff", letterSpacing: "1.5px", textShadow: "0 0 30px rgba(120,160,240,0.6), 0 2px 10px rgba(0,0,0,0.6)", transition: "font-size .2s" }}>My World</div>
        <div style={{ fontSize: 12, color: "#b8c8e0", marginTop: 3, letterSpacing: "1.2px", fontWeight: 400, textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>Travel Diary</div>
      </div>

      {/* Orbiting world labels */}
      {WORLDS.map(w => (
        <div key={w.id} ref={makeLabelRef(w.id)} data-hov="false" style={{
          position: "absolute", left: 0, top: 0, transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none", transition: "opacity .15s", opacity: 0,
        }}>
          <div style={{ fontSize: hovered === w.id ? 22 : 17, fontWeight: 600, color: "#f0d8e8", letterSpacing: "0.8px", textShadow: `0 0 24px ${w.color}90, 0 2px 10px rgba(0,0,0,0.6)`, transition: "font-size .2s" }}>{w.label}</div>
          <div style={{ fontSize: 11, color: "#e0c8d8", marginTop: 2, letterSpacing: "0.8px", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>{w.sub}</div>
        </div>
      ))}

      {/* Bottom controls */}
      <div style={{ position: "absolute", bottom: "5%", left: 0, right: 0, textAlign: "center", opacity: ready ? 1 : 0, transition: "opacity 1.5s" }}>
        <button onClick={(e) => { e.stopPropagation(); setShowAddModal(true); }}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "8px 22px", color: "#908898", fontSize: 11, fontFamily: F, letterSpacing: "1px", cursor: "pointer", transition: "all .3s" }}
          onMouseEnter={e => { e.target.style.borderColor = "rgba(255,255,255,0.3)"; e.target.style.color = "#c0b8c8"; }}
          onMouseLeave={e => { e.target.style.borderColor = "rgba(255,255,255,0.12)"; e.target.style.color = "#908898"; }}>
          + Add a World
        </button>
        <div style={{ fontSize: 10, color: "#807888", marginTop: 8, letterSpacing: "0.8px" }}>drag to orbit · scroll to zoom</div>
      </div>

      {/* Sign out button — top right */}
      <button onClick={(e) => { e.stopPropagation(); if (onSignOut) onSignOut(); }}
        style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "5px 12px", color: "#807888", fontSize: 10, fontFamily: F, letterSpacing: "0.5px", cursor: "pointer", opacity: ready ? 1 : 0, transition: "all .5s", zIndex: 10 }}
        onMouseEnter={e => { e.target.style.color = "#c0b8c8"; e.target.style.borderColor = "rgba(255,255,255,0.2)"; }}
        onMouseLeave={e => { e.target.style.color = "#807888"; e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}>
        Sign Out
      </button>

      {/* Add a World modal */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
          onClick={(e) => { e.stopPropagation(); setShowAddModal(false); }}>
          <div style={{ background: "#1a1424", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "32px 28px", width: 340, maxWidth: "90vw", textAlign: "center" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#e8e0d0", marginBottom: 8 }}>Add a World</div>
            <div style={{ fontSize: 13, color: "#a098a8", lineHeight: 1.6, marginBottom: 24 }}>
              Shared worlds are coming soon! You'll be able to create worlds with partners, friends, and family — and invite them to join your cosmos.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px", textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#c0b8c8" }}>Create a Shared World</div>
                <div style={{ fontSize: 11, color: "#807888", marginTop: 4 }}>Start a travel diary with someone special</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px", textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#c0b8c8" }}>Join Someone's World</div>
                <div style={{ fontSize: 11, color: "#807888", marginTop: 4 }}>Accept an invite to explore together</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#686070", fontStyle: "italic", marginBottom: 16 }}>Stay tuned — launching soon</div>
            <button onClick={() => setShowAddModal(false)}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 24px", color: "#a098a8", fontSize: 12, fontFamily: F, cursor: "pointer" }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
