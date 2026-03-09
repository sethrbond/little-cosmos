import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* =================================================================
   PhotoMap — flat equirectangular map with photos pinned at locations
   Full-screen overlay, all inline styles, no external deps
   ================================================================= */

// Simplified world continent outlines as SVG path data (equirectangular projection)
// Coordinates are in [lng, lat] normalized to 0-1 range where (0,0) is top-left
// lng: -180..180 -> 0..1, lat: 90..-90 -> 0..1
const CONTINENT_PATHS = [
  // North America
  "M 0.075,0.18 L 0.085,0.15 0.12,0.12 0.15,0.11 0.17,0.13 0.19,0.12 0.21,0.14 0.22,0.17 0.24,0.19 0.26,0.2 0.27,0.22 0.28,0.25 0.29,0.27 0.3,0.3 0.29,0.32 0.28,0.35 0.26,0.37 0.24,0.38 0.22,0.4 0.2,0.42 0.19,0.44 0.18,0.47 0.17,0.49 0.16,0.5 0.15,0.52 0.14,0.53 0.13,0.52 0.12,0.5 0.11,0.47 0.1,0.45 0.09,0.42 0.085,0.4 0.08,0.37 0.075,0.34 0.07,0.31 0.065,0.28 0.06,0.25 0.065,0.22 0.07,0.2 Z",
  // South America
  "M 0.18,0.53 L 0.2,0.52 0.22,0.53 0.24,0.55 0.25,0.58 0.26,0.6 0.265,0.63 0.27,0.66 0.265,0.69 0.26,0.72 0.25,0.75 0.24,0.78 0.22,0.8 0.2,0.82 0.19,0.84 0.18,0.86 0.175,0.88 0.17,0.85 0.165,0.82 0.16,0.79 0.155,0.76 0.15,0.73 0.15,0.7 0.155,0.67 0.16,0.64 0.165,0.61 0.17,0.58 0.175,0.55 Z",
  // Europe
  "M 0.47,0.15 L 0.48,0.14 0.5,0.13 0.52,0.14 0.54,0.15 0.55,0.17 0.56,0.19 0.555,0.21 0.55,0.23 0.545,0.25 0.54,0.27 0.535,0.29 0.52,0.3 0.51,0.31 0.5,0.32 0.49,0.33 0.48,0.34 0.47,0.33 0.46,0.31 0.455,0.29 0.45,0.27 0.455,0.25 0.46,0.23 0.465,0.21 0.465,0.19 0.47,0.17 Z",
  // Africa
  "M 0.45,0.34 L 0.47,0.33 0.49,0.34 0.51,0.35 0.53,0.37 0.55,0.39 0.56,0.42 0.565,0.45 0.57,0.48 0.565,0.51 0.56,0.54 0.555,0.57 0.55,0.6 0.545,0.63 0.54,0.66 0.53,0.68 0.52,0.69 0.51,0.68 0.5,0.66 0.49,0.64 0.48,0.62 0.47,0.6 0.465,0.57 0.46,0.54 0.455,0.51 0.45,0.48 0.445,0.45 0.44,0.42 0.44,0.39 0.445,0.37 0.45,0.35 Z",
  // Asia
  "M 0.56,0.13 L 0.58,0.12 0.6,0.11 0.63,0.1 0.66,0.11 0.69,0.12 0.72,0.13 0.75,0.14 0.78,0.15 0.8,0.17 0.82,0.19 0.83,0.21 0.84,0.23 0.845,0.25 0.84,0.27 0.835,0.29 0.83,0.31 0.82,0.33 0.8,0.35 0.78,0.37 0.76,0.38 0.74,0.39 0.72,0.4 0.7,0.41 0.68,0.42 0.66,0.43 0.64,0.44 0.62,0.43 0.6,0.42 0.58,0.4 0.57,0.38 0.565,0.35 0.56,0.32 0.555,0.29 0.555,0.26 0.555,0.23 0.555,0.2 0.555,0.17 0.555,0.15 Z",
  // Australia
  "M 0.77,0.58 L 0.79,0.57 0.81,0.57 0.83,0.58 0.85,0.59 0.865,0.61 0.87,0.63 0.865,0.65 0.86,0.67 0.85,0.69 0.84,0.7 0.82,0.71 0.8,0.71 0.78,0.7 0.77,0.69 0.76,0.67 0.755,0.65 0.755,0.63 0.76,0.61 0.765,0.59 Z",
  // Greenland
  "M 0.28,0.08 L 0.3,0.07 0.32,0.07 0.34,0.08 0.35,0.1 0.345,0.12 0.34,0.14 0.33,0.15 0.31,0.15 0.29,0.14 0.28,0.12 0.275,0.1 Z",
];

