import { useState, useRef, useEffect, useCallback, Component } from "react";
import { geocodeSearch } from "./geocode.js";

/* EntryForms.jsx — Shared UI primitives + entry forms
 *
 * All style functions read from window.__cosmosP (P) so they pick up
 * the current world's palette automatically. This is set by OurWorldInner
 * on mount and updated whenever the palette changes.
 */

// ---- FOCUS TRAP HOOK ----
// Traps Tab/Shift+Tab within a container element. Moves focus into container on mount.
export function useFocusTrap(active = true) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const prev = document.activeElement;
    const getFocusable = () => el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    // Move focus into the trap
    const items = getFocusable();
    if (items.length) items[0].focus();
    else { el.setAttribute('tabindex', '-1'); el.focus(); }
    const handler = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    el.addEventListener('keydown', handler);
    return () => { el.removeEventListener('keydown', handler); if (prev && prev.focus) prev.focus(); };
  }, [active]);
  return ref;
}

// Palette accessor — reads from mutable global set by OurWorldInner
const P = (typeof window !== "undefined" && window.__cosmosP) || {};
const getP = () => (typeof window !== "undefined" && window.__cosmosP) || P;

// ---- OVERLAY ERROR BOUNDARY ----

export class OverlayBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(err) { console.error('[OverlayBoundary]', err); }
  render() {
    if (this.state.error) {
      const P = getP();
      return (
        <div role="dialog" aria-modal="true" aria-label="Error" style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={this.props.onClose}>
          <div onClick={e => e.stopPropagation()} style={{ background: P.card || "#1a1a2e", borderRadius: 16, padding: "28px 32px", maxWidth: 340, textAlign: "center", border: `1px solid ${(P.rose || "#c9a96e")}20` }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>😵</div>
            <div style={{ fontSize: 13, color: P.text || "#e8e0d0", marginBottom: 8 }}>Something went wrong</div>
            <div style={{ fontSize: 10, color: P.textFaint || "#999", marginBottom: 16 }}>This feature encountered an error. Your data is safe.</div>
            <button onClick={this.props.onClose} style={{ padding: "8px 20px", background: `${(P.rose || "#c9a96e")}18`, border: `1px solid ${(P.rose || "#c9a96e")}30`, borderRadius: 10, color: P.rose || "#c9a96e", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Close</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---- DRAFT AUTO-SAVE HOOK ----

function useDraft(key, initialState) {
  const [state, setState] = useState(() => {
    if (!key) return initialState;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore if there's meaningful content
        if (parsed.city || parsed.notes || parsed.dateStart) {
          return { ...initialState, ...parsed };
        }
      }
    } catch {}
    return initialState;
  });

  const [restored, setRestored] = useState(() => {
    if (!key) return false;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        return !!(parsed.city || parsed.notes || parsed.dateStart);
      }
    } catch {}
    return false;
  });

  // Auto-save on change (debounced)
  const timerRef = useRef(null);
  useEffect(() => {
    if (!key) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const hasContent = state.city || state.notes || state.dateStart;
      if (hasContent) {
        localStorage.setItem(key, JSON.stringify(state));
      }
    }, 400);
    return () => clearTimeout(timerRef.current);
  }, [key, state]);

  const clearDraft = useCallback(() => {
    if (key) localStorage.removeItem(key);
    setRestored(false);
  }, [key]);

  const dismissRestored = useCallback(() => setRestored(false), []);

  return [state, setState, restored, clearDraft, dismissRestored];
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

export function inpSt() {
  const P = getP();
  return { width: "100%", padding: "10px 14px", border: `1px solid ${P.textFaint}25`, borderRadius: 10, fontSize: 13, fontFamily: "'Palatino Linotype',Palatino,Georgia,serif", color: P.text, background: P.cream, boxSizing: "border-box", transition: "border-color .2s, box-shadow .2s", outline: "none" };
}

export function navSt() {
  const P = getP();
  return { background: "none", border: `1px solid ${P.textFaint}25`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 11, color: P.textMid, fontFamily: "inherit", transition: "all .25s ease", minHeight: 36 };
}

export function imgN(s) {
  return { position: "absolute", [s]: 5, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,.7)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" };
}

export function renderList(t, items, icon, color, onRemove) {
  const P = getP();
  if (!items?.length) return null;
  return <div style={{ marginTop: 10 }}><div style={{ fontSize: 8, color: P.textFaint, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 6 }}>{t}</div>{items.map((it, i) => <div key={i} style={{ display: "flex", gap: 7, marginBottom: 5, padding: "4px 8px", background: `${color}08`, borderRadius: 6, borderLeft: `2px solid ${color}25`, alignItems: "center" }}><span style={{ color, fontSize: 9, flexShrink: 0 }}>{icon}</span><span style={{ flex: 1, fontSize: 11, color: P.textMid, lineHeight: 1.6, fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif" }}>{it}</span>{onRemove && <button onClick={() => onRemove(i)} style={{ background: "none", border: "none", color: P.textFaint, fontSize: 12, cursor: "pointer", padding: "0 2px", lineHeight: 1, opacity: 0.4, transition: "opacity .15s" }} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.4"}>×</button>}</div>)}</div>;
}

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
      <button onClick={onClick} aria-label={tip} style={{ width: 38, height: 38, borderRadius: 12, border: `1px solid ${a ? P.rose + "50" : accent ? P.lavender + "40" : P.textFaint + "20"}`, background: a ? P.card : P.glass, backdropFilter: "blur(12px)", cursor: "pointer", fontSize: accent ? 15 : 14, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .3s ease", fontFamily: "inherit", color: P.text, boxShadow: hov ? `0 4px 16px ${P.text}12, 0 1px 3px ${P.text}08` : `0 1px 4px ${P.text}06`, transform: hov ? "translateY(-1px)" : "none" }}>{children}</button>
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
          width: 38, height: 38, borderRadius: 12,
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
        <span style={{ position: "absolute", right: 2, bottom: 2, fontSize: 7, opacity: open ? 0.6 : 0.3, transition: "opacity .2s", lineHeight: 1 }}>›</span>
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
          {label && <div style={{ fontSize: 7, color: P.textFaint, letterSpacing: ".16em", textTransform: "uppercase", padding: "0 4px 3px", borderBottom: `1px solid ${P.textFaint}12`, marginBottom: 2, whiteSpace: "nowrap" }}>{label}</div>}
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
  return <div style={{ marginBottom: 12 }}><Lbl>{l}</Lbl><input type={t} value={v || ""} placeholder={ph} onChange={e => set(e.target.value)} style={inpSt()} /></div>;
}

// Required-field label with pink asterisk
function RLbl({ children, req }) {
  const P = getP();
  return <label style={{ fontSize: 9, color: P.textFaint, letterSpacing: ".18em", textTransform: "uppercase", display: "block", marginBottom: 4, fontWeight: 400 }}>
    {children}{req && <span style={{ color: P.rose, marginLeft: 3 }}>✱</span>}
  </label>;
}

// Field with required asterisk
function FldR({ l, v, set, t = "text", ph = "", req }) {
  return <div style={{ marginBottom: 9 }}><RLbl req={req}>{l}</RLbl><input type={t} value={v || ""} placeholder={ph} onChange={e => set(e.target.value)} style={inpSt()} /></div>;
}

// ---- QUICK ADD FORM ----

export function QuickAddForm({ types, onAdd, onClose, draftKey }) {
  const P = getP();
  const trapRef = useFocusTrap(true);
  const initialQuick = { city: "", country: "", lat: "", lng: "", dateStart: "", dateEnd: "", type: Object.keys(types)[0] || "together", notes: "" };
  const [f, sf, draftRestored, clearDraft] = useDraft(draftKey, initialQuick);
  const [sugg, setSugg] = useState([]);
  const [showSugg, setShowSugg] = useState(false);

  const onCityInput = v => {
    sf(p => ({ ...p, city: v }));
    if (v.length >= 2) {
      geocodeSearch(v, m => { setSugg(m); setShowSugg(m.length > 0); });
    } else { setSugg([]); setShowSugg(false); }
  };
  const selectCity = c => { sf(p => ({ ...p, city: c[0], country: c[1], lat: c[2].toString(), lng: c[3].toString() })); setSugg([]); setShowSugg(false); };
  const ok = f.city.trim() && f.lat && f.lng && f.dateStart;

  return (
    <div ref={trapRef} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 40, background: P.card, backdropFilter: "blur(28px)", borderRadius: 20, padding: 24, width: 340, boxShadow: "0 1px 3px rgba(61,53,82,.04), 0 8px 24px rgba(61,53,82,.06), 0 20px 56px rgba(61,53,82,.1)", border: `1px solid ${P.gold}15`, fontFamily: "'Palatino Linotype',Palatino,Georgia,serif", color: P.text, animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 400, letterSpacing: ".04em" }}>⚡ Quick Add</h3>
        <button aria-label="Close quick add" onClick={onClose} style={{ background: "none", border: "none", fontSize: 16, color: P.textFaint, cursor: "pointer" }}>×</button>
      </div>
      {draftRestored && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 9px", marginBottom: 6, background: `${P.gold}12`, border: `1px solid ${P.gold}20`, borderRadius: 7, fontSize: 9, color: P.textMid }}>
          <span>Draft restored</span>
          <button onClick={() => { sf(initialQuick); clearDraft(); }} style={{ background: "none", border: "none", color: P.textFaint, cursor: "pointer", fontSize: 9, fontFamily: "inherit", textDecoration: "underline", padding: 0 }}>Discard</button>
        </div>
      )}
      <div style={{ position: "relative", marginBottom: 6 }}>
        <input value={f.city} onChange={e => onCityInput(e.target.value)} onFocus={() => { if (sugg.length > 0) setShowSugg(true); }} placeholder="City..." style={inpSt()} autoFocus />
        {showSugg && sugg.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: P.card, border: `1px solid ${P.textFaint}40`, borderRadius: 6, maxHeight: 130, overflowY: "auto", zIndex: 10, boxShadow: "0 6px 16px rgba(0,0,0,.1)" }}>
            {sugg.map((c, i) => <button key={i} onClick={() => selectCity(c)} style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", border: "none", borderBottom: `1px solid ${P.textFaint}15`, background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10, color: P.textMid }} onMouseEnter={e => e.currentTarget.style.background = P.blush} onMouseLeave={e => e.currentTarget.style.background = "none"}><span style={{ fontWeight: 500, color: P.text }}>{c[0]}</span> <span style={{ color: P.textFaint }}>{c[1]}</span></button>)}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <input type="date" value={f.dateStart} onChange={e => { sf(p => ({ ...p, dateStart: e.target.value, dateEnd: p.dateEnd || e.target.value })); }} style={{ ...inpSt(), flex: 1 }} />
        <input type="date" value={f.dateEnd} onChange={e => sf(p => ({ ...p, dateEnd: e.target.value }))} style={{ ...inpSt(), flex: 1 }} />
        <select value={f.type} onChange={e => sf(p => ({ ...p, type: e.target.value }))} style={{ ...inpSt(), width: 80 }}>
          {Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v.icon}</option>)}
        </select>
      </div>
      <input value={f.notes} onChange={e => sf(p => ({ ...p, notes: e.target.value }))} placeholder="Quick note..." style={{ ...inpSt(), marginBottom: 8 }} />
      <button disabled={!ok} onClick={() => { clearDraft(); onAdd({ id: `e-${Date.now()}`, city: f.city, country: f.country, lat: parseFloat(f.lat), lng: parseFloat(f.lng), dateStart: f.dateStart, dateEnd: f.dateEnd || f.dateStart, type: f.type, who: types[f.type]?.who || "both", notes: f.notes, memories: [], museums: [], restaurants: [], highlights: [], photos: [], stops: [], zoomLevel: 1 }); }}
        style={{ width: "100%", padding: "11px", background: ok ? `linear-gradient(135deg, ${P.goldWarm}, ${P.rose})` : `${P.textFaint}60`, color: "#fff", border: "none", borderRadius: 12, cursor: ok ? "pointer" : "default", fontSize: 11, fontFamily: "inherit", transition: "all .3s", letterSpacing: ".06em", boxShadow: ok ? `0 2px 8px ${P.goldWarm}30, 0 4px 16px ${P.goldWarm}15` : "none" }}>
        {ok ? "⚡ Add to World" : "Select a city & date"}
      </button>
    </div>
  );
}

