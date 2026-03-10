import { useState, useEffect, useRef, useCallback } from "react";
import { OUR_WORLD_TYPES, MY_WORLD_TYPES, FRIENDS_TYPES, FAMILY_TYPES } from "./worldConfigs.js";

/* =================================================================
   TripCard — shareable Instagram-style card for a single trip entry
   Renders a beautiful preview modal with download (Canvas API) & copy
   ================================================================= */

// ---- helpers ----

function formatDateRange(dateStart, dateEnd) {
  if (!dateStart) return "";
  const opts = { month: "short", day: "numeric" };
  const optsY = { month: "short", day: "numeric", year: "numeric" };
  const s = new Date(dateStart + "T12:00:00");
  if (!dateEnd || dateEnd === dateStart) return s.toLocaleDateString("en-US", optsY);
  const e = new Date(dateEnd + "T12:00:00");
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.toLocaleDateString("en-US", opts)} - ${e.getDate()}, ${e.getFullYear()}`;
  }
  if (s.getFullYear() === e.getFullYear()) {
    return `${s.toLocaleDateString("en-US", opts)} - ${e.toLocaleDateString("en-US", optsY)}`;
  }
  return `${s.toLocaleDateString("en-US", optsY)} - ${e.toLocaleDateString("en-US", optsY)}`;
}

function dayCount(dateStart, dateEnd) {
  if (!dateStart || !dateEnd) return dateStart ? 1 : 0;
  const ms = new Date(dateEnd + "T12:00:00") - new Date(dateStart + "T12:00:00");
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

function resolveTypeInfo(type, worldMode) {
  const maps = {
    our: OUR_WORLD_TYPES,
    my: MY_WORLD_TYPES,
    friends: FRIENDS_TYPES,
    family: FAMILY_TYPES,
  };
  const types = maps[worldMode] || maps.my;
  return types[type] || { label: type || "Trip", icon: "\u{1F30D}" };
}

// hex to rgb helper
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbStr(r, g, b, a = 1) {
  return a < 1 ? `rgba(${r},${g},${b},${a})` : `rgb(${r},${g},${b})`;
}

// ---- Canvas renderer (pure Canvas API, no html2canvas) ----

function drawTripCard(canvas, entry, palette, worldMode, bgImage) {
  const W = 1080, H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const P = palette;
  const typeInfo = resolveTypeInfo(entry.type, worldMode);
  const dateStr = formatDateRange(entry.dateStart, entry.dateEnd);
  const days = dayCount(entry.dateStart, entry.dateEnd);
  const stops = (entry.stops || []).length;
  const photoCount = (entry.photos || []).length;

  // -- Background --
  if (bgImage) {
    // Draw photo filling card, then dark overlay
    const iw = bgImage.width, ih = bgImage.height;
    const scale = Math.max(W / iw, H / ih);
    const sw = iw * scale, sh = ih * scale;
    ctx.drawImage(bgImage, (W - sw) / 2, (H - sh) / 2, sw, sh);
    // dark gradient overlay
    const ov = ctx.createLinearGradient(0, 0, 0, H);
    ov.addColorStop(0, "rgba(0,0,0,0.25)");
    ov.addColorStop(0.4, "rgba(0,0,0,0.10)");
    ov.addColorStop(0.7, "rgba(0,0,0,0.45)");
    ov.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = ov;
    ctx.fillRect(0, 0, W, H);
  } else {
    // Gradient background from palette
    const [r1, g1, b1] = hexToRgb(P.text || "#2e2440");
    const [r2, g2, b2] = hexToRgb(P.rose || "#c48aa8");
    const [r3, g3, b3] = hexToRgb(P.sky || "#8ca8c8");
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, rgbStr(r1, g1, b1));
    grad.addColorStop(0.5, rgbStr(r2, g2, b2, 0.85));
    grad.addColorStop(1, rgbStr(r3, g3, b3, 0.7));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // decorative circles
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = P.cream || "#faf7f5";
    ctx.beginPath(); ctx.arc(W * 0.8, H * 0.15, 280, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W * 0.15, H * 0.75, 340, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // star-like dots (seeded positions to prevent flicker on redraw)
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    for (let i = 0; i < 60; i++) {
      const seed = (i * 2654435761 >>> 0) / 4294967296;
      const seed2 = ((i + 37) * 2654435761 >>> 0) / 4294967296;
      const seed3 = ((i + 73) * 2654435761 >>> 0) / 4294967296;
      const sx = seed * W, sy = seed2 * H, sr = seed3 * 2 + 0.5;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }
  }

  const textCol = bgImage ? "#ffffff" : (P.cream || "#faf7f5");
  const subCol = bgImage ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.7)";
  const mutedCol = bgImage ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.55)";

  // -- Top badge: type icon + label --
  const badgeY = 80;
  ctx.font = "600 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = subCol;
  ctx.textAlign = "center";
  ctx.fillText(`${typeInfo.icon}  ${typeInfo.label.toUpperCase()}`, W / 2, badgeY);

  // -- Favorite star --
  if (entry.favorite) {
    ctx.font = "36px serif";
    ctx.fillStyle = P.gold || "#c8a060";
    ctx.textAlign = "right";
    ctx.fillText("\u2605", W - 60, badgeY + 4);
  }

  // -- City --
  ctx.textAlign = "center";
  ctx.font = "bold 72px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = textCol;
  const cityText = entry.city || "Unknown";
  // Shrink if too wide
  let cityFontSize = 72;
  while (ctx.measureText(cityText).width > W - 140 && cityFontSize > 36) {
    cityFontSize -= 2;
    ctx.font = `bold ${cityFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  }
  ctx.fillText(cityText, W / 2, 180);

  // -- Country --
  ctx.font = "400 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = subCol;
  ctx.fillText((entry.country || "").toUpperCase(), W / 2, 228);

  // -- Date range --
  if (dateStr) {
    ctx.font = "300 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = mutedCol;
    ctx.fillText(dateStr, W / 2, 278);
  }

  // -- Divider --
  ctx.strokeStyle = bgImage ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W * 0.2, 310); ctx.lineTo(W * 0.8, 310); ctx.stroke();

  // -- Notes --
  let curY = 360;
  if (entry.notes) {
    ctx.font = "italic 26px Georgia, 'Times New Roman', serif";
    ctx.fillStyle = subCol;
    ctx.textAlign = "center";
    const noteLines = wrapText(ctx, `"${entry.notes}"`, W - 160);
    const maxNoteLines = 4;
    noteLines.slice(0, maxNoteLines).forEach((line, i) => {
      ctx.fillText(line, W / 2, curY + i * 36);
    });
    curY += Math.min(noteLines.length, maxNoteLines) * 36 + 30;
  }

  // -- Memories --
  const memories = (entry.memories || []).filter(Boolean);
  if (memories.length > 0) {
    ctx.font = "600 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = mutedCol;
    ctx.textAlign = "left";
    ctx.fillText("MEMORIES", 80, curY);
    curY += 10;
    ctx.font = "400 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = subCol;
    const maxMem = 4;
    memories.slice(0, maxMem).forEach(m => {
      curY += 34;
      const lines = wrapText(ctx, `\u2022  ${m}`, W - 180);
      lines.slice(0, 2).forEach((line, li) => {
        ctx.fillText(line, 90, curY + li * 30);
      });
      curY += (Math.min(lines.length, 2) - 1) * 30;
    });
    curY += 30;
  }

  // -- Highlights --
  const highlights = (entry.highlights || []).filter(Boolean);
  if (highlights.length > 0 && curY < H - 300) {
    ctx.font = "600 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = mutedCol;
    ctx.textAlign = "left";
    ctx.fillText("HIGHLIGHTS", 80, curY);
    curY += 10;
    ctx.font = "400 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = subCol;
    const maxHl = 3;
    highlights.slice(0, maxHl).forEach(h => {
      curY += 34;
      const lines = wrapText(ctx, `\u2726  ${h}`, W - 180);
      lines.slice(0, 2).forEach((line, li) => {
        ctx.fillText(line, 90, curY + li * 30);
      });
      curY += (Math.min(lines.length, 2) - 1) * 30;
    });
    curY += 20;
  }

  // -- Stats line at bottom --
  const statsY = H - 130;
  ctx.font = "500 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = subCol;
  ctx.textAlign = "center";
  const statParts = [];
  if (days > 0) statParts.push(`${days} day${days !== 1 ? "s" : ""}`);
  if (stops > 0) statParts.push(`${stops} stop${stops !== 1 ? "s" : ""}`);
  if (photoCount > 0) statParts.push(`${photoCount} photo${photoCount !== 1 ? "s" : ""}`);
  if (statParts.length > 0) {
    ctx.fillText(statParts.join("  \u2022  "), W / 2, statsY);
  }

  // -- Watermark --
  ctx.font = "300 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = bgImage ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.3)";
  ctx.textAlign = "center";
  ctx.fillText("\u2728  My Cosmos", W / 2, H - 50);

  // -- Bottom accent line --
  const accentColor = P.rose || "#c48aa8";
  const [ar, ag, ab] = hexToRgb(accentColor);
  ctx.strokeStyle = rgbStr(ar, ag, ab, 0.6);
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(W * 0.3, H - 25); ctx.lineTo(W * 0.7, H - 25); ctx.stroke();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ---- Component ----

