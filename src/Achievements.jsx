import { useState, useMemo, useEffect, useRef } from "react";

/* =================================================================
   Achievements / Badges — gamification layer for My Cosmos
   Pure-function achievement calculations from entries + stats.
   Full-screen overlay with cosmic dark aesthetic.
   ================================================================= */

// Haversine (miles) — duplicated from OurWorld to keep this module standalone
const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 3959, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const daysBetween = (a, b) => Math.max(1, Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000));

// ============================================================
//  BADGE DEFINITIONS
// ============================================================

const BADGE_CATEGORIES = [
  {
    key: "explorer",
    title: "Explorer Badges",
    subtitle: "Based on total entries",
    badges: [
      { id: "explorer-1",   name: "First Step",     icon: "\u2b50",     threshold: 1,   unit: "entries",   desc: "Log your first travel entry" },
      { id: "explorer-5",   name: "Wanderer",       icon: "\ud83e\udded", threshold: 5,   unit: "entries",   desc: "Log 5 travel entries" },
      { id: "explorer-10",  name: "Adventurer",     icon: "\ud83c\udfd4\ufe0f", threshold: 10,  unit: "entries",   desc: "Log 10 travel entries" },
      { id: "explorer-25",  name: "Globe Trotter",  icon: "\ud83c\udf0d", threshold: 25,  unit: "entries",   desc: "Log 25 travel entries" },
      { id: "explorer-50",  name: "World Traveler", icon: "\u2708\ufe0f", threshold: 50,  unit: "entries",   desc: "Log 50 travel entries" },
      { id: "explorer-100", name: "Legend",          icon: "\ud83d\udc51", threshold: 100, unit: "entries",   desc: "Log 100 travel entries" },
    ],
  },
  {
    key: "countries",
    title: "Country Collector",
    subtitle: "Based on unique countries visited",
    badges: [
      { id: "country-2",  name: "Passport Stamped",    icon: "\ud83d\udec2", threshold: 2,  unit: "countries", desc: "Visit 2 different countries" },
      { id: "country-5",  name: "Continental",          icon: "\ud83d\uddfa\ufe0f", threshold: 5,  unit: "countries", desc: "Visit 5 different countries" },
      { id: "country-10", name: "International",        icon: "\ud83c\udf10", threshold: 10, unit: "countries", desc: "Visit 10 different countries" },
      { id: "country-25", name: "Diplomat",              icon: "\ud83c\udfdb\ufe0f", threshold: 25, unit: "countries", desc: "Visit 25 different countries" },
      { id: "country-50", name: "Citizen of the World", icon: "\ud83c\udf0e", threshold: 50, unit: "countries", desc: "Visit 50 different countries" },
    ],
  },
  {
    key: "distance",
    title: "Distance Achievements",
    subtitle: "Based on total miles traveled",
    badges: [
      { id: "dist-100",    name: "Around the Block", icon: "\ud83d\udeb6", threshold: 100,    unit: "miles", desc: "Travel 100 miles" },
      { id: "dist-1000",   name: "Road Warrior",     icon: "\ud83d\ude97", threshold: 1000,   unit: "miles", desc: "Travel 1,000 miles" },
      { id: "dist-10000",  name: "Sky High",         icon: "\u2708\ufe0f", threshold: 10000,  unit: "miles", desc: "Travel 10,000 miles" },
      { id: "dist-25000",  name: "Orbit",            icon: "\ud83d\udef8", threshold: 25000,  unit: "miles", desc: "Travel 25,000 miles \u2014 the circumference of Earth" },
      { id: "dist-238900", name: "To the Moon",      icon: "\ud83c\udf19", threshold: 238900, unit: "miles", desc: "Travel 238,900 miles \u2014 the distance to the Moon" },
    ],
  },
  {
    key: "type",
    title: "Type Specialist",
    subtitle: "Based on entry types and content",
    badges: [
      { id: "type-beach",   name: "Beach Bum",      icon: "\ud83c\udfd6\ufe0f", threshold: 5, unit: "beach trips",    desc: "Log 5 beach or coast trips" },
      { id: "type-city",    name: "City Slicker",    icon: "\ud83c\udfd9\ufe0f", threshold: 5, unit: "city trips",     desc: "Log 5 city break trips" },
      { id: "type-nature",  name: "Mountain Goat",   icon: "\u26f0\ufe0f",       threshold: 5, unit: "nature trips",   desc: "Log 5 nature or adventure trips" },
      { id: "type-culture", name: "Culture Vulture", icon: "\ud83c\udfad",       threshold: 5, unit: "museum entries", desc: "Have 5 or more museum/culture entries across all trips" },
      { id: "type-food",    name: "Foodie",          icon: "\ud83c\udf7d\ufe0f", threshold: 5, unit: "restaurant entries", desc: "Have 5 or more restaurant entries across all trips" },
    ],
  },
  {
    key: "memory",
    title: "Memory Keeper",
    subtitle: "Based on photos, memories, and favorites",
    badges: [
      { id: "mem-photos10",  name: "Shutterbug",          icon: "\ud83d\udcf8", threshold: 10,  unit: "photos",    desc: "Upload 10 photos" },
      { id: "mem-photos50",  name: "Photographer",        icon: "\ud83d\udcf7", threshold: 50,  unit: "photos",    desc: "Upload 50 photos" },
      { id: "mem-photos100", name: "Gallery",             icon: "\ud83d\uddbc\ufe0f", threshold: 100, unit: "photos",    desc: "Upload 100 photos" },
      { id: "mem-story",     name: "Storyteller",         icon: "\ud83d\udcd6", threshold: 5,   unit: "rich entries", desc: "Have 5 entries with 3 or more memories" },
      { id: "mem-fav",       name: "Favorites Collector", icon: "\u2764\ufe0f", threshold: 5,   unit: "favorites", desc: "Favorite 5 entries" },
    ],
  },
  {
    key: "special",
    title: "Special Achievements",
    subtitle: "Unique milestones",
    badges: [
      { id: "sp-longtrip",  name: "Longest Trip",   icon: "\ud83c\udfd5\ufe0f", threshold: 1, unit: "trip",   desc: "Take a trip lasting 14 or more days" },
      { id: "sp-speedrun",  name: "Speed Run",      icon: "\u26a1",             threshold: 1, unit: "month",  desc: "Visit 3 or more countries in a single month" },
      { id: "sp-calendar",  name: "Full Calendar",  icon: "\ud83d\udcc5",       threshold: 12, unit: "months", desc: "Travel in all 12 months of the year" },
      { id: "sp-streak",    name: "Streak Master",  icon: "\ud83d\udd25",       threshold: 3, unit: "months", desc: "Travel in 3 or more consecutive months" },
    ],
  },
];