// ---- DREAM ADD FORM ----

export function DreamAddForm({ onAdd, isMyWorld }) {
  const P = getP();
  const [f, sf] = useState({ city: "", country: "", lat: "", lng: "", notes: "" });
  const [sugg, setSugg] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const onInput = v => {
    sf(p => ({ ...p, city: v }));
    if (v.length >= 2) {
      geocodeSearch(v, m => { setSugg(m); setShowSugg(m.length > 0); });
    } else { setSugg([]); setShowSugg(false); }
  };
  const pick = c => { sf(p => ({ ...p, city: c[0], country: c[1], lat: c[2].toString(), lng: c[3].toString() })); setSugg([]); setShowSugg(false); };
  const ok = f.city && f.lat && f.lng;
  return (
    <div style={{ marginTop: 14, padding: 14, background: `linear-gradient(145deg, ${P.gold}06, ${P.cream})`, borderRadius: 14, border: `1px dashed ${P.goldWarm}25` }}>
      <div style={{ fontSize: 8, color: P.textFaint, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 8 }}>{isMyWorld ? "Add to Bucket List" : "Add a Dream"}</div>
      <div style={{ position: "relative", marginBottom: 6 }}>
        <input placeholder="Start typing a city..." value={f.city} onChange={e => onInput(e.target.value)} onFocus={() => { if (sugg.length > 0) setShowSugg(true); }} style={{ ...inpSt(), fontSize: 11 }} />
        {showSugg && sugg.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: P.card, border: `1px solid ${P.textFaint}40`, borderRadius: 6, maxHeight: 120, overflowY: "auto", zIndex: 10, boxShadow: "0 6px 16px rgba(0,0,0,.1)" }}>
            {sugg.map((c, i) => (
              <button key={i} onClick={() => pick(c)} style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", border: "none", borderBottom: `1px solid ${P.textFaint}15`, background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10, color: P.textMid }}
                onMouseEnter={e => e.currentTarget.style.background = P.blush}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >
                <span style={{ fontWeight: 500, color: P.text }}>{c[0]}</span> <span style={{ color: P.textFaint }}>{c[1]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <input placeholder="Why this place?" value={f.notes} onChange={e => sf(p => ({ ...p, notes: e.target.value }))} style={{ ...inpSt(), fontSize: 10, marginBottom: 6 }} />
      <button disabled={!ok} onClick={() => { onAdd({ city: f.city, country: f.country, lat: parseFloat(f.lat), lng: parseFloat(f.lng), notes: f.notes }); sf({ city: "", country: "", lat: "", lng: "", notes: "" }); }}
        style={{ width: "100%", padding: "9px", background: ok ? `linear-gradient(135deg, ${P.goldWarm}, ${P.rose})` : `${P.textFaint}60`, color: "#fff", border: "none", borderRadius: 10, cursor: ok ? "pointer" : "default", fontSize: 10, fontFamily: "inherit", transition: "all .3s", letterSpacing: ".06em", boxShadow: ok ? `0 2px 8px ${P.goldWarm}25` : "none" }}>
        {isMyWorld ? "🗺 Add to List" : "✦ Add Dream"}
      </button>
    </div>
  );
}

// ---- ADD FORM ----

export function AddForm({ types, defaultType = "together", defaultWho = "both", fieldLabels, isMyWorld, worldName, onAdd, onClose, draftKey }) {
  const P = getP();
  const trapRef = useFocusTrap(true);
  const initialForm = { city: "", country: "", lat: "", lng: "", dateStart: "", dateEnd: "", type: defaultType, who: defaultWho, zoomLevel: 1, notes: "", museums: "", restaurants: "", highlights: "", musicUrl: "", stops: [] };
  const [f, sf, draftRestored, clearDraft, dismissRestored] = useDraft(draftKey, initialForm);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [ns, setNs] = useState({ city: "", lat: "", lng: "", notes: "", dateStart: "", dateEnd: "" });
  const [stopSugg, setStopSugg] = useState([]);
  const [showStopSugg, setShowStopSugg] = useState(false);
  const dateEndRef = useRef(null);
  const notesRef = useRef(null);

  const lat = parseFloat(f.lat), lng = parseFloat(f.lng);
  const validCoords = !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  const validDates = f.dateStart && f.dateEnd && f.dateEnd >= f.dateStart;
  const ok = f.city?.trim() && validCoords && validDates;
  const validationMsg = !f.city?.trim() ? "Enter a city name" : !validCoords ? "Lat must be -90 to 90, Lng -180 to 180" : !f.dateStart ? "Set a start date" : !f.dateEnd ? "Set an end date" : f.dateEnd < f.dateStart ? "End date must be after start" : "";

  const onCityInput = v => {
    sf(p => ({ ...p, city: v }));
    if (v.length >= 2) {
      geocodeSearch(v, matches => { setSuggestions(matches); setShowSuggestions(matches.length > 0); });
    } else { setSuggestions([]); setShowSuggestions(false); }
  };
  const selectCity = (c) => {
    sf(p => ({ ...p, city: c[0], country: c[1], lat: c[2].toString(), lng: c[3].toString() }));
    setSuggestions([]); setShowSuggestions(false);
  };
  const onStopCityInput = v => {
    setNs(p => ({ ...p, city: v }));
    if (v.length >= 2) {
      geocodeSearch(v, matches => { setStopSugg(matches); setShowStopSugg(matches.length > 0); });
    } else { setStopSugg([]); setShowStopSugg(false); }
  };
  const selectStopCity = c => {
    setNs(p => ({ ...p, city: c[0], lat: c[2].toString(), lng: c[3].toString() }));
    setStopSugg([]); setShowStopSugg(false);
  };

  return (
    <div ref={trapRef} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 40, background: P.card, backdropFilter: "blur(28px)", borderRadius: 22, padding: 28, width: 380, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 1px 3px rgba(61,53,82,.04), 0 8px 24px rgba(61,53,82,.06), 0 20px 56px rgba(61,53,82,.1)", border: `1px solid ${P.rose}10`, fontFamily: "'Palatino Linotype',Palatino,Georgia,serif", color: P.text, animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><h3 style={{ margin: 0, fontSize: 17, fontWeight: 400, letterSpacing: ".04em" }}>Add a New Chapter</h3><button aria-label="Close add form" onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: P.textFaint, cursor: "pointer" }}>×</button></div>
      <p style={{ fontSize: 9, color: P.textMuted, marginBottom: 12, fontStyle: "italic" }}>{isMyWorld ? "Add a new adventure 🧭" : "Another page in your story ✨"}</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <RLbl req>Type</RLbl>
          <select value={f.type} onChange={e => { const t = e.target.value; sf(p => ({ ...p, type: t, who: types[t]?.who || "both" })); }} style={inpSt()}>
            {Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <RLbl>Zoom (1-3)</RLbl>
          <select value={f.zoomLevel} onChange={e => sf(p => ({ ...p, zoomLevel: parseInt(e.target.value) || 1 }))} style={inpSt()}>
            <option value={1}>1 — Always</option>
            <option value={2}>2 — Regional</option>
            <option value={3}>3 — Close-up</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 8, position: "relative" }}>
        <RLbl req>City</RLbl>
        <input value={f.city} onChange={e => onCityInput(e.target.value)} onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }} placeholder="Start typing — e.g. Haw..." style={{ ...inpSt(), borderColor: f.city ? `${P.textFaint}60` : undefined }} />
        {showSuggestions && suggestions.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: P.card, border: `1px solid ${P.textFaint}40`, borderRadius: 6, maxHeight: 150, overflowY: "auto", zIndex: 10, boxShadow: "0 6px 16px rgba(0,0,0,.1)" }}>
            {suggestions.map((c, i) => (
              <button key={i} onClick={() => selectCity(c)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left", padding: "8px 10px", border: "none", borderBottom: `1px solid ${P.textFaint}15`, background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, color: P.textMid, transition: "background .15s" }}
                onMouseEnter={e => e.currentTarget.style.background = P.blush} onMouseLeave={e => e.currentTarget.style.background = "none"}>
                <span style={{ fontSize: 13 }}>📍</span>
                <div><div style={{ fontWeight: 500, color: P.text }}>{c[0]}</div><div style={{ fontSize: 9, color: P.textFaint }}>{c[1]} · {c[2].toFixed(2)}, {c[3].toFixed(2)}</div></div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Fld l="Country" v={f.country} set={v => sf(p => ({ ...p, country: v }))} ph="Auto-filled from city selection" />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}><FldR l="Latitude" v={f.lat} t="number" set={v => sf(p => ({ ...p, lat: v }))} ph="Auto-filled" req /></div>
        <div style={{ flex: 1 }}><FldR l="Longitude" v={f.lng} t="number" set={v => sf(p => ({ ...p, lng: v }))} ph="Auto-filled" req /></div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, marginBottom: 9 }}><RLbl req>Start Date</RLbl><input type="date" value={f.dateStart || ""} onChange={e => { const v = e.target.value; sf(p => ({ ...p, dateStart: v })); if (parseInt(v?.split('-')[0], 10) >= 1000) setTimeout(() => { if (dateEndRef.current) { dateEndRef.current.showPicker?.(); dateEndRef.current.focus(); } }, 50); }} style={inpSt()} /></div>
        <div style={{ flex: 1, marginBottom: 9 }}><RLbl req>End Date</RLbl><input ref={dateEndRef} type="date" value={f.dateEnd || ""} onChange={e => { const v = e.target.value; sf(p => ({ ...p, dateEnd: v })); if (parseInt(v?.split('-')[0], 10) >= 1000) setTimeout(() => { if (notesRef.current) notesRef.current.focus(); }, 50); }} style={inpSt()} /></div>
      </div>

      <div style={{ margin: "10px 0", height: 1, background: `linear-gradient(90deg,transparent,${P.rose}15,transparent)` }} />

      <div style={{ marginBottom: 8 }}><Lbl>Notes</Lbl><textarea ref={notesRef} value={f.notes} onChange={e => sf(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="What made this place special?" style={{ ...inpSt(), resize: "vertical" }} /></div>
      <div style={{ marginBottom: 8 }}><Lbl>{fieldLabels?.highlights?.label || "Highlights"} (one per line)</Lbl><textarea value={f.highlights} onChange={e => sf(p => ({ ...p, highlights: e.target.value }))} rows={2} placeholder={isMyWorld ? "Hiked the summit trail\nSunrise over the valley" : "The sunset was perfect\nDancing until midnight"} style={{ ...inpSt(), resize: "vertical" }} /></div>
      <div style={{ marginBottom: 8 }}><Lbl>{fieldLabels?.museums?.label || "Museums & Culture"}</Lbl><textarea value={f.museums} onChange={e => sf(p => ({ ...p, museums: e.target.value }))} rows={1} style={{ ...inpSt(), resize: "vertical" }} /></div>
      <div style={{ marginBottom: 8 }}><Lbl>{fieldLabels?.restaurants?.label || "Restaurants & Food"}</Lbl><textarea value={f.restaurants} onChange={e => sf(p => ({ ...p, restaurants: e.target.value }))} rows={1} style={{ ...inpSt(), resize: "vertical" }} /></div>
      <div style={{ marginBottom: 8 }}><Lbl>Music URL</Lbl><input value={f.musicUrl} onChange={e => sf(p => ({ ...p, musicUrl: e.target.value }))} placeholder="Paste audio URL (optional)" style={inpSt()} /></div>

      <div style={{ margin: "6px 0", height: 1, background: `linear-gradient(90deg,transparent,${P.rose}15,transparent)` }} />
      <Lbl>Trip Stops</Lbl>
      {f.stops.map(s => <div key={s.sid} style={{ fontSize: 10, padding: "3px 7px", background: `${P.rose}08`, borderRadius: 5, marginBottom: 3, display: "flex", justifyContent: "space-between" }}><span>{s.city}</span><button onClick={() => sf(p => ({ ...p, stops: p.stops.filter(st => st.sid !== s.sid) }))} style={{ background: "none", border: "none", color: "#c9777a", cursor: "pointer", fontSize: 11 }}>×</button></div>)}
      <div style={{ position: "relative", marginTop: 4, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 4 }}>
          <input placeholder="Start typing city..." value={ns.city} onChange={e => onStopCityInput(e.target.value)} onFocus={() => { if (stopSugg.length > 0) setShowStopSugg(true); }} style={{ ...inpSt(), flex: 1 }} />
          <input placeholder="Lat" value={ns.lat} onChange={e => setNs(p => ({ ...p, lat: e.target.value }))} style={{ ...inpSt(), width: 48 }} />
          <input placeholder="Lng" value={ns.lng} onChange={e => setNs(p => ({ ...p, lng: e.target.value }))} style={{ ...inpSt(), width: 48 }} />
        </div>
        {showStopSugg && stopSugg.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: P.card, border: `1px solid ${P.textFaint}40`, borderRadius: 6, maxHeight: 120, overflowY: "auto", zIndex: 10, boxShadow: "0 6px 16px rgba(0,0,0,.1)" }}>
            {stopSugg.map((c, i) => (
              <button key={i} onClick={() => selectStopCity(c)} style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", border: "none", borderBottom: `1px solid ${P.textFaint}15`, background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10, color: P.textMid }}
                onMouseEnter={e => e.currentTarget.style.background = P.blush} onMouseLeave={e => e.currentTarget.style.background = "none"}>
                <span style={{ fontWeight: 500, color: P.text }}>{c[0]}</span> <span style={{ color: P.textFaint }}>{c[1]}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <input type="date" placeholder="Start" value={ns.dateStart || ""} onChange={e => setNs(p => ({ ...p, dateStart: e.target.value }))} style={{ ...inpSt(), flex: 1, fontSize: 9 }} />
          <input type="date" placeholder="End" value={ns.dateEnd || ""} onChange={e => setNs(p => ({ ...p, dateEnd: e.target.value }))} style={{ ...inpSt(), flex: 1, fontSize: 9 }} />
        </div>
        <button disabled={!ns.city || !ns.lat} onClick={() => { setShowStopSugg(false); sf(p => ({ ...p, stops: [...p.stops, { sid: `s-${Date.now()}`, city: ns.city, lat: parseFloat(ns.lat) || 0, lng: parseFloat(ns.lng) || 0, notes: ns.notes, dateStart: ns.dateStart || null, dateEnd: ns.dateEnd || null }] })); setNs({ city: "", lat: "", lng: "", notes: "", dateStart: "", dateEnd: "" }); }} style={{ marginTop: 4, width: "100%", padding: "6px", background: P.rose, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "inherit" }}>+ Add Stop</button>
      </div>

      {draftRestored && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", marginBottom: 8, background: `${P.gold}12`, border: `1px solid ${P.gold}20`, borderRadius: 8, fontSize: 9, color: P.textMid, letterSpacing: ".04em" }}>
          <span>Draft restored</span>
          <button onClick={() => { sf(initialForm); clearDraft(); }} style={{ background: "none", border: "none", color: P.textFaint, cursor: "pointer", fontSize: 9, fontFamily: "inherit", textDecoration: "underline", padding: 0 }}>Discard</button>
        </div>
      )}

      <button disabled={!ok} onClick={() => { setShowSuggestions(false); clearDraft(); onAdd({
        id: `e-${Date.now()}`, city: f.city, country: f.country, lat: parseFloat(f.lat), lng: parseFloat(f.lng),
        dateStart: f.dateStart, dateEnd: f.dateEnd || null, type: f.type, who: f.who, zoomLevel: f.zoomLevel,
        notes: f.notes, memories: [], museums: f.museums.split("\n").filter(Boolean),
        restaurants: f.restaurants.split("\n").filter(Boolean), highlights: f.highlights.split("\n").filter(Boolean),
        photos: [], stops: f.stops, musicUrl: f.musicUrl || null,
      }); }} style={{ width: "100%", padding: "12px 0", background: ok ? `linear-gradient(135deg, ${P.rose}, ${P.sky})` : `${P.textFaint}60`, color: "#fff", border: "none", borderRadius: 14, cursor: ok ? "pointer" : "default", fontSize: 12, letterSpacing: ".1em", fontFamily: "inherit", transition: "all .3s", boxShadow: ok ? `0 2px 8px ${P.rose}30, 0 4px 16px ${P.rose}15` : "none" }}>
        {ok ? `Add to ${worldName || (isMyWorld ? "My World" : "Our World")} ${isMyWorld ? "🌍" : "💕"}` : "Fill required fields to continue"}
      </button>
      {!ok && <p style={{ fontSize: 8, color: validationMsg ? "#c9777a" : P.textFaint, textAlign: "center", marginTop: 5, letterSpacing: ".08em" }}>
        {validationMsg || "Fill required fields to continue"}
      </p>}
    </div>
  );
}

// ---- EDIT FORM ----

export function EditForm({ entry, types, fieldLabels, onChange, onSave, onClose, onDelete, onAddStop }) {
  const P = getP();
  const trapRef = useFocusTrap(true);
  const [ns, setNs] = useState({ city: "", lat: "", lng: "", notes: "", dateStart: "", dateEnd: "" });
  const [stopSugg, setStopSugg] = useState([]);
  const [showStopSugg, setShowStopSugg] = useState(false);
  const [citySugg, setCitySugg] = useState([]);
  const [showCitySugg, setShowCitySugg] = useState(false);
  const editDateEndRef = useRef(null);
  const editNotesRef = useRef(null);

  const onEditCity = v => {
    onChange(p => ({ ...p, city: v }));
    if (v.length >= 2) {
      geocodeSearch(v, matches => { setCitySugg(matches); setShowCitySugg(matches.length > 0); });
    } else { setCitySugg([]); setShowCitySugg(false); }
  };
  const selectEditCity = c => {
    onChange(p => ({ ...p, city: c[0], country: c[1], lat: parseFloat(c[2]) || 0, lng: parseFloat(c[3]) || 0 }));
    setCitySugg([]); setShowCitySugg(false);
  };
  const onStopCity = v => {
    setNs(p => ({ ...p, city: v }));
    if (v.length >= 2) {
      geocodeSearch(v, matches => { setStopSugg(matches); setShowStopSugg(matches.length > 0); });
    } else { setStopSugg([]); setShowStopSugg(false); }
  };
  const selectStopCity = c => {
    setNs(p => ({ ...p, city: c[0], lat: c[2].toString(), lng: c[3].toString() }));
    setStopSugg([]); setShowStopSugg(false);
  };

  return (
    <div ref={trapRef} style={{ position: "absolute", top: "42%", right: 18, transform: "translateY(-50%)", zIndex: 30, background: P.card, backdropFilter: "blur(28px)", borderRadius: 20, padding: 22, maxWidth: 340, minWidth: 270, maxHeight: "65vh", overflowY: "auto", boxShadow: "0 1px 3px rgba(61,53,82,.04), 0 8px 24px rgba(61,53,82,.06), 0 20px 56px rgba(61,53,82,.1)", border: `1px solid ${P.together}12`, fontFamily: "'Palatino Linotype',Palatino,Georgia,serif", animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 400, letterSpacing: ".04em" }}>Edit</h3><button aria-label="Close edit form" onClick={onClose} style={{ background: "none", border: "none", fontSize: 16, color: P.textFaint, cursor: "pointer" }}>×</button></div>
      <div style={{ marginBottom: 9, position: "relative" }}>
        <Lbl>City</Lbl>
        <input value={entry.city || ""} onChange={e => onEditCity(e.target.value)} onFocus={() => { if (citySugg.length > 0) setShowCitySugg(true); }} style={inpSt()} />
        {showCitySugg && citySugg.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: P.card, border: `1px solid ${P.textFaint}40`, borderRadius: 6, maxHeight: 120, overflowY: "auto", zIndex: 10, boxShadow: "0 6px 16px rgba(0,0,0,.1)" }}>
            {citySugg.map((c, i) => (
              <button key={i} onClick={() => selectEditCity(c)} style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", border: "none", borderBottom: `1px solid ${P.textFaint}15`, background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10, color: P.textMid }}
                onMouseEnter={e => e.currentTarget.style.background = P.blush} onMouseLeave={e => e.currentTarget.style.background = "none"}>
                <span style={{ fontWeight: 500, color: P.text }}>{c[0]}</span> <span style={{ color: P.textFaint }}>{c[1]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Fld l="Country" v={entry.country} set={v => onChange(p => ({ ...p, country: v }))} />
      <div style={{ display: "flex", gap: 6 }}><div style={{ flex: 1 }}><Fld l="Lat" v={entry.lat} t="number" set={v => onChange(p => ({ ...p, lat: parseFloat(v) || 0 }))} /></div><div style={{ flex: 1 }}><Fld l="Lng" v={entry.lng} t="number" set={v => onChange(p => ({ ...p, lng: parseFloat(v) || 0 }))} /></div></div>
      <div style={{ display: "flex", gap: 6 }}><div style={{ flex: 1, marginBottom: 9 }}><Lbl>Start</Lbl><input type="date" value={entry.dateStart || ""} onChange={e => { const v = e.target.value; onChange(p => ({ ...p, dateStart: v })); if (parseInt(v?.split('-')[0], 10) >= 1000) setTimeout(() => { if (editDateEndRef.current) { editDateEndRef.current.showPicker?.(); editDateEndRef.current.focus(); } }, 50); }} style={inpSt()} /></div><div style={{ flex: 1, marginBottom: 9 }}><Lbl>End</Lbl><input ref={editDateEndRef} type="date" value={entry.dateEnd || ""} onChange={e => { const v = e.target.value; onChange(p => ({ ...p, dateEnd: v || null })); if (parseInt(v?.split('-')[0], 10) >= 1000) setTimeout(() => { if (editNotesRef.current) editNotesRef.current.focus(); }, 50); }} style={inpSt()} /></div></div>
      <div style={{ marginBottom: 8 }}><Lbl>Type</Lbl><select value={entry.type} onChange={e => { const t = e.target.value; onChange(p => ({ ...p, type: t, who: types[t]?.who || "both" })); }} style={inpSt()}>{Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</select></div>
      <div style={{ marginBottom: 8 }}><Lbl>Notes</Lbl><textarea ref={editNotesRef} value={entry.notes || ""} onChange={e => onChange(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ ...inpSt(), resize: "vertical" }} /></div>
      <div style={{ marginBottom: 8 }}><Lbl>{fieldLabels?.highlights?.label || "Highlights"}</Lbl><textarea value={(entry.highlights || []).join("\n")} onChange={e => onChange(p => ({ ...p, highlights: e.target.value.split("\n").filter(Boolean) }))} rows={2} style={{ ...inpSt(), resize: "vertical" }} /></div>
      <div style={{ marginBottom: 8 }}><Lbl>{fieldLabels?.museums?.label || "Museums"}</Lbl><textarea value={(entry.museums || []).join("\n")} onChange={e => onChange(p => ({ ...p, museums: e.target.value.split("\n").filter(Boolean) }))} rows={1} style={{ ...inpSt(), resize: "vertical" }} /></div>
      <div style={{ marginBottom: 8 }}><Lbl>{fieldLabels?.restaurants?.label || "Restaurants"}</Lbl><textarea value={(entry.restaurants || []).join("\n")} onChange={e => onChange(p => ({ ...p, restaurants: e.target.value.split("\n").filter(Boolean) }))} rows={1} style={{ ...inpSt(), resize: "vertical" }} /></div>
      <div style={{ marginBottom: 8 }}><Lbl>Music URL</Lbl><input value={entry.musicUrl || ""} onChange={e => onChange(p => ({ ...p, musicUrl: e.target.value || null }))} placeholder="paste audio URL" style={inpSt()} /></div>

      <div style={{ margin: "8px 0", height: 1, background: `linear-gradient(90deg,transparent,${P.rose}15,transparent)` }} />
      <Lbl>Trip Stops</Lbl>
      {(entry.stops || []).map(s => <div key={s.sid} style={{ fontSize: 10, padding: "5px 7px", background: `${P.rose}08`, borderRadius: 5, marginBottom: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><span style={{ fontWeight: 500 }}>{s.city}</span>{s.dateStart && <span style={{ color: P.textFaint, marginLeft: 6 }}>{s.dateStart}{s.dateEnd ? ` → ${s.dateEnd}` : ""}</span>}</div><button onClick={() => onChange(p => ({ ...p, stops: (p.stops || []).filter(st => st.sid !== s.sid) }))} style={{ background: "none", border: "none", color: "#c9777a", cursor: "pointer", fontSize: 11 }}>×</button></div>)}

      <div style={{ position: "relative", marginTop: 4 }}>
        <div style={{ display: "flex", gap: 4 }}>
          <input placeholder="Start typing city..." value={ns.city} onChange={e => onStopCity(e.target.value)} onFocus={() => { if (stopSugg.length > 0) setShowStopSugg(true); }} style={{ ...inpSt(), flex: 1 }} />
        </div>
        {showStopSugg && stopSugg.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: P.card, border: `1px solid ${P.textFaint}40`, borderRadius: 6, maxHeight: 120, overflowY: "auto", zIndex: 10, boxShadow: "0 6px 16px rgba(0,0,0,.1)" }}>
            {stopSugg.map((c, i) => (
              <button key={i} onClick={() => selectStopCity(c)} style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", border: "none", borderBottom: `1px solid ${P.textFaint}15`, background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10, color: P.textMid }}
                onMouseEnter={e => e.currentTarget.style.background = P.blush} onMouseLeave={e => e.currentTarget.style.background = "none"}>
                <span style={{ fontWeight: 500, color: P.text }}>{c[0]}</span> <span style={{ color: P.textFaint }}>{c[1]}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <input placeholder="Lat" value={ns.lat} onChange={e => setNs(p => ({ ...p, lat: e.target.value }))} style={{ ...inpSt(), width: 55 }} />
          <input placeholder="Lng" value={ns.lng} onChange={e => setNs(p => ({ ...p, lng: e.target.value }))} style={{ ...inpSt(), width: 55 }} />
          <input type="date" value={ns.dateStart} onChange={e => setNs(p => ({ ...p, dateStart: e.target.value }))} style={{ ...inpSt(), flex: 1, fontSize: 9 }} />
          <input type="date" value={ns.dateEnd} onChange={e => setNs(p => ({ ...p, dateEnd: e.target.value }))} style={{ ...inpSt(), flex: 1, fontSize: 9 }} />
        </div>
        <button disabled={!ns.city || !ns.lat} onClick={() => { setShowStopSugg(false); onAddStop({ sid: `s-${Date.now()}`, city: ns.city, lat: parseFloat(ns.lat) || 0, lng: parseFloat(ns.lng) || 0, notes: ns.notes, dateStart: ns.dateStart || null, dateEnd: ns.dateEnd || null }); setNs({ city: "", lat: "", lng: "", notes: "", dateStart: "", dateEnd: "" }); }} style={{ marginTop: 4, width: "100%", padding: "6px", background: P.rose, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "inherit" }}>+ Add Stop</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={onSave} style={{ flex: 1, padding: "10px 0", background: `linear-gradient(135deg, ${P.rose}, ${P.sky})`, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 10, fontFamily: "inherit", letterSpacing: ".06em", boxShadow: `0 2px 8px ${P.rose}30`, transition: "all .25s" }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 4px 12px ${P.rose}40`; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 2px 8px ${P.rose}30`; }}>Save</button>
        <button onClick={onClose} style={{ padding: "10px 14px", background: "transparent", border: `1px solid ${P.textFaint}30`, borderRadius: 12, cursor: "pointer", fontSize: 10, fontFamily: "inherit", color: P.textMuted, transition: "all .2s" }}>Cancel</button>
      </div>
      <button onClick={onDelete} style={{ marginTop: 8, width: "100%", padding: "7px 0", background: "transparent", color: "#c9777a", border: `1px solid #c0707020`, borderRadius: 10, cursor: "pointer", fontSize: 9, fontFamily: "inherit", transition: "all .2s" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#c0707050"; e.currentTarget.style.background = "#c9777a08"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#c0707020"; e.currentTarget.style.background = "transparent"; }}>Delete</button>
    </div>
  );
}
