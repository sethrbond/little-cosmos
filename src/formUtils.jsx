import { useState } from "react";
import { getP } from "./cosmosGetP.js";

// Shared font family — import this instead of duplicating the string
export const FONT_FAMILY = "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif";

// ---- STAR RATING PICKER ----
export function StarRating({ value, onChange, size = 18 }) {
  const P = getP();
  return (
    <span style={{ display: "inline-flex", gap: 2, cursor: "pointer" }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          role="button"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(value === n ? null : n)}
          style={{ fontSize: size, color: n <= (value || 0) ? "#c9a96e" : (P.textFaint || "#666") + "60", transition: "color .15s", userSelect: "none", lineHeight: 1 }}
        >{n <= (value || 0) ? "\u2605" : "\u2606"}</span>
      ))}
    </span>
  );
}

// ---- DRAFT DETECTION ----

export function hasDraft(draftKey) {
  if (!draftKey) return false;
  try {
    const saved = localStorage.getItem(draftKey);
    if (!saved) return false;
    const parsed = JSON.parse(saved);
    return !!(parsed.city || parsed.notes || parsed.dateStart);
  } catch { return false; }
}

export function getDraftSummary(draftKey) {
  if (!draftKey) return null;
  try {
    const saved = localStorage.getItem(draftKey);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (!(parsed.city || parsed.notes || parsed.dateStart)) return null;
    return { city: parsed.city || "", dateStart: parsed.dateStart || "" };
  } catch { return null; }
}

// ---- STYLE FUNCTIONS ----

export function inputStyle(p) {
  const P = p || getP();
  return { width: "100%", padding: "10px 14px", border: `1px solid ${P.textFaint}25`, borderRadius: 10, fontSize: 13, fontFamily: "'Palatino Linotype',Palatino,Georgia,serif", color: P.text, background: P.cream, boxSizing: "border-box", transition: "border-color .2s, box-shadow .2s", outline: "none" };
}

export function navStyle(p) {
  const P = p || getP();
  return { background: "none", border: `1px solid ${P.textFaint}25`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 11, color: P.textMid, fontFamily: "inherit", transition: "all .25s ease", minHeight: 44 };
}

export function imageNavBtn(s) {
  return { position: "absolute", [s]: 5, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,.7)", border: "none", borderRadius: "50%", width: 44, height: 44, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" };
}

export function renderList(t, items, icon, color, onRemove) {
  const P = getP();
  if (!items?.length) return null;
  return <div style={{ marginTop: 10 }}><div style={{ fontSize: 10, color: P.textFaint, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 6 }}>{t}</div>{items.map((it, i) => <div key={it.slice(0, 20) + '-' + i} style={{ display: "flex", gap: 7, marginBottom: 5, padding: "4px 8px", background: `${color}08`, borderRadius: 6, borderLeft: `2px solid ${color}25`, alignItems: "center" }}><span style={{ color, fontSize: 9, flexShrink: 0 }}>{icon}</span><span style={{ flex: 1, fontSize: 11, color: P.textMid, lineHeight: 1.6, fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif" }}>{it}</span>{onRemove && <button onClick={() => onRemove(i)} style={{ background: "none", border: "none", color: P.textFaint, fontSize: 12, cursor: "pointer", padding: "4px 6px", lineHeight: 1, opacity: 0.4, transition: "opacity .15s" }} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.4"}>×</button>}</div>)}</div>;
}