// ============================================================
//  PURE COMPUTATION — compute all badge progress from entries
// ============================================================

function computeAchievements(entries) {
  if (!entries || entries.length === 0) {
    return BADGE_CATEGORIES.map(cat => ({
      ...cat,
      badges: cat.badges.map(b => ({ ...b, current: 0, unlocked: false, unlockedDate: null, progress: 0 })),
    }));
  }

  const sorted = [...entries].sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));

  // --- Aggregate data ---
  const totalEntries = sorted.length;
  const countries = new Set();
  let totalMiles = 0;
  let totalPhotos = 0;
  let totalFavorites = 0;
  let richEntries = 0; // entries with 3+ memories
  let beachCount = 0, cityCount = 0, natureCount = 0;
  let museumCount = 0, restaurantCount = 0;
  let longestTripDays = 0;
  const monthsVisited = new Set();
  const monthsByYearMonth = new Set(); // "YYYY-MM" for streak calc
  const countriesByMonth = {}; // "YYYY-MM" -> Set of countries

  sorted.forEach((e, i) => {
    // Countries
    if (e.country) countries.add(e.country);
    (e.stops || []).forEach(s => { if (s.country) countries.add(s.country); });

    // Miles
    if (i > 0) {
      const prev = sorted[i - 1];
      if (prev.lat != null && prev.lng != null && e.lat != null && e.lng != null) {
        totalMiles += haversine(prev.lat, prev.lng, e.lat, e.lng);
      }
    }

    // Photos
    totalPhotos += (e.photos || []).length;

    // Favorites
    if (e.favorite) totalFavorites++;

    // Rich entries (3+ memories)
    if ((e.memories || []).length >= 3) richEntries++;

    // Type counts
    const t = (e.type || "").toLowerCase();
    if (t === "beach" || t === "cruise") beachCount++;
    if (t === "city") cityCount++;
    if (t === "nature" || t === "adventure" || t === "outdoors") natureCount++;

    // Museum and restaurant entries (count individual items)
    museumCount += (e.museums || []).length;
    restaurantCount += (e.restaurants || []).length;

    // Trip duration
    if (e.dateStart) {
      const end = e.dateEnd || e.dateStart;
      const days = daysBetween(e.dateStart, end);
      if (days > longestTripDays) longestTripDays = days;

      // Month tracking
      const m = new Date(e.dateStart + "T12:00:00").getMonth();
      monthsVisited.add(m);
      const ym = e.dateStart.slice(0, 7);
      monthsByYearMonth.add(ym);

      // Countries per month (for speed run)
      if (e.country) {
        if (!countriesByMonth[ym]) countriesByMonth[ym] = new Set();
        countriesByMonth[ym].add(e.country);
      }
    }
  });

  // Streak calculation — longest run of consecutive months
  const ymSorted = [...monthsByYearMonth].sort();
  let maxStreak = 0, streak = 1;
  for (let i = 1; i < ymSorted.length; i++) {
    const [py, pm] = ymSorted[i - 1].split("-").map(Number);
    const [cy, cm] = ymSorted[i].split("-").map(Number);
    const diff = (cy * 12 + cm) - (py * 12 + pm);
    if (diff === 1) { streak++; }
    else { streak = 1; }
    if (streak > maxStreak) maxStreak = streak;
  }
  if (ymSorted.length === 1) maxStreak = 1;
  if (ymSorted.length > 1 && maxStreak < streak) maxStreak = streak;

  // Speed run — max countries in a single month
  let maxCountriesInMonth = 0;
  for (const ym of Object.keys(countriesByMonth)) {
    if (countriesByMonth[ym].size > maxCountriesInMonth) {
      maxCountriesInMonth = countriesByMonth[ym].size;
    }
  }

  // --- Map values to badges ---
  const valueMap = {
    "explorer-1": totalEntries, "explorer-5": totalEntries, "explorer-10": totalEntries,
    "explorer-25": totalEntries, "explorer-50": totalEntries, "explorer-100": totalEntries,
    "country-2": countries.size, "country-5": countries.size, "country-10": countries.size,
    "country-25": countries.size, "country-50": countries.size,
    "dist-100": totalMiles, "dist-1000": totalMiles, "dist-10000": totalMiles,
    "dist-25000": totalMiles, "dist-238900": totalMiles,
    "type-beach": beachCount, "type-city": cityCount, "type-nature": natureCount,
    "type-culture": museumCount, "type-food": restaurantCount,
    "mem-photos10": totalPhotos, "mem-photos50": totalPhotos, "mem-photos100": totalPhotos,
    "mem-story": richEntries, "mem-fav": totalFavorites,
    "sp-longtrip": longestTripDays >= 14 ? 1 : 0,
    "sp-speedrun": maxCountriesInMonth >= 3 ? 1 : 0,
    "sp-calendar": monthsVisited.size,
    "sp-streak": maxStreak,
  };

  // --- Find unlock dates (first entry date that crosses each threshold) ---
  // For simplicity, we approximate: the date is the dateStart of the entry that pushed the count past threshold.
  // We compute this by replaying entries in order for entry-count and country-count badges.
  const unlockDates = {};

  // Replay for entry count milestones
  sorted.forEach((e, i) => {
    const count = i + 1;
    [1, 5, 10, 25, 50, 100].forEach(t => {
      if (count >= t && !unlockDates[`explorer-${t}`]) unlockDates[`explorer-${t}`] = e.dateStart;
    });
  });

  // Replay for country milestones
  const seenCountries = new Set();
  sorted.forEach(e => {
    if (e.country) seenCountries.add(e.country);
    (e.stops || []).forEach(s => { if (s.country) seenCountries.add(s.country); });
    [2, 5, 10, 25, 50].forEach(t => {
      if (seenCountries.size >= t && !unlockDates[`country-${t}`]) unlockDates[`country-${t}`] = e.dateStart;
    });
  });

  // Replay for distance milestones
  let runningMiles = 0;
  sorted.forEach((e, i) => {
    if (i > 0) {
      const prev = sorted[i - 1];
      if (prev.lat != null && prev.lng != null && e.lat != null && e.lng != null) {
        runningMiles += haversine(prev.lat, prev.lng, e.lat, e.lng);
      }
    }
    [100, 1000, 10000, 25000, 238900].forEach(t => {
      if (runningMiles >= t && !unlockDates[`dist-${t}`]) unlockDates[`dist-${t}`] = e.dateStart;
    });
  });

  // Replay for photo milestones
  let runningPhotos = 0;
  sorted.forEach(e => {
    runningPhotos += (e.photos || []).length;
    [10, 50, 100].forEach(t => {
      if (runningPhotos >= t && !unlockDates[`mem-photos${t}`]) unlockDates[`mem-photos${t}`] = e.dateStart;
    });
  });

  // Simple date assignment for remaining badges
  const lastDate = sorted[sorted.length - 1]?.dateStart;
  ["mem-story", "mem-fav", "type-beach", "type-city", "type-nature", "type-culture", "type-food",
   "sp-longtrip", "sp-speedrun", "sp-calendar", "sp-streak"].forEach(id => {
    if (valueMap[id] >= BADGE_CATEGORIES.flatMap(c => c.badges).find(b => b.id === id).threshold) {
      unlockDates[id] = unlockDates[id] || lastDate;
    }
  });

  // --- Build result ---
  return BADGE_CATEGORIES.map(cat => ({
    ...cat,
    badges: cat.badges.map(b => {
      const current = valueMap[b.id] || 0;
      const unlocked = current >= b.threshold;
      return {
        ...b,
        current: Math.min(current, b.threshold),
        unlocked,
        unlockedDate: unlocked ? unlockDates[b.id] || null : null,
        progress: Math.min(1, current / b.threshold),
      };
    }),
  }));
}

