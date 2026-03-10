import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { haversine, daysBetween } from "./utils.js";

/* =================================================================
   TravelStats — Deep-dive statistics overlay for My Cosmos
   Pure CSS visualizations, animated counters, dark cosmic aesthetic
   ================================================================= */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---- ANIMATED COUNTER ----
function AnimCounter({ target, duration = 1200, prefix = "", suffix = "" }) {
  const [val, setVal] = useState(0);
  const ref = useRef();
  useEffect(() => {
    const num = typeof target === "number" ? target : parseInt(target) || 0;
    if (num === 0) { setVal(0); return; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setVal(Math.round(ease * num));
      if (t < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);
  return <>{prefix}{val.toLocaleString()}{suffix}</>;
}

// ---- ANIMATED BAR ----
function AnimBar({ pct, color, delay = 0, label, value, subLabel }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 60 + delay);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div style={{ marginBottom: 10 }}>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 13 }}>
          <span style={{ color: "#e0dce8", fontWeight: 500 }}>{label}</span>
          <span style={{ color: "#b0acc0", fontSize: 12 }}>{value}{subLabel ? ` ${subLabel}` : ""}</span>
        </div>
      )}
      <div style={{ height: 22, background: "rgba(255,255,255,0.06)", borderRadius: 11, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 11,
          width: `${width}%`,
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)",
          boxShadow: `0 0 12px ${color}44`,
        }} />
      </div>
    </div>
  );
}

