import { useState, useEffect, useRef, useMemo } from "react";
import { getP } from "./cosmosGetP.js";
import { thumbnail } from "./imageUtils.js";

const fmtDate = d => { if (!d) return ""; const dt = new Date(d + "T12:00:00"); return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };

export default function SearchPanel({ entries, types, defaultType, isMobile, onSelectEntry, onClose, searchMatchIdsRef, isSharedWorld, memberNameMap }) {
  const P = getP();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchHl, setSearchHl] = useState(-1);
  const [searchDateFrom, setSearchDateFrom] = useState("");
  const [searchDateTo, setSearchDateTo] = useState("");
  const [searchTypeFilter, setSearchTypeFilter] = useState("all");
  const [searchSort, setSearchSort] = useState("date-desc");

  const hasSearchFilters = searchQuery.length >= 2 || searchDateFrom || searchDateTo || searchTypeFilter !== "all";

  const searchResults = useMemo(() => {
    if (!hasSearchFilters) return [];
    let results = entries;
    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      results = results.filter(e =>
        (e.city || "").toLowerCase().includes(q) ||
        (e.country || "").toLowerCase().includes(q) ||
        (e.notes || "").toLowerCase().includes(q) ||
        (e.highlights || []).some(h => h.toLowerCase().includes(q)) ||
        (e.restaurants || []).some(r => r.toLowerCase().includes(q)) ||
        (e.museums || []).some(m => m.toLowerCase().includes(q)) ||
        (e.stops || []).some(s => (s.city || "").toLowerCase().includes(q))
      );
    }
    if (searchDateFrom) results = results.filter(e => (e.dateEnd || e.dateStart) >= searchDateFrom);
    if (searchDateTo) results = results.filter(e => e.dateStart <= searchDateTo);
    if (searchTypeFilter !== "all") results = results.filter(e => e.type === searchTypeFilter);
    if (searchSort === "date-asc") results = [...results].sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));
    else if (searchSort === "alpha") results = [...results].sort((a, b) => (a.city || "").localeCompare(b.city || ""));
    else if (searchSort === "country") results = [...results].sort((a, b) => (a.country || "").localeCompare(b.country || "") || (a.city || "").localeCompare(b.city || ""));
    else results = [...results].sort((a, b) => (b.dateStart || "").localeCompare(a.dateStart || ""));
    return results;
  }, [searchQuery, searchDateFrom, searchDateTo, searchTypeFilter, searchSort, entries, hasSearchFilters]);

  // Sync search matches to ref for globe highlighting
  useEffect(() => {
    searchMatchIdsRef.current = new Set(searchResults.map(e => e.id));
  }, [searchResults, searchMatchIdsRef]);

  // Clear on unmount
  useEffect(() => {
    return () => { searchMatchIdsRef.current = new Set(); };
  }, [searchMatchIdsRef]);

  return (
    <div style={{ position: "absolute", top: 22, left: 66, zIndex: 22, width: isMobile ? "calc(100% - 80px)" : 300, animation: "fadeIn .2s ease" }}>
      <div style={{ position: "relative" }}>
        <input autoFocus value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setSearchHl(-1); }}
          onKeyDown={e => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSearchHl(h => Math.min(h + 1, searchResults.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSearchHl(h => Math.max(h - 1, -1)); }
            else if (e.key === "Enter" && searchHl >= 0 && searchHl < searchResults.length) {
              e.preventDefault();
              onSelectEntry(searchResults[searchHl]);
            }
            else if (e.key === "Escape") { onClose(); }
          }}
          placeholder="Search cities, notes, highlights..."
          style={{ width: "100%", padding: "9px 28px 9px 12px", border: `1px solid ${P.rose}25`, borderRadius: 10, fontSize: 11, fontFamily: "inherit", color: P.text, background: P.card, backdropFilter: "blur(16px)", boxShadow: "0 4px 16px rgba(0,0,0,.08)", outline: "none", boxSizing: "border-box" }}
        />
        {searchQuery.length > 0 && (
          <button onClick={() => { setSearchQuery(""); setSearchHl(-1); }} style={{ position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: P.textFaint, fontSize: 15, cursor: "pointer", padding: "6px 10px", lineHeight: 1 }}>×</button>
        )}
      </div>
      {/* Filter row: date range, type, sort */}
      <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
        <input type="date" value={searchDateFrom} onChange={e => setSearchDateFrom(e.target.value)} title="From date"
          style={{ flex: 1, minWidth: 90, padding: "5px 6px", border: `1px solid ${P.rose}20`, borderRadius: 7, fontSize: 9, fontFamily: "inherit", color: P.text, background: P.card, backdropFilter: "blur(12px)", outline: "none" }} />
        <span style={{ fontSize: 9, color: P.textFaint }}>→</span>
        <input type="date" value={searchDateTo} onChange={e => setSearchDateTo(e.target.value)} title="To date"
          style={{ flex: 1, minWidth: 90, padding: "5px 6px", border: `1px solid ${P.rose}20`, borderRadius: 7, fontSize: 9, fontFamily: "inherit", color: P.text, background: P.card, backdropFilter: "blur(12px)", outline: "none" }} />
        <select value={searchTypeFilter} onChange={e => setSearchTypeFilter(e.target.value)} title="Filter by type"
          style={{ padding: "5px 4px", border: `1px solid ${P.rose}20`, borderRadius: 7, fontSize: 9, fontFamily: "inherit", color: P.text, background: P.card, outline: "none", maxWidth: 90 }}>
          <option value="all">All types</option>
          {Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <select value={searchSort} onChange={e => setSearchSort(e.target.value)} title="Sort results"
          style={{ padding: "5px 4px", border: `1px solid ${P.rose}20`, borderRadius: 7, fontSize: 9, fontFamily: "inherit", color: P.text, background: P.card, outline: "none", maxWidth: 80 }}>
          <option value="date-desc">Newest</option>
          <option value="date-asc">Oldest</option>
          <option value="alpha">A→Z</option>
          <option value="country">Country</option>
        </select>
        {(searchDateFrom || searchDateTo || searchTypeFilter !== "all") && (
          <button onClick={() => { setSearchDateFrom(""); setSearchDateTo(""); setSearchTypeFilter("all"); setSearchSort("date-desc"); }}
            style={{ background: "none", border: "none", color: P.rose, fontSize: 9, cursor: "pointer", padding: "2px 4px", fontFamily: "inherit" }}>Clear filters</button>
        )}
      </div>
      {hasSearchFilters && (
        <div style={{ marginTop: 4, background: P.card, backdropFilter: "blur(16px)", borderRadius: 10, maxHeight: 300, overflowY: "auto", boxShadow: "0 8px 28px rgba(61,53,82,.12)", border: `1px solid ${P.rose}10`, animation: "fadeIn .2s ease" }}>
          {searchResults.length === 0 && (
            <div style={{ padding: "14px 16px", fontSize: 10, color: P.textFaint, textAlign: "center" }}>{searchQuery.length >= 2 ? <>No matches for &ldquo;{searchQuery}&rdquo;</> : "No entries match these filters"}</div>
          )}
          {searchResults.length > 0 && (
            <div style={{ padding: "6px 14px 2px", fontSize: 8, color: P.textFaint, letterSpacing: "0.5px" }}>{searchResults.length} {searchResults.length === 1 ? "result" : "results"}</div>
          )}
          {searchResults.slice(0, 50).map((e, ri) => {
            const t = types[e.type] || defaultType;
            const isHl = ri === searchHl;
            return (
              <button key={e.id} onClick={() => onSelectEntry(e)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "9px 14px", border: "none", borderBottom: `1px solid ${P.parchment}`, background: isHl ? P.blush : "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                onMouseEnter={ev => { ev.currentTarget.style.background = P.blush; setSearchHl(ri); }}
                onMouseLeave={ev => { if (ri !== searchHl) ev.currentTarget.style.background = "transparent"; }}
              >
                {(e.photos || []).length > 0
                  ? <img loading="lazy" src={thumbnail(e.photos[0], 64)} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />
                  : <span style={{ fontSize: 14, width: 28, textAlign: "center", flexShrink: 0 }}>{t.icon}</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.city}{e.favorite ? " ♥" : ""}</div>
                  <div style={{ fontSize: 8, color: P.textFaint }}>{fmtDate(e.dateStart)} · {e.country}{isSharedWorld && e.addedBy && memberNameMap[e.addedBy] ? ` · ${memberNameMap[e.addedBy]}` : ""}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
