import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

/* WorldSelector.jsx — "My Constellation" world chooser
   My World is the central orb. Other worlds orbit it.
   Camera can be dragged/orbited to view from any angle.
   Labels track their orbs in real-time via direct DOM updates. */

const WORLDS = [
  {
    id: "our",
    label: "Our World",
    sub: "Seth & Rosie",
    color: "#d4a0b9",
    glowColor: "#f0c8e0",
    emissive: "#5a2060",
    orbitRadius: 2.4,
    orbitSpeed: 0.25,
    size: 0.32,
  },
];

const CENTER = {
  id: "my",
  label: "My World",
  sub: "Solo Adventures",
  color: "#7090c0",
  glowColor: "#a0b8e0",
  emissive: "#182840",
};

export default function WorldSelector({ onSelect }) {
  const mountRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [ready, setReady] = useState(false);
  const labelRefsMap = useRef({});
  const dragRef = useRef({ dragging: false, moved: false, prevX: 0, prevY: 0 });
  const camAngleRef = useRef({ theta: 0.3, phi: 1.2, radius: 5.8 });

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

    scene.add(new THREE.AmbientLight("#e8e0d8", 0.5));
    const sun = new THREE.DirectionalLight("#fff4e8", 0.9);
    sun.position.set(3, 3, 4); scene.add(sun);
    scene.add(Object.assign(new THREE.PointLight("#d8c8b0", 0.4, 15), { position: new THREE.Vector3(-3, -1, 2) }));

    // Stars
    const sP = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const r = 15 + Math.random() * 25, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      sP[i*3] = r*Math.sin(ph)*Math.cos(th); sP[i*3+1] = r*Math.sin(ph)*Math.sin(th); sP[i*3+2] = r*Math.cos(ph);
    }
    const sG = new THREE.BufferGeometry(); sG.setAttribute("position", new THREE.BufferAttribute(sP, 3));
    scene.add(new THREE.Points(sG, new THREE.PointsMaterial({ color: "#f0e8d8", size: 0.04, transparent: true, opacity: 0.5 })));

    // Center orb — MY WORLD (blue-ish)
    const centerOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 48, 48),
      new THREE.MeshPhongMaterial({ color: CENTER.color, emissive: CENTER.emissive, emissiveIntensity: 0.5, shininess: 14 })
    );
    scene.add(centerOrb);
    [0.76, 0.84, 0.95, 1.1].forEach((r, i) => {
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24),
        new THREE.MeshBasicMaterial({ color: CENTER.glowColor, transparent: true, opacity: 0.16 - i * 0.035, side: THREE.BackSide })));
    });

    // Orbiting worlds
    const orbs = WORLDS.map((w, idx) => {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(w.size, 32, 32),
        new THREE.MeshPhongMaterial({ color: w.color, emissive: w.emissive, emissiveIntensity: 0.5, shininess: 18 }));
      orb.add(new THREE.Mesh(new THREE.SphereGeometry(w.size + 0.08, 24, 24),
        new THREE.MeshBasicMaterial({ color: w.glowColor, transparent: true, opacity: 0.2, side: THREE.BackSide })));
      scene.add(orb);
      return { mesh: orb, world: w, angleOffset: (idx / Math.max(WORLDS.length, 1)) * Math.PI * 2 };
    });

    // Orbit ring
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.36, 2.42, 80),
      new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.04, side: THREE.DoubleSide }));
    ring.rotation.x = Math.PI * 0.5; scene.add(ring);

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

      // Update label positions directly in DOM (no React re-render needed)
      const allItems = [{ id: "my", mesh: centerOrb, below: true }, ...orbs.map(o => ({ id: o.world.id, mesh: o.mesh, below: false }))];
      allItems.forEach(({ id, mesh, below }) => {
        const el = labelRefsMap.current[id];
        if (!el) return;
        const v = mesh.position.clone().project(cam);
        const sx = (v.x * 0.5 + 0.5) * W;
        const sy = (-v.y * 0.5 + 0.5) * H;
        el.style.left = sx + "px";
        el.style.top = (below ? sy + 55 : sy - 50) + "px";
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
  }, []);

  const handleClick = useCallback((e) => {
    if (dragRef.current.moved) return;
    // Use label refs to detect click proximity
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
    // Update data-hov attribute for animation loop
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
        <div style={{ fontSize: 13, letterSpacing: "4px", color: "#b0a8c0", textTransform: "uppercase", fontWeight: 500 }}>My Constellation</div>
      </div>

      {/* Center label — My World (positioned by animation loop) */}
      <div ref={makeLabelRef("my")} data-hov="false" style={{
        position: "absolute", left: 0, top: 0, transform: "translate(-50%, 0)", textAlign: "center", pointerEvents: "none", transition: "opacity .15s", opacity: 0,
      }}>
        <div style={{ fontSize: hovered === "my" ? 24 : 20, fontWeight: 600, color: "#c0d0f0", letterSpacing: "1.5px", textShadow: "0 0 28px rgba(112,144,192,0.5), 0 2px 8px rgba(0,0,0,0.4)", transition: "font-size .2s" }}>My World</div>
        <div style={{ fontSize: 11, color: "#90a0b8", marginTop: 3, letterSpacing: "1.2px", fontWeight: 400 }}>Solo Adventures</div>
      </div>

      {/* Orbiting world labels (positioned by animation loop) */}
      {WORLDS.map(w => (
        <div key={w.id} ref={makeLabelRef(w.id)} data-hov="false" style={{
          position: "absolute", left: 0, top: 0, transform: "translate(-50%, -100%)", textAlign: "center", pointerEvents: "none", transition: "opacity .15s", opacity: 0,
        }}>
          <div style={{ fontSize: hovered === w.id ? 20 : 16, fontWeight: 600, color: w.glowColor, letterSpacing: "0.8px", textShadow: `0 0 22px ${w.color}70, 0 2px 8px rgba(0,0,0,0.4)`, transition: "font-size .2s" }}>{w.label}</div>
          <div style={{ fontSize: 10, color: "#c0b0c8", marginTop: 2, letterSpacing: "0.8px" }}>{w.sub}</div>
        </div>
      ))}

      {/* Add World button */}
      <div style={{ position: "absolute", bottom: "5%", left: 0, right: 0, textAlign: "center", opacity: ready ? 1 : 0, transition: "opacity 1.5s" }}>
        <button onClick={(e) => { e.stopPropagation(); }}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "8px 22px", color: "#908898", fontSize: 11, fontFamily: F, letterSpacing: "1px", cursor: "pointer", transition: "all .3s" }}
          onMouseEnter={e => { e.target.style.borderColor = "rgba(255,255,255,0.3)"; e.target.style.color = "#c0b8c8"; }}
          onMouseLeave={e => { e.target.style.borderColor = "rgba(255,255,255,0.12)"; e.target.style.color = "#908898"; }}>
          + Add a World
        </button>
        <div style={{ fontSize: 10, color: "#686070", marginTop: 8, letterSpacing: "0.8px" }}>drag to orbit · scroll to zoom</div>
      </div>
    </div>
  );
}
