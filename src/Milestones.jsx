import { useState, useMemo, useEffect } from "react";
import { haversine, daysBetween } from "./utils.js";

/* =================================================================
   Milestones & Reflections — sentimental moments from your journeys
   Surfaces meaningful firsts, distances, anniversaries, and memories.
   Replaces the old Achievements/badges system with something warmer.
   ================================================================= */

const fmtDate = d => {
  if (!d) return "";
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

const fmtDateShort = d => {
  if (!d) return "";
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

const daysAgoText = d => {
  if (!d) return "";
  const days = daysBetween(d, new Date().toISOString().slice(0, 10));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }
  const years = Math.floor(days / 365);
  const remaining = Math.floor((days % 365) / 30);
  if (remaining === 0) return years === 1 ? "1 year ago" : `${years} years ago`;
  return `${years}y ${remaining}m ago`;
};

// ============================================================
//  MILESTONE DETECTION — find meaningful moments in entries
// ============================================================

function detectMilestones(entries, config, worldMode) {
  if (!entries || entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));
  const milestones = [];
  const isPartner = worldMode === "partner" || worldMode === "our";

  // --- FIRSTS ---

  // First ever entry
  const first = sorted[0];
  if (first) {
    milestones.push({
      id: "first-entry",
      category: "firsts",
      icon: "✨",
      title: isPartner ? "Where it all began" : "Your first adventure",
      detail: `${first.city || "Unknown"}${first.country ? `, ${first.country}` : ""}`,
      date: first.dateStart,
      timeAgo: daysAgoText(first.dateStart),
      entry: first,
      warmth: 1.0,
    });
  }

  // First photo
  const firstWithPhoto = sorted.find(e => (e.photos || []).length > 0);
  if (firstWithPhoto) {
    milestones.push({
      id: "first-photo",
      category: "firsts",
      icon: "📸",
      title: "First captured moment",
      detail: `${firstWithPhoto.city || ""}${firstWithPhoto.country ? `, ${firstWithPhoto.country}` : ""}`,
      date: firstWithPhoto.dateStart,
      timeAgo: daysAgoText(firstWithPhoto.dateStart),
      photo: (firstWithPhoto.photos || [])[0],
      entry: firstWithPhoto,
      warmth: 0.8,
    });
  }

  // First country outside home (if we can detect home)
  const countries = [];
  sorted.forEach(e => {
    if (e.country && !countries.includes(e.country)) countries.push(e.country);
  });
  if (countries.length >= 2) {
    const homeCountry = countries[0];
    const firstAbroad = sorted.find(e => e.country && e.country !== homeCountry);
    if (firstAbroad) {
      milestones.push({
        id: "first-abroad",
        category: "firsts",
        icon: "🌍",
        title: "First time abroad",
        detail: `${firstAbroad.city || ""}${firstAbroad.country ? `, ${firstAbroad.country}` : ""}`,
        date: firstAbroad.dateStart,
        timeAgo: daysAgoText(firstAbroad.dateStart),
        entry: firstAbroad,
        warmth: 0.9,
      });
    }
  }

  // First favorite
  const firstFav = sorted.find(e => e.favorite);
  if (firstFav) {
    milestones.push({
      id: "first-favorite",
      category: "firsts",
      icon: "💛",
      title: "A place close to your heart",
      detail: `${firstFav.city || ""}${firstFav.country ? `, ${firstFav.country}` : ""} — your first favorite`,
      date: firstFav.dateStart,
      timeAgo: daysAgoText(firstFav.dateStart),
      entry: firstFav,
      warmth: 0.85,
    });
  }

  // --- DISTANCE & GEOGRAPHY ---

  // Farthest from home
  if (sorted.length >= 2) {
    const home = sorted[0];
    let farthest = null, maxDist = 0;
    sorted.forEach(e => {
      if (e.lat != null && e.lng != null && home.lat != null && home.lng != null) {
        const d = haversine(home.lat, home.lng, e.lat, e.lng);
        if (d > maxDist) { maxDist = d; farthest = e; }
      }
    });
    if (farthest && maxDist > 50) {
      milestones.push({
        id: "farthest-from-home",
        category: "distance",
        icon: "🧭",
        title: "The farthest you've been",
        detail: `${Math.round(maxDist).toLocaleString()} miles from home — ${farthest.city || ""}${farthest.country ? `, ${farthest.country}` : ""}`,
        date: farthest.dateStart,
        timeAgo: daysAgoText(farthest.dateStart),
        entry: farthest,
        warmth: 0.7,
      });
    }
  }

  // Total distance traveled
  let totalMiles = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1], cur = sorted[i];
    if (prev.lat != null && prev.lng != null && cur.lat != null && cur.lng != null) {
      totalMiles += haversine(prev.lat, prev.lng, cur.lat, cur.lng);
    }
  }
  if (totalMiles > 100) {
    const earthCircumference = 24901;
    let distanceStory;
    if (totalMiles >= earthCircumference) {
      const orbits = (totalMiles / earthCircumference).toFixed(1);
      distanceStory = `${Math.round(totalMiles).toLocaleString()} miles — that's ${orbits}× around the Earth`;
    } else {
      const pct = ((totalMiles / earthCircumference) * 100).toFixed(0);
      distanceStory = `${Math.round(totalMiles).toLocaleString()} miles — ${pct}% of the way around the Earth`;
    }
    milestones.push({
      id: "total-distance",
      category: "distance",
      icon: "🌏",
      title: "Miles together" + (isPartner ? "" : " so far"),
      detail: distanceStory,
      warmth: 0.6,
    });
  }

  // Countries visited
  if (countries.length >= 2) {
    milestones.push({
      id: "countries-count",
      category: "distance",
      icon: "🗺️",
      title: `${countries.length} countries and counting`,
      detail: countries.slice(0, 8).join(", ") + (countries.length > 8 ? `, and ${countries.length - 8} more` : ""),
      warmth: 0.6,
    });
  }

  // --- TIME & MEMORIES ---

  // Longest trip
  let longestTrip = null, longestDays = 0;
  sorted.forEach(e => {
    if (e.dateStart) {
      const end = e.dateEnd || e.dateStart;
      const days = daysBetween(e.dateStart, end);
      if (days > longestDays) { longestDays = days; longestTrip = e; }
    }
  });
  if (longestTrip && longestDays >= 3) {
    milestones.push({
      id: "longest-trip",
      category: "time",
      icon: "🏕️",
      title: longestDays >= 14 ? "The great adventure" : "Your longest escape",
      detail: `${longestDays} days in ${longestTrip.city || ""}${longestTrip.country ? `, ${longestTrip.country}` : ""}`,
      date: longestTrip.dateStart,
      timeAgo: daysAgoText(longestTrip.dateStart),
      entry: longestTrip,
      warmth: 0.75,
    });
  }

  // Most recent entry
  const latest = sorted[sorted.length - 1];
  if (latest && sorted.length > 1) {
    milestones.push({
      id: "most-recent",
      category: "time",
      icon: "📍",
      title: "Most recent memory",
      detail: `${latest.city || ""}${latest.country ? `, ${latest.country}` : ""}`,
      date: latest.dateStart,
      timeAgo: daysAgoText(latest.dateStart),
      entry: latest,
      warmth: 0.65,
    });
  }

  // Time since first entry (journey duration)
  if (sorted.length >= 2 && first.dateStart && latest.dateStart) {
    const journeyDays = daysBetween(first.dateStart, latest.dateStart);
    if (journeyDays > 30) {
      const years = Math.floor(journeyDays / 365);
      const months = Math.floor((journeyDays % 365) / 30);
      let span = "";
      if (years > 0 && months > 0) span = `${years} year${years > 1 ? "s" : ""} and ${months} month${months > 1 ? "s" : ""}`;
      else if (years > 0) span = `${years} year${years > 1 ? "s" : ""}`;
      else span = `${months} month${months > 1 ? "s" : ""}`;
      milestones.push({
        id: "journey-span",
        category: "time",
        icon: "⏳",
        title: isPartner ? "Your story so far" : "Your journey so far",
        detail: `${span} of ${isPartner ? "adventures together" : "adventures"}, from ${fmtDateShort(first.dateStart)} to ${fmtDateShort(latest.dateStart)}`,
        warmth: 0.9,
      });
    }
  }

  // --- RICHNESS ---

  // Total photos
  const totalPhotos = sorted.reduce((s, e) => s + (e.photos || []).length, 0);
  if (totalPhotos >= 5) {
    milestones.push({
      id: "photo-collection",
      category: "richness",
      icon: "🖼️",
      title: `${totalPhotos} moments captured`,
      detail: totalPhotos >= 100 ? "A beautiful collection of memories" : totalPhotos >= 50 ? "Your gallery is growing" : "Every photo tells a story",
      warmth: 0.5,
    });
  }

  // Most photographed place
  const photosByCity = {};
  sorted.forEach(e => {
    if (e.city && (e.photos || []).length > 0) {
      photosByCity[e.city] = (photosByCity[e.city] || 0) + e.photos.length;
    }
  });
  const topPhotoCity = Object.entries(photosByCity).sort((a, b) => b[1] - a[1])[0];
  if (topPhotoCity && topPhotoCity[1] >= 3) {
    milestones.push({
      id: "most-photographed",
      category: "richness",
      icon: "📸",
      title: "Most photographed place",
      detail: `${topPhotoCity[0]} — ${topPhotoCity[1]} photos`,
      warmth: 0.55,
    });
  }

  // Most visited city
  const visitsByCity = {};
  sorted.forEach(e => {
    if (e.city) visitsByCity[e.city] = (visitsByCity[e.city] || 0) + 1;
  });
  const topCity = Object.entries(visitsByCity).sort((a, b) => b[1] - a[1])[0];
  if (topCity && topCity[1] >= 2) {
    milestones.push({
      id: "most-visited",
      category: "richness",
      icon: "🏠",
      title: isPartner ? "Your favorite place together" : "A place you keep returning to",
      detail: `${topCity[0]} — visited ${topCity[1]} times`,
      warmth: 0.7,
    });
  }

  // Entry with most highlights (richest story)
  let richestEntry = null, maxMemories = 0;
  sorted.forEach(e => {
    const count = (e.highlights || []).length;
    if (count > maxMemories) { maxMemories = count; richestEntry = e; }
  });
  if (richestEntry && maxMemories >= 3) {
    milestones.push({
      id: "richest-story",
      category: "richness",
      icon: "📖",
      title: "Your most detailed story",
      detail: `${richestEntry.city || ""}${richestEntry.country ? `, ${richestEntry.country}` : ""} — ${maxMemories} highlights`,
      date: richestEntry.dateStart,
      entry: richestEntry,
      warmth: 0.65,
    });
  }

  // --- PARTNER-SPECIFIC ---
  if (isPartner) {
    // Together entries
    const togetherEntries = sorted.filter(e => e.who === "both" || e.type === "together" || e.type === "special");
    if (togetherEntries.length >= 1) {
      milestones.push({
        id: "together-count",
        category: "together",
        icon: "💕",
        title: `${togetherEntries.length} adventures together`,
        detail: togetherEntries.length >= 20
          ? "You two have been everywhere"
          : togetherEntries.length >= 10
          ? "So many wonderful memories"
          : "Each one a chapter in your story",
        warmth: 0.95,
      });
    }

    // Days spent together traveling
    let daysTogether = 0;
    togetherEntries.forEach(e => {
      const end = e.dateEnd || e.dateStart;
      daysTogether += Math.max(1, daysBetween(e.dateStart, end));
    });
    if (daysTogether >= 7) {
      milestones.push({
        id: "days-together",
        category: "together",
        icon: "🤍",
        title: `${daysTogether} days of adventures`,
        detail: daysTogether >= 100
          ? "More than a hundred days exploring the world together"
          : daysTogether >= 30
          ? "A whole month's worth of memories"
          : "Every day with you is an adventure",
        warmth: 0.9,
      });
    }

    // Anniversary proximity
    if (config.startDate) {
      const today = new Date().toISOString().slice(0, 10);
      const totalDays = daysBetween(config.startDate, today);
      const years = Math.floor(totalDays / 365);
      if (years >= 1) {
        milestones.push({
          id: "relationship-years",
          category: "together",
          icon: "💫",
          title: `${years} year${years > 1 ? "s" : ""} of love`,
          detail: `${totalDays.toLocaleString()} days since ${fmtDate(config.startDate)}`,
          warmth: 1.0,
        });
      }
    }

    // Love notes count
    const withNotes = sorted.filter(e => e.loveNote && e.loveNote.trim());
    if (withNotes.length >= 1) {
      milestones.push({
        id: "love-notes",
        category: "together",
        icon: "💌",
        title: `${withNotes.length} love note${withNotes.length > 1 ? "s" : ""} written`,
        detail: withNotes.length >= 5 ? "A collection of whispered words" : "Words from the heart",
        warmth: 0.85,
      });
    }
  }

  // Sort by warmth (most meaningful first)
  milestones.sort((a, b) => b.warmth - a.warmth);

  return milestones;
}

