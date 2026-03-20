import { getP } from "./cosmosGetP.js";
import { navStyle } from "./formUtils.jsx";

const fmtDate = d => { if (!d) return ""; const dt = new Date(d + "T12:00:00"); return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const addDays = (ds, n) => { const d = new Date(ds); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function TimelineSlider({
  sliderDate, sliderVal, totalDays, effectiveStartDate, sorted, milestones, chapters,
  selectedId, isMyWorld, isPartnerWorld, isAnimating, areTogether, pos, entryCount, firstEntryCity,
  TYPES, DEFAULT_TYPE,
  onJumpNext, onStepDay, onSliderChange, onSelectEntry,
}) {
  const P = getP();
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: P.glass, backdropFilter: "blur(16px)", borderTop: `1px solid ${P.rose}10`, zIndex: 15, display: "flex", flexDirection: "column", justifyContent: "center", padding: "12px 22px", paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
        <button onClick={() => onJumpNext(-1)} disabled={isAnimating} style={navStyle()} title={isPartnerWorld ? "Previous together" : "Previous entry"}>{isPartnerWorld ? "💕◂" : "⏮"}</button>
        <button onClick={() => onStepDay(-1)} disabled={isAnimating} style={navStyle()}>◂</button>
        <div style={{ minWidth: 150, textAlign: "center" }}>
          <div style={{ fontSize: 15, color: P.text, fontWeight: 400 }}>{fmtDate(sliderDate)}</div>
          <div style={{ fontSize: 9, color: isMyWorld ? P.textMid : (isPartnerWorld && areTogether ? P.heart : P.textFaint), letterSpacing: ".1em", marginTop: 1 }}>
            {isMyWorld
              ? (pos.seth?.entry?.city ? `📍 ${pos.seth.entry.city}` : "Add entries to begin")
              : isPartnerWorld
              ? (areTogether ? `✨ ${pos.together?.city || "Together"} ✨` : pos.seth && pos.rosie ? `${pos.seth.entry?.city || "?"} ↔ ${pos.rosie.entry?.city || "?"}` : "Add entries to begin")
              : (entryCount > 0 ? `📍 ${firstEntryCity || ""}` : "Add entries to begin")
            }
          </div>
        </div>
        <button onClick={() => onStepDay(1)} disabled={isAnimating} style={navStyle()}>▸</button>
        <button onClick={() => onJumpNext(1)} disabled={isAnimating} style={navStyle()} title={isPartnerWorld ? "Next together" : "Next entry"}>{isPartnerWorld ? "▸💕" : "⏭"}</button>
      </div>
      <div style={{ position: "relative", width: "100%", height: 24, display: "flex", alignItems: "center" }}>
        <input type="range" min={0} max={totalDays} value={clamp(sliderVal, 0, totalDays)}
          onChange={e => { if (!isAnimating) onSliderChange(addDays(effectiveStartDate, parseInt(e.target.value))); }}
          style={{ width: "100%", height: 4, appearance: "none", WebkitAppearance: "none", background: `linear-gradient(90deg,${P.sky},${P.rose})`, borderRadius: 2, outline: "none", cursor: "pointer", opacity: 0.5, touchAction: "manipulation" }} />
        {sorted.map(e => {
          const d = daysBetween(effectiveStartDate, e.dateStart);
          const pct = totalDays > 0 ? (d / totalDays) * 100 : 0;
          if (pct < 0 || pct > 100) return null;
          const typeColor = (TYPES[e.type] || DEFAULT_TYPE).color;
          const isBig = isMyWorld ? true : e.who === "both";
          const isActive = selectedId === e.id;
          return <div key={e.id} onClick={() => onSelectEntry(e)} title={`${e.city} · ${fmtDate(e.dateStart)}`} style={{ position: "absolute", left: `${pct}%`, top: isActive ? 2 : isBig ? 5 : 6, width: isActive ? 8 : isBig ? 5 : 3, height: isActive ? 8 : isBig ? 5 : 3, borderRadius: "50%", background: typeColor, transform: "translateX(-50%)", cursor: "pointer", boxShadow: isActive ? `0 0 8px ${typeColor}, 0 0 16px ${typeColor}60` : `0 0 4px ${typeColor}40`, opacity: isActive ? 1 : isBig ? 0.85 : 0.5, transition: "all .2s ease", zIndex: isActive ? 3 : 1, border: isActive ? "1.5px solid #fff" : "none" }} />;
        })}
        {milestones.map(m => (
          <div key={m.days} style={{ position: "absolute", left: `${m.pct}%`, top: 2, transform: "translateX(-50%)", pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 6, height: 6, background: P.gold, transform: "rotate(45deg)", boxShadow: `0 0 6px ${P.gold}60` }} />
            <div style={{ fontSize: 6, color: P.goldWarm, marginTop: 2, whiteSpace: "nowrap", letterSpacing: ".05em" }}>{m.label}</div>
          </div>
        ))}
        {(chapters || []).map((ch, i) => {
          const cStart = daysBetween(effectiveStartDate, ch.startDate || effectiveStartDate);
          const cEnd = daysBetween(effectiveStartDate, ch.endDate || todayStr());
          const pctStart = totalDays > 0 ? (cStart / totalDays) * 100 : 0;
          const pctEnd = totalDays > 0 ? (cEnd / totalDays) * 100 : 100;
          if (pctStart > 100 || pctEnd < 0) return null;
          return <div key={i} style={{ position: "absolute", left: `${clamp(pctStart, 0, 100)}%`, width: `${clamp(pctEnd - pctStart, 0, 100 - pctStart)}%`, top: -14, height: 12, background: `${[P.rose, P.sky, P.sage, P.gold, P.lavender][i % 5]}30`, borderRadius: 3, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 7, color: P.textMuted, letterSpacing: ".06em", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", padding: "0 2px" }}>{ch.label}</span>
          </div>;
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7, color: P.textFaint, letterSpacing: ".1em", marginTop: 1 }}>
        <span>{fmtDate(effectiveStartDate)}</span>
        <span>today</span>
      </div>
    </div>
  );
}