// ============================================================
//  COMPONENT
// ============================================================

const fmtDate = d => {
  if (!d) return "";
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const FILTER_TABS = ["All", "Unlocked", "Locked"];

export default function Achievements({ entries, stats, palette, onClose, worldMode, config }) {
  const P = palette || {};
  const [filter, setFilter] = useState("All");
  const [hoveredBadge, setHoveredBadge] = useState(null);
  const [newlyViewed, setNewlyViewed] = useState(new Set());
  const overlayRef = useRef(null);

  const categories = useMemo(() => computeAchievements(entries), [entries]);

  const allBadges = useMemo(() => categories.flatMap(c => c.badges), [categories]);
  const unlockedCount = useMemo(() => allBadges.filter(b => b.unlocked).length, [allBadges]);
  const totalCount = allBadges.length;

  // Track which badges were newly unlocked since last view
  const storageKey = `achievements_seen_${worldMode || "default"}`;
  useEffect(() => {
    try {
      const seen = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const seenSet = new Set(seen);
      const newOnes = new Set();
      allBadges.forEach(b => {
        if (b.unlocked && !seenSet.has(b.id)) newOnes.add(b.id);
      });
      setNewlyViewed(newOnes);
      // Save all currently unlocked as seen
      const nowSeen = allBadges.filter(b => b.unlocked).map(b => b.id);
      localStorage.setItem(storageKey, JSON.stringify(nowSeen));
    } catch { /* ignore */ }
  }, [allBadges, storageKey]);

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    if (filter === "All") return categories;
    return categories.map(cat => ({
      ...cat,
      badges: cat.badges.filter(b => filter === "Unlocked" ? b.unlocked : !b.unlocked),
    })).filter(cat => cat.badges.length > 0);
  }, [categories, filter]);

  // Colors derived from palette
  const accent = P.rose || "#c48aa8";
  const accentSoft = P.roseSoft || "#d8a8c0";
  const gold = P.goldWarm || "#dab470";
  const textColor = P.text || "#2e2440";
  const textMid = P.textMid || "#584c6e";
  const textMuted = P.textMuted || "#8878a0";
  const textFaint = P.textFaint || "#b8aec8";
  const cardBg = P.card || "rgba(252,249,246,0.96)";
  const glassBg = P.glass || "rgba(248,244,240,0.92)";

  const overlayBg = "rgba(8, 6, 18, 0.92)";
  const panelBg = "rgba(20, 16, 36, 0.97)";
  const badgeCardBg = "rgba(30, 24, 52, 0.85)";
  const badgeCardUnlocked = "rgba(40, 32, 68, 0.95)";
  const badgeCardGlow = `${accent}30`;

  return (
    <div ref={overlayRef} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: overlayBg,
      backdropFilter: "blur(12px)",
      display: "flex", flexDirection: "column", alignItems: "center",
      overflow: "hidden",
      animation: "achFadeIn .35s ease",
      fontFamily: "'Palatino Linotype', Georgia, serif",
    }}>
      {/* Background stars */}
      {Array.from({ length: 40 }, (_, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          width: 2 + Math.random() * 2,
          height: 2 + Math.random() * 2,
          borderRadius: "50%",
          background: "#fff",
          opacity: 0.15 + Math.random() * 0.25,
          animation: `achTwinkle ${2 + Math.random() * 4}s ${Math.random() * 3}s ease-in-out infinite`,
          pointerEvents: "none",
        }} />
      ))}

      {/* Header */}
      <div style={{
        width: "100%", maxWidth: 720, padding: "28px 24px 0",
        position: "relative", zIndex: 1, flexShrink: 0,
      }}>
        {/* Close button */}
        <button onClick={onClose} style={{
          position: "absolute", top: 20, right: 20,
          background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%",
          width: 36, height: 36, cursor: "pointer",
          color: textFaint, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all .2s",
        }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = textFaint; }}
        >\u2715</button>

        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 36, marginBottom: 4, filter: `drop-shadow(0 0 16px ${gold}50)` }}>\ud83c\udfc6</div>
          <h2 style={{
            color: "#fff", fontSize: 22, fontWeight: 400, letterSpacing: ".08em", margin: 0,
            textShadow: `0 0 20px ${accent}40`,
          }}>Achievements</h2>
          <div style={{
            color: textMuted, fontSize: 13, marginTop: 6, letterSpacing: ".04em",
          }}>
            {unlockedCount} / {totalCount} badges unlocked
          </div>
          {/* Overall progress bar */}
          <div style={{
            margin: "12px auto 0", width: "60%", maxWidth: 280, height: 4,
            background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden",
          }}>
            <div style={{
              width: `${(unlockedCount / totalCount) * 100}%`, height: "100%",
              background: `linear-gradient(90deg, ${accent}, ${gold})`,
              borderRadius: 2,
              transition: "width .6s ease",
            }} />
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{
          display: "flex", justifyContent: "center", gap: 8, marginTop: 16, marginBottom: 4,
        }}>
          {FILTER_TABS.map(tab => (
            <button key={tab} onClick={() => setFilter(tab)} style={{
              background: filter === tab ? `${accent}30` : "rgba(255,255,255,0.05)",
              border: filter === tab ? `1px solid ${accent}50` : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20, padding: "5px 16px",
              color: filter === tab ? "#fff" : textMuted,
              fontSize: 12, cursor: "pointer", letterSpacing: ".03em",
              transition: "all .2s",
              fontFamily: "inherit",
            }}>{tab}{tab === "Unlocked" ? ` (${unlockedCount})` : tab === "Locked" ? ` (${totalCount - unlockedCount})` : ""}</button>
          ))}
        </div>
      </div>

      {/* Scrollable badge grid */}
      <div style={{
        flex: 1, overflowY: "auto", width: "100%", maxWidth: 720,
        padding: "12px 24px 32px",
        WebkitOverflowScrolling: "touch",
      }}>
        {filteredCategories.length === 0 && (
          <div style={{ textAlign: "center", color: textFaint, marginTop: 60, fontSize: 14 }}>
            {filter === "Unlocked" ? "No badges unlocked yet \u2014 keep exploring!" : "All badges unlocked!"}
          </div>
        )}

        {filteredCategories.map(cat => (
          <div key={cat.key} style={{ marginBottom: 28 }}>
            {/* Category header */}
            <div style={{ marginBottom: 12 }}>
              <h3 style={{
                color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: 500, margin: 0,
                letterSpacing: ".06em",
              }}>{cat.title}</h3>
              <div style={{ color: textFaint, fontSize: 11, marginTop: 2, letterSpacing: ".02em" }}>{cat.subtitle}</div>
            </div>

            {/* Badge grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 10,
            }}>
              {cat.badges.map(badge => {
                const isNew = newlyViewed.has(badge.id);
                const isHovered = hoveredBadge === badge.id;
                return (
                  <div
                    key={badge.id}
                    onMouseEnter={() => setHoveredBadge(badge.id)}
                    onMouseLeave={() => setHoveredBadge(null)}
                    onClick={() => setHoveredBadge(isHovered ? null : badge.id)}
                    style={{
                      background: badge.unlocked ? badgeCardUnlocked : badgeCardBg,
                      border: badge.unlocked
                        ? `1px solid ${isNew ? gold : accent}40`
                        : "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 12,
                      padding: "16px 12px 12px",
                      textAlign: "center",
                      cursor: "pointer",
                      position: "relative",
                      overflow: "hidden",
                      transition: "all .25s ease",
                      transform: isHovered ? "translateY(-2px) scale(1.02)" : "none",
                      boxShadow: badge.unlocked && isNew
                        ? `0 0 20px ${gold}30, 0 4px 16px rgba(0,0,0,0.3)`
                        : badge.unlocked
                        ? `0 0 12px ${badgeCardGlow}, 0 4px 12px rgba(0,0,0,0.2)`
                        : "0 2px 8px rgba(0,0,0,0.2)",
                      ...(isNew && badge.unlocked ? { animation: "achNewGlow 2s ease-in-out infinite" } : {}),
                    }}
                  >
                    {/* New badge sparkle indicator */}
                    {isNew && badge.unlocked && (
                      <>
                        {Array.from({ length: 6 }, (_, i) => (
                          <div key={i} style={{
                            position: "absolute",
                            width: 3, height: 3, borderRadius: "50%",
                            background: gold,
                            left: `${20 + Math.random() * 60}%`,
                            top: `${10 + Math.random() * 40}%`,
                            opacity: 0,
                            animation: `achSparkle ${1 + Math.random() * 1.5}s ${Math.random() * 1}s ease-in-out infinite`,
                            pointerEvents: "none",
                          }} />
                        ))}
                      </>
                    )}

                    {/* Icon */}
                    <div style={{
                      fontSize: 32,
                      filter: badge.unlocked
                        ? `drop-shadow(0 0 10px ${isNew ? gold : accent}50)`
                        : "grayscale(1) brightness(0.4)",
                      opacity: badge.unlocked ? 1 : 0.35,
                      transition: "all .3s",
                      marginBottom: 6,
                    }}>
                      {badge.icon}
                    </div>

                    {/* Name */}
                    <div style={{
                      color: badge.unlocked ? "#fff" : "rgba(255,255,255,0.3)",
                      fontSize: 12, fontWeight: 500, letterSpacing: ".03em",
                      marginBottom: 6, lineHeight: 1.3,
                    }}>{badge.name}</div>

                    {/* Progress bar */}
                    {!badge.unlocked && (
                      <div style={{
                        width: "80%", margin: "0 auto 4px", height: 3,
                        background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden",
                      }}>
                        <div style={{
                          width: `${badge.progress * 100}%`, height: "100%",
                          background: `linear-gradient(90deg, ${accent}80, ${accent})`,
                          borderRadius: 2, transition: "width .4s ease",
                        }} />
                      </div>
                    )}

                    {/* Progress text / unlocked date */}
                    <div style={{
                      color: badge.unlocked ? textMuted : "rgba(255,255,255,0.2)",
                      fontSize: 10, letterSpacing: ".02em",
                    }}>
                      {badge.unlocked
                        ? (badge.unlockedDate ? fmtDate(badge.unlockedDate) : "Unlocked")
                        : `${badge.current} / ${badge.threshold}`
                      }
                    </div>

                    {/* Hover/tap detail overlay */}
                    {isHovered && (
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "rgba(12, 8, 24, 0.94)",
                        borderRadius: 12,
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                        padding: 12,
                        animation: "achFadeIn .2s ease",
                      }}>
                        <div style={{ fontSize: 24, marginBottom: 6 }}>{badge.icon}</div>
                        <div style={{ color: "#fff", fontSize: 12, fontWeight: 500, marginBottom: 4, textAlign: "center" }}>{badge.name}</div>
                        <div style={{ color: textMuted, fontSize: 10, textAlign: "center", lineHeight: 1.5, marginBottom: 6 }}>{badge.desc}</div>
                        {badge.unlocked ? (
                          <div style={{
                            color: gold, fontSize: 10, fontWeight: 500, letterSpacing: ".04em",
                          }}>\u2713 Unlocked{badge.unlockedDate ? ` \u2022 ${fmtDate(badge.unlockedDate)}` : ""}</div>
                        ) : (
                          <div style={{ color: textFaint, fontSize: 10 }}>
                            {badge.current} / {badge.threshold} {badge.unit}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes achFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes achTwinkle {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        @keyframes achNewGlow {
          0%, 100% { box-shadow: 0 0 12px ${gold}20, 0 4px 12px rgba(0,0,0,0.2); }
          50% { box-shadow: 0 0 24px ${gold}40, 0 4px 16px rgba(0,0,0,0.3); }
        }
        @keyframes achSparkle {
          0%, 100% { opacity: 0; transform: scale(0.5) translateY(0); }
          50% { opacity: 1; transform: scale(1.2) translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
