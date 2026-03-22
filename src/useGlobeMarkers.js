import { useMemo, useEffect, useRef } from "react";
import * as THREE from "three";

// ---- LOCAL UTILS (copied from OurWorld to avoid shared imports) ----

const RAD = 1;

const ll2v = (lat, lng, r) => {
  const phi = (90 - lat) * Math.PI / 180, theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(-(r * Math.sin(phi) * Math.cos(theta)), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
};

const _symbolCache = {};
function makeSymbolTexture(type, color) {
  const key = `${type}-${color}`;
  if (_symbolCache[key]) return _symbolCache[key];
  const s = 64, c = document.createElement("canvas");
  c.width = s; c.height = s;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, s, s);
  const cx = s / 2, cy = s / 2;
  ctx.fillStyle = color;

  if (type === "together") {
    ctx.beginPath();
    ctx.moveTo(cx, cy + 10);
    ctx.bezierCurveTo(cx - 18, cy - 2, cx - 18, cy - 18, cx, cy - 8);
    ctx.bezierCurveTo(cx + 18, cy - 18, cx + 18, cy - 2, cx, cy + 10);
    ctx.fill();
  } else if (type === "special") {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const r = i % 2 === 0 ? 18 : 5;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  } else if (type === "home-seth") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 16); ctx.lineTo(cx + 14, cy - 2); ctx.lineTo(cx - 14, cy - 2);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(cx - 10, cy - 2, 20, 15);
    ctx.fillStyle = "#161028"; ctx.globalAlpha = 0.5;
    ctx.fillRect(cx - 3, cy + 3, 6, 10);
  } else if (type === "home-rosie") {
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff8f0"; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
  } else if (type === "seth-solo" || type === "diamond") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 16); ctx.lineTo(cx + 10, cy);
    ctx.lineTo(cx, cy + 16); ctx.lineTo(cx - 10, cy);
    ctx.closePath(); ctx.fill();
  } else if (type === "rosie-solo") {
    ctx.beginPath(); ctx.arc(cx - 2, cy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath(); ctx.arc(cx + 6, cy - 3, 12, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  } else if (type === "dream") {
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.6;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? 16 : 7;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.stroke();
  } else if (type === "love-letter") {
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 8, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff4e8"; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
  } else if (type === "compass") {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const r = i % 2 === 0 ? 16 : 6;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff8f0"; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
  } else if (type === "triangle-group") {
    const offsets = [[-5, 2], [5, 2], [0, -5]];
    offsets.forEach(([ox, oy]) => {
      ctx.beginPath();
      ctx.moveTo(cx + ox, cy + oy - 10); ctx.lineTo(cx + ox + 7, cy + oy + 6); ctx.lineTo(cx + ox - 7, cy + oy + 6);
      ctx.closePath(); ctx.fill();
    });
  } else if (type === "burst") {
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6 - Math.PI / 2;
      const r = i % 2 === 0 ? 16 : 8;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  } else if (type === "wave") {
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy + 2);
    ctx.bezierCurveTo(cx - 12, cy - 10, cx - 6, cy - 10, cx, cy + 2);
    ctx.bezierCurveTo(cx + 6, cy + 14, cx + 12, cy + 14, cx + 18, cy + 2);
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy + 10);
    ctx.bezierCurveTo(cx - 8, cy + 2, cx - 2, cy + 2, cx + 4, cy + 10);
    ctx.bezierCurveTo(cx + 8, cy + 16, cx + 12, cy + 16, cx + 16, cy + 10);
    ctx.stroke();
  } else if (type === "anchor") {
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy + 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 8, cy - 6); ctx.lineTo(cx + 8, cy - 6); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy + 12, 8, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy - 14, 3, 0, Math.PI * 2); ctx.fill();
  } else if (type === "mountain") {
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy + 12); ctx.lineTo(cx - 4, cy - 10); ctx.lineTo(cx + 4, cy + 4);
    ctx.lineTo(cx + 8, cy - 4); ctx.lineTo(cx + 16, cy + 12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff8f0"; ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 10); ctx.lineTo(cx - 1, cy - 4); ctx.lineTo(cx - 7, cy - 4);
    ctx.closePath(); ctx.fill();
  } else if (type === "car") {
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy + 4); ctx.lineTo(cx - 14, cy - 2); ctx.lineTo(cx - 8, cy - 2);
    ctx.lineTo(cx - 5, cy - 10); ctx.lineTo(cx + 7, cy - 10); ctx.lineTo(cx + 12, cy - 2);
    ctx.lineTo(cx + 14, cy - 2); ctx.lineTo(cx + 14, cy + 4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff8f0"; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(cx - 8, cy + 4, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 8, cy + 4, 3.5, 0, Math.PI * 2); ctx.fill();
  } else if (type === "tent") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 16); ctx.lineTo(cx + 16, cy + 10); ctx.lineTo(cx - 16, cy + 10);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff8f0"; ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 10); ctx.lineTo(cx - 4, cy + 10); ctx.lineTo(cx, cy - 2);
    ctx.lineTo(cx + 4, cy + 10);
    ctx.closePath(); ctx.fill();
  } else if (type === "backpack") {
    ctx.fillRect(cx - 8, cy - 8, 16, 20);
    ctx.fillStyle = "#fff8f0"; ctx.globalAlpha = 0.4;
    ctx.fillRect(cx - 5, cy - 14, 10, 8);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy); ctx.stroke();
  } else if (type === "people") {
    ctx.beginPath(); ctx.arc(cx - 6, cy - 8, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 6, cy - 8, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - 10, cy - 2, 8, 14);
    ctx.fillRect(cx + 2, cy - 2, 8, 14);
  } else if (type === "briefcase") {
    ctx.fillRect(cx - 12, cy - 6, 24, 16);
    ctx.fillStyle = "#fff8f0"; ctx.globalAlpha = 0.4;
    ctx.fillRect(cx - 5, cy - 10, 10, 6);
  } else if (type === "star") {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? 16 : 7;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  } else if (type === "heart") {
    ctx.beginPath();
    ctx.moveTo(cx, cy + 12);
    ctx.bezierCurveTo(cx - 16, cy, cx - 16, cy - 14, cx, cy - 6);
    ctx.bezierCurveTo(cx + 16, cy - 14, cx + 16, cy, cx, cy + 12);
    ctx.fill();
  } else if (type === "house") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 16); ctx.lineTo(cx + 14, cy - 2); ctx.lineTo(cx - 14, cy - 2);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(cx - 10, cy - 2, 20, 15);
    ctx.fillStyle = "#161028"; ctx.globalAlpha = 0.5;
    ctx.fillRect(cx - 3, cy + 3, 6, 10);
  } else if (type === "capsule-sealed") {
    // Golden pulsing hourglass/capsule shape for sealed time capsules
    ctx.globalAlpha = 0.9;
    // Outer glow ring
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.stroke();
    // Lock body
    ctx.fillStyle = color; ctx.globalAlpha = 0.85;
    ctx.fillRect(cx - 7, cy - 2, 14, 12);
    ctx.beginPath(); ctx.arc(cx, cy - 2, 7, Math.PI, 0); ctx.fill();
    // Lock shackle
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(cx, cy - 6, 5, Math.PI, 0); ctx.stroke();
    // Keyhole
    ctx.fillStyle = "#161028"; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(cx, cy + 2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - 0.8, cy + 3, 1.6, 3);
  } else if (type === "capsule-opened") {
    // Opened time capsule — star burst
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? 16 : 7;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff8e8"; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  _symbolCache[key] = tex;
  return tex;
}