export default function TripCard({ entry, palette, onClose, worldMode }) {
  const [visible, setVisible] = useState(false);
  const [bgImage, setBgImage] = useState(null);
  const [bgLoading, setBgLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);

  const P = palette || {};
  const typeInfo = resolveTypeInfo(entry?.type, worldMode);

  // fade in
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // load first photo as background image
  useEffect(() => {
    if (!entry?.photos?.length) return;
    setBgLoading(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { setBgImage(img); setBgLoading(false); };
    img.onerror = () => { setBgImage(null); setBgLoading(false); };
    img.src = entry.photos[0];
  }, [entry?.photos]);

  // draw canvas whenever data is ready
  useEffect(() => {
    if (!canvasRef.current || !entry) return;
    if (bgLoading) return;
    drawTripCard(canvasRef.current, entry, palette || {}, worldMode, bgImage);
  }, [entry, palette, worldMode, bgImage, bgLoading]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(() => onClose?.(), 280);
  }, [onClose]);

  // close on escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose]);

  const handleOverlayClick = useCallback((e) => {
    if (e.target === overlayRef.current) handleClose();
  }, [handleClose]);

  // download
  const handleDownload = useCallback(() => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `${(entry.city || "trip").replace(/\s+/g, "-").toLowerCase()}-tripcard.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }, [entry]);

  // copy text summary
  const handleCopy = useCallback(() => {
    const days = dayCount(entry.dateStart, entry.dateEnd);
    const stops = (entry.stops || []).length;
    const dateStr = formatDateRange(entry.dateStart, entry.dateEnd);
    const lines = [];
    lines.push(`${typeInfo.icon} ${entry.city || "Trip"}${entry.country ? `, ${entry.country}` : ""}`);
    if (dateStr) lines.push(dateStr);
    const statParts = [];
    if (days > 0) statParts.push(`${days} day${days !== 1 ? "s" : ""}`);
    if (stops > 0) statParts.push(`${stops} stop${stops !== 1 ? "s" : ""}`);
    statParts.push(`${(entry.photos || []).length} photos`);
    lines.push(statParts.join(" | "));
    if (entry.notes) lines.push(`"${entry.notes}"`);
    const memories = (entry.memories || []).filter(Boolean);
    if (memories.length) lines.push("Memories: " + memories.join(", "));
    const highlights = (entry.highlights || []).filter(Boolean);
    if (highlights.length) lines.push("Highlights: " + highlights.join(", "));
    lines.push("");
    lines.push("Shared from My Cosmos");
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [entry, typeInfo]);

  if (!entry) return null;

  // --- inline styles ---
  const accent = P.rose || "#c48aa8";
  const accentSoft = P.roseSoft || "#d8a8c0";
  const textColor = P.text || "#2e2440";
  const cardBg = P.card || "rgba(252,249,246,0.96)";

  const overlayStyle = {
    position: "fixed",
    inset: 0,
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    opacity: visible ? 1 : 0,
    transition: "opacity 0.28s ease",
  };

  const modalStyle = {
    position: "relative",
    maxWidth: "min(90vw, 440px)",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    transform: visible ? "scale(1) translateY(0)" : "scale(0.92) translateY(24px)",
    opacity: visible ? 1 : 0,
    transition: "transform 0.32s cubic-bezier(0.16,1,0.3,1), opacity 0.28s ease",
  };

  const canvasStyle = {
    width: "100%",
    maxHeight: "70vh",
    objectFit: "contain",
    borderRadius: 16,
    boxShadow: "0 24px 64px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.2)",
  };

  const btnRow = {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
  };

  const btnBase = {
    padding: "10px 24px",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
    boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
  };

  const downloadBtnStyle = {
    ...btnBase,
    background: accent,
    color: "#fff",
  };

  const copyBtnStyle = {
    ...btnBase,
    background: cardBg,
    color: textColor,
  };

  const closeBtnStyle = {
    position: "absolute",
    top: -12,
    right: -12,
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "none",
    background: "rgba(0,0,0,0.5)",
    color: "#fff",
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(4px)",
    zIndex: 2,
  };

  return (
    <div ref={overlayRef} style={overlayStyle} onClick={handleOverlayClick}>
      <div style={modalStyle}>
        <button style={closeBtnStyle} onClick={handleClose} title="Close">{"\u2715"}</button>
        <canvas ref={canvasRef} style={canvasStyle} />
        <div style={btnRow}>
          <button
            style={downloadBtnStyle}
            onClick={handleDownload}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            {"\u2B07"} Download PNG
          </button>
          <button
            style={copyBtnStyle}
            onClick={handleCopy}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            {copied ? "\u2713 Copied!" : "\u{1F4CB} Copy Text"}
          </button>
        </div>
      </div>
    </div>
  );
}