// ---- SECTION WRAPPER ----
function Section({ title, icon, children, palette }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", borderRadius: 16,
      padding: "24px 24px 20px", marginBottom: 20,
      border: "1px solid rgba(255,255,255,0.07)",
      backdropFilter: "blur(12px)",
    }}>
      <h3 style={{
        margin: "0 0 18px", fontSize: 16, fontWeight: 600,
        color: palette.rose || "#c48aa8",
        letterSpacing: "0.02em",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

// ---- STAT CARD ----
function StatCard({ label, value, icon, palette, animTarget }) {
  return (
    <div style={{
      flex: "1 1 120px", minWidth: 120, textAlign: "center",
      padding: "18px 12px", borderRadius: 14,
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: palette.rose || "#c48aa8", lineHeight: 1.1 }}>
        {animTarget != null ? <AnimCounter target={animTarget} /> : value}
      </div>
      <div style={{ fontSize: 12, color: "#9088a8", marginTop: 4, fontWeight: 500, letterSpacing: "0.03em" }}>
        {label}
      </div>
    </div>
  );
}

// ============================================================
//  MAIN COMPONENT
// ============================================================

export default function TravelStats({ entries = [], stats = {}, palette: P, onClose, worldMode, config }) {
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    const hide = setTimeout(() => setShowScrollHint(false), 4000);
    return () => clearTimeout(hide);
  }, []);

  const handleScroll = useCallback(() => {
    if (showScrollHint) setShowScrollHint(false);
  }, [showScrollHint]);

  // ---- sort entries by date ----
  const sorted = useMemo(() =>
    [...entries].filter(e => e.dateStart).sort((a, b) => a.dateStart.localeCompare(b.dateStart)),
    [entries]
  );

  // ---- OVERVIEW STATS ----
  const overview = useMemo(() => {
    const countries = new Set();
    const cities = new Set();
    let totalMiles = 0, totalDays = 0;
    sorted.forEach((e, i) => {
      if (e.country) countries.add(e.country);
      if (e.city) cities.add(e.city + "," + e.country);
      (e.stops || []).forEach(s => {
        if (s.country) countries.add(s.country);
        if (s.city) cities.add(s.city + "," + s.country);
      });
      const end = e.dateEnd || e.dateStart;
      totalDays += daysBetween(e.dateStart, end);
      if (i > 0) {
        const prev = sorted[i - 1];
        if (prev.lat != null && prev.lng != null && e.lat != null && e.lng != null) {
          totalMiles += haversine(prev.lat, prev.lng, e.lat, e.lng);
        }
      }
    });
    return { countries: countries.size, cities: cities.size, totalMiles, totalDays, trips: sorted.length };
  }, [sorted]);

  // ---- TRAVEL HEATMAP ----
  const heatmap = useMemo(() => {
    if (!sorted.length) return { years: [], data: {}, maxDays: 1 };
    const data = {}; // { year: { month: days } }
    sorted.forEach(e => {
      const start = new Date(e.dateStart + "T12:00:00");
      const end = new Date((e.dateEnd || e.dateStart) + "T12:00:00");
      const cur = new Date(start);
      while (cur <= end) {
        const y = cur.getFullYear(), m = cur.getMonth();
        if (!data[y]) data[y] = {};
        data[y][m] = (data[y][m] || 0) + 1;
        cur.setDate(cur.getDate() + 1);
      }
    });
    const years = Object.keys(data).map(Number).sort();
    let maxDays = 1;
    years.forEach(y => { for (let m = 0; m < 12; m++) maxDays = Math.max(maxDays, data[y][m] || 0); });
    return { years, data, maxDays };
  }, [sorted]);

  // ---- TRIP DURATION DISTRIBUTION ----
  const durations = useMemo(() => {
    const buckets = { "Day Trip": 0, "Weekend (2-3d)": 0, "Short (4-7d)": 0, "Medium (8-14d)": 0, "Long (15d+)": 0 };
    sorted.forEach(e => {
      const d = daysBetween(e.dateStart, e.dateEnd || e.dateStart);
      if (d <= 1) buckets["Day Trip"]++;
      else if (d <= 3) buckets["Weekend (2-3d)"]++;
      else if (d <= 7) buckets["Short (4-7d)"]++;
      else if (d <= 14) buckets["Medium (8-14d)"]++;
      else buckets["Long (15d+)"]++;
    });
    const max = Math.max(1, ...Object.values(buckets));
    return { buckets, max };
  }, [sorted]);

  // ---- TOP DESTINATIONS ----
  const topDest = useMemo(() => {
    const countryCounts = {}, cityCounts = {};
    entries.forEach(e => {
      if (e.country) countryCounts[e.country] = (countryCounts[e.country] || 0) + 1;
      if (e.city) cityCounts[e.city] = (cityCounts[e.city] || 0) + 1;
      (e.stops || []).forEach(s => {
        if (s.country) countryCounts[s.country] = (countryCounts[s.country] || 0) + 1;
        if (s.city) cityCounts[s.city] = (cityCounts[s.city] || 0) + 1;
      });
    });
    const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maxC = topCountries.length ? topCountries[0][1] : 1;
    const maxCi = topCities.length ? topCities[0][1] : 1;
    return { topCountries, topCities, maxC, maxCi };
  }, [entries]);

  // ---- TRAVEL PATTERNS ----
  const patterns = useMemo(() => {
    if (!sorted.length) return {};
    // Average trip length
    let totalLen = 0;
    sorted.forEach(e => { totalLen += daysBetween(e.dateStart, e.dateEnd || e.dateStart); });
    const avgLen = (totalLen / sorted.length).toFixed(1);

    // Most common type
    const typeCounts = {};
    entries.forEach(e => {
      if (e.type) typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
    });
    const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];

    // Busiest month
    const monthCounts = new Array(12).fill(0);
    sorted.forEach(e => {
      const m = new Date(e.dateStart + "T12:00:00").getMonth();
      monthCounts[m]++;
    });
    const busiestMonth = MONTHS[monthCounts.indexOf(Math.max(...monthCounts))];

    // Longest gap
    let longestGap = 0, longestGapBetween = null;
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = sorted[i - 1].dateEnd || sorted[i - 1].dateStart;
      const gap = daysBetween(prevEnd, sorted[i].dateStart);
      if (gap > longestGap) {
        longestGap = gap;
        longestGapBetween = [sorted[i - 1].city, sorted[i].city];
      }
    }

    // Current streak: consecutive months with travel (counting backward from most recent)
    const travelMonths = new Set();
    sorted.forEach(e => {
      const d = new Date(e.dateStart + "T12:00:00");
      travelMonths.add(`${d.getFullYear()}-${d.getMonth()}`);
    });
    let streak = 0;
    const now = new Date();
    let curY = now.getFullYear(), curM = now.getMonth();
    while (travelMonths.has(`${curY}-${curM}`)) {
      streak++;
      curM--;
      if (curM < 0) { curM = 11; curY--; }
    }

    return { avgLen, topType, busiestMonth, longestGap, longestGapBetween, streak, monthCounts };
  }, [sorted, entries]);

  // ---- DISTANCE RECORDS ----
  const distRecords = useMemo(() => {
    if (!sorted.length) return {};
    // Home entry
    const homeEntry = entries.find(e => e.type === "home" || e.type === "home-seth" || e.type === "home-rosie");
    let furthest = null, furthestDist = 0;
    if (homeEntry) {
      entries.forEach(e => {
        if (e === homeEntry || !e.lat || !e.lng) return;
        const d = haversine(homeEntry.lat, homeEntry.lng, e.lat, e.lng);
        if (d > furthestDist) { furthestDist = d; furthest = e; }
      });
    }

    // Longest single trip by distance (entry with stops or multi-leg)
    let longestTrip = null, longestTripDist = 0;
    entries.forEach(e => {
      if (!e.lat || !e.lng) return;
      let tripDist = 0;
      const legs = [e, ...(e.stops || [])];
      for (let i = 1; i < legs.length; i++) {
        if (legs[i].lat && legs[i].lng && legs[i - 1].lat && legs[i - 1].lng) {
          tripDist += haversine(legs[i - 1].lat, legs[i - 1].lng, legs[i].lat, legs[i].lng);
        }
      }
      // Also consider distance from home if available
      if (homeEntry && tripDist === 0) {
        tripDist = haversine(homeEntry.lat, homeEntry.lng, e.lat, e.lng);
      }
      if (tripDist > longestTripDist) { longestTripDist = tripDist; longestTrip = e; }
    });

    // Cumulative distance over time
    let cum = 0;
    const cumulative = sorted.map((e, i) => {
      if (i > 0) {
        const prev = sorted[i - 1];
        if (prev.lat != null && prev.lng != null && e.lat != null && e.lng != null) {
          cum += haversine(prev.lat, prev.lng, e.lat, e.lng);
        }
      }
      return { date: e.dateStart, miles: cum, city: e.city };
    });

    return { furthest, furthestDist, longestTrip, longestTripDist, cumulative };
  }, [sorted, entries]);

  // ---- FAVORITES & HIGHLIGHTS ----
  const favs = useMemo(() => {
    const favorited = entries.filter(e => e.favorite);
    const byPhotos = [...entries].filter(e => (e.photos || []).length > 0).sort((a, b) => (b.photos || []).length - (a.photos || []).length).slice(0, 5);
    const byMemories = [...entries].filter(e => (e.memories || []).length + (e.highlights || []).length > 0)
      .sort((a, b) => ((b.memories || []).length + (b.highlights || []).length) - ((a.memories || []).length + (a.highlights || []).length)).slice(0, 5);
    return { favorited, byPhotos, byMemories };
  }, [entries]);

  // ---- YEAR COMPARISON ----
  const yearComp = useMemo(() => {
    const byYear = {};
    sorted.forEach(e => {
      const y = new Date(e.dateStart + "T12:00:00").getFullYear();
      if (!byYear[y]) byYear[y] = { trips: 0, days: 0, countries: new Set(), cities: new Set(), miles: 0, photos: 0, entries: [] };
      byYear[y].trips++;
      byYear[y].days += daysBetween(e.dateStart, e.dateEnd || e.dateStart);
      if (e.country) byYear[y].countries.add(e.country);
      if (e.city) byYear[y].cities.add(e.city);
      byYear[y].photos += (e.photos || []).length;
      byYear[y].entries.push(e);
    });
    // Add miles
    sorted.forEach((e, i) => {
      if (i === 0) return;
      const y = new Date(e.dateStart + "T12:00:00").getFullYear();
      {
        const prev = sorted[i - 1];
        if (prev.lat != null && prev.lng != null && e.lat != null && e.lng != null) {
          byYear[y].miles += haversine(prev.lat, prev.lng, e.lat, e.lng);
        }
      }
    });
    const years = Object.keys(byYear).map(Number).sort();
    const result = years.map(y => ({
      year: y, trips: byYear[y].trips, days: byYear[y].days,
      countries: byYear[y].countries.size, cities: byYear[y].cities.size,
      miles: Math.round(byYear[y].miles), photos: byYear[y].photos,
    }));
    return result;
  }, [sorted]);

  // ---- PALETTE COLORS ----
  const accent = P.rose || "#c48aa8";
  const accent2 = P.sky || "#8ca8c8";
  const accent3 = P.sage || "#90b080";
  const accent4 = P.gold || "#c8a060";
  const accent5 = P.heart || "#d06888";
  const accent6 = P.lavender || "#a898c0";
  const barColors = [accent, accent2, accent3, accent4, accent5, accent6];

  // ---- RENDER ----
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "linear-gradient(180deg, #0c0a14 0%, #161226 40%, #1a1030 100%)",
      opacity: mounted ? 1 : 0,
      transition: "opacity 0.4s ease",
      display: "flex", flexDirection: "column",
    }}>
      {/* HEADER */}
      <div style={{
        padding: "20px 24px 12px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f0ecf6", letterSpacing: "-0.01em" }}>
            Travel Deep Dive
          </h2>
          <div style={{ fontSize: 12, color: "#787090", marginTop: 2 }}>
            {overview.trips} trips across {overview.countries} countries
          </div>
        </div>
        <button onClick={onClose} style={{
          width: 40, height: 40, borderRadius: 20,
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)",
          color: "#c0b8d8", fontSize: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.2s",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
        >
          &times;
        </button>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div ref={scrollRef} onScroll={handleScroll} style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        padding: "20px 20px 80px",
        scrollBehavior: "smooth",
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>

          {/* ---- OVERVIEW ---- */}
          <Section title="Overview" icon="🌎" palette={P}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <StatCard label="Adventures" value={overview.trips} icon="🧭" palette={P} animTarget={overview.trips} />
              <StatCard label="Countries" value={overview.countries} icon="🌍" palette={P} animTarget={overview.countries} />
              <StatCard label="Cities" value={overview.cities} icon="🏙️" palette={P} animTarget={overview.cities} />
              <StatCard label="Miles" value={overview.totalMiles.toLocaleString()} icon="✈️" palette={P} animTarget={overview.totalMiles} />
              <StatCard label="Travel Days" value={overview.totalDays} icon="📅" palette={P} animTarget={overview.totalDays} />
            </div>
          </Section>

          {/* ---- TRAVEL HEATMAP ---- */}
          {heatmap.years.length > 0 && (
            <Section title="Travel Heatmap" icon="🗓️" palette={P}>
              <div style={{ fontSize: 11, color: "#7870908a", marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
                <span>Less</span>
                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                  {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v, i) => (
                    <div key={i} style={{
                      width: 12, height: 12, borderRadius: 3,
                      background: v === 0 ? "rgba(255,255,255,0.06)" : `${accent}${Math.round(v * 200 + 55).toString(16).padStart(2, "0")}`,
                    }} />
                  ))}
                </div>
                <span>More</span>
              </div>
              {heatmap.years.map(y => (
                <div key={y} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: "#9088a8", fontWeight: 600, marginBottom: 6 }}>{y}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4 }}>
                    {MONTHS.map((m, mi) => {
                      const days = heatmap.data[y]?.[mi] || 0;
                      const intensity = days / heatmap.maxDays;
                      return (
                        <div key={mi} title={`${m} ${y}: ${days} day${days !== 1 ? "s" : ""}`} style={{
                          aspectRatio: "1", borderRadius: 4,
                          background: days === 0
                            ? "rgba(255,255,255,0.04)"
                            : `${accent}${Math.round(intensity * 200 + 55).toString(16).padStart(2, "0")}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, color: days > 0 ? "#fff" : "#504868",
                          fontWeight: days > 0 ? 600 : 400,
                          transition: "background 0.3s",
                          cursor: "default",
                        }}>
                          {m.slice(0, 1)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* ---- TRIP DURATION DISTRIBUTION ---- */}
          <Section title="Trip Duration" icon="⏱️" palette={P}>
            {Object.entries(durations.buckets).map(([label, count], i) => (
              <AnimBar
                key={label}
                label={label}
                value={count}
                subLabel={count === 1 ? "trip" : "trips"}
                pct={(count / durations.max) * 100}
                color={barColors[i % barColors.length]}
                delay={i * 80}
              />
            ))}
          </Section>

          {/* ---- TOP DESTINATIONS ---- */}
          <Section title="Top Destinations" icon="📍" palette={P}>
            {topDest.topCountries.length > 0 && (
              <>
                <div style={{ fontSize: 13, color: "#b0acc0", fontWeight: 600, marginBottom: 8, letterSpacing: "0.04em" }}>
                  COUNTRIES
                </div>
                {topDest.topCountries.map(([name, count], i) => (
                  <AnimBar
                    key={name}
                    label={name}
                    value={count}
                    subLabel={count === 1 ? "visit" : "visits"}
                    pct={(count / topDest.maxC) * 100}
                    color={accent}
                    delay={i * 60}
                  />
                ))}
              </>
            )}
            {topDest.topCities.length > 0 && (
              <>
                <div style={{ fontSize: 13, color: "#b0acc0", fontWeight: 600, margin: "16px 0 8px", letterSpacing: "0.04em" }}>
                  CITIES
                </div>
                {topDest.topCities.map(([name, count], i) => (
                  <AnimBar
                    key={name}
                    label={name}
                    value={count}
                    subLabel={count === 1 ? "visit" : "visits"}
                    pct={(count / topDest.maxCi) * 100}
                    color={accent2}
                    delay={i * 60}
                  />
                ))}
              </>
            )}
          </Section>

          {/* ---- TRAVEL PATTERNS ---- */}
          {sorted.length > 0 && (
            <Section title="Travel Patterns" icon="📊" palette={P}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Avg Trip Length", value: `${patterns.avgLen} days`, icon: "📏" },
                  { label: "Most Common Type", value: patterns.topType ? patterns.topType[0].replace(/-/g, " ") : "—", icon: "🏷️" },
                  { label: "Busiest Month", value: patterns.busiestMonth || "—", icon: "📅" },
                  { label: "Longest Gap", value: patterns.longestGap ? `${patterns.longestGap} days` : "—", icon: "⏸️" },
                  { label: "Travel Streak", value: patterns.streak ? `${patterns.streak} mo` : "0 mo", icon: "🔥" },
                  { label: "Total Travel Days", value: `${overview.totalDays}`, icon: "🗓️" },
                ].map((item, i) => (
                  <div key={i} style={{
                    padding: "14px 12px", borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}>
                    <div style={{ fontSize: 14, marginBottom: 4 }}>{item.icon}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#e8e4f0" }}>{item.value}</div>
                    <div style={{ fontSize: 11, color: "#7870908a", marginTop: 2 }}>{item.label}</div>
                  </div>
                ))}
              </div>

              {/* Monthly activity sparkline */}
              {patterns.monthCounts && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 12, color: "#9088a8", fontWeight: 600, marginBottom: 8 }}>Trips by Month</div>
                  <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 80 }}>
                    {(() => { const maxM = Math.max(1, ...patterns.monthCounts); return patterns.monthCounts.map((c, i) => {
                      return (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <div style={{
                            width: "100%", borderRadius: "4px 4px 0 0",
                            height: `${(c / maxM) * 60 + 4}px`,
                            background: c > 0 ? `linear-gradient(180deg, ${accent}, ${accent}88)` : "rgba(255,255,255,0.05)",
                            transition: "height 0.6s ease",
                          }} />
                          <div style={{ fontSize: 9, color: "#706888" }}>{MONTHS[i].slice(0, 1)}</div>
                        </div>
                      );
                    }); })()}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* ---- DISTANCE RECORDS ---- */}
          <Section title="Distance Records" icon="🛫" palette={P}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              {distRecords.furthest && (
                <div style={{
                  flex: "1 1 200px", padding: "16px", borderRadius: 12,
                  background: `linear-gradient(135deg, ${accent}18, ${accent}08)`,
                  border: `1px solid ${accent}30`,
                }}>
                  <div style={{ fontSize: 12, color: "#9088a8", fontWeight: 600, marginBottom: 4 }}>Furthest from Home</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: accent }}>{distRecords.furthest.city}</div>
                  <div style={{ fontSize: 13, color: "#b0acc0" }}>
                    {distRecords.furthestDist.toLocaleString()} miles away
                  </div>
                </div>
              )}
              {distRecords.longestTrip && (
                <div style={{
                  flex: "1 1 200px", padding: "16px", borderRadius: 12,
                  background: `linear-gradient(135deg, ${accent2}18, ${accent2}08)`,
                  border: `1px solid ${accent2}30`,
                }}>
                  <div style={{ fontSize: 12, color: "#9088a8", fontWeight: 600, marginBottom: 4 }}>Longest Trip Distance</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: accent2 }}>{distRecords.longestTrip.city}</div>
                  <div style={{ fontSize: 13, color: "#b0acc0" }}>
                    {distRecords.longestTripDist.toLocaleString()} miles
                  </div>
                </div>
              )}
            </div>

            {/* Cumulative distance line */}
            {distRecords.cumulative && distRecords.cumulative.length > 1 && (() => {
              const maxMiles = Math.max(1, ...distRecords.cumulative.map(c => c.miles));
              const pts = distRecords.cumulative;
              return (
                <div>
                  <div style={{ fontSize: 12, color: "#9088a8", fontWeight: 600, marginBottom: 8 }}>Cumulative Miles Over Time</div>
                  <div style={{ position: "relative", height: 100, background: "rgba(255,255,255,0.03)", borderRadius: 10, overflow: "hidden" }}>
                    {/* Area fill */}
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "100%", display: "flex", alignItems: "flex-end" }}>
                      {pts.map((p, i) => (
                        <div key={i} style={{
                          flex: 1,
                          height: `${(p.miles / maxMiles) * 90 + 5}%`,
                          background: `linear-gradient(180deg, ${accent}40 0%, ${accent}08 100%)`,
                          borderTop: `2px solid ${accent}90`,
                          transition: "height 1s ease",
                        }} />
                      ))}
                    </div>
                    {/* Labels */}
                    <div style={{ position: "absolute", top: 6, left: 8, fontSize: 10, color: "#706888" }}>
                      {pts[0]?.date?.slice(0, 4)}
                    </div>
                    <div style={{ position: "absolute", top: 6, right: 8, fontSize: 10, color: "#706888" }}>
                      {pts[pts.length - 1]?.date?.slice(0, 4)} — {maxMiles.toLocaleString()} mi
                    </div>
                  </div>
                </div>
              );
            })()}
          </Section>

          {/* ---- FAVORITES & HIGHLIGHTS ---- */}
          <Section title="Favorites & Highlights" icon="⭐" palette={P}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <StatCard label="Favorited" value={favs.favorited.length} icon="❤️" palette={P} animTarget={favs.favorited.length} />
              <StatCard label="Total Photos" value={(stats.photos || 0)} icon="📸" palette={P} animTarget={stats.photos || entries.reduce((s, e) => s + (e.photos || []).length, 0)} />
              <StatCard label="Memories Logged" value={entries.reduce((s, e) => s + (e.memories || []).length, 0)} icon="💭" palette={P}
                animTarget={entries.reduce((s, e) => s + (e.memories || []).length, 0)} />
            </div>

            {favs.byPhotos.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: "#9088a8", fontWeight: 600, marginBottom: 8, marginTop: 8 }}>Most Photographed</div>
                {favs.byPhotos.map((e, i) => (
                  <div key={e.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 12px", borderRadius: 8,
                    background: i === 0 ? `${accent4}18` : "transparent",
                    marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 13, color: "#d8d4e4", fontWeight: i === 0 ? 600 : 400 }}>
                      {e.city}{e.country ? `, ${e.country}` : ""}
                    </span>
                    <span style={{ fontSize: 12, color: accent4, fontWeight: 600 }}>
                      {(e.photos || []).length} photos
                    </span>
                  </div>
                ))}
              </>
            )}

            {favs.byMemories.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: "#9088a8", fontWeight: 600, marginBottom: 8, marginTop: 16 }}>Most Memories</div>
                {favs.byMemories.map((e, i) => (
                  <div key={e.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 12px", borderRadius: 8,
                    background: i === 0 ? `${accent3}18` : "transparent",
                    marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 13, color: "#d8d4e4", fontWeight: i === 0 ? 600 : 400 }}>
                      {e.city}{e.country ? `, ${e.country}` : ""}
                    </span>
                    <span style={{ fontSize: 12, color: accent3, fontWeight: 600 }}>
                      {(e.memories || []).length + (e.highlights || []).length} entries
                    </span>
                  </div>
                ))}
              </>
            )}
          </Section>

          {/* ---- YEAR COMPARISON ---- */}
          {yearComp.length > 1 && (
            <Section title="Year Comparison" icon="📈" palette={P}>
              <div style={{ overflowX: "auto", paddingBottom: 8 }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: `100px repeat(${yearComp.length}, 1fr)`,
                  gap: 1, fontSize: 13, minWidth: yearComp.length > 3 ? yearComp.length * 90 + 100 : "auto",
                }}>
                  {/* Header row */}
                  <div style={{ padding: "8px 4px", color: "#706888", fontWeight: 600 }} />
                  {yearComp.map(y => (
                    <div key={y.year} style={{
                      padding: "8px 4px", textAlign: "center",
                      color: accent, fontWeight: 700, fontSize: 14,
                    }}>
                      {y.year}
                    </div>
                  ))}

                  {/* Data rows */}
                  {[
                    { label: "Trips", key: "trips" },
                    { label: "Days", key: "days" },
                    { label: "Countries", key: "countries" },
                    { label: "Cities", key: "cities" },
                    { label: "Miles", key: "miles", fmt: v => v.toLocaleString() },
                    { label: "Photos", key: "photos" },
                  ].map((row, ri) => {
                    const vals = yearComp.map(y => y[row.key]);
                    const maxVal = Math.max(1, ...vals);
                    return [
                      <div key={`l-${ri}`} style={{
                        padding: "10px 4px", color: "#9088a8", fontWeight: 500,
                        borderTop: "1px solid rgba(255,255,255,0.04)",
                        display: "flex", alignItems: "center",
                      }}>
                        {row.label}
                      </div>,
                      ...yearComp.map((y, yi) => (
                        <div key={`${ri}-${yi}`} style={{
                          padding: "10px 4px", textAlign: "center",
                          borderTop: "1px solid rgba(255,255,255,0.04)",
                        }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: "#e0dcec" }}>
                            {row.fmt ? row.fmt(y[row.key]) : y[row.key]}
                          </div>
                          <div style={{
                            height: 4, borderRadius: 2, marginTop: 4,
                            background: `${barColors[ri % barColors.length]}${Math.round((y[row.key] / maxVal) * 200 + 55).toString(16).padStart(2, "0")}`,
                          }} />
                        </div>
                      )),
                    ];
                  })}
                </div>
              </div>
            </Section>
          )}

          {/* Empty state */}
          {entries.length === 0 && (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              color: "#706888",
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🌏</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>No adventures yet</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>Add your first trip to see your travel stats come alive.</div>
            </div>
          )}
        </div>
      </div>

      {/* SCROLL HINT */}
      {showScrollHint && entries.length > 0 && (
        <div style={{
          position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
          padding: "8px 18px", borderRadius: 20,
          background: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)",
          color: "#9088a8", fontSize: 12, fontWeight: 500,
          animation: "tsBounce 2s ease infinite",
          pointerEvents: "none",
        }}>
          Scroll for more
          <style>{`@keyframes tsBounce { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-6px); } }`}</style>
        </div>
      )}
    </div>
  );
}