// Minimum touch hit-area radius (48px equivalent in 3D space)
const TOUCH_HIT_RADIUS = 0.045;

// ---- MARKER HELPER ----
function makeDot(group, lat, lng, color, size, id, faint = false, symbolType = null) {
  const P = window.__cosmosP;
  const p = ll2v(lat, lng, RAD * 1.012);
  // Invisible larger hit-area mesh for touch devices
  const hitSize = Math.max(size * 3, TOUCH_HIT_RADIUS);
  const hitArea = new THREE.Mesh(new THREE.CircleGeometry(hitSize, 12), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide, depthTest: true }));
  hitArea.position.copy(p); hitArea.lookAt(p.clone().multiplyScalar(2)); hitArea.userData = { entryId: id }; hitArea.renderOrder = -1; group.add(hitArea);
  if (symbolType) {
    const tex = makeSymbolTexture(symbolType, color);
    const sz = size * 7;
    const dot = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, depthTest: true }));
    dot.position.copy(p); dot.lookAt(p.clone().multiplyScalar(2)); dot.userData = { entryId: id }; dot.renderOrder = 2; group.add(dot);
    return { entryId: id, dot, ring: null, glow: null, hitArea };
  }
  const dotOp = faint ? 0.28 : 0.85;
  const dot = new THREE.Mesh(new THREE.CircleGeometry(size, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: dotOp, side: THREE.DoubleSide, depthTest: true }));
  dot.material._baseOpacity = dotOp;
  dot.position.copy(p); dot.lookAt(p.clone().multiplyScalar(2)); dot.userData = { entryId: id }; dot.renderOrder = 2; group.add(dot);
  const glowOp = faint ? 0.04 : 0.10;
  const glow = new THREE.Mesh(new THREE.CircleGeometry(size * (faint ? 1.4 : 2.0), 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: glowOp, side: THREE.DoubleSide, depthTest: true }));
  glow.material._baseOpacity = glowOp;
  glow.position.copy(p); glow.lookAt(p.clone().multiplyScalar(2)); glow.renderOrder = 0; group.add(glow);
  return { entryId: id, dot, ring: null, glow, hitArea };
}

