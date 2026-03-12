import { useState, useMemo, useEffect, useRef, useCallback } from "react";

/* TripJournal.jsx — Swipeable scrapbook-style trip journal overlay
 *
 * Groups consecutive/overlapping entries into "trips" and presents them
 * as swipeable scrapbook pages with photos, notes, highlights, and route info.
 */

const STYLE_ID = "trip-journal-keyframes";

function injectKeyframes() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes tj-slideInRight { from { transform: translateX(60px) rotate(1deg); opacity: 0; } to { transform: translateX(0) rotate(0); opacity: 1; } }
    @keyframes tj-slideInLeft { from { transform: translateX(-60px) rotate(-1deg); opacity: 0; } to { transform: translateX(0) rotate(0); opacity: 1; } }
    @keyframes tj-fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes tj-fadeOverlay { from { opacity: 0; backdrop-filter: blur(0); } to { opacity: 1; backdrop-filter: blur(12px); } }
  `;
  document.head.appendChild(style);
}

function thumb(url) {
  if (!url) return url;
  if (url.includes("supabase")) return url + "?width=96&height=96&resize=contain";
  return url;
}

function dateFmt(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[+m - 1]} ${+day}, ${y}`;
}

function daysBetween(a, b) {
  if (!a || !b) return Infinity;
  return (new Date(b) - new Date(a)) / 86400000;
}

/** Build trips from entries: group by country + temporal proximity (3 days). */
function buildTrips(entries) {
  if (!entries || !entries.length) return [];
  const sorted = [...entries].sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));
  const trips = [];
  let cur = null;

  for (const e of sorted) {
    const country = e.country || "Unknown";
    if (
      cur &&
      cur.country === country &&
      daysBetween(cur.dateEnd || cur.dateStart, e.dateStart) <= 3
    ) {
      cur.entries.push(e);
      if (e.dateEnd && (!cur.dateEnd || e.dateEnd > cur.dateEnd)) cur.dateEnd = e.dateEnd;
      if (!cur.dateEnd && e.dateStart > (cur.dateStart || "")) cur.dateEnd = e.dateStart;
      if (!cur.cities.includes(e.city || "")) cur.cities.push(e.city || "");
    } else {
      cur = {
        country,
        dateStart: e.dateStart || "",
        dateEnd: e.dateEnd || e.dateStart || "",
        entries: [e],
        cities: [e.city || ""],
      };
      trips.push(cur);
    }
  }

  return trips.map((t) => ({
    ...t,
    name:
      t.cities.length <= 3
        ? t.cities.filter(Boolean).join(" \u2192 ") || t.country
        : `${t.cities[0]} \u2192 ... \u2192 ${t.cities[t.cities.length - 1]}`,
    dateLabel:
      t.dateStart === t.dateEnd || !t.dateEnd
        ? dateFmt(t.dateStart)
        : `${dateFmt(t.dateStart)} \u2013 ${dateFmt(t.dateEnd)}`,
  }));
}

