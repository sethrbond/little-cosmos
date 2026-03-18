/* =================================================================
   importTimeline.js — Pure utility for parsing Google Maps Timeline
   Supports: Records.json (old), Semantic Location History (new),
   and semanticSegments (newer) formats from Google Takeout.
   NO imports from EntryForms or OurWorld.
   ================================================================= */

// Haversine distance in km between two lat/lng points
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Format a Date object as YYYY-MM-DD
function toDateStr(d) {
  if (!d || isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// Difference in days between two date strings
function daysBetween(a, b) {
  if (!a || !b) return Infinity;
  const da = new Date(a + "T00:00:00Z");
  const db = new Date(b + "T00:00:00Z");
  return Math.abs((db - da) / 86400000);
}

// Extract city/country from an address string (best effort)
function parseAddress(address) {
  if (!address) return { city: null, country: null };
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { city: parts[0], country: parts[parts.length - 1] };
  }
  if (parts.length === 1) {
    return { city: parts[0], country: null };
  }
  return { city: null, country: null };
}

// ---------- Format parsers ----------

// Old format: Records.json with latitudeE7/longitudeE7
function parseOldFormat(data) {
  const locations = data.locations || data.records || [];
  if (!Array.isArray(locations) || locations.length === 0) return null;

  const visits = [];
  for (const rec of locations) {
    const lat =
      rec.latitudeE7 != null
        ? rec.latitudeE7 / 1e7
        : rec.latitude != null
          ? rec.latitude
          : null;
    const lng =
      rec.longitudeE7 != null
        ? rec.longitudeE7 / 1e7
        : rec.longitude != null
          ? rec.longitude
          : null;
    if (lat == null || lng == null) continue;

    let ts = null;
    if (rec.timestampMs) ts = new Date(Number(rec.timestampMs));
    else if (rec.timestamp) ts = new Date(rec.timestamp);
    if (!ts || isNaN(ts.getTime())) continue;

    const dateStr = toDateStr(ts);
    if (!dateStr) continue;

    // Try to get place name from the record
    let city = null;
    let country = null;
    if (rec.address) {
      const parsed = parseAddress(rec.address);
      city = parsed.city;
      country = parsed.country;
    }
    if (rec.name) city = city || rec.name;

    visits.push({ lat, lng, date: dateStr, city, country });
  }
  return visits.length > 0 ? visits : null;
}

// New format: Semantic Location History with placeVisit objects
function parsePlaceVisits(data) {
  const timeline = data.timelineObjects || [];
  if (!Array.isArray(timeline) || timeline.length === 0) return null;

  const visits = [];
  for (const obj of timeline) {
    const pv = obj.placeVisit;
    if (!pv) continue;

    const loc = pv.location || {};
    const lat =
      loc.latitudeE7 != null
        ? loc.latitudeE7 / 1e7
        : loc.latitude != null
          ? loc.latitude
          : null;
    const lng =
      loc.longitudeE7 != null
        ? loc.longitudeE7 / 1e7
        : loc.longitude != null
          ? loc.longitude
          : null;
    if (lat == null || lng == null) continue;

    const duration = pv.duration || {};
    let startDate = null;
    if (duration.startTimestampMs) startDate = new Date(Number(duration.startTimestampMs));
    else if (duration.startTimestamp) startDate = new Date(duration.startTimestamp);
    if (!startDate || isNaN(startDate.getTime())) continue;

    let endDate = null;
    if (duration.endTimestampMs) endDate = new Date(Number(duration.endTimestampMs));
    else if (duration.endTimestamp) endDate = new Date(duration.endTimestamp);

    const city = loc.name || loc.address?.split(",")[0]?.trim() || null;
    let country = null;
    if (loc.address) {
      const parsed = parseAddress(loc.address);
      country = parsed.country;
    }

    visits.push({
      lat,
      lng,
      date: toDateStr(startDate),
      dateEnd: endDate ? toDateStr(endDate) : null,
      city,
      country,
    });
  }
  return visits.length > 0 ? visits : null;
}

// Newer format: semanticSegments with visit/topCandidate
function parseSemanticSegments(data) {
  const segments = data.semanticSegments || [];
  if (!Array.isArray(segments) || segments.length === 0) return null;

  const visits = [];
  for (const seg of segments) {
    const visit = seg.visit;
    if (!visit) continue;

    const candidate = visit.topCandidate || (visit.topCandidates && visit.topCandidates[0]);
    if (!candidate) continue;

    const placeLocation = candidate.placeLocation || {};
    let lat = null;
    let lng = null;

    // placeLocation may have latLng string "geo:lat,lng"
    if (placeLocation.latLng) {
      const match = placeLocation.latLng.match(/geo:([-\d.]+),([-\d.]+)/);
      if (match) {
        lat = parseFloat(match[1]);
        lng = parseFloat(match[2]);
      }
    }
    if (lat == null && placeLocation.latitudeE7 != null) lat = placeLocation.latitudeE7 / 1e7;
    if (lng == null && placeLocation.longitudeE7 != null) lng = placeLocation.longitudeE7 / 1e7;
    if (lat == null || lng == null) continue;

    const timeRange = seg.startTime && seg.endTime
      ? { start: new Date(seg.startTime), end: new Date(seg.endTime) }
      : seg.timeRange
        ? { start: new Date(seg.timeRange.startTime || seg.timeRange.startTimestamp), end: new Date(seg.timeRange.endTime || seg.timeRange.endTimestamp) }
        : null;
    if (!timeRange || isNaN(timeRange.start.getTime())) continue;

    const placeName = candidate.placeLocation?.name || candidate.placeName || null;
    let city = placeName;
    let country = null;

    const address = candidate.placeLocation?.address || candidate.address || null;
    if (address) {
      const parsed = parseAddress(address);
      if (!city) city = parsed.city;
      country = parsed.country;
    }

    visits.push({
      lat,
      lng,
      date: toDateStr(timeRange.start),
      dateEnd: timeRange.end && !isNaN(timeRange.end.getTime()) ? toDateStr(timeRange.end) : null,
      city,
      country,
    });
  }
  return visits.length > 0 ? visits : null;
}

// ---------- Clustering & Merging ----------

const CLUSTER_RADIUS_KM = 50;
const MERGE_GAP_DAYS = 3;

function clusterVisits(visits) {
  if (!visits || visits.length === 0) return [];

  // Sort by date
  visits.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const clusters = [];

  for (const v of visits) {
    let merged = false;
    for (const c of clusters) {
      if (haversineKm(c.lat, c.lng, v.lat, v.lng) <= CLUSTER_RADIUS_KM) {
        // Same cluster — use city name from whichever has one
        if (!c.city && v.city) c.city = v.city;
        if (!c.country && v.country) c.country = v.country;
        c.dates.push(v.date);
        if (v.dateEnd) c.dates.push(v.dateEnd);
        merged = true;
        break;
      }
    }
    if (!merged) {
      clusters.push({
        lat: v.lat,
        lng: v.lng,
        city: v.city,
        country: v.country,
        dates: v.dateEnd ? [v.date, v.dateEnd] : [v.date],
      });
    }
  }

  // Resolve each cluster to a single date range
  return clusters.map((c) => {
    const sorted = [...new Set(c.dates.filter(Boolean))].sort();
    return {
      lat: c.lat,
      lng: c.lng,
      city: c.city || `${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}`,
      country: c.country || null,
      dateStart: sorted[0],
      dateEnd: sorted[sorted.length - 1],
    };
  });
}

function mergeConsecutive(trips) {
  if (trips.length === 0) return [];

  // Sort by dateStart
  trips.sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));

  const merged = [{ ...trips[0] }];

  for (let i = 1; i < trips.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = trips[i];

    const sameCity =
      prev.city === curr.city &&
      prev.country === curr.country;
    const gap = daysBetween(prev.dateEnd || prev.dateStart, curr.dateStart);

    if (sameCity && gap <= MERGE_GAP_DAYS) {
      // Extend the previous trip
      const endA = prev.dateEnd || prev.dateStart;
      const endB = curr.dateEnd || curr.dateStart;
      prev.dateEnd = endA > endB ? endA : endB;
    } else {
      merged.push({ ...curr });
    }
  }

  return merged;
}

