import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ll2v, lerp, clamp } from "./geodata.js";

// Pre-allocated vectors for animation loop (avoid per-frame GC)
const _cometTarget = new THREE.Vector3();
const _cometMid = new THREE.Vector3();
const _cometPos = new THREE.Vector3();
const _burstTmp = new THREE.Vector3();
const _meteorV1 = new THREE.Vector3();
const _meteorV2 = new THREE.Vector3();

// Symbol texture cache (shared across hook instances)
const _symbolCache = {};

/**
 * useGlobeScene — Three.js globe scene setup, animation loop, and cleanup.
 *
 * @param {React.RefObject} mountRef - ref to the DOM element to mount the renderer in
 * @param {object} deps - all external refs, state values, and setters needed by the scene
 * @returns {{ sceneReady, rendRef, scnRef, camRef, globeRef, heartRef,
 *             glowLayersRef, particlesRef, particles2Ref, starsRef, shootingStarsRef,
 *             auroraRef, nightShadowRef }}
 */
export function useGlobeScene(mountRef, deps) {
  const {
    // Constants / data
    loading, SC, RAD, P, LAND, COAST_DATA,
    isPartnerWorld, isSharedWorld,
    // State setters
    setReady, setIntroComplete,
    // Refs used in animation loop (owned by OurWorld)
    frameRef, spinSpd, tSpinSpd, dragR, selectedRef,
    rot, tRot, zmR, tZm,
    easterEggRef, searchMatchIdsRef, mkRef, routesRef,
    mouseRef, atmosphereRef, pulseRingsRef, cometRef,
    // Refs used in cleanup (owned by OurWorld)
    animRef, playRef, photoTimerRef, stepDayTimer,
    surpriseTimers, dismissTimers,
  } = deps;

  // Scene object refs (owned by this hook, returned to caller)
  const rendRef = useRef(null);
  const scnRef = useRef(null);
  const camRef = useRef(null);
  const globeRef = useRef(null);
  const heartRef = useRef(null);
  const glowLayersRef = useRef([]);
  const particlesRef = useRef(null);
  const particles2Ref = useRef(null);
  const starsRef = useRef(null);
  const shootingStarsRef = useRef([]);
  const auroraRef = useRef(null);
  const nightShadowRef = useRef(null);

  const [sceneReady, setSceneReady] = useState(false);

  // ---- THREE SETUP ----
  useEffect(() => {
    if (!mountRef.current || loading) return;
    const el = mountRef.current;
    const w = el.clientWidth, h = el.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SC.bg);
    scene.fog = new THREE.FogExp2(SC.fog, 0.008);
    scnRef.current = scene;

    const cam = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    cam.position.z = 8;
    camRef.current = cam;

    const rend = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    rend.setSize(w, h); rend.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(rend.domElement);
    rendRef.current = rend;

    scene.add(new THREE.AmbientLight(SC.ambientColor, 1.3));
    const sun = new THREE.DirectionalLight(SC.sunColor, 1.3);
    sun.position.set(4, 3, 5); scene.add(sun);
    const fill = new THREE.DirectionalLight(SC.fillColor, 0.7);
    fill.position.set(-4, -2, -4); scene.add(fill);
    const rim = new THREE.PointLight(SC.rimColor, 0.9, 14);
    rim.position.set(0, 4, 2); scene.add(rim);
    const bottomGlow = new THREE.PointLight(SC.bottomColor, 0.5, 10);
    bottomGlow.position.set(0, -3, 1); scene.add(bottomGlow);
    // Extra radiance from behind — makes globe feel like it's glowing through the screen
    const backGlow = new THREE.PointLight(SC.rimColor, 0.4, 12);
    backGlow.position.set(0, 0, -4); scene.add(backGlow);

    const globe = new THREE.Group();
    scene.add(globe);
    globeRef.current = globe;

    // Main sphere — themed per world mode
    globe.add(new THREE.Mesh(
      new THREE.SphereGeometry(RAD, 96, 96),
      new THREE.MeshLambertMaterial({ color: SC.sphereColor, emissive: SC.sphereEmissive, emissiveIntensity: 0.35, transparent: false })
    ));
    // Inner bloom removed — was rendering as visible yellow blob on light-themed worlds

    // Night shadow — smooth gradient day/night terminator using custom shader
    const nightGeo = new THREE.SphereGeometry(RAD * 1.005, 64, 64);
    const nightMat = new THREE.ShaderMaterial({
      transparent: true, depthTest: true, side: THREE.FrontSide,
      uniforms: {
        sunDir: { value: new THREE.Vector3(1, 0, 0) },
        nightColor: { value: new THREE.Color("#080618") },
        strength: { value: 0.28 },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normal); // object-space normal (sunDir is transformed to match)
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform vec3 sunDir;
        uniform vec3 nightColor;
        uniform float strength;
        varying vec3 vNormal;
        void main() {
          float facing = dot(vNormal, sunDir);
          // Smooth gradient: fully lit → twilight → dark
          float shadow = smoothstep(0.2, -0.35, facing);
          gl_FragColor = vec4(nightColor, shadow * strength);
        }
      `,
    });
    const nightMesh = new THREE.Mesh(nightGeo, nightMat);
    nightMesh.renderOrder = 1;
    globe.add(nightMesh);
    nightShadowRef.current = { mesh: nightMesh, material: nightMat };

    // Glow layers — 12-layer deep halo for ethereal radiance
    const glowRadii = [1.01, 1.025, 1.045, 1.07, 1.10, 1.14, 1.20, 1.28, 1.40, 1.55, 1.75, 2.0];
    const glowOpacities = [0.12, 0.10, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0.025, 0.015, 0.008];
    const glows = glowRadii.map((r, i) => ({ r, color: SC.glowColors[i] || SC.glowColors[0], op: glowOpacities[i] })).map(({ r, color, op }) => {
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.BackSide });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(RAD * r, 48, 48), m);
      globe.add(mesh);
      return mesh;
    });
    glowLayersRef.current = glows;

    // Land dots — InstancedMesh for performance (~1500 dots → few draw calls)
    {
      const landGeo = new THREE.CircleGeometry(1, 5); // unit size, scaled per instance
      const colors = SC.landColors;
      const colorGroups = {};
      LAND.forEach(([lat, lng]) => {
        const c = colors[Math.floor(Math.random() * colors.length)];
        const key = typeof c === 'string' ? c : `#${new THREE.Color(c).getHexString()}`;
        if (!colorGroups[key]) colorGroups[key] = { color: c, items: [] };
        colorGroups[key].items.push({ lat, lng, sz: 0.002 + Math.random() * 0.003 });
      });
      const _dummy = new THREE.Object3D();
      Object.values(colorGroups).forEach(({ color, items }) => {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
        const inst = new THREE.InstancedMesh(landGeo, mat, items.length);
        items.forEach((item, i) => {
          const p = ll2v(item.lat, item.lng, RAD * 1.002);
          _dummy.position.copy(p);
          _dummy.lookAt(p.clone().multiplyScalar(2));
          _dummy.scale.setScalar(item.sz);
          _dummy.updateMatrix();
          inst.setMatrixAt(i, _dummy.matrix);
        });
        inst.instanceMatrix.needsUpdate = true;
        globe.add(inst);
      });
    }

    // Geography lines — Natural Earth 50m coastlines (merged for fewer draw calls)
    const geoGroup = [];
    // Merge all rings into two LineSegments objects (primary + glow)
    const allPrimary = [];
    const allGlow = [];
    COAST_DATA.forEach(ring => {
      for (let i = 0; i < ring.length - 1; i++) {
        allPrimary.push(ll2v(ring[i][0], ring[i][1], RAD * 1.003));
        allPrimary.push(ll2v(ring[i + 1][0], ring[i + 1][1], RAD * 1.003));
        allGlow.push(ll2v(ring[i][0], ring[i][1], RAD * 1.005));
        allGlow.push(ll2v(ring[i + 1][0], ring[i + 1][1], RAD * 1.005));
      }
    });
    {
      const geom = new THREE.BufferGeometry().setFromPoints(allPrimary);
      const mat = new THREE.LineBasicMaterial({ color: SC.coastColor, transparent: true, opacity: 1.0 });
      const lines = new THREE.LineSegments(geom, mat);
      lines.renderOrder = -1;
      globe.add(lines);
      geoGroup.push({ line: lines, mat });
    }
    {
      const geom = new THREE.BufferGeometry().setFromPoints(allGlow);
      const mat = new THREE.LineBasicMaterial({ color: SC.coastColor, transparent: true, opacity: 0.45 });
      const lines = new THREE.LineSegments(geom, mat);
      lines.renderOrder = -2;
      globe.add(lines);
      geoGroup.push({ line: lines, mat });
    }

    // Particles — rose-pink fairy dust floating in space
    const pN = 450;
    const pG = new THREE.BufferGeometry();
    const pP = new Float32Array(pN * 3);
    for (let i = 0; i < pN; i++) { pP[i * 3] = (Math.random() - 0.5) * 16; pP[i * 3 + 1] = (Math.random() - 0.5) * 16; pP[i * 3 + 2] = (Math.random() - 0.5) * 16; }
    pG.setAttribute("position", new THREE.BufferAttribute(pP, 3));
    const pMat = new THREE.PointsMaterial({ color: SC.particleColor, size: 0.010, transparent: true, opacity: 0.32 });
    const particles = new THREE.Points(pG, pMat);
    scene.add(particles);
    particlesRef.current = particles;

    // Second particle layer — lavender stardust
    const p2N = 460;
    const p2G = new THREE.BufferGeometry();
    const p2P = new Float32Array(p2N * 3);
    for (let i = 0; i < p2N; i++) { p2P[i * 3] = (Math.random() - 0.5) * 13; p2P[i * 3 + 1] = (Math.random() - 0.5) * 13; p2P[i * 3 + 2] = (Math.random() - 0.5) * 13; }
    p2G.setAttribute("position", new THREE.BufferAttribute(p2P, 3));
    const p2Mat = new THREE.PointsMaterial({ color: SC.particleColor2, size: 0.007, transparent: true, opacity: 0.20 });
    const particles2 = new THREE.Points(p2G, p2Mat);
    scene.add(particles2);
    particles2Ref.current = particles2;

    // Stars — 900+ twinkling field, no sizeAttenuation so they're visible at distance
    const starN = 920;
    const starG = new THREE.BufferGeometry();
    const starP = new Float32Array(starN * 3);
    const starS = new Float32Array(starN);
    const starPhase = new Float32Array(starN);
    const starSpeed = new Float32Array(starN);
    const starBaseOp = new Float32Array(starN);
    for (let i = 0; i < starN; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 14 + Math.random() * 18; // closer so fog doesn't eat them
      starP[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starP[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starP[i * 3 + 2] = r * Math.cos(phi);
      starS[i] = 1.0 + Math.random() * 2.5; // screen-space pixels since no sizeAttenuation
      starPhase[i] = Math.random() * Math.PI * 2;
      starSpeed[i] = 0.3 + Math.random() * 2.5;
      starBaseOp[i] = 0.15 + Math.random() * 0.55;
    }
    starG.setAttribute("position", new THREE.BufferAttribute(starP, 3));
    starG.setAttribute("size", new THREE.BufferAttribute(starS, 1));
    const starMat = new THREE.PointsMaterial({ color: SC.starTint || "#f0e8ff", size: 1.8, transparent: true, opacity: 0.6, sizeAttenuation: false });
    const stars = new THREE.Points(starG, starMat);
    stars.renderOrder = -10; // render behind everything
    scene.add(stars);
    starsRef.current = { mesh: stars, phases: starPhase, speeds: starSpeed, baseOps: starBaseOp, sizes: starS, geometry: starG };
    // Warm star layer — golden/rose tint, also fixed-size
    const warmStarN = 250;
    const warmG = new THREE.BufferGeometry();
    const warmP = new Float32Array(warmStarN * 3);
    for (let i = 0; i < warmStarN; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 15 + Math.random() * 16;
      warmP[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      warmP[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      warmP[i * 3 + 2] = r * Math.cos(phi);
    }
    warmG.setAttribute("position", new THREE.BufferAttribute(warmP, 3));
    const warmStarMat = new THREE.PointsMaterial({ color: "#ffd8e8", size: 1.2, transparent: true, opacity: 0.35, sizeAttenuation: false });
    const warmStars = new THREE.Points(warmG, warmStarMat);
    warmStars.renderOrder = -10;
    scene.add(warmStars);

    // Shooting stars — pool of meteor streaks that fire periodically
    const meteorPool = [];
    for (let mi = 0; mi < 5; mi++) {
      const mGeo = new THREE.BufferGeometry();
      const mPositions = new Float32Array(6); // 2 points (head + tail)
      mGeo.setAttribute("position", new THREE.BufferAttribute(mPositions, 3));
      const mMat = new THREE.LineBasicMaterial({ color: "#fffaf0", transparent: true, opacity: 0, linewidth: 1 });
      const mLine = new THREE.Line(mGeo, mMat);
      mLine.renderOrder = -8;
      mLine.visible = false;
      scene.add(mLine);
      // Each meteor has: origin, direction, speed, progress, active flag
      meteorPool.push({
        line: mLine, geo: mGeo, mat: mMat, positions: mPositions,
        active: false, progress: 0, speed: 0, opacity: 0,
        origin: new THREE.Vector3(), dir: new THREE.Vector3(), length: 0,
      });
    }
    shootingStarsRef.current = meteorPool;

    // Aurora — rich color bands drifting across the top of the scene
    const auroraN = 160;
    const auroraG = new THREE.BufferGeometry();
    const auroraP = new Float32Array(auroraN * 3);
    const auroraC = new Float32Array(auroraN * 3);
    for (let i = 0; i < auroraN; i++) {
      auroraP[i * 3] = (Math.random() - 0.5) * 12;
      auroraP[i * 3 + 1] = 2.5 + Math.random() * 5;
      auroraP[i * 3 + 2] = -4 + (Math.random() - 0.5) * 8;
      const t = i / auroraN;
      const band = Math.sin(t * Math.PI * 3); // creates color banding
      auroraC[i * 3] = 0.55 + band * 0.2 + t * 0.2;     // R — rose to peach
      auroraC[i * 3 + 1] = 0.4 + Math.abs(band) * 0.25;  // G — subtle greens
      auroraC[i * 3 + 2] = 0.7 + (1 - t) * 0.2;          // B — lavender base
    }
    auroraG.setAttribute("position", new THREE.BufferAttribute(auroraP, 3));
    auroraG.setAttribute("color", new THREE.BufferAttribute(auroraC, 3));
    const auroraMat = new THREE.PointsMaterial({ size: 0.24, transparent: true, opacity: 0.07, vertexColors: true, sizeAttenuation: true, blending: THREE.AdditiveBlending });
    const auroraMesh = new THREE.Points(auroraG, auroraMat);
    scene.add(auroraMesh);
    auroraRef.current = { mesh: auroraMesh, positions: auroraP, geometry: auroraG };

    // Heart mesh
    const hs = new THREE.Shape();
    hs.moveTo(0, -0.025); hs.bezierCurveTo(0, -0.025, -0.005, 0, -0.025, 0);
    hs.bezierCurveTo(-0.055, 0, -0.055, -0.035, -0.055, -0.035);
    hs.bezierCurveTo(-0.055, -0.055, -0.035, -0.077, 0, -0.1);
    hs.bezierCurveTo(0.035, -0.077, 0.055, -0.055, 0.055, -0.035);
    hs.bezierCurveTo(0.055, -0.035, 0.055, 0, 0.025, 0);
    hs.bezierCurveTo(0.005, 0, 0, -0.025, 0, -0.025);
    const hMat = new THREE.MeshBasicMaterial({ color: P.heart, transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: true });
    const hMesh = new THREE.Mesh(new THREE.ShapeGeometry(hs), hMat);
    hMesh.renderOrder = 10; hMesh.visible = false;
    globe.add(hMesh);
    heartRef.current = hMesh;

    // Fly-in animation — staged zoom with globe rotation
    tZm.current = 5.5; // start zoomed out
    const flyInT1 = setTimeout(() => { tZm.current = 3.6; tRot.current.y = tRot.current.y + 0.8; }, 200);
    const flyInT2 = setTimeout(() => tSpinSpd.current = 0.002, 1800);

    const _tmpQuat = new THREE.Quaternion();
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      spinSpd.current = lerp(spinSpd.current, tSpinSpd.current, 0.04);
      if (!dragR.current && !selectedRef.current) tRot.current.y += spinSpd.current;
      rot.current.x = lerp(rot.current.x, tRot.current.x, 0.05);
      rot.current.y = lerp(rot.current.y, tRot.current.y, 0.05);
      globe.rotation.x = rot.current.x;
      globe.rotation.y = rot.current.y;
      zmR.current = lerp(zmR.current, tZm.current, 0.03);
      cam.position.z = zmR.current;

      // Easter egg: fade in "you are my world" when zoomed all the way out (shared worlds only)
      if (easterEggRef.current) easterEggRef.current.style.opacity = isPartnerWorld && isSharedWorld && zmR.current > 5.5 ? Math.min(1, (zmR.current - 5.5) * 2) : 0;

      // Zoom-based marker scaling with type-specific breathing + search glow
      const mkScale = Math.min(1.2, Math.max(0.35, zmR.current / 3.5));
      const now = Date.now();
      const searchActive = searchMatchIdsRef.current.size > 0;
      const searchPulse = searchActive ? 1 + Math.sin(now * 0.004) * 0.3 : 1;
      mkRef.current.forEach((m) => {
        // Type-specific breathing: vary speed & amplitude per entry type
        const t = m.entryType;
        let breathe;
        if (t === "beach" || t === "cruise") breathe = 1 + Math.sin(now * 0.0005) * 0.09; // slow wave
        else if (t === "city" || t === "night-out") breathe = 1 + Math.sin(now * 0.0018) * 0.05; // quick sparkle
        else if (t === "nature" || t === "outdoors") breathe = 1 + Math.sin(now * 0.0006) * 0.10; // gentle glow
        else if (t === "special" || t === "celebration" || t === "milestone") breathe = 1 + Math.sin(now * 0.0012) * 0.12; // warm pulse
        else if (t === "together" || t === "group-trip" || t === "family-trip") breathe = 1 + (Math.sin(now * 0.0009) * 0.5 + 0.5) * 0.08; // heartbeat (asymmetric)
        else breathe = 1 + Math.sin(now * 0.0008) * 0.07; // default
        const isMatch = searchActive && (searchMatchIdsRef.current.has(m.entryId) || (m.entryIds && m.entryIds.some(id => searchMatchIdsRef.current.has(id))));
        const scale = isMatch ? mkScale * searchPulse * 1.4 : mkScale * breathe;
        const dimmed = searchActive && !isMatch;
        if (m.dot) {
          m.dot.scale.setScalar(scale);
          if (m.dot.material) m.dot.material.opacity = dimmed ? 0.15 : (m.dot.material._baseOpacity ?? 0.85);
        }
        if (m.glow) {
          m.glow.scale.setScalar(scale);
          if (m.glow.material) m.glow.material.opacity = dimmed ? 0.02 : (isMatch ? 0.25 : (m.glow.material._baseOpacity ?? 0.10));
        }
      });

      // Animate travel route dashes — flowing along arcs
      const rt = Date.now() * 0.0004;
      routesRef.current.forEach((r) => {
        if (r.line?.material) {
          r.line.material.dashOffset = -rt + (r.idx || 0) * 0.3;
          r.line.material.opacity = 0.55 + Math.sin(rt * 2.5 + (r.idx || 0) * 0.8) * 0.15;
        }
        if (r.glow?.material) {
          r.glow.material.opacity = 0.1 + Math.sin(rt * 1.5 + (r.idx || 0) * 0.5) * 0.06;
        }
      });

      if (hMesh.visible) {
        const ht = Date.now() * 0.004;
        hMesh.scale.set(1 + Math.sin(ht) * 0.15, 1 + Math.sin(ht) * 0.15, 1);
        hMesh.material.opacity = 0.5 + Math.sin(ht * 0.7) * 0.2;
        // Billboard: counter globe rotation so heart always faces camera
        _tmpQuat.setFromEuler(globe.rotation).invert();
        hMesh.quaternion.copy(_tmpQuat);
      }
      particles.rotation.y += 0.0001;
      particles2.rotation.y -= 0.00008;
      particles2.rotation.x += 0.00003;

      // Star twinkling — per-star size/opacity oscillation (2x faster when entry selected)
      if (starsRef.current) {
        const sr = starsRef.current;
        const sizes = sr.geometry.attributes.size;
        const now = Date.now() * 0.001;
        const twinkleMultiplier = atmosphereRef.current.targetHue ? 2.0 : 1.0;
        for (let i = 0; i < sr.phases.length; i++) {
          const twinkle = 0.6 + 0.4 * Math.sin(now * sr.speeds[i] * twinkleMultiplier + sr.phases[i]);
          sizes.array[i] = sr.sizes[i] * twinkle;
        }
        sizes.needsUpdate = true;
        sr.mesh.rotation.y += 0.000015; // very slow drift
        sr.mesh.rotation.x += 0.000005; // subtle multi-axis
      }

      // Shooting stars — periodic meteor streaks across the sky
      {
        const meteors = shootingStarsRef.current;
        const markerCount = mkRef.current.length;
        // More entries = more frequent shooting stars (1 every ~8s base, up to ~3s with 50+ entries)
        const freq = Math.max(3000, 8000 - markerCount * 100);
        // Try to launch a new meteor
        if (Math.random() < 1 / (freq * 0.06)) { // ~60fps, so divide freq by ~16.6ms
          const idle = meteors.find(m => !m.active);
          if (idle) {
            // Random origin point in the star field
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 12 + Math.random() * 8;
            idle.origin.set(
              r * Math.sin(phi) * Math.cos(theta),
              r * Math.sin(phi) * Math.sin(theta),
              r * Math.cos(phi)
            );
            // Direction: mostly tangential with slight inward bias
            _meteorV1.set(-idle.origin.y, idle.origin.x, 0).normalize();
            _meteorV2.copy(idle.origin).normalize().multiplyScalar(-0.3);
            idle.dir.copy(_meteorV1).add(_meteorV2).normalize();
            idle.length = 1.5 + Math.random() * 2.5; // streak length
            idle.speed = 0.08 + Math.random() * 0.12; // speed
            idle.progress = 0;
            idle.active = true;
            idle.line.visible = true;
          }
        }
        // Animate active meteors
        for (let mi = 0; mi < meteors.length; mi++) {
          const m = meteors[mi];
          if (!m.active) continue;
          m.progress += m.speed;
          const headT = m.progress;
          const tailT = Math.max(0, headT - m.length);
          const head = _meteorV1.copy(m.origin).addScaledVector(m.dir, headT);
          const tail = _meteorV2.copy(m.origin).addScaledVector(m.dir, tailT);
          m.positions[0] = head.x; m.positions[1] = head.y; m.positions[2] = head.z;
          m.positions[3] = tail.x; m.positions[4] = tail.y; m.positions[5] = tail.z;
          m.geo.attributes.position.needsUpdate = true;
          // Fade in quickly, sustain, fade out
          const life = m.progress / (m.length * 3);
          if (life < 0.1) m.mat.opacity = life * 10 * 0.5;
          else if (life < 0.7) m.mat.opacity = 0.5;
          else m.mat.opacity = Math.max(0, (1 - life) / 0.3 * 0.5);
          // Deactivate when fully faded
          if (life >= 1) {
            m.active = false;
            m.line.visible = false;
            m.mat.opacity = 0;
          }
        }
      }

      // Parallax — glow layers shift subtly opposite to mouse
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      glows.forEach((glow, i) => {
        const strength = (i + 1) * 0.02;
        glow.position.x = -mx * strength;
        glow.position.y = my * strength;
      });

      // Aurora drift
      if (auroraRef.current) {
        const ap = auroraRef.current.positions;
        const ag = auroraRef.current.geometry;
        const at = Date.now() * 0.0003;
        for (let i = 0; i < ap.length / 3; i++) {
          ap[i * 3] += Math.sin(at + i * 0.5) * 0.002;
          ap[i * 3 + 1] += Math.cos(at + i * 0.3) * 0.001;
          if (ap[i * 3] > 5) ap[i * 3] = -5;
          if (ap[i * 3] < -5) ap[i * 3] = 5;
        }
        ag.attributes.position.needsUpdate = true;

        // Atmosphere mood — aurora color shifts toward selected entry's type
        const atm = atmosphereRef.current;
        if (atm.targetHue) {
          if (!atm._cachedColor) atm._cachedColor = new THREE.Color(atm.targetHue);
          else if (atm._cachedHex !== atm.targetHue) { atm._cachedColor.set(atm.targetHue); atm._stable = false; }
          atm._cachedHex = atm.targetHue;
          // Fade intensity toward target (ramp up)
          const prevIntensity = atm.intensity;
          atm.intensity = lerp(atm.intensity, 0.35, 0.02);
          // Skip per-vertex recalc if intensity has stabilized
          if (!atm._stable || Math.abs(atm.intensity - prevIntensity) > 0.0005) {
            const colors = ag.attributes.color;
            const tc = atm._cachedColor;
            const blend = Math.min(atm.intensity, 0.35);
            for (let i = 0; i < colors.count; i++) {
              const t2 = i / colors.count;
              const band = Math.sin(t2 * Math.PI * 3);
              const baseR = 0.55 + band * 0.2 + t2 * 0.2;
              const baseG2 = 0.4 + Math.abs(band) * 0.25;
              const baseB = 0.7 + (1 - t2) * 0.2;
              colors.array[i * 3] = baseR + (tc.r - baseR) * blend;
              colors.array[i * 3 + 1] = baseG2 + (tc.g - baseG2) * blend;
              colors.array[i * 3 + 2] = baseB + (tc.b - baseB) * blend;
            }
            colors.needsUpdate = true;
            if (Math.abs(atm.intensity - prevIntensity) <= 0.0005) atm._stable = true;
          }
        } else if (atm.intensity > 0.001) {
          // Fade back to default
          atm._stable = false;
          atm.intensity = lerp(atm.intensity, 0, 0.015);
          const colors = ag.attributes.color;
          for (let i = 0; i < colors.count; i++) {
            const t2 = i / colors.count;
            const band = Math.sin(t2 * Math.PI * 3);
            colors.array[i * 3] = 0.55 + band * 0.2 + t2 * 0.2;
            colors.array[i * 3 + 1] = 0.4 + Math.abs(band) * 0.25;
            colors.array[i * 3 + 2] = 0.7 + (1 - t2) * 0.2;
          }
          colors.needsUpdate = true;
        }

        // Aurora brightness boost on selection
        if (auroraRef.current.mesh) {
          const targetOp = atm.targetHue ? 0.12 : 0.07;
          auroraRef.current.mesh.material.opacity = lerp(auroraRef.current.mesh.material.opacity, targetOp, 0.03);
        }
      }

      // Particle quickening — brief speed boost on selection
      {
        const atm = atmosphereRef.current;
        if (atm.particleBoost > 0.001) {
          const boost = atm.particleBoost;
          particles.rotation.y += 0.0001 * boost * 3;
          if (particles2Ref.current) {
            particles2Ref.current.rotation.y -= 0.00008 * boost * 3;
            particles2Ref.current.rotation.x += 0.00003 * boost * 2;
          }
          atm.particleBoost = lerp(atm.particleBoost, 0, 0.02);
        }
      }

      // Pulse rings — expanding rings from selected markers
      for (let pi = pulseRingsRef.current.length - 1; pi >= 0; pi--) {
        const pr = pulseRingsRef.current[pi];
        pr.age += 0.012;
        if (pr.age >= 1) {
          globe.remove(pr.mesh);
          pr.mesh.geometry.dispose();
          pr.mesh.material.dispose();
          pulseRingsRef.current.splice(pi, 1);
          continue;
        }
        const scale = 1 + pr.age * 4; // expand from 1x to 5x
        pr.mesh.scale.setScalar(scale);
        pr.mesh.material.opacity = (1 - pr.age) * 0.25; // fade out
      }

      // Night shadow — sun direction in globe-local space (no counter-rotation needed;
      // mesh is a child of globe, normals are object-space, ll2v coords are fixed)
      if (nightShadowRef.current?.material) {
        const _now = new Date();
        const uh = _now.getUTCHours() + _now.getUTCMinutes() / 60 + _now.getUTCSeconds() / 3600;
        const sunAngle = (12 - uh) * Math.PI / 12; // subsolar longitude in ll2v coords
        nightShadowRef.current.material.uniforms.sunDir.value.set(
          Math.cos(sunAngle), 0.15, -Math.sin(sunAngle)
        ).normalize();
      }

      // Comet animation — dramatic arc from sky to globe surface
      if (cometRef.current && cometRef.current.active) {
        const c = cometRef.current;
        // Recompute target in world space from globe's current rotation
        const target = _cometTarget.copy(c.targetLocal).applyEuler(globe.rotation);
        c.progress += 0.008 + c.progress * 0.025;
        if (c.progress >= 1) {
          // IMPACT!
          c.active = false;
          c.head.visible = false;
          c.trail.visible = false;
          // Flash at actual target position
          c.flash.position.copy(target);
          c.flash.material.opacity = 0.7;
          c.flash.scale.setScalar(0.3);
          // Spawn burst particles — more, bigger, faster
          const burstN = 36;
          const burstGroup = new THREE.Group();
          const burstParticles = [];
          const normal = target.clone().normalize();
          for (let bi = 0; bi < burstN; bi++) {
            const bGeo = new THREE.SphereGeometry(0.012 + Math.random() * 0.008, 8, 8);
            const bColor = bi < burstN / 3 ? "#ffffff" : c.color; // mix white sparks with colored
            const bMat = new THREE.MeshBasicMaterial({ color: bColor, transparent: true, opacity: 0.9 });
            const bMesh = new THREE.Mesh(bGeo, bMat);
            bMesh.position.copy(target);
            // Burst outward from surface, biased along normal
            const spread = new THREE.Vector3(
              (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)
            ).normalize().multiplyScalar(0.3 + Math.random() * 0.5);
            spread.add(normal.clone().multiplyScalar(0.2 + Math.random() * 0.3));
            burstParticles.push({ mesh: bMesh, vel: spread, age: 0 });
            burstGroup.add(bMesh);
          }
          // Add expanding ring at impact point
          const ringGeo = new THREE.RingGeometry(0.01, 0.04, 32);
          const ringMat = new THREE.MeshBasicMaterial({ color: c.color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthTest: false });
          const impactRing = new THREE.Mesh(ringGeo, ringMat);
          impactRing.position.copy(target);
          impactRing.lookAt(target.clone().multiplyScalar(2));
          impactRing.renderOrder = 16;
          burstGroup.add(impactRing);
          burstParticles.push({ mesh: impactRing, vel: new THREE.Vector3(), age: 0, isRing: true });
          scene.add(burstGroup); // add to scene (not globe) since positions are world-space
          c.burst = { group: burstGroup, particles: burstParticles };
          c.burstAge = 0;
        } else {
          // Recompute bezier position each frame to track globe rotation
          // Mid-point: average of origin & target, lifted on Y
          _cometMid.addVectors(c.origin, target).multiplyScalar(0.5);
          _cometMid.y += 1.5;
          const eased = c.progress < 0.5
            ? 2 * c.progress * c.progress
            : 1 - Math.pow(-2 * c.progress + 2, 2) / 2;
          // Manual quadratic bezier: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
          const t = eased, t1 = 1 - t;
          const t1sq = t1 * t1, tsq = t * t, t1t2 = 2 * t1 * t;
          _cometPos.set(
            t1sq * c.origin.x + t1t2 * _cometMid.x + tsq * target.x,
            t1sq * c.origin.y + t1t2 * _cometMid.y + tsq * target.y,
            t1sq * c.origin.z + t1t2 * _cometMid.z + tsq * target.z
          );
          c.head.position.copy(_cometPos);
          // Record position in ring buffer for multi-segment trail
          const ri = c.historyIdx;
          c.historyBuf[ri * 3] = _cometPos.x;
          c.historyBuf[ri * 3 + 1] = _cometPos.y;
          c.historyBuf[ri * 3 + 2] = _cometPos.z;
          c.historyIdx = (ri + 1) % c.TRAIL_LEN;
          if (c.historyCount < c.TRAIL_LEN) c.historyCount++;
          // Update trail geometry from ring buffer (newest first)
          for (let ti = 0; ti < c.TRAIL_LEN; ti++) {
            // Read backwards from most recent entry in ring buffer
            const si = ti < c.historyCount
              ? ((c.historyIdx - 1 - ti + c.TRAIL_LEN * 2) % c.TRAIL_LEN) * 3
              : ((c.historyIdx - 1 + c.TRAIL_LEN * 2) % c.TRAIL_LEN) * 3; // clamp to oldest available
            c.trailPositions[ti * 3] = c.historyBuf[si];
            c.trailPositions[ti * 3 + 1] = c.historyBuf[si + 1];
            c.trailPositions[ti * 3 + 2] = c.historyBuf[si + 2];
          }
          c.trailGeo.attributes.position.needsUpdate = true;
          c.trail.material.opacity = 0.3 + c.progress * 0.4;
          c.head.material.opacity = 0.7 + Math.sin(c.progress * Math.PI) * 0.3;
          // Pulse head size
          const headScale = 1 + Math.sin(c.progress * Math.PI * 4) * 0.15;
          c.head.scale.setScalar(headScale);
        }
      }
      // Animate comet burst + flash
      if (cometRef.current?.burst) {
        const c = cometRef.current;
        c.burstAge += 0.015;
        // Flash: expand and fade
        if (c.flash) {
          const flashLife = Math.min(c.burstAge * 3, 1);
          c.flash.scale.setScalar(0.3 + flashLife * 1.5);
          c.flash.material.opacity = Math.max(0, 0.7 * (1 - flashLife));
          if (flashLife >= 1 && c.flash.parent) {
            scene.remove(c.flash);
            c.flash.geometry.dispose(); c.flash.material.dispose();
            c.flash = null;
          }
        }
        if (c.burstAge >= 1.2) {
          scene.remove(c.burst.group);
          c.burst.particles.forEach(p => { p.mesh.geometry.dispose(); p.mesh.material.dispose(); });
          c.burst = null;
          scene.remove(c.head); scene.remove(c.trail);
          if (c.head._halo) { c.head._halo.geometry.dispose(); c.head._halo.material.dispose(); }
          c.head.geometry.dispose(); c.head.material.dispose();
          c.trailGeo.dispose(); c.trail.material.dispose();
          if (c.flash) { scene.remove(c.flash); c.flash.geometry.dispose(); c.flash.material.dispose(); }
          cometRef.current = null;
        } else {
          c.burst.particles.forEach(p => {
            p.age += 0.015;
            if (p.isRing) {
              // Expanding impact ring
              const ringScale = 1 + p.age * 12;
              p.mesh.scale.setScalar(ringScale);
              p.mesh.material.opacity = Math.max(0, 0.6 * (1 - p.age));
            } else {
              p.mesh.position.add(_burstTmp.copy(p.vel).multiplyScalar(0.018));
              p.vel.multiplyScalar(0.94); // drag
              p.mesh.material.opacity = Math.max(0, 0.9 * (1 - p.age * 0.8));
              p.mesh.scale.setScalar(Math.max(0.1, 1 - p.age * 0.6));
            }
          });
        }
      }

      // Geography lines — primary at full opacity, glow lines softer
      const zoomFactor = clamp((3.5 - zmR.current) / 2.0, 0, 1);
      for (let gi = 0; gi < geoGroup.length; gi++) {
        const g = geoGroup[gi];
        // Even indices = primary lines, odd = glow lines
        g.mat.opacity = gi % 2 === 0 ? 1.0 : 0.35 + zoomFactor * 0.25;
      }

      rend.render(scene, cam);
    };
    animate();

    // Intro sequence
    const introT1 = setTimeout(() => setReady(true), 300);
    const introT2 = setTimeout(() => setIntroComplete(true), 2500);
    setSceneReady(true);

    const onR = () => { const nw = el.clientWidth, nh = el.clientHeight; cam.aspect = nw / nh; cam.updateProjectionMatrix(); rend.setSize(nw, nh); };
    window.addEventListener("resize", onR);

    return () => {
      clearTimeout(flyInT1); clearTimeout(flyInT2);
      clearTimeout(introT1); clearTimeout(introT2);
      cancelAnimationFrame(frameRef.current);
      if (animRef?.current) cancelAnimationFrame(animRef.current);
      if (playRef?.current) clearTimeout(playRef.current);
      if (photoTimerRef?.current) clearInterval(photoTimerRef.current);
      if (stepDayTimer?.current) clearTimeout(stepDayTimer.current);
      if (surpriseTimers?.current) surpriseTimers.current.forEach(clearTimeout);
      if (dismissTimers?.current) dismissTimers.current.forEach(clearTimeout);
      window.removeEventListener("resize", onR);
      // Dispose all Three.js objects to prevent GPU memory leaks
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      });
      if (el.contains(rend.domElement)) el.removeChild(rend.domElement);
      rend.forceContextLoss();
      rend.dispose();
      // Null out all refs so no stale references to disposed objects remain
      rendRef.current = null;
      scnRef.current = null;
      camRef.current = null;
      globeRef.current = null;
      heartRef.current = null;
      glowLayersRef.current = [];
      particlesRef.current = null;
      particles2Ref.current = null;
      starsRef.current = null;
      shootingStarsRef.current = [];
      auroraRef.current = null;
      nightShadowRef.current = null;
      // Clear symbol texture cache
      Object.keys(_symbolCache).forEach(k => { if (_symbolCache[k]?.dispose) _symbolCache[k].dispose(); delete _symbolCache[k]; });
    };
  }, [loading]);

  return {
    sceneReady,
    rendRef, scnRef, camRef, globeRef, heartRef,
    glowLayersRef, particlesRef, particles2Ref,
    starsRef, shootingStarsRef, auroraRef, nightShadowRef,
  };
}
