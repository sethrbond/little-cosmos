import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/* WorldSelector.jsx — Globe-orbit world chooser
   A mini spinning globe with two orbiting "world orbs"
   Future-ready: can add more orbs for other peoples' worlds */

const WORLDS = [
  {
    id: "our",
    label: "Our World",
    sub: "Seth & Rosie Posie",
    color: "#d4a0b9",
    glowColor: "#e8c0d8",
    emissive: "#5a2060",
    angle: 0,
  },
  {
    id: "my",
    label: "My World",
    sub: "Solo Travel Diary",
    color: "#8aaa6e",
    glowColor: "#a8c490",
    emissive: "#1a3010",
    angle: Math.PI,
  },
];

export default function WorldSelector({ onSelect }) {
  const mountRef = useRef(null);
  const cleanupRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [ready, setReady] = useState(false);
  const orbPositionsRef = useRef([]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const W = mount.clientWidth, H = mount.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0a0a14");
    scene.fog = new THREE.FogExp2("#0a0a14", 0.015);

    // Camera
    const cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    cam.position.set(0, 0.3, 5.5);

    // Renderer
    const rend = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rend.setSize(W, H);
    rend.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(rend.domElement);

    // Lights
    scene.add(new THREE.AmbientLight("#f8f0e8", 0.6));
    const sun = new THREE.DirectionalLight("#fff8f0", 0.8);
    sun.position.set(3, 2, 4);
    scene.add(sun);

    // Central globe — muted, neutral
    const globeGeo = new THREE.SphereGeometry(1, 48, 48);
    const globeMat = new THREE.MeshPhongMaterial({
      color: "#b8b0c8",
      emissive: "#1a1428",
      emissiveIntensity: 0.4,
      shininess: 15,
      transparent: true,
      opacity: 0.85,
    });
    const globe = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globe);

    // Glow layers on central globe
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Mesh(
        new THREE.SphereGeometry(1.02 + i * 0.04, 32, 32),
        new THREE.MeshBasicMaterial({
          color: "#c0b8d0",
          transparent: true,
          opacity: 0.12 - i * 0.025,
          side: THREE.BackSide,
        })
      );
      scene.add(g);
    }

    // Stars
    const starCount = 400;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 40;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      starPos[i * 3 + 2] = -10 - Math.random() * 30;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: "#ffffff", size: 0.04, transparent: true, opacity: 0.6,
    }));
    scene.add(stars);

    // Orbiting world orbs
    const orbs = WORLDS.map((w) => {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 32, 32),
        new THREE.MeshPhongMaterial({
          color: w.color,
          emissive: w.emissive,
          emissiveIntensity: 0.5,
          shininess: 20,
        })
      );
      // Glow
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 24, 24),
        new THREE.MeshBasicMaterial({
          color: w.glowColor,
          transparent: true,
          opacity: 0.2,
          side: THREE.BackSide,
        })
      );
      orb.add(glow);
      orb.userData = { worldId: w.id };
      scene.add(orb);
      return { mesh: orb, world: w };
    });

    // Orbit trail rings (decorative)
    const orbitRing = new THREE.Mesh(
      new THREE.RingGeometry(2.18, 2.22, 64),
      new THREE.MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
      })
    );
    orbitRing.rotation.x = Math.PI * 0.42;
    scene.add(orbitRing);

    // Raycaster
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Animation
    let t = 0;
    let frameId;
    const orbRadius = 2.2;
    const orbSpeed = 0.3;
    const orbTilt = 0.15;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      t += 0.008;

      // Spin central globe
      globe.rotation.y += 0.003;

      // Orbit world orbs
      const positions = [];
      orbs.forEach((o, i) => {
        const angle = o.world.angle + t * orbSpeed;
        const x = Math.cos(angle) * orbRadius;
        const z = Math.sin(angle) * orbRadius;
        const y = Math.sin(angle) * orbTilt;
        o.mesh.position.set(x, y, z);
        o.mesh.rotation.y += 0.01;

        // Gentle breathe
        const scale = 1.0 + Math.sin(t * 2 + i) * 0.04;
        o.mesh.scale.setScalar(scale);

        // Project to screen for label positioning
        const v = o.mesh.position.clone().project(cam);
        positions.push({
          id: o.world.id,
          x: (v.x * 0.5 + 0.5) * W,
          y: (-v.y * 0.5 + 0.5) * H,
          z: v.z,
        });
      });
      orbPositionsRef.current = positions;

      rend.render(scene, cam);
    };
    animate();

    // Resize
    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      rend.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    setTimeout(() => setReady(true), 300);

    cleanupRef.current = () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      rend.dispose();
      if (mount.contains(rend.domElement)) mount.removeChild(rend.domElement);
    };

    return () => { if (cleanupRef.current) cleanupRef.current(); };
  }, []);

  const handleClick = (e) => {
    const mount = mountRef.current;
    if (!mount) return;
    const rect = mount.getBoundingClientRect();
    // Check if click is near an orb label
    const cx = e.clientX, cy = e.clientY;
    for (const pos of orbPositionsRef.current) {
      const dx = cx - (rect.left + pos.x);
      const dy = cy - (rect.top + pos.y);
      if (Math.sqrt(dx * dx + dy * dy) < 80 && pos.z < 1) {
        onSelect(pos.id);
        return;
      }
    }
  };

  const handleMove = (e) => {
    const mount = mountRef.current;
    if (!mount) return;
    const rect = mount.getBoundingClientRect();
    const cx = e.clientX, cy = e.clientY;
    let found = null;
    for (const pos of orbPositionsRef.current) {
      const dx = cx - (rect.left + pos.x);
      const dy = cy - (rect.top + pos.y);
      if (Math.sqrt(dx * dx + dy * dy) < 80 && pos.z < 1) {
        found = pos.id;
        break;
      }
    }
    setHovered(found);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0a0a14",
      fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif",
      cursor: hovered ? "pointer" : "default",
      overflow: "hidden",
    }}
      onClick={handleClick}
      onMouseMove={handleMove}
    >
      {/* Three.js canvas */}
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {/* Floating labels for each orb */}
      {ready && orbPositionsRef.current.map((pos) => {
        const w = WORLDS.find(w => w.id === pos.id);
        if (!w || pos.z > 1) return null;
        const isHov = hovered === pos.id;
        return (
          <div key={pos.id} style={{
            position: "absolute",
            left: pos.x, top: pos.y - 60,
            transform: "translate(-50%, -100%)",
            textAlign: "center",
            pointerEvents: "none",
            transition: "opacity 0.3s, transform 0.3s",
            opacity: ready ? (isHov ? 1 : 0.75) : 0,
          }}>
            <div style={{
              fontSize: isHov ? 20 : 17,
              fontWeight: 600,
              color: w.glowColor,
              letterSpacing: "0.5px",
              textShadow: `0 0 20px ${w.color}60`,
              transition: "font-size 0.2s",
            }}>
              {w.label}
            </div>
            <div style={{
              fontSize: 11,
              color: "#a0a0b0",
              marginTop: 2,
              letterSpacing: "0.8px",
            }}>
              {w.sub}
            </div>
          </div>
        );
      })}

      {/* Title */}
      <div style={{
        position: "absolute", top: "6%", left: 0, right: 0,
        textAlign: "center",
        opacity: ready ? 1 : 0,
        transition: "opacity 1s",
      }}>
        <div style={{
          fontSize: 14, letterSpacing: "3px", color: "#8080a0",
          textTransform: "uppercase",
        }}>
          Choose Your World
        </div>
      </div>

      {/* Bottom text */}
      <div style={{
        position: "absolute", bottom: "6%", left: 0, right: 0,
        textAlign: "center",
        opacity: ready ? 0.45 : 0,
        transition: "opacity 1.5s",
      }}>
        <div style={{ fontSize: 12, color: "#8080a0", letterSpacing: "1px" }}>
          you can switch anytime
        </div>
      </div>
    </div>
  );
}
