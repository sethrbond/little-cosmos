import { getP } from "./cosmosGetP.js";
import { DreamAddForm, DREAM_CATEGORIES, useFocusTrap } from "./formComponents.jsx";

export default function DreamPanel({ dreams, visitedCount, isMyWorld, isPartnerWorld, worldType, isViewer, onClose, onMarkVisited, onRemoveDream, onAddDream }) {
  const P = getP();
  const trapRef = useFocusTrap();
  const totalDreams = dreams.length + visitedCount;
  const progressPct = totalDreams > 0 ? Math.round((visitedCount / totalDreams) * 100) : 0;
  const catMap = {};
  DREAM_CATEGORIES.forEach(c => { catMap[c.key] = c; });
  return (
    <div ref={trapRef} role="dialog" aria-modal="true" aria-label="Dream destinations" onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 45, background: `linear-gradient(135deg, rgba(22,16,40,.82), rgba(30,24,48,.88))`, backdropFilter: "blur(24px)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", animation: "fadeIn .4s ease" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 440, maxWidth: "92vw", maxHeight: "85vh", overflowY: "auto", padding: 32, background: P.card, borderRadius: 22, boxShadow: "0 1px 3px rgba(61,53,82,.04), 0 8px 24px rgba(61,53,82,.06), 0 24px 64px rgba(61,53,82,.1)", cursor: "default" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 400, letterSpacing: ".08em" }}>{isMyWorld ? "🗺 Bucket List" : "✦ Dream Destinations"}</h2>
          <button aria-label="Close dreams" onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: P.textFaint, cursor: "pointer", transition: "color .2s" }}>×</button>
        </div>

        {/* Progress bar */}
        {totalDreams > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: P.textFaint, fontStyle: "italic" }}>{visitedCount} of {totalDreams} dreams realized</span>
              <span style={{ fontSize: 10, color: P.goldWarm, fontWeight: 500 }}>{progressPct}%</span>
            </div>
            <div style={{ height: 4, background: `${P.textFaint}15`, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progressPct}%`, background: `linear-gradient(90deg, ${P.goldWarm}, ${P.rose})`, borderRadius: 2, transition: "width .6s ease" }} />
            </div>
          </div>
        )}

        <p style={{ fontSize: 10, color: P.textFaint, marginBottom: 14, fontStyle: "italic" }}>{isMyWorld ? "Places on your bucket list. They appear as golden ghost markers on the globe." : "Places you dream of visiting together. They appear as golden ghost markers on the globe."}</p>

        {dreams.map((dream) => {
          const cat = dream.category ? catMap[dream.category] : null;
          const hasTarget = !!dream.targetDate;
          const daysUntil = hasTarget ? Math.ceil((new Date(dream.targetDate) - new Date()) / 86400000) : null;
          return (
          <div key={dream.id} style={{ padding: "10px 12px", background: `${P.gold}08`, borderRadius: 10, marginBottom: 6, borderLeft: `3px solid ${P.goldWarm}40` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>{cat ? cat.icon : "✦"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 400 }}>{dream.city}</div>
                <div style={{ fontSize: 9, color: P.textFaint, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span>{dream.country}</span>
                  {cat && <span style={{ padding: "1px 5px", background: `${P.goldWarm}12`, borderRadius: 6, fontSize: 10 }}>{cat.label}</span>}
                  {hasTarget && <span style={{ color: daysUntil > 0 ? P.textMuted : P.heart, fontSize: 10 }}>{daysUntil > 0 ? `${daysUntil}d away` : daysUntil === 0 ? "Today!" : "Past target"}</span>}
                </div>
                {dream.notes && <div style={{ fontSize: 9, color: P.textMuted, marginTop: 2, fontStyle: "italic" }}>{dream.notes}</div>}
              </div>
              {!isViewer && (<>
                <button onClick={() => onMarkVisited(dream)} style={{ background: P.rose, color: "#fff", border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>✓ Visited!</button>
                <button onClick={() => onRemoveDream(dream)} style={{ background: "none", border: "none", color: P.textFaint, cursor: "pointer", fontSize: 12 }}>×</button>
              </>)}
            </div>
          </div>
          );
        })}

        {dreams.length === 0 && <div style={{ textAlign: "center", padding: "24px 0", color: P.textFaint, fontSize: 11 }}>{isMyWorld ? "No bucket list items yet" : "No dream destinations yet"}{visitedCount > 0 && <div style={{ marginTop: 6, fontSize: 10, color: P.goldWarm }}>🎉 All {visitedCount} dreams realized!</div>}</div>}

        {!isViewer && <DreamAddForm isMyWorld={isMyWorld} onAdd={onAddDream} />}
      </div>
    </div>
  );
}