export default function TripJournal({
  entries,
  palette,
  types,
  onClose,
  onSelectEntry,
  flyTo,
}) {
  const P = palette || {};
  const injectedRef = useRef(false);
  const touchRef = useRef(null);
  const [tripIdx, setTripIdx] = useState(0);
  const [pageIdx, setPageIdx] = useState(0);
  const [dir, setDir] = useState("right");

  useEffect(() => {
    if (!injectedRef.current) { injectKeyframes(); injectedRef.current = true; }
  }, []);

  const trips = useMemo(() => buildTrips(entries), [entries]);

  // Reset page when trip changes
  useEffect(() => { setPageIdx(0); }, [tripIdx]);

  const trip = trips[tripIdx] || null;
  const entry = trip ? trip.entries[pageIdx] || null : null;
  const totalPages = trip ? trip.entries.length : 0;

  const go = useCallback(
    (delta) => {
      if (!trip) return;
      const next = pageIdx + delta;
      if (next < 0 || next >= totalPages) return;
      setDir(delta > 0 ? "right" : "left");
      setPageIdx(next);
    },
    [pageIdx, totalPages, trip],
  );

  // Keyboard
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") { onClose?.(); return; }
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [go, onClose]);

  // Touch swipe
  const onTouchStart = useCallback((e) => {
    touchRef.current = e.touches[0].clientX;
  }, []);
  const onTouchEnd = useCallback(
    (e) => {
      if (touchRef.current == null) return;
      const dx = e.changedTouches[0].clientX - touchRef.current;
      touchRef.current = null;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    },
    [go],
  );

  // Colors
  const bg = P.card || "rgba(20,18,28,0.97)";
  const text = P.text || "#ede6f0";
  const textMuted = P.textMuted || "#a09ca8";
  const textFaint = P.textFaint || "#6c6876";
  const accent = P.rose || P.gold || "#c48aa8";
  const gold = P.gold || "#c8a060";

  if (!entries || !entries.length) {
    return (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9000, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "rgba(10,8,20,0.85)", backdropFilter: "blur(12px)",
          animation: "tj-fadeOverlay 0.3s ease",
        }}
        onClick={onClose}
      >
        <div style={{ color: textMuted, fontSize: 18, fontFamily: "Palatino, Georgia, serif" }}>
          No trips yet — add entries to build your journal
        </div>
      </div>
    );
  }

  const typeInfo = entry && types ? types[entry.type] : null;
  const photo = entry?.photos?.length ? entry.photos[0] : null;

  const animKey = `${tripIdx}-${pageIdx}-${dir}`;
  const animName = dir === "right" ? "tj-slideInRight" : "tj-slideInLeft";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9000, display: "flex",
        background: "rgba(10,8,20,0.88)", backdropFilter: "blur(12px)",
        animation: "tj-fadeOverlay 0.3s ease", fontFamily: "'Palatino', Georgia, serif",
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Close */}
      <button
        onClick={onClose}
        aria-label="Close journal"
        style={{
          position: "absolute", top: 16, right: 20, zIndex: 9010,
          background: "none", border: "none", color: textMuted,
          fontSize: 28, cursor: "pointer", lineHeight: 1,
        }}
      >
        \u00d7
      </button>

      {/* Trip sidebar */}
      <div
        style={{
          width: 220, minWidth: 180, borderRight: `1px solid ${textFaint}33`,
          overflowY: "auto", padding: "56px 0 24px", flexShrink: 0,
        }}
      >
        <div style={{ padding: "0 16px 12px", fontSize: 11, textTransform: "uppercase",
          letterSpacing: 1.5, color: textFaint, fontFamily: "system-ui, sans-serif" }}>
          Trips ({trips.length})
        </div>
        {trips.map((t, i) => (
          <button
            key={i}
            onClick={() => { setDir("right"); setTripIdx(i); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "10px 16px", border: "none", cursor: "pointer",
              background: i === tripIdx ? `${accent}22` : "transparent",
              borderLeft: i === tripIdx ? `3px solid ${accent}` : "3px solid transparent",
              color: i === tripIdx ? text : textMuted,
              fontSize: 13, lineHeight: 1.4, fontFamily: "inherit",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ fontWeight: i === tripIdx ? 600 : 400 }}>{t.name}</div>
            <div style={{ fontSize: 11, color: textFaint, marginTop: 2 }}>{t.dateLabel}</div>
            <div style={{ fontSize: 10, color: textFaint, marginTop: 1 }}>
              {t.entries.length} {t.entries.length === 1 ? "entry" : "entries"}
            </div>
          </button>
        ))}
      </div>

      {/* Main page area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", position: "relative", overflow: "hidden", padding: 24 }}>

        {trip && entry && (
          <div
            key={animKey}
            style={{
              width: "100%", maxWidth: 640, aspectRatio: "3/4", maxHeight: "calc(100vh - 120px)",
              borderRadius: 8, overflow: "hidden", position: "relative",
              boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px ${textFaint}22`,
              transform: `rotate(${(pageIdx % 3 - 1) * 0.6}deg)`,
              animation: `${animName} 0.35s ease`,
              background: photo
                ? `linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.7))`
                : `linear-gradient(135deg, ${accent}44, ${gold}22, ${textFaint}33)`,
            }}
          >
            {/* Background photo */}
            {photo && (
              <img
                src={photo}
                alt=""
                style={{
                  position: "absolute", inset: 0, width: "100%", height: "100%",
                  objectFit: "cover", zIndex: 0,
                }}
              />
            )}
            {/* Dark overlay */}
            <div style={{
              position: "absolute", inset: 0, zIndex: 1,
              background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.65) 100%)",
            }} />

            {/* Content */}
            <div style={{
              position: "relative", zIndex: 2, height: "100%", display: "flex",
              flexDirection: "column", justifyContent: "flex-end", padding: "32px 28px 28px",
            }}>
              {/* Type badge */}
              {typeInfo && (
                <div style={{
                  position: "absolute", top: 20, left: 24, fontSize: 12,
                  background: `${accent}44`, color: "#fff", borderRadius: 20,
                  padding: "4px 12px", backdropFilter: "blur(4px)",
                  fontFamily: "system-ui, sans-serif",
                }}>
                  {typeInfo.icon} {typeInfo.label}
                </div>
              )}

              {/* Fly-to button */}
              {flyTo && (
                <button
                  onClick={() => { flyTo(entry.lat, entry.lng); onClose?.(); }}
                  aria-label="Fly to location"
                  style={{
                    position: "absolute", top: 18, right: 24, fontSize: 20,
                    background: "rgba(255,255,255,0.12)", border: "none",
                    borderRadius: "50%", width: 36, height: 36, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", backdropFilter: "blur(4px)",
                  }}
                  title="Fly to this place"
                >
                  \ud83c\udf0d
                </button>
              )}

              {/* City */}
              <h2 style={{
                margin: 0, fontSize: 36, fontWeight: 700, color: "#fff",
                textShadow: "0 2px 12px rgba(0,0,0,0.5)", lineHeight: 1.15,
              }}>
                {entry.city || "Unknown"}
              </h2>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
                {entry.country || ""}
                {entry.country && entry.dateStart ? " \u00b7 " : ""}
                {entry.dateStart === entry.dateEnd || !entry.dateEnd
                  ? dateFmt(entry.dateStart)
                  : `${dateFmt(entry.dateStart)} \u2013 ${dateFmt(entry.dateEnd)}`}
              </div>

              {/* Notes */}
              {entry.notes && (
                <p style={{
                  marginTop: 14, fontSize: 15, fontStyle: "italic", color: "rgba(255,255,255,0.85)",
                  lineHeight: 1.55, maxHeight: 72, overflow: "hidden",
                }}>
                  {entry.notes}
                </p>
              )}

              {/* Highlights */}
              {entry.highlights?.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {entry.highlights.map((h, i) => (
                    <span key={i} style={{
                      fontSize: 11, padding: "3px 10px", borderRadius: 12,
                      background: `${gold}33`, color: "#fff",
                      fontFamily: "system-ui, sans-serif",
                    }}>
                      \u2728 {h}
                    </span>
                  ))}
                </div>
              )}

              {/* Memories */}
              {entry.memories?.length > 0 && (
                <div style={{
                  marginTop: 12, padding: "8px 12px", borderRadius: 8,
                  background: "rgba(255,255,255,0.08)", backdropFilter: "blur(4px)",
                }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4,
                    fontFamily: "system-ui, sans-serif" }}>
                    \ud83d\udcad Memories
                  </div>
                  {entry.memories.slice(0, 3).map((m, i) => (
                    <div key={i} style={{
                      fontSize: 13, color: "rgba(255,255,255,0.8)",
                      lineHeight: 1.45, marginTop: i ? 4 : 0,
                    }}>
                      {m}
                    </div>
                  ))}
                </div>
              )}

              {/* Photo strip */}
              {entry.photos?.length > 1 && (
                <div style={{
                  marginTop: 12, display: "flex", gap: 6, overflowX: "auto",
                  paddingBottom: 2,
                }}>
                  {entry.photos.slice(0, 8).map((p, i) => (
                    <img
                      key={i}
                      src={thumb(p)}
                      alt=""
                      style={{
                        width: 48, height: 48, borderRadius: 6, objectFit: "cover",
                        border: i === 0 ? `2px solid ${accent}` : "2px solid rgba(255,255,255,0.2)",
                        flexShrink: 0, cursor: "pointer",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEntry?.(entry);
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Select entry link */}
              {onSelectEntry && (
                <button
                  onClick={() => onSelectEntry(entry)}
                  style={{
                    marginTop: 12, background: "none", border: `1px solid rgba(255,255,255,0.2)`,
                    color: "rgba(255,255,255,0.7)", fontSize: 12, padding: "5px 14px",
                    borderRadius: 16, cursor: "pointer", alignSelf: "flex-start",
                    fontFamily: "system-ui, sans-serif",
                    transition: "all 0.15s ease",
                  }}
                >
                  View full entry \u2192
                </button>
              )}
            </div>
          </div>
        )}

        {/* Page navigation arrows */}
        {totalPages > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              disabled={pageIdx === 0}
              aria-label="Previous page"
              style={{
                position: "absolute", left: 24, top: "50%", transform: "translateY(-50%)",
                background: pageIdx === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)",
                border: "none", color: pageIdx === 0 ? textFaint : "#fff",
                fontSize: 22, width: 40, height: 40, borderRadius: "50%",
                cursor: pageIdx === 0 ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s ease",
              }}
            >
              \u2039
            </button>
            <button
              onClick={() => go(1)}
              disabled={pageIdx === totalPages - 1}
              aria-label="Next page"
              style={{
                position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)",
                background: pageIdx === totalPages - 1 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)",
                border: "none", color: pageIdx === totalPages - 1 ? textFaint : "#fff",
                fontSize: 22, width: 40, height: 40, borderRadius: "50%",
                cursor: pageIdx === totalPages - 1 ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s ease",
              }}
            >
              \u203a
            </button>
          </>
        )}

        {/* Dot indicators */}
        {totalPages > 1 && (
          <div style={{
            display: "flex", gap: 6, marginTop: 16, justifyContent: "center",
          }}>
            {trip.entries.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDir(i > pageIdx ? "right" : "left"); setPageIdx(i); }}
                aria-label={`Page ${i + 1}`}
                style={{
                  width: i === pageIdx ? 18 : 7, height: 7, borderRadius: 4,
                  background: i === pageIdx ? accent : `${textMuted}66`,
                  border: "none", cursor: "pointer", padding: 0,
                  transition: "all 0.2s ease",
                }}
              />
            ))}
          </div>
        )}

        {/* Trip route mini indicator */}
        {trip && trip.cities.length > 1 && (
          <div style={{
            marginTop: 10, fontSize: 11, color: textFaint,
            fontFamily: "system-ui, sans-serif", textAlign: "center",
          }}>
            {trip.cities.filter(Boolean).join(" \u2192 ")}
          </div>
        )}
      </div>
    </div>
  );
}
