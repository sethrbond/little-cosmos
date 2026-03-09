import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* =================================================================
   Year-in-Review — animated full-screen recap overlay
   Props: entries, stats, palette (P), onClose, worldMode, config
   ================================================================= */

// ---- COUNTRY FLAG LOOKUP ----
const COUNTRY_CODES = {
  "Afghanistan":"AF","Albania":"AL","Algeria":"DZ","Andorra":"AD","Angola":"AO","Argentina":"AR",
  "Armenia":"AM","Australia":"AU","Austria":"AT","Azerbaijan":"AZ","Bahamas":"BS","Bahrain":"BH",
  "Bangladesh":"BD","Barbados":"BB","Belarus":"BY","Belgium":"BE","Belize":"BZ","Benin":"BJ",
  "Bhutan":"BT","Bolivia":"BO","Bosnia and Herzegovina":"BA","Botswana":"BW","Brazil":"BR",
  "Brunei":"BN","Bulgaria":"BG","Cambodia":"KH","Cameroon":"CM","Canada":"CA","Chad":"TD",
  "Chile":"CL","China":"CN","Colombia":"CO","Congo":"CG","Costa Rica":"CR","Croatia":"HR",
  "Cuba":"CU","Cyprus":"CY","Czech Republic":"CZ","Czechia":"CZ","Denmark":"DK",
  "Dominican Republic":"DO","Ecuador":"EC","Egypt":"EG","El Salvador":"SV","Estonia":"EE",
  "Ethiopia":"ET","Fiji":"FJ","Finland":"FI","France":"FR","Georgia":"GE","Germany":"DE",
  "Ghana":"GH","Greece":"GR","Guatemala":"GT","Haiti":"HT","Honduras":"HN","Hungary":"HU",
  "Iceland":"IS","India":"IN","Indonesia":"ID","Iran":"IR","Iraq":"IQ","Ireland":"IE",
  "Israel":"IL","Italy":"IT","Jamaica":"JM","Japan":"JP","Jordan":"JO","Kazakhstan":"KZ",
  "Kenya":"KE","South Korea":"KR","Korea":"KR","Kuwait":"KW","Laos":"LA","Latvia":"LV",
  "Lebanon":"LB","Libya":"LY","Lithuania":"LT","Luxembourg":"LU","Madagascar":"MG",
  "Malaysia":"MY","Maldives":"MV","Mali":"ML","Malta":"MT","Mexico":"MX","Moldova":"MD",
  "Monaco":"MC","Mongolia":"MN","Montenegro":"ME","Morocco":"MA","Mozambique":"MZ",
  "Myanmar":"MM","Nepal":"NP","Netherlands":"NL","New Zealand":"NZ","Nicaragua":"NI",
  "Nigeria":"NG","North Macedonia":"MK","Norway":"NO","Oman":"OM","Pakistan":"PK","Panama":"PA",
  "Paraguay":"PY","Peru":"PE","Philippines":"PH","Poland":"PL","Portugal":"PT","Qatar":"QA",
  "Romania":"RO","Russia":"RU","Rwanda":"RW","Saudi Arabia":"SA","Senegal":"SN","Serbia":"RS",
  "Singapore":"SG","Slovakia":"SK","Slovenia":"SI","Somalia":"SO","South Africa":"ZA",
  "Spain":"ES","Sri Lanka":"LK","Sudan":"SD","Sweden":"SE","Switzerland":"CH","Syria":"SY",
  "Taiwan":"TW","Tanzania":"TZ","Thailand":"TH","Tunisia":"TN","Turkey":"TR","Turkiye":"TR",
  "Uganda":"UG","Ukraine":"UA","United Arab Emirates":"AE","UAE":"AE",
  "United Kingdom":"GB","UK":"GB","United States":"US","USA":"US","Uruguay":"UY",
  "Uzbekistan":"UZ","Venezuela":"VE","Vietnam":"VN","Yemen":"YE","Zambia":"ZM","Zimbabwe":"ZW",
  "Puerto Rico":"PR","Hawaii":"US","Scotland":"GB","England":"GB","Wales":"GB",
};

