import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { ll2v, makeSymbolTexture, RAD } from "./globeUtils.js";

/**
 * useGlobeMarkers — extracted from OurWorld.jsx
 *
 * Handles marker/overlay rendering on the globe:
 *   - makeDot helper (Three.js marker meshes)
 *   - locationGroups useMemo (groups entries by lat/lng)
 *   - Marker rebuild useEffect (entry markers, person dots, heart, distance line,
 *     love thread, constellation, travel routes, dream destinations, love letters)
 *   - Trip route useEffect (for selected entry)
 *
 * @param {object} deps — state, refs, and derived data from OurWorld
 * @returns {{ locationGroups: Array }}
 */
export function useGlobeMarkers(deps) {
  const {
    // Refs (mutable)
    globeRef,
    mkRef,
    rtRef,
    heartRef,
    loveThreadRef,
    constellationRef,
    routesRef,
    // State / derived
    data,
    sceneReady,
    sliderDate,
    getPositions,
    areTogether,
    isPartnerWorld,
    isMyWorld,
    showLoveThread,
    loveThreadData,
    showConstellation,
    constellationData,
    showRoutes,
    isPlaying,
    routeData,
    config,
    selected,
    TYPES,
    P,
  } = deps;

  // ---- MARKER HELPER ----
  function makeDot(group, lat, lng, color, size, id, faint = false, symbolType = null) {
    const p = ll2v(lat, lng, RAD * 1.012);
    if (symbolType) {
      const tex = makeSymbolTexture(symbolType, color);
      const sz = size * 7;
      const dot = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, depthTest: true }));
      dot.position.copy(p); dot.lookAt(p.clone().multiplyScalar(2)); dot.userData = { entryId: id }; dot.renderOrder = 2; group.add(dot);
      return { entryId: id, dot, ring: null, glow: null };
    }
    const dotOp = faint ? 0.28 : 0.85;
    const dot = new THREE.Mesh(new THREE.CircleGeometry(size, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: dotOp, side: THREE.DoubleSide, depthTest: true }));
    dot.material._baseOpacity = dotOp;
    dot.position.copy(p); dot.lookAt(p.clone().multiplyScalar(2)); dot.userData = { entryId: id }; dot.renderOrder = 2; group.add(dot);
    const glowOp = faint ? 0.04 : 0.10;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(size * (faint ? 1.4 : 2.0), 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: glowOp, side: THREE.DoubleSide, depthTest: true }));
    glow.material._baseOpacity = glowOp;
    glow.position.copy(p); glow.lookAt(p.clone().multiplyScalar(2)); glow.renderOrder = 0; group.add(glow);
    return { entryId: id, dot, ring: null, glow };
  }

  // ---- LOCATION GROUPS — group entries by lat/lng ----
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

    // ---- DREAM DESTINATIONS — ethereal ghost markers ----
    (config.dreamDestinations || []).forEach(dream => {
      mkRef.current.push(makeDot(g, dream.lat, dream.lng, P.goldWarm, 0.016, `dream-${dream.id}`, true, "dream"));
    });

    // ---- LOVE LETTERS — hidden flower markers scattered on globe ---- (partner only)
    if (isPartnerWorld) {
      (config.loveLetters || []).forEach(letter => {
        mkRef.current.push(makeDot(g, letter.lat, letter.lng, "#e8a878", 0.018, `love-${letter.id}`, false, "love-letter"));
      });
    }
  }, [sliderDate, getPositions, areTogether, locationGroups, sceneReady, showLoveThread, loveThreadData, showConstellation, constellationData, showRoutes, isPlaying, routeData, config.dreamDestinations, config.loveLetters, isPartnerWorld, isMyWorld]);

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
