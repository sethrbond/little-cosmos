import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/* WorldSelector.jsx — "My Constellation" world chooser
   My World is the central orb. Other worlds orbit it.
   Camera can be dragged/orbited to view from any angle.
   Future-ready: "Add World" button for shared worlds. */

const WORLDS = [
  {
    id: "our",
    label: "Our World",
    sub: "Seth & Rosie",
    color: "#d4a0b9",
    glowColor: "#e8c0d8",
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
  color: "#b8a080",
  glowColor: "#d4c4a8",
  emissive: "#3a2818",
};

export default function WorldSelector({ onSelect }) {
  const mountRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [ready, setReady] = useState(false);
  const orbPositionsRef = useRef([]);
  const centerPosRef = useRef({ x: 0, y: 0, z: 0 });
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

    // Lights
    scene.add(new THREE.AmbientLight("#e8e0d8", 0.5));
    const sun = new THREE.DirectionalLight("#fff4e8", 0.9);
    sun.position.set(3, 3, 4);
    scene.add(sun);
    const rim = new THREE.PointLight("#d8c8b0", 0.4, 15);
    rim.position.set(-3, -1, 2);
    scene.add(rim);

    // Stars — spread in a sphere
    const starCount = 500;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 15 + Math.random() * 25;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      starPos[i * 3 + 2] = r * Math.cos(ph);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: "#f0e8d8", size: 0.04, transparent: true, opacity: 0.5,
    })));

    // Center orb — MY WORLD
    const centerOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 48, 48),
      new THREE.MeshPhongMaterial({
        color: CENTER.color, emissive: CENTER.emissive,
        emissiveIntensity: 0.45, shininess: 12,
      })
    );
    scene.add(centerOrb);

    // Center glow
    [0.76, 0.84, 0.95, 1.1].forEach((r, i) => {
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(r, 24, 24),
        new THREE.MeshBasicMaterial({
          color: CENTER.glowColor, transparent: true,
          opacity: 0.14 - i * 0.03, side: THREE.BackSide,
        })
      ));
    });

    // Orbiting worlds
    const orbs = WORLDS.map((w, idx) => {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(w.size, 32, 32),
        new THREE.MeshPhongMaterial({
          color: w.color, emissive: w.emissive,
          emissiveIntensity: 0.5, shininess: 18,
        })
      );
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(w.size + 0.08, 24, 24),
        new THREE.MeshBasicMaterial({
          color: w.glowColor, transparent: true, opacity: 0.18, side: THREE.BackSide,
        })
      );
      orb.add(glow);
      scene.add(orb);
      return { mesh: orb, world: w, angleOffset: (idx / Math.max(WORLDS.length, 1)) * Math.PI * 2 };
    });

    // Orbit ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.36, 2.42, 80),
      new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.04, side: THREE.DoubleSide })
    );
    ring.rotation.x = Math.PI * 0.5;
    scene.add(ring);

    let t = 0, frameId;

    const updateCamera = () => {
      const a = camAngleRef.current;
      cam.position.set(
        a.radius * Math.sin(a.phi) * Math.cos(a.theta),
        a.radius * Math.cos(a.phi),
        a.radius * Math.sin(a.phi) * Math.sin(a.theta)
      );
      cam.lookAt(0, 0, 0);
    };
    updateCamera();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      t += 0.006;

      centerOrb.rotation.y += 0.002;
      centerOrb.scale.setScalar(1 + Math.sin(t * 1.2) * 0.03);

      const positions = [];
      orbs.forEach((o, i) => {
        const angle = o.angleOffset + t * o.world.orbitSpeed;
        o.mesh.position.set(
          Math.cos(angle) * o.world.orbitRadius,
          Math.sin(angle * 0.7) * 0.15,
          Math.sin(angle) * o.world.orbitRadius
        );
        o.mesh.rotation.y += 0.008;
        o.mesh.scale.setScalar(1 + Math.sin(t * 2 + i * 1.5) * 0.03);

        const v = o.mesh.position.clone().project(cam);
        positions.push({ id: o.world.id, x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, z: v.z });
      });

      const cv = centerOrb.position.clone().project(cam);
      centerPosRef.current = { x: (cv.x * 0.5 + 0.5) * W, y: (-cv.y * 0.5 + 0.5) * H, z: cv.z };
      orbPositionsRef.current = positions;

      rend.render(scene, cam);
    };
    animate();

    // Drag orbit controls
    const onDown = (e) => { dragRef.current = { dragging: true, moved: false, prevX: e.clientX, prevY: e.clientY }; };
    const onMoveEvt = (e) => {
      if (!dragRef.current.dragging) return;
      const dx = e.clientX - dragRef.current.prevX;
      const dy = e.clientY - dragRef.current.prevY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragRef.current.moved = true;
      camAngleRef.current.theta -= dx * 0.005;
      camAngleRef.current.phi = Math.max(0.3, Math.min(2.8, camAngleRef.current.phi + dy * 0.005));
      dragRef.current.prevX = e.clientX;
      dragRef.current.prevY = e.clientY;
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

    const onResize = () => {
      W = mount.clientWidth; H = mount.clientHeight;
      cam.aspect = W / H; cam.updateProjectionMatrix(); rend.setSize(W, H);
    };
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

  const handleClick = (e) => {
    if (dragRef.current.moved) return; // was a drag, not a click
    const mount = mountRef.current;
    if (!mount) return;
    const rect = mount.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;

    const cp = centerPosRef.current;
    if (cp.z < 1 && Math.sqrt((cx - cp.x) ** 2 + (cy - cp.y) ** 2) < 70) { onSelect("my"); return; }

    for (const pos of orbPositionsRef.current) {
      if (pos.z < 1 && Math.sqrt((cx - pos.x) ** 2 + (cy - pos.y) ** 2) < 60) { onSelect(pos.id); return; }
    }
  };

  const handleMove = (e) => {
    if (dragRef.current.dragging) { setHovered(null); return; }
    const mount = mountRef.current;
    if (!mount) return;
    const rect = mount.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    let found = null;

    const cp = centerPosRef.current;
    if (cp.z < 1 && Math.sqrt((cx - cp.x) ** 2 + (cy - cp.y) ** 2) < 70) found = "my";
    if (!found) {
      for (const pos of orbPositionsRef.current) {
        if (pos.z < 1 && Math.sqrt((cx - pos.x) ** 2 + (cy - pos.y) ** 2) < 60) { found = pos.id; break; }
      }
    }
    setHovered(found);
  };

  const F = "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif";

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0c0a12", fontFamily: F, cursor: hovered ? "pointer" : "grab", overflow: "hidden" }}
      onClick={handleClick} onMouseMove={handleMove}>

      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {/* Title */}
      <div style={{ position: "absolute", top: "4%", left: 0, right: 0, textAlign: "center", opacity: ready ? 1 : 0, transition: "opacity 1.2s", pointerEvents: "none" }}>
        <div style={{ fontSize: 11, letterSpacing: "4px", color: "#7a7088", textTransform: "uppercase" }}>My Constellation</div>
      </div>

      {/* Center label — My World */}
      {ready && centerPosRef.current.z < 1 && (() => {
        const p = centerPosRef.current;
        const isHov = hovered === "my";
        return (
          <div style={{ position: "absolute", left: p.x, top: p.y + 60, transform: "translate(-50%, 0)", textAlign: "center", pointerEvents: "none", transition: "opacity .3s", opacity: isHov ? 1 : 0.7 }}>
            <div style={{ fontSize: isHov ? 22 : 18, fontWeight: 500, color: CENTER.glowColor, letterSpacing: "1px", textShadow: `0 0 24px ${CENTER.color}50`, transition: "font-size .2s" }}>{CENTER.label}</div>
            <div style={{ fontSize: 10, color: "#908878", marginTop: 2, letterSpacing: "1.2px" }}>{CENTER.sub}</div>
          </div>
        );
      })()}

      {/* Orbiting world labels */}
      {ready && orbPositionsRef.current.map(pos => {
        const w = WORLDS.find(wd => wd.id === pos.id);
        if (!w || pos.z > 1) return null;
        const isHov = hovered === pos.id;
        return (
          <div key={pos.id} style={{ position: "absolute", left: pos.x, top: pos.y - 50, transform: "translate(-50%, -100%)", textAlign: "center", pointerEvents: "none", transition: "opacity .3s", opacity: isHov ? 1 : 0.65 }}>
            <div style={{ fontSize: isHov ? 18 : 15, fontWeight: 500, color: w.glowColor, letterSpacing: "0.5px", textShadow: `0 0 18px ${w.color}50`, transition: "font-size .2s" }}>{w.label}</div>
            <div style={{ fontSize: 10, color: "#a098a8", marginTop: 1, letterSpacing: "0.8px" }}>{w.sub}</div>
          </div>
        );
      })}

      {/* Add World button */}
      <div style={{ position: "absolute", bottom: "5%", left: 0, right: 0, textAlign: "center", opacity: ready ? 1 : 0, transition: "opacity 1.5s" }}>
        <button
          onClick={(e) => { e.stopPropagation(); }}
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "8px 20px", color: "#706878", fontSize: 11, fontFamily: F, letterSpacing: "1px", cursor: "pointer", transition: "all .3s" }}
          onMouseEnter={e => { e.target.style.borderColor = "rgba(255,255,255,0.25)"; e.target.style.color = "#a098b0"; }}
          onMouseLeave={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.color = "#706878"; }}
        >
          + Add a World
        </button>
        <div style={{ fontSize: 10, color: "#504858", marginTop: 8, letterSpacing: "0.8px" }}>drag to orbit · scroll to zoom</div>
      </div>
    </div>
  );
}
