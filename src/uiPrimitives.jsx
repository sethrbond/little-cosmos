import { useState, useRef, useEffect } from "react";
import { getP } from "./cosmosGetP.js";
import { inputStyle } from "./formUtils.jsx";

// ---- UI COMPONENTS ----

export function TBtn({ a, onClick, children, accent, tip }) {
  const P = getP();
  const [showTip, setShowTip] = useState(false);
  const [hov, setHov] = useState(false);
  const tipTimer = useRef(null);
  useEffect(() => () => clearTimeout(tipTimer.current), []);
  const onEnter = () => { setHov(true); if (tip) tipTimer.current = setTimeout(() => setShowTip(true), 1500); };
  const onLeave = () => { setHov(false); clearTimeout(tipTimer.current); setShowTip(false); };
  return (
    <div style={{ position: "relative" }} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button onClick={onClick} aria-label={tip} onTouchStart={e => { e.currentTarget.style.opacity = '0.6'; setTimeout(() => { if (e.currentTarget) e.currentTarget.style.opacity = '1'; }, 150); }} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${a ? P.rose + "50" : accent ? P.lavender + "40" : P.textFaint + "20"}`, background: a ? P.card : P.glass, backdropFilter: "blur(12px)", cursor: "pointer", fontSize: accent ? 15 : 14, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .3s ease", fontFamily: "inherit", color: P.text, boxShadow: hov ? `0 4px 16px ${P.text}12, 0 1px 3px ${P.text}08` : `0 1px 4px ${P.text}06`, transform: hov ? "translateY(-1px)" : "none" }}>{children}</button>
      {showTip && tip && (
        <div style={{ position: "absolute", left: 46, top: "50%", transform: "translateY(-50%)", whiteSpace: "nowrap", background: P.card, backdropFilter: "blur(14px)", border: `1px solid ${P.rose}15`, borderRadius: 10, padding: "6px 14px", fontSize: 10, color: P.textMid, boxShadow: `0 4px 20px ${P.text}12, 0 1px 4px ${P.text}06`, pointerEvents: "none", animation: "fadeIn .2s ease", zIndex: 30, letterSpacing: ".05em" }}>{tip}</div>
      )}
    </div>
  );
}

// ---- TOOLBAR GROUP (accordion) ----

export function TBtnGroup({ icon, label, children, badge }) {
  const P = getP();
  const [open, setOpen] = useState(false);
  const [hov, setHov] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        aria-label={label ? `${label} menu` : "More options"}
        aria-expanded={open}
        style={{
          width: 44, height: 44, borderRadius: 12,
          border: `1px solid ${open ? P.rose + "40" : P.textFaint + "20"}`,
          background: open ? P.card : P.glass,
          backdropFilter: "blur(12px)", cursor: "pointer",
          fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all .3s ease", fontFamily: "inherit", color: P.text,
          boxShadow: hov ? `0 4px 16px ${P.text}12, 0 1px 3px ${P.text}08` : `0 1px 4px ${P.text}06`,
          transform: hov ? "translateY(-1px)" : "none",
          position: "relative",
        }}
      >
        {icon}
        {/* Expand indicator */}
        <span style={{ position: "absolute", right: 2, bottom: 2, fontSize: 10, opacity: open ? 0.6 : 0.3, transition: "opacity .2s", lineHeight: 1 }}>›</span>
        {badge && <span style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", background: P.rose, border: `1.5px solid ${P.card}` }} />}
      </button>
      {open && (
        <div style={{
          position: "absolute", left: 46, top: 0, zIndex: 35,
          display: "flex", flexDirection: "column", gap: 5,
          background: P.card, backdropFilter: "blur(20px)",
          border: `1px solid ${P.rose}12`, borderRadius: 14,
          padding: "8px 7px", minWidth: 42,
          boxShadow: `0 4px 20px ${P.text}10, 0 1px 4px ${P.text}06`,
          animation: "fadeIn .15s ease",
        }}>
          {label && <div style={{ fontSize: 10, color: P.textFaint, letterSpacing: ".16em", textTransform: "uppercase", padding: "0 4px 3px", borderBottom: `1px solid ${P.textFaint}12`, marginBottom: 2, whiteSpace: "nowrap" }}>{label}</div>}
          {children}
        </div>
      )}
    </div>
  );
}

export function Lbl({ children }) {
  const P = getP();
  return <label style={{ fontSize: 9, color: P.textFaint, letterSpacing: ".18em", textTransform: "uppercase", display: "block", marginBottom: 4, fontWeight: 400 }}>{children}</label>;
}

export function Fld({ l, v, set, t = "text", ph = "" }) {
  return <div style={{ marginBottom: 12 }}><Lbl>{l}</Lbl><input type={t} value={v || ""} placeholder={ph} onChange={e => set(e.target.value)} style={inputStyle()} /></div>;
}