// ---------- Main exports ----------

/**
 * Parse Google Takeout JSON into travel entries.
 * Handles old (Records.json), new (Semantic Location History), and
 * newer (semanticSegments) formats.
 */
export function parseGoogleTimeline(jsonData) {
  if (!jsonData || typeof jsonData !== "object") return [];

  // Try each format
  let visits =
    parseSemanticSegments(jsonData) ||
    parsePlaceVisits(jsonData) ||
    parseOldFormat(jsonData);

  if (!visits || visits.length === 0) return [];

  // Cluster nearby visits by city
  const clustered = clusterVisits(visits);

  // Merge consecutive days in same city
  const merged = mergeConsecutive(clustered);

  // Return in the expected entry shape
  return merged.map((t) => ({
    city: t.city,
    country: t.country || "",
    lat: t.lat,
    lng: t.lng,
    dateStart: t.dateStart,
    dateEnd: t.dateEnd || t.dateStart,
    entry_type: "adventure",
    type: "adventure",
    notes: "Imported from Google Maps Timeline",
  }));
}

/**
 * Summarize parsed timeline entries.
 */
export function getTimelineSummary(entries) {
  if (!entries || entries.length === 0) {
    return { tripCount: 0, countryCount: 0, yearCount: 0, firstDate: null, lastDate: null };
  }

  const countries = new Set(entries.map((e) => e.country).filter(Boolean));
  const dates = entries
    .flatMap((e) => [e.dateStart, e.dateEnd])
    .filter(Boolean)
    .sort();
  const years = new Set(dates.map((d) => d.slice(0, 4)));

  return {
    tripCount: entries.length,
    countryCount: countries.size,
    yearCount: years.size,
    yearRange: years.size > 0 ? `${[...years].sort()[0]} - ${[...years].sort().pop()}` : "",
    firstDate: dates[0] || null,
    lastDate: dates[dates.length - 1] || null,
  };
}

/**
 * Find trips that overlap in time and location with a partner's entries.
 * Used for "Our World" overlap detection.
 */
export function findOverlappingTrips(myTrips, partnerEntries) {
  if (!myTrips?.length || !partnerEntries?.length) return [];

  const overlaps = [];

  for (const mine of myTrips) {
    for (const theirs of partnerEntries) {
      // Check city/country match
      const samePlace =
        mine.city &&
        theirs.city &&
        mine.city.toLowerCase() === theirs.city.toLowerCase();
      if (!samePlace) continue;

      // Check date overlap
      const mStart = mine.dateStart;
      const mEnd = mine.dateEnd || mine.dateStart;
      const tStart = theirs.dateStart;
      const tEnd = theirs.dateEnd || theirs.dateStart;
      if (!mStart || !tStart) continue;

      if (mStart <= tEnd && tStart <= mEnd) {
        overlaps.push({
          city: mine.city,
          country: mine.country,
          dateStart: mStart > tStart ? mStart : tStart,
          dateEnd: mEnd < tEnd ? mEnd : tEnd,
          lat: mine.lat,
          lng: mine.lng,
        });
      }
    }
  }

  return overlaps;
}
