import { useMemo } from "react";
import { getFirstBadges } from "./entryReducer.js";
import { getSeasonalHue, getMilestoneConfig } from "./worldConfigs.js";

// Local copies of utilities — avoids importing from shared modules that pull in heavy deps
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const addDays = (ds, n) => { const d = new Date(ds); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const todayStr = () => new Date().toISOString().slice(0, 10);
const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * useDerivedData — all useMemo computations that derive display data from entries.
 *
 * Returns: sorted, effectiveStartDate, filteredList, togetherList, firstBadges,
 *          season, milestones, expandedStats, favorites, reunionStats, stats,
 *          loveThreadData, constellationData, routeData, allPhotos, allPhotoCaptions
 */
export function useDerivedData(deps) {
  const {
    data, config, markerFilter, listSortMode, sliderDate,
    isPartnerWorld, isMyWorld, worldType,
    showLoveThread, showConstellation, showRoutes, isPlaying,
    TYPES,
  } = deps;

  const sorted = useMemo(
    () => [...data.entries].sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || "")),
    [data.entries],
  );

  const effectiveStartDate = useMemo(() => {
    if (config.startDate) return config.startDate;
    if (sorted.length > 0 && sorted[0].dateStart) return sorted[0].dateStart;
    return todayStr();
  }, [config.startDate, sorted]);

  const filteredList = useMemo(() => {
    const list = markerFilter === "all"
      ? data.entries
      : markerFilter === "favorites"
        ? data.entries.filter(e => e.favorite)
        : data.entries.filter(e => e.type === markerFilter);
    if (listSortMode === "oldest") return [...list].sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));
    if (listSortMode === "alpha") return [...list].sort((a, b) => (a.city || "").localeCompare(b.city || ""));
    if (listSortMode === "country") return [...list].sort((a, b) => (a.country || "").localeCompare(b.country || "") || (a.city || "").localeCompare(b.city || ""));
    return [...list].sort((a, b) => (b.dateStart || "").localeCompare(a.dateStart || ""));
  }, [data.entries, markerFilter, listSortMode]);

  const togetherList = useMemo(() => sorted.filter(e => e.who === "both"), [sorted]);

  const firstBadges = useMemo(
    () => isPartnerWorld ? getFirstBadges(data.entries) : {},
    [data.entries, isPartnerWorld],
  );

  const season = useMemo(() => getSeasonalHue(sliderDate, isMyWorld), [sliderDate, isMyWorld]);

  // Stats (used by StatsOverlay, dashboard, and celebration effects)
  const stats = useMemo(() => {
    const statList = isPartnerWorld ? togetherList : sorted;
    let daysTog = 0, totalMiles = 0;
    const countries = new Set();
    statList.forEach((e, i) => {
      const end = e.dateEnd || e.dateStart;
      daysTog += Math.max(1, daysBetween(e.dateStart, end));
      if (e.country) countries.add(e.country);
      (e.stops || []).forEach(s => { if (s.country) countries.add(s.country); });
      if (i > 0) {
        const prev = statList[i - 1];
        totalMiles += haversine(prev.lat, prev.lng, e.lat, e.lng);
      }
    });
    return { daysTog, countries: countries.size, trips: statList.length, totalMiles, photos: data.entries.reduce((s, e) => s + (e.photos || []).length, 0) };
  }, [data.entries, togetherList, sorted, isPartnerWorld]);

  // Timeline milestones (100 days, 1 year, etc.)
  const milestones = useMemo(() => {
    if (!effectiveStartDate) return [];
    const ms = [
      { days: 100, label: "100 Days" }, { days: 182, label: "6 Months" },
      { days: 365, label: "1 Year" }, { days: 500, label: "500 Days" },
      { days: 730, label: "2 Years" }, { days: 1000, label: "1000 Days" },
      { days: 1095, label: "3 Years" }, { days: 1461, label: "4 Years" },
      { days: 1826, label: "5 Years" }, { days: 2557, label: "7 Years" },
      { days: 3652, label: "10 Years" },
    ];
    const total = daysBetween(effectiveStartDate, todayStr());
    return ms.filter(m => m.days <= total).map(m => ({
      ...m, date: addDays(effectiveStartDate, m.days), pct: (m.days / Math.max(1, total)) * 100
    }));
  }, [effectiveStartDate]);

  // Expanded stats for dashboard
  const expandedStats = useMemo(() => {
    const tripList = isPartnerWorld ? togetherList : sorted;
    const longestTrip = tripList.reduce((best, e) => {
      const d = e.dateEnd ? daysBetween(e.dateStart, e.dateEnd) : 1;
      return d > best.days ? { days: d, entry: e } : best;
    }, { days: 0, entry: null });

    const farthestApart = { dist: 0, seth: null, rosie: null };
    const sethEntries = sorted.filter(e => (e.who === "seth" || e.who === "both") && e.lat != null);
    const rosieEntries = sorted.filter(e => (e.who === "rosie" || e.who === "both") && e.lat != null);
    const sampleSet = (arr, maxSize) => {
      if (arr.length <= maxSize) return arr;
      const picked = new Set();
      const byLat = [...arr].sort((a, b) => a.lat - b.lat);
      const byLng = [...arr].sort((a, b) => a.lng - b.lng);
      [byLat[0], byLat[byLat.length - 1], byLng[0], byLng[byLng.length - 1]].forEach(e => picked.add(e));
      while (picked.size < maxSize) picked.add(arr[Math.floor(Math.random() * arr.length)]);
      return [...picked];
    };
    const sS = sampleSet(sethEntries, 50);
    const rS = sampleSet(rosieEntries, 50);
    for (const s of sS) {
      for (const r of rS) {
        if (s.who === "both" && r.who === "both" && s.id === r.id) continue;
        const d = haversine(s.lat, s.lng, r.lat, r.lng);
        if (d > farthestApart.dist) { farthestApart.dist = d; farthestApart.seth = s; farthestApart.rosie = r; }
      }
    }

    const cityVisits = {};
    tripList.forEach(e => { cityVisits[e.city] = (cityVisits[e.city] || 0) + 1; });
    const topCity = Object.entries(cityVisits).sort((a, b) => b[1] - a[1])[0];

    const countryList = new Set();
    const citySet = new Set();
    data.entries.forEach(e => { if (e.country) countryList.add(e.country); if (e.city) citySet.add(e.city); (e.stops || []).forEach(s => { if (s.country) countryList.add(s.country); if (s.city) citySet.add(s.city); }); });

    let longestApart = 0;
    if (isPartnerWorld) {
      for (let i = 1; i < togetherList.length; i++) {
        const gap = daysBetween(togetherList[i - 1].dateEnd || togetherList[i - 1].dateStart, togetherList[i].dateStart);
        if (gap > longestApart) longestApart = gap;
      }
    }

    const avgTripLength = tripList.length > 0
      ? Math.round(tripList.reduce((s, e) => s + Math.max(1, e.dateEnd ? daysBetween(e.dateStart, e.dateEnd) : 1), 0) / tripList.length)
      : 0;

    const years = [...new Set(data.entries.map(e => parseInt(e.dateStart?.slice(0, 4))).filter(Boolean))].sort();

    return { longestTrip, farthestApart, topCity, countryList: [...countryList], cityCount: citySet.size, longestApart, avgTripLength, years };
  }, [data.entries, togetherList, sorted, isPartnerWorld]);

  const favorites = useMemo(() => data.entries.filter(e => e.favorite), [data.entries]);

  // Reunion counter & distance scoreboard
  const reunionStats = useMemo(() => {
    let reunions = 0, daysApart = 0, daysTogether = 0;
    let lastState = null;
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      const isTog = e.who === "both";
      if (isTog && lastState === "apart") reunions++;
      if (isTog) {
        const d = e.dateEnd ? daysBetween(e.dateStart, e.dateEnd) : 1;
        daysTogether += Math.max(1, d);
        lastState = "together";
      } else {
        if (i > 0) {
          const prev = sorted[i - 1];
          const gap = daysBetween(prev.dateEnd || prev.dateStart, e.dateStart);
          if (gap > 0 && lastState === "together") daysApart += gap;
        }
        lastState = "apart";
      }
    }
    const togetherWinning = daysTogether >= daysApart;
    return { reunions, daysApart, daysTogether, togetherWinning };
  }, [sorted]);

  // Love thread arcs (connecting together entries)
  const loveThreadData = useMemo(() => {
    if (!showLoveThread) return [];
    return togetherList.slice(1).map((e, i) => {
      const prev = togetherList[i];
      return { from: { lat: prev.lat, lng: prev.lng }, to: { lat: e.lat, lng: e.lng } };
    });
  }, [togetherList, showLoveThread]);

  // Constellation (MST connecting all entries)
  const constellationData = useMemo(() => {
    if (!showConstellation) return [];
    const all = data.entries;
    if (all.length < 2) return [];
    const subset = all.length > 80 ? all.slice(0, 80) : all;
    const n = subset.length;
    const lines = [];
    const inMST = new Uint8Array(n);
    const minDist = new Float32Array(n).fill(Infinity);
    const minFrom = new Int32Array(n).fill(-1);
    inMST[0] = 1;
    for (let i = 1; i < n; i++) {
      minDist[i] = haversine(subset[0].lat, subset[0].lng, subset[i].lat, subset[i].lng);
      minFrom[i] = 0;
    }
    for (let step = 1; step < n; step++) {
      let bestIdx = -1, bestD = Infinity;
      for (let i = 0; i < n; i++) {
        if (!inMST[i] && minDist[i] < bestD) { bestD = minDist[i]; bestIdx = i; }
      }
      if (bestIdx < 0) break;
      inMST[bestIdx] = 1;
      lines.push({ from: subset[minFrom[bestIdx]], to: subset[bestIdx] });
      for (let i = 0; i < n; i++) {
        if (inMST[i]) continue;
        const d = haversine(subset[bestIdx].lat, subset[bestIdx].lng, subset[i].lat, subset[i].lng);
        if (d < minDist[i]) { minDist[i] = d; minFrom[i] = bestIdx; }
      }
    }
    return lines;
  }, [data.entries, showConstellation]);

  // Travel routes (chronological dotted paths)
  const routeData = useMemo(() => {
    if (!showRoutes && !isPlaying) return [];
    const s = sorted.filter(e => e.dateStart && e.dateStart <= sliderDate);
    if (s.length < 2) return [];
    const pairs = [];
    for (let i = 1; i < s.length; i++) {
      if (s[i].lat === s[i - 1].lat && s[i].lng === s[i - 1].lng) continue;
      pairs.push({ from: s[i - 1], to: s[i] });
    }
    return pairs;
  }, [sorted, showRoutes, isPlaying, sliderDate]);

  // Gallery data
  const allPhotos = useMemo(() => {
    const out = [];
    sorted.forEach(e => (e.photos || []).forEach(url => out.push({ url, id: e.id, city: e.city, country: e.country, date: e.dateStart })));
    return out;
  }, [sorted]);

  const allPhotoCaptions = useMemo(() => {
    const map = {};
    for (const e of data.entries) {
      if (e.photoCaptions) Object.assign(map, e.photoCaptions);
    }
    return map;
  }, [data.entries]);

  return {
    sorted,
    effectiveStartDate,
    filteredList,
    togetherList,
    firstBadges,
    season,
    stats,
    milestones,
    expandedStats,
    favorites,
    reunionStats,
    loveThreadData,
    constellationData,
    routeData,
    allPhotos,
    allPhotoCaptions,
  };
}
