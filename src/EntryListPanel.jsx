import { useState, useMemo, memo } from "react";
import { daysBetween, todayStr } from "./geodata.js";
import { thumbnail } from "./imageUtils.js";

/* Right-side entry list panel — distance indicator, filter, scrollable entries */
function EntryListPanelInner({
  entries, sorted, togetherList, favorites,
  selected, onSelectEntry,
  markerFilter, setMarkerFilter,
  showFilter, onToggleFilter, onCloseFilter,
  TYPES, P, config,
  isMobile, isPartnerWorld, isMyWorld, isSharedWorld,
  fmtDate, stats, dist, nextTogether, areTogether,
  allStickersMap, memberNameMap, worldName, introComplete,
}) {
  const [listSortMode, setListSortMode] = useState("newest");
  const [listRenderLimit, setListRenderLimit] = useState(100);

  const filteredList = useMemo(() => {
    const list = markerFilter === "all" ? entries : markerFilter === "favorites" ? entries.filter(e => e.favorite) : entries.filter(e => e.type === markerFilter);
    if (listSortMode === "oldest") return [...list].sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));
    if (listSortMode === "alpha") return [...list].sort((a, b) => (a.city || "").localeCompare(b.city || ""));
    if (listSortMode === "country") return [...list].sort((a, b) => (a.country || "").localeCompare(b.country || "") || (a.city || "").localeCompare(b.city || ""));
    return [...list].sort((a, b) => (b.dateStart || "").localeCompare(a.dateStart || ""));
  }, [entries, markerFilter, listSortMode]);

  const entryRow = (e) => (
    <button key={e.id} onClick={() => onSelectEntry(e)}
      style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "7px 10px", border: "none", borderBottom: `1px solid ${P.parchment}60`, background: selected?.id === e.id ? P.blush : "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background .15s" }}
      onMouseEnter={ev => { if (selected?.id !== e.id) ev.currentTarget.style.background = P.lavMist; }}
      onMouseLeave={ev => { if (selected?.id !== e.id) ev.currentTarget.style.background = "transparent"; }}
    >
      {(e.photos || []).length > 0 ? (
        <img loading="lazy" src={thumbnail(e.photos[0], 64)} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0, border: `1px solid ${P.rose}15` }} />
      ) : (
        <span style={{ fontSize: 14, flexShrink: 0, width: 32, textAlign: "center" }}>{(TYPES[e.type] || {}).icon || "📍"}</span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 400, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.city}{(e.stops || []).length > 0 ? ` + ${e.stops.length} stop${e.stops.length > 1 ? "s" : ""}` : ""}</div>
        <div style={{ fontSize: 10, color: P.textFaint }}>{fmtDate(e.dateStart)}{e.dateEnd && e.dateEnd !== e.dateStart ? ` → ${fmtDate(e.dateEnd)}` : ""}{(e.stops || []).length > 0 ? ` · ${[...new Set(e.stops.map(s => s.country).filter(Boolean))].join(", ")}` : ""}</div>
        {allStickersMap[e.id] && <div style={{ display: "flex", gap: 2, marginTop: 1 }}>{allStickersMap[e.id].map((s, i) => <span key={i} style={{ fontSize: 10 }} title={s.label}>{s.emoji}</span>)}</div>}
      </div>
      {(e.photos || []).length > 1 && <span style={{ fontSize: 10, color: P.textFaint }}>📸{(e.photos || []).length}</span>}
      {isSharedWorld && e.addedBy && memberNameMap[e.addedBy] && (
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: `linear-gradient(135deg, ${P.rose}35, ${P.sky}35)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: P.text, flexShrink: 0 }} title={`Added by ${memberNameMap[e.addedBy]}`}>
          {memberNameMap[e.addedBy].charAt(0).toUpperCase()}
        </div>
      )}
      {e.favorite && <span style={{ fontSize: 9, color: P.heart }}>♥</span>}
    </button>
  );

  return (
    <div style={{ position: "absolute", top: `max(${isMobile ? 14 : 22}px, env(safe-area-inset-top, ${isMobile ? 14 : 22}px))`, right: `max(${isMobile ? 12 : 22}px, env(safe-area-inset-right, ${isMobile ? 12 : 22}px))`, zIndex: 10, textAlign: "right", opacity: introComplete ? .8 : 0, transition: "opacity 1s ease", maxWidth: isMobile ? 130 : 180 }}>
      {isPartnerWorld && dist !== null && (
        <div style={{ marginBottom: 4 }}>
          {areTogether ? <div style={{ fontSize: 16, color: P.heart, animation: "heartPulse 1.5s ease infinite" }}>💕 {config.youName && config.partnerName ? `${config.youName} & ${config.partnerName}` : "Together"}</div>
            : <div style={{ fontSize: 13, color: P.textMid }}><span style={{ color: P.rose }}>♥</span> {dist.toLocaleString()} mi apart{dist > 3000 ? <div style={{ fontSize: 9, color: P.rose, opacity: 0.7, marginTop: 2, fontStyle: "italic" }}>across the world</div> : dist > 500 ? <div style={{ fontSize: 9, color: P.rose, opacity: 0.7, marginTop: 2, fontStyle: "italic" }}>missing you</div> : null}</div>}
        </div>
      )}
      {isPartnerWorld && nextTogether && !areTogether && (
        <div style={{ fontSize: 10, color: P.goldWarm, letterSpacing: ".08em", marginBottom: 4, fontWeight: 500, textShadow: "0 1px 3px rgba(0,0,0,.15)" }}>
          {daysBetween(todayStr(), nextTogether.dateStart)} days until together 💛
        </div>
      )}
      {!isMobile && entries.length > 0 && <div style={{ fontSize: 10, color: P.textMid, letterSpacing: ".08em", lineHeight: 1.6, textShadow: "0 1px 6px rgba(0,0,0,0.2)" }}>
        {isMyWorld
          ? <>{entries.length} trips · {stats.countries} countries<br />{stats.totalMiles.toLocaleString()} miles explored</>
          : isPartnerWorld
          ? <>{stats.daysTog} days {config.youName && config.partnerName ? `${config.youName} & ${config.partnerName}` : "together"}<br />{stats.trips} adventures · {stats.countries} countries<br />{stats.totalMiles.toLocaleString()} miles traveled</>
          : <>{entries.length} {worldName ? `${worldName} ` : ""}trips · {stats.countries} countries<br />{stats.totalMiles.toLocaleString()} miles traveled</>
        }
      </div>}
      {/* Entry type filter + scrollable entry list */}
      {entries.length > 0 && (
        <div style={{ marginTop: 10, position: "relative" }}>
          <button onClick={onToggleFilter} style={{ background: showFilter ? P.blush : "rgba(255,255,255,.6)", border: `1px solid ${P.rose}20`, borderRadius: 8, padding: "8px 12px", fontSize: 9, cursor: "pointer", fontFamily: "inherit", color: P.textMid, letterSpacing: ".06em", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
            {markerFilter === "all" ? "🌍 All Entries" : markerFilter === "favorites" ? "♥ Favorites" : `${(TYPES[markerFilter] || {}).icon || "✨"} ${(TYPES[markerFilter] || {}).label || markerFilter}`}
            <span style={{ fontSize: 10, opacity: 0.5 }}>{showFilter ? "▲" : "▼"}</span>
          </button>
          {showFilter && (
            <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: P.card, backdropFilter: "blur(16px)", borderRadius: 10, boxShadow: "0 8px 28px rgba(61,53,82,.12)", border: `1px solid ${P.rose}10`, overflow: "hidden", minWidth: 150, zIndex: 20 }}>
              {[{ key: "all", icon: "🌍", label: "All Entries", count: entries.length },
                { key: "favorites", icon: "♥", label: "Favorites", count: favorites.length },
                ...Object.entries(TYPES).map(([k, v]) => ({ key: k, icon: v.icon, label: v.label, count: entries.filter(e => e.type === k).length }))
              ].filter(f => f.count > 0 || f.key === "favorites").map(f => (
                <button key={f.key} onClick={() => { setMarkerFilter(f.key); onCloseFilter(); setListRenderLimit(100); }}
                  style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "10px 12px", border: "none", borderBottom: `1px solid ${P.parchment}`, background: markerFilter === f.key ? P.blush : "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 10, color: markerFilter === f.key ? P.text : P.textMid, textAlign: "left" }}
                  onMouseEnter={e => { if (markerFilter !== f.key) e.currentTarget.style.background = P.lavMist; }}
                  onMouseLeave={e => { if (markerFilter !== f.key) e.currentTarget.style.background = "transparent"; }}
                >
                  <span>{f.icon}</span>
                  <span style={{ flex: 1 }}>{f.label}</span>
                  <span style={{ fontSize: 10, color: P.textFaint, background: `${P.parchment}`, borderRadius: 10, padding: "1px 5px" }}>{f.count}</span>
                </button>
              ))}
            </div>
          )}
          {/* Scrollable entry list */}
          {filteredList.length > 0 && (
            <div style={{ marginTop: 6, background: P.card, backdropFilter: "blur(12px)", borderRadius: 10, border: `1px solid ${P.rose}10`, maxHeight: "calc(100vh - 340px)", overflowY: "auto", boxShadow: "0 4px 16px rgba(61,53,82,.06)" }}>
              <div style={{ padding: "6px 10px 4px", fontSize: 10, color: P.textFaint, letterSpacing: ".12em", textTransform: "uppercase", borderBottom: `1px solid ${P.parchment}`, position: "sticky", top: 0, background: P.card, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>{filteredList.length} {markerFilter === "all" ? "entries" : markerFilter === "favorites" ? "favorites" : (TYPES[markerFilter]?.label || "entries").toLowerCase()}</span>
                <select value={listSortMode} onChange={e => setListSortMode(e.target.value)}
                  style={{ background: "none", border: "none", color: P.textFaint, fontSize: 10, fontFamily: "inherit", cursor: "pointer", letterSpacing: ".08em", textTransform: "uppercase", outline: "none", padding: 0 }}>
                  <option value="newest">newest</option>
                  <option value="oldest">oldest</option>
                  <option value="alpha">A→Z</option>
                  <option value="country">country</option>
                </select>
              </div>
              {filteredList.slice(0, listRenderLimit).map(e => entryRow(e))}
              {filteredList.length > listRenderLimit && (
                <button onClick={() => setListRenderLimit(v => v + 100)}
                  style={{ width: "100%", padding: "8px", border: "none", background: P.lavMist, cursor: "pointer", fontSize: 9, color: P.textMid, fontFamily: "inherit", letterSpacing: ".06em" }}>
                  Show more ({filteredList.length - listRenderLimit} remaining)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const EntryListPanel = memo(EntryListPanelInner);
export default EntryListPanel;