/**
 * useGlobeMarkers — extracted marker rendering logic from OurWorld.
 */
export function useGlobeMarkers(deps) {
  const {
    data, TYPES,
    globeRef, mkRef, rtRef, heartRef,
    loveThreadRef, constellationRef, routesRef,
    sceneReady, sliderDate, getPositions, areTogether,
    isPartnerWorld, isMyWorld,
    showLoveThread, loveThreadData,
    showConstellation, constellationData,
    showRoutes, isPlaying, routeData,
    config, selected,
  } = deps;

  const P = window.__cosmosP;

  // ---- Group entries by location (within ~0.5 degrees) ----
  const locationGroups = useMemo(() => {
    const groups = [];
    data.entries.forEach(e => {
      const existing = groups.find(g => Math.abs(g.lat - e.lat) < 0.5 && Math.abs(g.lng - e.lng) < 0.5);
      if (existing) { existing.entries.push(e); }
      else { groups.push({ lat: e.lat, lng: e.lng, city: e.city, entries: [e] }); }
    });
    return groups;
  }, [data.entries]);

  // ---- REBUILD MARKERS ----
  useEffect(() => {
    const g = globeRef.current; if (!g || !sceneReady) return;
    mkRef.current.forEach(m => [m.dot, m.ring, m.glow].forEach(o => {
      if (!o) return; g.remove(o); if (o.material?.map) o.material.map.dispose(); o.geometry?.dispose(); o.material?.dispose();
    }));
    mkRef.current = [];
    rtRef.current.forEach(r => { if (r.line) { g.remove(r.line); r.line.geometry?.dispose(); r.line.material?.dispose(); } });
    rtRef.current = [];

    const positions = getPositions(sliderDate);

    // ---- ALL ENTRIES always visible as colored markers ----
    locationGroups.forEach(loc => {
      const types = loc.entries.map(e => e.type);
      const priority = ["special", "together"];
      const primaryType = priority.find(t => types.includes(t)) || types.find(t => TYPES[t]) || types[0];
      const typeInfo = TYPES[primaryType];
      let color = typeInfo ? (P[typeInfo.color] || typeInfo.color || P.textFaint) : P.textFaint;
      let icon = typeInfo?.symbol || "together";

      const isMulti = loc.entries.length > 1;
      const size = isMulti ? 0.02 : 0.014;
      const entryId = isMulti ? `group-${loc.lat.toFixed(2)}-${loc.lng.toFixed(2)}` : loc.entries[0].id;

      const mk = makeDot(g, loc.lat, loc.lng, color, size, entryId, false, icon);
      mk.entryIds = loc.entries.map(e => e.id);
      mk.entryType = primaryType;
      mkRef.current.push(mk);
    });

    // ---- Person 1 ("you") position dot (from slider) ---- (partner only)
    if (isPartnerWorld && positions.seth && !areTogether) {
      mkRef.current.push(makeDot(g, positions.seth.lat, positions.seth.lng, P.sky, 0.016, "seth-pos", false, "diamond"));
    }
    // ---- Person 2 ("partner") position dot (from slider) ---- (partner only)
    if (isPartnerWorld && positions.rosie && !areTogether) {
      mkRef.current.push(makeDot(g, positions.rosie.lat, positions.rosie.lng, P.rose, 0.016, "rosie-pos", false, "diamond"));
    }

    // ---- Heart on together location ---- (partner only)
    if (isPartnerWorld) {
      if (areTogether && positions.together) {
        if (heartRef.current) {
          const hp = ll2v(positions.together.lat, positions.together.lng, RAD * 1.05);
          heartRef.current.position.copy(hp);
          heartRef.current.visible = true;
        }
      } else if (heartRef.current) { heartRef.current.visible = false; }
    } else if (heartRef.current) { heartRef.current.visible = false; }

    // ---- Distance line when apart ---- (partner only)
    if (isPartnerWorld && positions.seth && positions.rosie && !areTogether) {
      const from = ll2v(positions.seth.lat, positions.seth.lng, RAD * 1.08);
      const to = ll2v(positions.rosie.lat, positions.rosie.lng, RAD * 1.08);
      const mid = from.clone().add(to).multiplyScalar(0.5);
      mid.normalize().multiplyScalar(RAD * 1.12 + from.distanceTo(to) * 0.4);
      const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
      const lG = new THREE.BufferGeometry().setFromPoints(curve.getPoints(50));
      const lM = new THREE.LineDashedMaterial({ color: P.rose, transparent: true, opacity: 0.8, dashSize: 0.025, gapSize: 0.015, linewidth: 2, depthTest: false });
      const line = new THREE.Line(lG, lM); line.computeLineDistances(); line.renderOrder = 3;
      g.add(line); rtRef.current.push({ line });
    }

    // ---- LOVE THREAD — golden arcs connecting all together entries ---- (Our World only)
    loveThreadRef.current.forEach(l => { g.remove(l); l.geometry?.dispose(); l.material?.dispose(); });
    loveThreadRef.current = [];
    if (isPartnerWorld && showLoveThread) {
      loveThreadData.forEach(({ from, to }) => {
        const f = ll2v(from.lat, from.lng, RAD * 1.03);
        const t = ll2v(to.lat, to.lng, RAD * 1.03);
        const mid = f.clone().add(t).multiplyScalar(0.5);
        mid.normalize().multiplyScalar(RAD * 1.04 + f.distanceTo(t) * 0.2);
        const curve = new THREE.QuadraticBezierCurve3(f, mid, t);
        const geom = new THREE.BufferGeometry().setFromPoints(curve.getPoints(40));
        const mat = new THREE.LineBasicMaterial({ color: P.goldWarm, transparent: true, opacity: 0.85, depthTest: false });
        const line = new THREE.Line(geom, mat); line.renderOrder = 3;
        g.add(line);
        loveThreadRef.current.push(line);
      });
    }

    // ---- CONSTELLATION — minimum spanning tree lines ----
    constellationRef.current.forEach(l => { g.remove(l); l.geometry?.dispose(); l.material?.dispose(); });
    constellationRef.current = [];
    if (showConstellation) {
      constellationData.forEach(({ from, to }) => {
        const f = ll2v(from.lat, from.lng, RAD * 1.035);
        const t = ll2v(to.lat, to.lng, RAD * 1.035);
        const geom = new THREE.BufferGeometry().setFromPoints([f, t]);
        const mat = new THREE.LineBasicMaterial({ color: isMyWorld ? "#d4a87c" : "#b8c8f0", transparent: true, opacity: 0.70, depthTest: false });
        const line = new THREE.Line(geom, mat); line.renderOrder = 1;
        g.add(line);
        constellationRef.current.push(line);
      });
    }

    // ---- TRAVEL ROUTES — animated arcs between sequential entries ----
    routesRef.current.forEach(r => { if (r.line) { g.remove(r.line); r.line.geometry?.dispose(); r.line.material?.dispose(); } if (r.glow) { g.remove(r.glow); r.glow.geometry?.dispose(); r.glow.material?.dispose(); } });
    routesRef.current = [];
    if (showRoutes || isPlaying) {
      const routeColor = isMyWorld ? "#a0c0a0" : P.sky;
      const glowColor = isMyWorld ? "#688c5c" : P.skySoft;
      routeData.forEach(({ from, to }, idx) => {
        const f = ll2v(from.lat, from.lng, RAD * 1.025);
        const t = ll2v(to.lat, to.lng, RAD * 1.025);
        const dist = f.distanceTo(t);
        const mid = f.clone().add(t).multiplyScalar(0.5);
        const arcHeight = RAD * 1.04 + dist * 0.25 + Math.min(dist * 0.15, 0.3);
        mid.normalize().multiplyScalar(arcHeight);
        const curve = new THREE.QuadraticBezierCurve3(f, mid, t);
        const pts = curve.getPoints(48);
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineDashedMaterial({ color: routeColor, transparent: true, opacity: 0.7, dashSize: 0.018, gapSize: 0.012, depthTest: false });
        const line = new THREE.Line(geom, mat);
        line.computeLineDistances();
        line.renderOrder = 2;
        g.add(line);
        const glowGeom = new THREE.BufferGeometry().setFromPoints(pts);
        const glowMat = new THREE.LineBasicMaterial({ color: glowColor, transparent: true, opacity: 0.15, depthTest: false });
        const glowLine = new THREE.Line(glowGeom, glowMat);
        glowLine.renderOrder = 1;
        g.add(glowLine);
        routesRef.current.push({ line, glow: glowLine, idx, dist });
      });
    }

    // ---- CLUSTER HALOS — soft glow spheres where entries cluster together ----
    {
      const clusterThreshold = 5; // degrees lat/lng
      const clusters = [];
      locationGroups.forEach(loc => {
        const existing = clusters.find(c =>
          Math.abs(c.lat - loc.lat) < clusterThreshold &&
          Math.abs(c.lng - loc.lng) < clusterThreshold
        );
        if (existing) {
          existing.locs.push(loc);
          existing.lat = existing.locs.reduce((s, l) => s + l.lat, 0) / existing.locs.length;
          existing.lng = existing.locs.reduce((s, l) => s + l.lng, 0) / existing.locs.length;
        } else {
          clusters.push({ lat: loc.lat, lng: loc.lng, locs: [loc] });
        }
      });
      clusters.filter(c => c.locs.length >= 2).forEach(cluster => {
        const entryCount = cluster.locs.reduce((s, l) => s + l.entries.length, 0);
        const typeColors = cluster.locs.map(l => {
          const t = l.entries[0]?.type;
          const info = TYPES[t];
          return info ? (P[info.color] || info.color || P.textFaint) : P.textFaint;
        });
        const avgColor = typeColors[0] || P.textFaint;
        const size = 0.04 + Math.min(entryCount, 10) * 0.008;
        const opacity = 0.08 + Math.min(entryCount, 10) * 0.007;
        const pos = ll2v(cluster.lat, cluster.lng, RAD * 1.01);
        const haloGeo = new THREE.SphereGeometry(size, 16, 16);
        const haloMat = new THREE.MeshBasicMaterial({
          color: avgColor, transparent: true, opacity: Math.min(opacity, 0.15),
          side: THREE.FrontSide, depthTest: true, blending: THREE.AdditiveBlending,
        });
        const haloMesh = new THREE.Mesh(haloGeo, haloMat);
        haloMesh.position.copy(pos);
        haloMesh.renderOrder = -1;
        g.add(haloMesh);
        mkRef.current.push({ entryId: `cluster-halo-${cluster.lat.toFixed(1)}-${cluster.lng.toFixed(1)}`, dot: haloMesh, glow: null, ring: null, entryType: 'cluster' });
      });
    }

    // ---- DREAM DESTINATIONS — ethereal ghost markers ----
    (config.dreamDestinations || []).forEach(dream => {
      mkRef.current.push(makeDot(g, dream.lat, dream.lng, P.goldWarm, 0.016, `dream-${dream.id}`, true, "dream"));
    });

    // ---- LOVE LETTERS / NOTES — hidden markers scattered on globe (all world types) ----
    (config.loveLetters || []).forEach(letter => {
      mkRef.current.push(makeDot(g, letter.lat, letter.lng, "#e8a878", 0.018, `love-${letter.id}`, false, "love-letter"));
    });

    // ---- TIME CAPSULES — golden sealed/opened markers ----
    const today = new Date().toISOString().slice(0, 10);
    (config.timeCapsules || []).forEach(capsule => {
      const isSealed = capsule.unlockDate > today;
      const color = isSealed ? "#c8a860" : "#d4b870";
      const symbol = isSealed ? "capsule-sealed" : "capsule-opened";
      mkRef.current.push(makeDot(g, capsule.lat, capsule.lng, color, 0.020, `capsule-${capsule.id}`, false, symbol));
    });
  }, [sliderDate, getPositions, areTogether, locationGroups, sceneReady, showLoveThread, loveThreadData, showConstellation, constellationData, showRoutes, isPlaying, routeData, config.dreamDestinations, config.loveLetters, config.timeCapsules, isPartnerWorld, isMyWorld]);

  // ---- TRIP ROUTE for selected entry (separate effect to avoid full marker rebuild on click) ----
  const tripRouteRef = useRef([]);
  const tripStopMkRef = useRef([]);
  useEffect(() => {
    const g = globeRef.current; if (!g || !sceneReady) return;
    tripRouteRef.current.forEach(r => { g.remove(r); r.geometry?.dispose(); r.material?.dispose(); });
    tripRouteRef.current = [];
    tripStopMkRef.current.forEach(m => { [m.dot, m.ring, m.glow].forEach(o => { if (!o) return; g.remove(o); if (o.material?.map) o.material.map.dispose(); o.geometry?.dispose(); o.material?.dispose(); }); });
    tripStopMkRef.current = [];
    if (!selected || !(selected.stops || []).length) return;
    const allPts = [{ lat: selected.lat, lng: selected.lng }, ...selected.stops];
    selected.stops.forEach(s => {
      const mk = makeDot(g, s.lat, s.lng, P.sage, 0.01, `${selected.id}-${s.sid}`);
      tripStopMkRef.current.push(mk);
      mkRef.current.push(mk);
    });
    for (let i = 0; i < allPts.length - 1; i++) {
      const from = ll2v(allPts[i].lat, allPts[i].lng, RAD * 1.005);
      const to = ll2v(allPts[i + 1].lat, allPts[i + 1].lng, RAD * 1.005);
      const mid = from.clone().add(to).multiplyScalar(0.5);
      mid.normalize().multiplyScalar(RAD + from.distanceTo(to) * 0.2);
      const lG = new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(from, mid, to).getPoints(40));
      const lM = new THREE.LineDashedMaterial({ color: P.sage, transparent: true, opacity: 0.35, dashSize: 0.015, gapSize: 0.008 });
      const line = new THREE.Line(lG, lM); line.computeLineDistances(); line.renderOrder = 3;
      g.add(line); tripRouteRef.current.push(line);
    }
  }, [selected, sceneReady]);

  return { locationGroups };
}