// ============================================================
//  CATEGORY LABELS & ICONS
// ============================================================

const CATEGORIES = {
  firsts:   { label: "Firsts", icon: "✨" },
  distance: { label: "Distances", icon: "🧭" },
  time:     { label: "Time", icon: "⏳" },
  richness: { label: "Memories", icon: "📖" },
  together: { label: "Together", icon: "💕" },
};

// ============================================================
//  COMPONENT
// ============================================================

export default function Milestones({ entries, palette, onClose, worldMode, config }) {
  const P = palette || {};
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const milestones = useMemo(() => detectMilestones(entries, config || {}, worldMode), [entries, config, worldMode]);

  const categoryKeys = useMemo(() => {
    const seen = new Set();
    milestones.forEach(m => seen.add(m.category));
    return [...seen];
  }, [milestones]);

  const filtered = useMemo(() => {
    if (activeCategory === "all") return milestones;
    return milestones.filter(m => m.category === activeCategory);
  }, [milestones, activeCategory]);

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Colors
  const accent = P.rose || "#c48aa8";
  const gold = P.goldWarm || "#dab470";
  const textMuted = P.textMuted || "#8878a0";
  const textFaint = P.textFaint || "#b8aec8";

  // Background particles (soft, warm dots instead of competitive stars)
  const bgDots = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 1.5 + Math.random() * 2,
    opacity: 0.08 + Math.random() * 0.12,
    dur: 4 + Math.random() * 6,
    delay: Math.random() * 4,
  })), []);

  if (milestones.length === 0) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(8, 6, 18, 0.92)", backdropFilter: "blur(12px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'Palatino Linotype', Georgia, serif",
        animation: "mlFadeIn .35s ease",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 20, right: 20,
          background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%",
          width: 36, height: 36, cursor: "pointer",
          color: textFaint, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
        }}>✕</button>
        <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.6 }}>✨</div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, textAlign: "center", maxWidth: 300, lineHeight: 1.6 }}>
          Your milestones will appear here as you add entries.<br />
          <span style={{ fontSize: 13, opacity: 0.7 }}>Every journey begins with a single step.</span>
        </div>
        <style>{`@keyframes mlFadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(8, 6, 18, 0.92)",
      backdropFilter: "blur(12px)",
      display: "flex", flexDirection: "column", alignItems: "center",
      overflow: "hidden",
      animation: "mlFadeIn .35s ease",
      fontFamily: "'Palatino Linotype', Georgia, serif",
    }}>
      {/* Soft background dots */}
      {bgDots.map((d, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${d.left}%`, top: `${d.top}%`,
          width: d.size, height: d.size, borderRadius: "50%",
          background: i % 3 === 0 ? gold : accent,
          opacity: d.opacity,
          animation: `mlFloat ${d.dur}s ${d.delay}s ease-in-out infinite`,
          pointerEvents: "none",
        }} />
      ))}

      {/* Header */}
      <div style={{
        width: "100%", maxWidth: 640, padding: "28px 24px 0",
        position: "relative", zIndex: 1, flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 20, right: 20,
          background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%",
          width: 36, height: 36, cursor: "pointer",
          color: textFaint, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all .2s",
        }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = textFaint; }}
        >✕</button>

        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 4, filter: `drop-shadow(0 0 12px ${gold}40)` }}>✨</div>
          <h2 style={{
            color: "#fff", fontSize: 20, fontWeight: 400, letterSpacing: ".08em", margin: 0,
            textShadow: `0 0 20px ${accent}30`,
          }}>Milestones</h2>
          <div style={{
            color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 6,
            letterSpacing: ".03em", fontStyle: "italic",
          }}>
            The moments that made your journey
          </div>
        </div>

        {/* Category tabs */}
        {categoryKeys.length > 1 && (
          <div style={{
            display: "flex", justifyContent: "center", gap: 6, marginTop: 12, marginBottom: 4,
            flexWrap: "wrap",
          }}>
            <button onClick={() => setActiveCategory("all")} style={{
              background: activeCategory === "all" ? `${accent}25` : "rgba(255,255,255,0.04)",
              border: activeCategory === "all" ? `1px solid ${accent}40` : "1px solid rgba(255,255,255,0.06)",
              borderRadius: 20, padding: "4px 14px",
              color: activeCategory === "all" ? "#fff" : "rgba(255,255,255,0.4)",
              fontSize: 11, cursor: "pointer", letterSpacing: ".03em",
              transition: "all .2s", fontFamily: "inherit",
            }}>All</button>
            {categoryKeys.map(key => {
              const cat = CATEGORIES[key] || { label: key, icon: "" };
              return (
                <button key={key} onClick={() => setActiveCategory(key)} style={{
                  background: activeCategory === key ? `${accent}25` : "rgba(255,255,255,0.04)",
                  border: activeCategory === key ? `1px solid ${accent}40` : "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 20, padding: "4px 14px",
                  color: activeCategory === key ? "#fff" : "rgba(255,255,255,0.4)",
                  fontSize: 11, cursor: "pointer", letterSpacing: ".03em",
                  transition: "all .2s", fontFamily: "inherit",
                }}>{cat.icon} {cat.label}</button>
              );
            })}
          </div>
        )}
      </div>

      {/* Scrollable milestone cards */}
      <div style={{
        flex: 1, overflowY: "auto", width: "100%", maxWidth: 640,
        padding: "16px 24px 32px",
        WebkitOverflowScrolling: "touch",
      }}>
        {filtered.map((m, idx) => {
          const isExpanded = expandedId === m.id;
          return (
            <div
              key={m.id}
              onClick={() => setExpandedId(isExpanded ? null : m.id)}
              style={{
                background: "rgba(25, 20, 45, 0.8)",
                border: `1px solid rgba(255,255,255,${isExpanded ? "0.12" : "0.06"})`,
                borderRadius: 14,
                padding: "18px 20px",
                marginBottom: 10,
                cursor: "pointer",
                position: "relative",
                transition: "all .25s ease",
                animation: `mlSlideUp .4s ${idx * 0.05}s ease both`,
                ...(isExpanded ? {
                  boxShadow: `0 0 20px ${accent}15, 0 4px 20px rgba(0,0,0,0.3)`,
                  borderColor: `${accent}30`,
                } : {}),
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                {/* Icon */}
                <div style={{
                  fontSize: 28, flexShrink: 0,
                  filter: `drop-shadow(0 0 8px ${accent}30)`,
                  marginTop: 2,
                }}>
                  {m.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: "#fff", fontSize: 14, fontWeight: 500,
                    letterSpacing: ".03em", lineHeight: 1.4, marginBottom: 4,
                  }}>{m.title}</div>
                  <div style={{
                    color: "rgba(255,255,255,0.55)", fontSize: 12.5,
                    lineHeight: 1.5, letterSpacing: ".01em",
                  }}>{m.detail}</div>

                  {/* Date line */}
                  {m.date && (
                    <div style={{
                      color: "rgba(255,255,255,0.3)", fontSize: 11,
                      marginTop: 6, letterSpacing: ".02em",
                    }}>
                      {fmtDate(m.date)}{m.timeAgo ? ` · ${m.timeAgo}` : ""}
                    </div>
                  )}

                  {/* Expanded: photo preview if available */}
                  {isExpanded && m.photo && (
                    <div style={{
                      marginTop: 12, borderRadius: 10, overflow: "hidden",
                      maxHeight: 180, animation: "mlFadeIn .3s ease",
                    }}>
                      <img loading="lazy" src={m.photo} alt="" style={{
                        width: "100%", height: 180, objectFit: "cover",
                        borderRadius: 10, opacity: 0.85,
                      }} />
                    </div>
                  )}

                  {/* Expanded: entry photos preview */}
                  {isExpanded && !m.photo && m.entry && (m.entry.photos || []).length > 0 && (
                    <div style={{
                      marginTop: 12, display: "flex", gap: 6, overflow: "auto",
                      animation: "mlFadeIn .3s ease",
                    }}>
                      {m.entry.photos.slice(0, 4).map((p, pi) => (
                        <img key={pi} loading="lazy" src={p} alt="" style={{
                          width: 80, height: 60, objectFit: "cover",
                          borderRadius: 8, opacity: 0.8, flexShrink: 0,
                        }} />
                      ))}
                    </div>
                  )}

                  {/* Expanded: notes preview */}
                  {isExpanded && m.entry && m.entry.notes && (
                    <div style={{
                      marginTop: 10, color: "rgba(255,255,255,0.4)", fontSize: 12,
                      fontStyle: "italic", lineHeight: 1.5,
                      animation: "mlFadeIn .3s ease",
                    }}>
                      "{m.entry.notes.length > 150 ? m.entry.notes.slice(0, 150) + "…" : m.entry.notes}"
                    </div>
                  )}

                  {/* Expanded: highlights */}
                  {isExpanded && m.entry && (m.entry.highlights || []).length > 0 && (
                    <div style={{
                      marginTop: 8, animation: "mlFadeIn .3s ease",
                    }}>
                      {m.entry.highlights.slice(0, 3).map((mem, mi) => (
                        <div key={mi} style={{
                          color: "rgba(255,255,255,0.35)", fontSize: 11,
                          marginTop: 3, paddingLeft: 10,
                          borderLeft: `2px solid ${accent}30`,
                        }}>
                          {mem}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Gentle closing message */}
        <div style={{
          textAlign: "center", padding: "24px 0 12px",
          color: "rgba(255,255,255,0.2)", fontSize: 12,
          fontStyle: "italic", letterSpacing: ".03em",
        }}>
          {milestones.length} milestone{milestones.length > 1 ? "s" : ""} in your story so far
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes mlFadeIn {
          from { opacity: 0 }
          to { opacity: 1 }
        }
        @keyframes mlSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes mlFloat {
          0%, 100% { opacity: inherit; transform: translateY(0); }
          50% { opacity: 0.25; transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