function countryFlag(country) {
  const code = COUNTRY_CODES[country];
  if (!code) return "";
  return String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

// ---- ANIMATED COUNTER ----
function AnimatedCounter({ target, duration = 2000, prefix = "", suffix = "", style }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (target <= 0) { setVal(0); return; }
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * target));
      if (progress < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration]);
  return <span style={style}>{prefix}{val.toLocaleString()}{suffix}</span>;
}

// ---- STARFIELD CANVAS ----
function Starfield({ color }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width = window.innerWidth;
    const h = canvas.height = window.innerHeight;
    const stars = Array.from({ length: 180 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.4 + 0.3,
      a: Math.random() * 0.6 + 0.2,
      speed: Math.random() * 0.008 + 0.003,
      phase: Math.random() * Math.PI * 2,
    }));
    let frame;
    const draw = (t) => {
      ctx.clearRect(0, 0, w, h);
      stars.forEach(s => {
        const alpha = s.a * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = color + Math.round(alpha * 255).toString(16).padStart(2, "0");
        ctx.fill();
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [color]);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />;
}

// ---- HELPERS ----
function daysBetween(a, b) {
  if (!a || !b) return 0;
  return Math.max(1, Math.round(Math.abs(new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000));
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const MOTIVATIONAL = [
  "The world is a book, and those who do not travel read only one page.",
  "Not all those who wander are lost.",
  "Adventure is worthwhile in itself.",
  "Travel far enough, you meet yourself.",
  "Life is short and the world is wide.",
  "Collect moments, not things.",
  "The journey is the destination.",
  "Wander often, wonder always.",
];

// =================================================================
//  MAIN COMPONENT
// =================================================================

export default function YearInReview({ entries = [], stats = {}, palette, onClose, worldMode, config }) {
  const P = palette || {};
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [slideDirection, setSlideDirection] = useState(1); // 1=forward, -1=back
  const [slideKey, setSlideKey] = useState(0);
  const timerRef = useRef(null);

  // ---- Determine the review year ----
  const reviewYear = useMemo(() => {
    const years = entries
      .map(e => e.dateStart ? new Date(e.dateStart + "T12:00:00").getFullYear() : null)
      .filter(Boolean);
    if (years.length === 0) return new Date().getFullYear();
    // Use the most common year
    const counts = {};
    years.forEach(y => { counts[y] = (counts[y] || 0) + 1; });
    return parseInt(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
  }, [entries]);

  // ---- Filter entries to the review year ----
  const yearEntries = useMemo(() => {
    return entries.filter(e => {
      if (!e.dateStart) return false;
      return new Date(e.dateStart + "T12:00:00").getFullYear() === reviewYear;
    }).sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));
  }, [entries, reviewYear]);

  // ---- Computed data ----
  const travelerName = useMemo(() => {
    if (config?.travelerName && config.travelerName !== "Explorer") return config.travelerName;
    if (config?.youName) return config.youName;
    return "Explorer";
  }, [config]);

  const countriesVisited = useMemo(() => {
    const set = new Set();
    yearEntries.forEach(e => {
      if (e.country) set.add(e.country);
      (e.stops || []).forEach(s => { if (s.country) set.add(s.country); });
    });
    return [...set].sort();
  }, [yearEntries]);

  const totalMiles = useMemo(() => {
    let miles = 0;
    const sorted = [...yearEntries].sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (prev.lat && prev.lng && curr.lat && curr.lng) {
        miles += haversine(prev.lat, prev.lng, curr.lat, curr.lng);
      }
    }
    return Math.round(miles);
  }, [yearEntries]);

  const topMemories = useMemo(() => {
    const all = [];
    yearEntries.forEach(e => {
      (e.memories || []).forEach(m => {
        if (m && m.trim()) all.push({ text: m.trim(), city: e.city, country: e.country });
      });
    });
    return all.slice(0, 8);
  }, [yearEntries]);

  const photoHighlights = useMemo(() => {
    // Prefer favorites, then most-photoed
    const withPhotos = yearEntries
      .filter(e => (e.photos || []).length > 0)
      .sort((a, b) => {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        return (b.photos || []).length - (a.photos || []).length;
      });
    return withPhotos.slice(0, 6);
  }, [yearEntries]);

  const monthlyBreakdown = useMemo(() => {
    const months = new Array(12).fill(0);
    yearEntries.forEach(e => {
      if (e.dateStart) {
        const m = new Date(e.dateStart + "T12:00:00").getMonth();
        months[m]++;
      }
    });
    return months;
  }, [yearEntries]);

  const longestTrip = useMemo(() => {
    let best = null;
    let bestDays = 0;
    yearEntries.forEach(e => {
      if (e.dateStart && e.dateEnd) {
        const d = daysBetween(e.dateStart, e.dateEnd);
        if (d > bestDays) { bestDays = d; best = e; }
      }
    });
    return best ? { entry: best, days: bestDays } : null;
  }, [yearEntries]);

  const newCities = useMemo(() => {
    // Cities that appeared for the first time in this year
    const priorCities = new Set();
    entries.forEach(e => {
      if (!e.dateStart) return;
      if (new Date(e.dateStart + "T12:00:00").getFullYear() < reviewYear) {
        if (e.city) priorCities.add(e.city);
        (e.stops || []).forEach(s => { if (s.city) priorCities.add(s.city); });
      }
    });
    const yearCities = new Set();
    const result = [];
    yearEntries.forEach(e => {
      if (e.city && !priorCities.has(e.city) && !yearCities.has(e.city)) {
        yearCities.add(e.city);
        result.push({ city: e.city, country: e.country });
      }
    });
    return result;
  }, [entries, yearEntries, reviewYear]);

  const motivationalQuote = useMemo(() => {
    return MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Build slides array ----
  const slides = useMemo(() => {
    const s = [];

    // 0: Title
    s.push({ id: "title" });
    // 1: Total adventures
    s.push({ id: "adventures" });
    // 2: Countries
    if (countriesVisited.length > 0) s.push({ id: "countries" });
    // 3: Miles
    if (totalMiles > 0) s.push({ id: "miles" });
    // 4: Monthly breakdown
    s.push({ id: "monthly" });
    // 5: Longest trip
    if (longestTrip) s.push({ id: "longest" });
    // 6: New cities
    if (newCities.length > 0) s.push({ id: "new-cities" });
    // 7: Top memories
    if (topMemories.length > 0) s.push({ id: "memories" });
    // 8: Photos
    if (photoHighlights.length > 0) s.push({ id: "photos" });
    // 9: Summary
    s.push({ id: "summary" });

    return s;
  }, [countriesVisited, totalMiles, longestTrip, newCities, topMemories, photoHighlights]);

  const totalSlides = slides.length;

  // ---- Navigation ----
  const goTo = useCallback((idx, dir) => {
    if (idx < 0 || idx >= totalSlides) return;
    setSlideDirection(dir || 1);
    setSlideKey(k => k + 1);
    setCurrentSlide(idx);
  }, [totalSlides]);

  const next = useCallback(() => {
    if (currentSlide < totalSlides - 1) goTo(currentSlide + 1, 1);
    else setIsPlaying(false);
  }, [currentSlide, totalSlides, goTo]);

  const prev = useCallback(() => {
    if (currentSlide > 0) goTo(currentSlide - 1, -1);
  }, [currentSlide, goTo]);

  // Auto-play
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (isPlaying && currentSlide < totalSlides - 1) {
      timerRef.current = setInterval(() => next(), 5000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, currentSlide, totalSlides, next]);

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key === "p" || e.key === "P") setIsPlaying(p => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  // ---- Styles ----
  const accent = P.rose || "#c48aa8";
  const accent2 = P.sky || "#8ca8c8";
  const gold = P.gold || "#c8a060";
  const bg = "#0c0a14";
  const cardBg = "rgba(255,255,255,0.04)";
  const textMain = "#f0ece8";
  const textSub = "rgba(240,236,232,0.6)";
  const textFaint = "rgba(240,236,232,0.35)";
  const fontFamily = "'Palatino Linotype',Palatino,Georgia,serif";

  const overlayStyle = {
    position: "fixed", inset: 0, zIndex: 9999,
    background: bg,
    fontFamily,
    color: textMain,
    overflow: "hidden",
    display: "flex", flexDirection: "column",
  };

  const progressBarContainerStyle = {
    position: "absolute", top: 0, left: 0, right: 0, height: 3,
    background: "rgba(255,255,255,0.08)", zIndex: 10,
  };

  const progressBarStyle = {
    height: "100%",
    background: `linear-gradient(90deg, ${accent}, ${accent2})`,
    width: `${((currentSlide + 1) / totalSlides) * 100}%`,
    transition: "width 0.5s ease",
    borderRadius: "0 2px 2px 0",
  };

  const slideContainerStyle = {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
    position: "relative", overflow: "hidden",
    padding: "40px 24px",
  };

  const slideStyle = {
    maxWidth: 600, width: "100%",
    textAlign: "center",
    animation: `slideIn${slideDirection > 0 ? "Right" : "Left"} 0.5s ease both`,
  };

  const closeBtnStyle = {
    position: "absolute", top: 16, right: 16, zIndex: 20,
    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)",
    color: textSub, fontSize: 18, width: 36, height: 36,
    borderRadius: "50%", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily, transition: "all 0.2s",
  };

  const navBtnStyle = (side) => ({
    position: "absolute", top: "50%", [side]: 16, transform: "translateY(-50%)",
    zIndex: 20, background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: textSub, fontSize: 22, width: 44, height: 44,
    borderRadius: "50%", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily, transition: "all 0.2s",
  });

  const playBtnStyle = {
    position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
    zIndex: 20, background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: textSub, fontSize: 11, padding: "6px 16px",
    borderRadius: 20, cursor: "pointer",
    fontFamily, letterSpacing: ".12em", transition: "all 0.2s",
  };

  const bigNumberStyle = {
    fontSize: 72, fontWeight: 300, letterSpacing: "-0.02em",
    background: `linear-gradient(135deg, ${accent}, ${accent2})`,
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    lineHeight: 1.1, marginBottom: 12,
    display: "block",
  };

  const labelStyle = {
    fontSize: 13, color: textSub, letterSpacing: ".2em",
    textTransform: "uppercase", marginBottom: 24,
  };

  const chipStyle = {
    display: "inline-block", padding: "6px 14px",
    background: cardBg, borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.06)",
    fontSize: 13, margin: 4, letterSpacing: ".04em",
  };

  const memoryCardStyle = {
    background: cardBg, borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.06)",
    padding: "14px 18px", marginBottom: 8,
    textAlign: "left",
  };

  // ---- Render current slide ----
  const currentSlideData = slides[currentSlide];

  function renderSlide() {
    if (!currentSlideData) return null;

    switch (currentSlideData.id) {
      case "title":
        return (
          <div key={slideKey} style={slideStyle}>
            <div style={{ fontSize: 14, color: textFaint, letterSpacing: ".3em", textTransform: "uppercase", marginBottom: 16 }}>
              {worldMode === "our" ? "Our" : "My"} Cosmos presents
            </div>
            <div style={{
              fontSize: 48, fontWeight: 300, lineHeight: 1.2, marginBottom: 16,
              background: `linear-gradient(135deg, ${accent}, ${gold}, ${accent2})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              Your {reviewYear} in Review
            </div>
            <div style={{ fontSize: 16, color: textSub, fontStyle: "italic", marginBottom: 32 }}>
              {travelerName}'s year of adventures
            </div>
            <div style={{
              width: 48, height: 1,
              background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              margin: "0 auto 32px",
            }} />
            <div style={{ fontSize: 12, color: textFaint, letterSpacing: ".15em" }}>
              {yearEntries.length} {yearEntries.length === 1 ? "adventure" : "adventures"} across {countriesVisited.length} {countriesVisited.length === 1 ? "country" : "countries"}
            </div>
          </div>
        );

      case "adventures":
        return (
          <div key={slideKey} style={slideStyle}>
            <div style={labelStyle}>Total Adventures</div>
            <div style={bigNumberStyle}>
              <AnimatedCounter target={yearEntries.length} duration={1500} />
            </div>
            <div style={{ fontSize: 15, color: textSub, marginBottom: 32 }}>
              {yearEntries.length === 1 ? "place explored" : "places explored"} in {reviewYear}
            </div>
            {yearEntries.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
                {yearEntries.slice(0, 12).map((e, i) => (
                  <div key={e.id || i} style={{
                    ...chipStyle,
                    animationDelay: `${i * 0.1}s`,
                    animation: `fadeUp 0.5s ease ${i * 0.1}s both`,
                  }}>
                    {e.city}{e.country ? `, ${e.country}` : ""}
                  </div>
                ))}
                {yearEntries.length > 12 && (
                  <div style={{ ...chipStyle, color: textFaint }}>
                    +{yearEntries.length - 12} more
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case "countries":
        return (
          <div key={slideKey} style={slideStyle}>
            <div style={labelStyle}>Countries Visited</div>
            <div style={bigNumberStyle}>
              <AnimatedCounter target={countriesVisited.length} duration={1200} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 16 }}>
              {countriesVisited.map((c, i) => (
                <div key={c} style={{
                  ...chipStyle, fontSize: 14,
                  animation: `fadeUp 0.5s ease ${i * 0.08}s both`,
                }}>
                  <span style={{ marginRight: 6 }}>{countryFlag(c)}</span>
                  {c}
                </div>
              ))}
            </div>
          </div>
        );

      case "miles":
        return (
          <div key={slideKey} style={slideStyle}>
            <div style={labelStyle}>Distance Traveled</div>
            <div style={bigNumberStyle}>
              <AnimatedCounter target={totalMiles} duration={2500} suffix=" mi" />
            </div>
            <div style={{ fontSize: 14, color: textSub, marginBottom: 8 }}>
              That's about <AnimatedCounter
                target={Math.round(totalMiles * 1.609)}
                duration={2500}
                suffix=" km"
                style={{ color: accent2 }}
              />
            </div>
            <div style={{ fontSize: 13, color: textFaint, marginTop: 24 }}>
              {totalMiles > 25000
                ? "You've circled the globe!"
                : totalMiles > 10000
                ? "Nearly halfway around the world"
                : totalMiles > 5000
                ? "A truly epic distance"
                : totalMiles > 1000
                ? "Plenty of miles under your belt"
                : "Every journey begins with a single step"}
            </div>
          </div>
        );

      case "monthly": {
        const maxMonth = Math.max(...monthlyBreakdown, 1);
        const busiestMonth = monthlyBreakdown.indexOf(Math.max(...monthlyBreakdown));
        return (
          <div key={slideKey} style={slideStyle}>
            <div style={labelStyle}>Month by Month</div>
            <div style={{ fontSize: 15, color: textSub, marginBottom: 28 }}>
              Your busiest month was <span style={{ color: accent }}>{MONTH_NAMES[busiestMonth]}</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 8, height: 120, marginBottom: 12 }}>
              {monthlyBreakdown.map((count, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{
                    width: 28, borderRadius: 4,
                    height: Math.max(4, (count / maxMonth) * 100),
                    background: count > 0
                      ? `linear-gradient(180deg, ${accent}, ${accent2})`
                      : "rgba(255,255,255,0.06)",
                    transition: "height 1s ease",
                    animation: `growUp 0.8s ease ${i * 0.05}s both`,
                  }} />
                  <div style={{ fontSize: 9, color: textFaint, letterSpacing: ".08em" }}>
                    {MONTH_SHORT[i]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case "longest":
        return (
          <div key={slideKey} style={slideStyle}>
            <div style={labelStyle}>Longest Adventure</div>
            <div style={bigNumberStyle}>
              <AnimatedCounter target={longestTrip.days} duration={1200} />
            </div>
            <div style={{ fontSize: 15, color: textSub, marginBottom: 8 }}>
              days in <span style={{ color: accent }}>{longestTrip.entry.city}</span>
              {longestTrip.entry.country ? `, ${longestTrip.entry.country}` : ""}
            </div>
            {longestTrip.entry.dateStart && (
              <div style={{ fontSize: 12, color: textFaint, marginTop: 12 }}>
                {longestTrip.entry.dateStart}
                {longestTrip.entry.dateEnd ? ` to ${longestTrip.entry.dateEnd}` : ""}
              </div>
            )}
            {longestTrip.entry.notes && (
              <div style={{
                ...memoryCardStyle, marginTop: 24,
                maxWidth: 400, marginLeft: "auto", marginRight: "auto",
                fontStyle: "italic", fontSize: 13, color: textSub,
              }}>
                "{longestTrip.entry.notes}"
              </div>
            )}
          </div>
        );

      case "new-cities":
        return (
          <div key={slideKey} style={slideStyle}>
            <div style={labelStyle}>New Places Discovered</div>
            <div style={bigNumberStyle}>
              <AnimatedCounter target={newCities.length} duration={1000} />
            </div>
            <div style={{ fontSize: 14, color: textSub, marginBottom: 24 }}>
              {newCities.length === 1 ? "city" : "cities"} visited for the first time
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
              {newCities.slice(0, 16).map((c, i) => (
                <div key={c.city} style={{
                  ...chipStyle,
                  animation: `fadeUp 0.4s ease ${i * 0.06}s both`,
                  borderColor: `${accent}30`,
                }}>
                  {c.country && <span style={{ marginRight: 4 }}>{countryFlag(c.country)}</span>}
                  {c.city}
                </div>
              ))}
              {newCities.length > 16 && (
                <div style={{ ...chipStyle, color: textFaint }}>+{newCities.length - 16} more</div>
              )}
            </div>
          </div>
        );

      case "memories":
        return (
          <div key={slideKey} style={slideStyle}>
            <div style={labelStyle}>Top Memories</div>
            <div style={{ maxWidth: 440, margin: "0 auto" }}>
              {topMemories.map((m, i) => (
                <div key={i} style={{
                  ...memoryCardStyle,
                  animation: `fadeUp 0.5s ease ${i * 0.1}s both`,
                }}>
                  <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 4 }}>"{m.text}"</div>
                  <div style={{ fontSize: 10, color: textFaint }}>
                    {m.city}{m.country ? `, ${m.country}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "photos":
        return (
          <div key={slideKey} style={slideStyle}>
            <div style={labelStyle}>Photo Highlights</div>
            <div style={{
              display: "grid",
              gridTemplateColumns: photoHighlights.length <= 2 ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
              gap: 8, maxWidth: 480, margin: "0 auto",
            }}>
              {photoHighlights.map((e, i) => (
                <div key={e.id || i} style={{
                  position: "relative", borderRadius: 10, overflow: "hidden",
                  aspectRatio: "1", animation: `fadeUp 0.5s ease ${i * 0.1}s both`,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}>
                  <img
                    src={(e.photos || [])[0]}
                    alt={e.city || ""}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(ev) => { ev.target.style.display = "none"; }}
                  />
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    padding: "20px 8px 6px",
                    background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                    fontSize: 10, letterSpacing: ".06em",
                  }}>
                    {e.city}
                    {e.favorite && <span style={{ marginLeft: 4, color: gold }}>*</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "summary":
        return (
          <div key={slideKey} style={slideStyle}>
            <div style={{
              fontSize: 36, fontWeight: 300, lineHeight: 1.3, marginBottom: 24,
              background: `linear-gradient(135deg, ${accent}, ${gold}, ${accent2})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              What a year, {travelerName}.
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 32, flexWrap: "wrap" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 300, color: accent }}>{yearEntries.length}</div>
                <div style={{ fontSize: 10, color: textFaint, letterSpacing: ".15em", textTransform: "uppercase" }}>Adventures</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 300, color: accent2 }}>{countriesVisited.length}</div>
                <div style={{ fontSize: 10, color: textFaint, letterSpacing: ".15em", textTransform: "uppercase" }}>Countries</div>
              </div>
              {totalMiles > 0 && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: 300, color: gold }}>{totalMiles.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: textFaint, letterSpacing: ".15em", textTransform: "uppercase" }}>Miles</div>
                </div>
              )}
              {newCities.length > 0 && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: 300, color: accent }}>{newCities.length}</div>
                  <div style={{ fontSize: 10, color: textFaint, letterSpacing: ".15em", textTransform: "uppercase" }}>New Cities</div>
                </div>
              )}
            </div>
            <div style={{
              width: 48, height: 1,
              background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              margin: "0 auto 24px",
            }} />
            <div style={{ fontSize: 15, color: textSub, fontStyle: "italic", lineHeight: 1.7, marginBottom: 32, maxWidth: 400, margin: "0 auto 32px" }}>
              "{motivationalQuote}"
            </div>
            <button
              onClick={onClose}
              style={{
                padding: "12px 36px",
                background: `linear-gradient(135deg, ${accent}, ${accent2})`,
                color: "#fff", border: "none", borderRadius: 24,
                cursor: "pointer", fontSize: 13, fontFamily,
                letterSpacing: ".12em", transition: "all 0.3s",
                boxShadow: `0 4px 20px ${accent}40`,
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 28px ${accent}60`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 4px 20px ${accent}40`; }}
            >
              Back to {worldMode === "our" ? "Our" : "My"} World
            </button>
          </div>
        );

      default:
        return null;
    }
  }

  // ---- INJECT KEYFRAMES ----
  useEffect(() => {
    const id = "year-in-review-keyframes";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes slideInRight {
        from { opacity: 0; transform: translateX(60px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes slideInLeft {
        from { opacity: 0; transform: translateX(-60px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes growUp {
        from { transform: scaleY(0); transform-origin: bottom; }
        to   { transform: scaleY(1); transform-origin: bottom; }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);

  // ---- Empty state ----
  if (yearEntries.length === 0) {
    return (
      <div style={overlayStyle}>
        <Starfield color={accent} />
        <div style={progressBarContainerStyle}><div style={progressBarStyle} /></div>
        <button style={closeBtnStyle} onClick={onClose}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
        >&times;</button>
        <div style={{ ...slideContainerStyle }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 300, color: textSub, marginBottom: 16 }}>
              No adventures yet
            </div>
            <div style={{ fontSize: 14, color: textFaint }}>
              Add some entries to see your year in review
            </div>
            <button onClick={onClose} style={{
              marginTop: 32, padding: "10px 28px",
              background: `linear-gradient(135deg, ${accent}, ${accent2})`,
              color: "#fff", border: "none", borderRadius: 20,
              cursor: "pointer", fontSize: 12, fontFamily, letterSpacing: ".1em",
            }}>
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Main render ----
  return (
    <div style={overlayStyle}>
      <Starfield color={accent} />

      {/* Progress bar */}
      <div style={progressBarContainerStyle}><div style={progressBarStyle} /></div>

      {/* Slide counter */}
      <div style={{
        position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
        zIndex: 20, fontSize: 10, color: textFaint, letterSpacing: ".2em",
      }}>
        {currentSlide + 1} / {totalSlides}
      </div>

      {/* Close button */}
      <button style={closeBtnStyle} onClick={onClose}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
      >&times;</button>

      {/* Navigation arrows */}
      {currentSlide > 0 && (
        <button style={navBtnStyle("left")} onClick={prev}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
        >&#8249;</button>
      )}
      {currentSlide < totalSlides - 1 && (
        <button style={navBtnStyle("right")} onClick={next}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
        >&#8250;</button>
      )}

      {/* Slide content */}
      <div style={slideContainerStyle}>
        {renderSlide()}
      </div>

      {/* Play/Pause & dots */}
      <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        {/* Dot indicators */}
        <div style={{ display: "flex", gap: 6 }}>
          {slides.map((_, i) => (
            <button key={i} onClick={() => goTo(i, i > currentSlide ? 1 : -1)} style={{
              width: i === currentSlide ? 18 : 6, height: 6,
              borderRadius: 3, border: "none", cursor: "pointer",
              background: i === currentSlide
                ? `linear-gradient(90deg, ${accent}, ${accent2})`
                : "rgba(255,255,255,0.15)",
              transition: "all 0.3s", padding: 0,
            }} />
          ))}
        </div>
        {/* Play/Pause */}
        <button style={playBtnStyle} onClick={() => setIsPlaying(p => !p)}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
        >
          {isPlaying ? "PAUSE" : "PLAY"}
        </button>
      </div>
    </div>
  );
}