// Grid lines for lat/lng
const GRID_LATS = [-60, -30, 0, 30, 60];
const GRID_LNGS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];

function lngToX(lng) { return (lng + 180) / 360; }
function latToY(lat) { return (90 - lat) / 180; }

const PIN_SIZE = 40;
const CLUSTER_DIST = 30;

export default function PhotoMap({ entries = [], palette, onClose, worldMode }) {
  const P = palette || {};
  const accent = P.rose || "#c48aa8";
  const bg = "#0d0d1a";
  const cardBg = P.card || "rgba(252,249,246,0.96)";
  const textColor = P.text || "#2e2440";
  const textMuted = P.textMuted || "#8878a0";

  const containerRef = useRef(null);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { entry, photoIdx }
  const [mapSize, setMapSize] = useState({ w: 1200, h: 600 });

  // Measure container
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        // Map takes up most of the overlay, leave room for stats bar
        setMapSize({ w: r.width, h: r.height - 56 });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Filter entries with photos and valid coords
  const photoEntries = useMemo(() =>
    entries.filter(e => (e.photos || []).length > 0 && e.lat != null && e.lng != null),
    [entries]
  );

  const totalPhotos = useMemo(() =>
    photoEntries.reduce((s, e) => s + (e.photos || []).length, 0),
    [photoEntries]
  );

  // Convert entries to pin positions
  const pins = useMemo(() =>
    photoEntries.map(e => ({
      entry: e,
      x: lngToX(e.lng) * mapSize.w,
      y: latToY(e.lat) * mapSize.h,
    })),
    [photoEntries, mapSize]
  );

  // Cluster pins that overlap
  const clusters = useMemo(() => {
    const used = new Set();
    const result = [];
    const threshold = CLUSTER_DIST / zoom;

    for (let i = 0; i < pins.length; i++) {
      if (used.has(i)) continue;
      const cluster = [pins[i]];
      used.add(i);
      for (let j = i + 1; j < pins.length; j++) {
        if (used.has(j)) continue;
        const dx = pins[i].x - pins[j].x;
        const dy = pins[i].y - pins[j].y;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          cluster.push(pins[j]);
          used.add(j);
        }
      }
      // Cluster center is average position
      const cx = cluster.reduce((s, p) => s + p.x, 0) / cluster.length;
      const cy = cluster.reduce((s, p) => s + p.y, 0) / cluster.length;
      result.push({ pins: cluster, x: cx, y: cy, count: cluster.length });
    }
    return result;
  }, [pins, zoom]);

  // Pan & zoom transforms
  const transform = useCallback((x, y) => ({
    x: x * zoom + pan.x,
    y: y * zoom + pan.y,
  }), [zoom, pan]);

  // Dragging handlers
  const onPointerDown = useCallback((e) => {
    if (e.target.closest("[data-pin]") || e.target.closest("[data-control]")) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
  }, [pan]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({ x: panStart.current.x + dx, y: panStart.current.y + dy });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const zoomIn = useCallback(() => {
    setZoom(z => Math.min(z * 1.5, 8));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(z => {
      const nz = Math.max(z / 1.5, 1);
      if (nz === 1) setPan({ x: 0, y: 0 });
      return nz;
    });
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const onClusterClick = useCallback((cluster) => {
    if (cluster.count === 1) {
      setLightbox({ entry: cluster.pins[0].entry, photoIdx: 0 });
    } else {
      // Zoom into the cluster area
      const newZoom = Math.min(zoom * 2.5, 8);
      const cx = cluster.x;
      const cy = cluster.y;
      const containerW = mapSize.w;
      const containerH = mapSize.h;
      setPan({
        x: containerW / 2 - cx * newZoom,
        y: containerH / 2 - cy * newZoom,
      });
      setZoom(newZoom);
    }
  }, [zoom, mapSize]);

  // Wheel zoom
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 / 1.15 : 1.15;
    setZoom(z => {
      const nz = Math.max(1, Math.min(z * delta, 8));
      if (nz === 1) setPan({ x: 0, y: 0 });
      return nz;
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // Keyboard
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        if (lightbox) setLightbox(null);
        else onClose?.();
      }
      if (lightbox) {
        const photos = lightbox.entry.photos || [];
        if (e.key === "ArrowRight") setLightbox(lb => ({ ...lb, photoIdx: (lb.photoIdx + 1) % photos.length }));
        if (e.key === "ArrowLeft") setLightbox(lb => ({ ...lb, photoIdx: (lb.photoIdx - 1 + photos.length) % photos.length }));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightbox, onClose]);

  // --- Render ---

  const renderGrid = () => {
    const lines = [];
    GRID_LATS.forEach(lat => {
      const y = latToY(lat) * mapSize.h;
      lines.push(
        <line key={`lat${lat}`} x1={0} y1={y} x2={mapSize.w} y2={y}
          stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      );
      lines.push(
        <text key={`latL${lat}`} x={4} y={y - 3} fill="rgba(255,255,255,0.15)" fontSize={9} fontFamily="monospace">
          {Math.abs(lat)}{lat >= 0 ? "N" : "S"}
        </text>
      );
    });
    GRID_LNGS.forEach(lng => {
      const x = lngToX(lng) * mapSize.w;
      lines.push(
        <line key={`lng${lng}`} x1={x} y1={0} x2={x} y2={mapSize.h}
          stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      );
      lines.push(
        <text key={`lngL${lng}`} x={x + 3} y={mapSize.h - 4} fill="rgba(255,255,255,0.15)" fontSize={9} fontFamily="monospace">
          {Math.abs(lng)}{lng >= 0 ? "E" : "W"}
        </text>
      );
    });
    return lines;
  };

  const renderContinents = () =>
    CONTINENT_PATHS.map((d, i) => (
      <path key={i} d={d}
        fill="rgba(255,255,255,0.05)"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={1}
        transform={`scale(${mapSize.w}, ${mapSize.h})`}
        vectorEffect="non-scaling-stroke"
      />
    ));

  const renderPins = () =>
    clusters.map((cluster, ci) => {
      const pos = transform(cluster.x, cluster.y);
      const isCluster = cluster.count > 1;
      const isHov = hovered === ci;
      const size = isCluster ? PIN_SIZE + 8 : PIN_SIZE;
      const displaySize = isHov ? size * 1.2 : size;
      const entry = cluster.pins[0].entry;
      const photoUrl = (entry.photos || [])[0];
      const totalInCluster = cluster.pins.reduce((s, p) => s + (p.entry.photos || []).length, 0);

      return (
        <div
          key={ci}
          data-pin="true"
          onMouseEnter={() => setHovered(ci)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onClusterClick(cluster)}
          style={{
            position: "absolute",
            left: pos.x - displaySize / 2,
            top: pos.y - displaySize / 2,
            width: displaySize,
            height: displaySize,
            borderRadius: "50%",
            border: `2.5px solid ${accent}`,
            overflow: "hidden",
            cursor: "pointer",
            transition: "all 0.25s cubic-bezier(.4,0,.2,1)",
            boxShadow: isHov
              ? `0 0 18px 4px ${accent}88, 0 0 40px 8px ${accent}44`
              : `0 0 10px 2px ${accent}44`,
            zIndex: isHov ? 20 : 10,
            background: bg,
          }}
        >
          {photoUrl && (
            <img
              src={photoUrl}
              alt={entry.city || ""}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                filter: isCluster ? "brightness(0.7)" : "none",
                transition: "filter 0.2s",
              }}
              draggable={false}
            />
          )}
          {isCluster && (
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              textShadow: "0 1px 4px rgba(0,0,0,0.7)",
              letterSpacing: 0.5,
            }}>
              {cluster.count}
            </div>
          )}
          {/* Tooltip */}
          {isHov && !isCluster && (
            <div style={{
              position: "absolute",
              bottom: displaySize + 6,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.85)",
              color: "#fff",
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              zIndex: 30,
            }}>
              {entry.city}{entry.country ? `, ${entry.country}` : ""}
            </div>
          )}
          {isHov && isCluster && (
            <div style={{
              position: "absolute",
              bottom: displaySize + 6,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.85)",
              color: "#fff",
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              zIndex: 30,
            }}>
              {cluster.count} locations &middot; {totalInCluster} photos
            </div>
          )}
        </div>
      );
    });

  const renderLightbox = () => {
    if (!lightbox) return null;
    const { entry, photoIdx } = lightbox;
    const photos = entry.photos || [];
    if (photos.length === 0) return null;
    const idx = ((photoIdx % photos.length) + photos.length) % photos.length;

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(0,0,0,0.88)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          animation: "photomap-fadein 0.25s ease",
        }}
        onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null); }}
      >
        {/* Header info */}
        <div style={{
          position: "absolute",
          top: 24,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#fff",
          zIndex: 1001,
        }}>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
            {entry.city}{entry.country ? `, ${entry.country}` : ""}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
            {entry.dateStart || ""}{entry.dateEnd && entry.dateEnd !== entry.dateStart ? ` — ${entry.dateEnd}` : ""}
            {photos.length > 1 && <span style={{ marginLeft: 12 }}>{idx + 1} / {photos.length}</span>}
          </div>
        </div>

        {/* Close */}
        <button
          onClick={() => setLightbox(null)}
          style={{
            position: "absolute",
            top: 16,
            right: 20,
            background: "none",
            border: "none",
            color: "#fff",
            fontSize: 28,
            cursor: "pointer",
            zIndex: 1002,
            padding: "4px 8px",
            lineHeight: 1,
            opacity: 0.7,
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = "1"}
          onMouseLeave={e => e.currentTarget.style.opacity = "0.7"}
        >
          &times;
        </button>

        {/* Photo */}
        <img
          src={photos[idx]}
          alt={entry.city || "Photo"}
          style={{
            maxWidth: "85vw",
            maxHeight: "75vh",
            borderRadius: 10,
            boxShadow: `0 0 40px 8px ${accent}33`,
            objectFit: "contain",
          }}
          draggable={false}
        />

        {/* Navigation arrows */}
        {photos.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setLightbox(lb => ({ ...lb, photoIdx: idx - 1 })); }}
              style={{
                position: "absolute",
                left: 20,
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(255,255,255,0.12)",
                border: "none",
                color: "#fff",
                fontSize: 32,
                cursor: "pointer",
                borderRadius: "50%",
                width: 48,
                height: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s",
                zIndex: 1001,
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.25)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
            >
              &#8249;
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setLightbox(lb => ({ ...lb, photoIdx: idx + 1 })); }}
              style={{
                position: "absolute",
                right: 20,
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(255,255,255,0.12)",
                border: "none",
                color: "#fff",
                fontSize: 32,
                cursor: "pointer",
                borderRadius: "50%",
                width: 48,
                height: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s",
                zIndex: 1001,
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.25)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
            >
              &#8250;
            </button>
          </>
        )}

        {/* Dots */}
        {photos.length > 1 && photos.length <= 20 && (
          <div style={{
            display: "flex",
            gap: 6,
            marginTop: 16,
          }}>
            {photos.map((_, i) => (
              <div
                key={i}
                onClick={(e) => { e.stopPropagation(); setLightbox(lb => ({ ...lb, photoIdx: i })); }}
                style={{
                  width: i === idx ? 10 : 7,
                  height: i === idx ? 10 : 7,
                  borderRadius: "50%",
                  background: i === idx ? accent : "rgba(255,255,255,0.35)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const btnStyle = (extra) => ({
    background: "rgba(255,255,255,0.1)",
    border: `1px solid rgba(255,255,255,0.15)`,
    color: "#fff",
    width: 36,
    height: 36,
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
    backdropFilter: "blur(8px)",
    ...extra,
  });

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 900,
      background: bg,
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Inline keyframes */}
      <style>{`
        @keyframes photomap-fadein {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes photomap-slidein {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Stats bar */}
      <div style={{
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
        animation: "photomap-slidein 0.3s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18, opacity: 0.7 }}>&#128247;</span>
          <span style={{ color: "#fff", fontSize: 14, fontWeight: 500 }}>
            <span style={{ color: accent, fontWeight: 700 }}>{totalPhotos}</span>
            {" "}photo{totalPhotos !== 1 ? "s" : ""} across{" "}
            <span style={{ color: accent, fontWeight: 700 }}>{photoEntries.length}</span>
            {" "}location{photoEntries.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginRight: 4 }}>
            {zoom > 1 ? `${zoom.toFixed(1)}x` : ""}
          </span>
          <button onClick={onClose} style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.6)",
            fontSize: 13,
            cursor: "pointer",
            padding: "6px 14px",
            borderRadius: 6,
            transition: "all 0.2s",
            fontWeight: 500,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; e.currentTarget.style.background = "none"; }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Map area */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          cursor: dragging.current ? "grabbing" : "grab",
          userSelect: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* SVG map */}
        <svg
          width={mapSize.w}
          height={mapSize.h}
          style={{
            position: "absolute",
            left: pan.x,
            top: pan.y,
            transform: `scale(${zoom})`,
            transformOrigin: "0 0",
            transition: dragging.current ? "none" : "transform 0.3s cubic-bezier(.4,0,.2,1)",
          }}
        >
          {/* Background water */}
          <rect width={mapSize.w} height={mapSize.h} fill="transparent" />
          {/* Grid */}
          {renderGrid()}
          {/* Continents */}
          {renderContinents()}
          {/* Equator highlight */}
          <line
            x1={0} y1={mapSize.h / 2} x2={mapSize.w} y2={mapSize.h / 2}
            stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="6,4"
          />
          {/* Prime meridian highlight */}
          <line
            x1={mapSize.w / 2} y1={0} x2={mapSize.w / 2} y2={mapSize.h}
            stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="6,4"
          />
        </svg>

        {/* Photo pins (rendered as HTML for image support) */}
        <div style={{
          position: "absolute",
          left: pan.x,
          top: pan.y,
          width: mapSize.w,
          height: mapSize.h,
          transform: `scale(${zoom})`,
          transformOrigin: "0 0",
          transition: dragging.current ? "none" : "transform 0.3s cubic-bezier(.4,0,.2,1)",
          pointerEvents: "none",
        }}>
          <div style={{ position: "relative", width: "100%", height: "100%", pointerEvents: "auto" }}>
            {renderPins()}
          </div>
        </div>

        {/* Controls */}
        <div data-control="true" style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          zIndex: 50,
        }}>
          <button
            data-control="true"
            onClick={zoomIn}
            style={btnStyle()}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
            title="Zoom in"
          >+</button>
          <button
            data-control="true"
            onClick={zoomOut}
            style={btnStyle()}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
            title="Zoom out"
          >&minus;</button>
          <button
            data-control="true"
            onClick={resetView}
            style={btnStyle({ fontSize: 13, fontWeight: 600 })}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
            title="Reset view"
          >&#8634;</button>
        </div>

        {/* Empty state */}
        {photoEntries.length === 0 && (
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.4)",
            gap: 12,
          }}>
            <span style={{ fontSize: 40, opacity: 0.5 }}>&#128247;</span>
            <span style={{ fontSize: 16, fontWeight: 500 }}>No photos yet</span>
            <span style={{ fontSize: 13, opacity: 0.6 }}>Add photos to your entries to see them on the map</span>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {renderLightbox()}
    </div>
  );
}
