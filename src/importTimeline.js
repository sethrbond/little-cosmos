/* importTimeline.js — Google Maps Timeline (Takeout) parser
   Accepts both old format (Records.json with timestampMs + latitudeE7)
   and new format (Semantic Location History with placeVisit objects).
   Returns an array of draft entries ready for import into MyCosmos. */

// ---- Haversine distance (km) ----
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---- Date helpers ----
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseTimestamp(ts) {
  if (!ts) return null;
  if (typeof ts === "string" && ts.includes("T")) return new Date(ts);
  const ms = typeof ts === "number" ? ts : parseInt(ts, 10);
  if (isNaN(ms)) return null;
  return new Date(ms);
}

function daysBetweenDates(a, b) {
  return Math.abs(a - b) / (1000 * 60 * 60 * 24);
}

// ---- Extract city & country from Google address string ----
function parseCityCountry(name, address) {
  const parts = (address || "").split(",").map(s => s.trim()).filter(Boolean);
  let city = "";
  let country = "";

  if (parts.length >= 3) {
    country = parts[parts.length - 1];
    city = parts.length >= 4 ? parts[parts.length - 3] : parts[parts.length - 2];
    if (/^\d{4,}/.test(city) && parts.length >= 4) {
      city = parts[parts.length - 4] || parts[parts.length - 3];
    }
  } else if (parts.length === 2) {
    city = parts[0];
    country = parts[1];
  } else if (parts.length === 1) {
    city = parts[0];
  }

  if (!city && name) city = name;
  country = country.replace(/\d{4,}/, "").trim();

  return { city, country };
}

// ---- Parse old-format Records.json ----
function parseOldFormat(data) {
  const locations = data.locations || [];
  if (locations.length === 0) return [];

  const sorted = locations
    .map(loc => ({
      lat: (loc.latitudeE7 || 0) / 1e7,
      lng: (loc.longitudeE7 || 0) / 1e7,
      timestamp: parseTimestamp(loc.timestampMs || loc.timestamp),
    }))
    .filter(loc => loc.timestamp && loc.lat !== 0 && loc.lng !== 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (sorted.length === 0) return [];

  // Cluster: group points within 50km and within 12 hours
  const clusters = [];
  let current = { points: [sorted[0]] };

  for (let i = 1; i < sorted.length; i++) {
    const prev = current.points[current.points.length - 1];
    const pt = sorted[i];
    const dist = haversineKm(prev.lat, prev.lng, pt.lat, pt.lng);
    const hours = Math.abs(pt.timestamp - prev.timestamp) / (1000 * 60 * 60);

    if (dist < 50 && hours < 12) {
      current.points.push(pt);
    } else {
      clusters.push(current);
      current = { points: [pt] };
    }
  }
  clusters.push(current);

  return clusters
    .filter(c => c.points.length >= 2)
    .map(c => {
      const avgLat = c.points.reduce((s, p) => s + p.lat, 0) / c.points.length;
      const avgLng = c.points.reduce((s, p) => s + p.lng, 0) / c.points.length;
      const start = c.points[0].timestamp;
      const end = c.points[c.points.length - 1].timestamp;
      return {
        lat: Math.round(avgLat * 1e5) / 1e5,
        lng: Math.round(avgLng * 1e5) / 1e5,
        city: "",
        country: "",
        dateStart: toDateStr(start),
        dateEnd: toDateStr(end),
      };
    });
}

// ---- Parse new-format Semantic Location History ----
function parseNewFormat(data) {
  let placeVisits = [];

  if (Array.isArray(data.timelineObjects)) {
    placeVisits = data.timelineObjects
      .filter(obj => obj.placeVisit)
      .map(obj => obj.placeVisit);
  } else if (Array.isArray(data.semanticSegments)) {
    placeVisits = data.semanticSegments
      .filter(seg => seg.visit)
      .map(seg => ({
        location: {
          name: seg.visit.topCandidate?.placeLocation?.name || seg.visit.topCandidate?.semanticType || "",
          address: seg.visit.topCandidate?.placeLocation?.address || "",
          latitudeE7: seg.visit.topCandidate?.placeLocation?.latitudeE7 || null,
          longitudeE7: seg.visit.topCandidate?.placeLocation?.longitudeE7 || null,
        },
        duration: {
          startTimestamp: seg.startTime || seg.visit.startTime,
          endTimestamp: seg.endTime || seg.visit.endTime,
        },
      }));
  } else if (Array.isArray(data)) {
    placeVisits = data.filter(obj =>
      obj.placeVisit ? true : (obj.location && obj.duration)
    ).map(obj => obj.placeVisit || obj);
  }

  return placeVisits
    .map(visit => {
      const loc = visit.location || {};
      const dur = visit.duration || {};

      const lat = loc.latitudeE7 != null ? loc.latitudeE7 / 1e7
        : (loc.lat || loc.latitude || 0);
      const lng = loc.longitudeE7 != null ? loc.longitudeE7 / 1e7
        : (loc.lng || loc.longitude || 0);

      if (lat === 0 && lng === 0) return null;

      const start = parseTimestamp(dur.startTimestamp || dur.startTimestampMs);
      const end = parseTimestamp(dur.endTimestamp || dur.endTimestampMs);
      if (!start) return null;

      const { city, country } = parseCityCountry(
        loc.name || loc.placeId || "",
        loc.address || loc.formattedAddress || ""
      );

      return {
        lat: Math.round(lat * 1e5) / 1e5,
        lng: Math.round(lng * 1e5) / 1e5,
        city: city || `${Math.round(lat * 100) / 100}, ${Math.round(lng * 100) / 100}`,
        country,
        dateStart: toDateStr(start),
        dateEnd: end ? toDateStr(end) : toDateStr(start),
        locationName: loc.name || "",
      };
    })
    .filter(Boolean);
}

// ---- Group visits by city (cluster within ~50km & same city name) ----
function groupByCity(visits) {
  const groups = [];

  for (const visit of visits) {
    let merged = false;
    for (const group of groups) {
      const dist = haversineKm(group.lat, group.lng, visit.lat, visit.lng);
      const sameCity = group.city && visit.city &&
        group.city.toLowerCase() === visit.city.toLowerCase();
      if (dist < 50 && (sameCity || !visit.city || !group.city)) {
        group.visits.push(visit);
        const n = group.visits.length;
        group.lat = (group.lat * (n - 1) + visit.lat) / n;
        group.lng = (group.lng * (n - 1) + visit.lng) / n;
        if (!group.city && visit.city) group.city = visit.city;
        if (!group.country && visit.country) group.country = visit.country;
        merged = true;
        break;
      }
    }
    if (!merged) {
      groups.push({
        lat: visit.lat,
        lng: visit.lng,
        city: visit.city,
        country: visit.country,
        visits: [visit],
      });
    }
  }

  return groups;
}

// ---- Merge consecutive days in same city into one trip (gap: 3 days) ----
const GAP_THRESHOLD_DAYS = 3;

function mergeConsecutiveVisits(groups) {
  const trips = [];

  for (const group of groups) {
    const sorted = group.visits.sort((a, b) =>
      (a.dateStart || "").localeCompare(b.dateStart || "")
    );

    let currentTrip = null;

    for (const visit of sorted) {
      if (!currentTrip) {
        currentTrip = {
          dateStart: visit.dateStart,
          dateEnd: visit.dateEnd || visit.dateStart,
        };
        continue;
      }

      const tripEnd = new Date(currentTrip.dateEnd + "T12:00:00");
      const visitStart = new Date(visit.dateStart + "T12:00:00");
      const gap = daysBetweenDates(tripEnd, visitStart);

      if (gap <= GAP_THRESHOLD_DAYS) {
        const visitEnd = visit.dateEnd || visit.dateStart;
        if (visitEnd > currentTrip.dateEnd) {
          currentTrip.dateEnd = visitEnd;
        }
      } else {
        trips.push({
          city: group.city,
          country: group.country,
          lat: Math.round(group.lat * 1e5) / 1e5,
          lng: Math.round(group.lng * 1e5) / 1e5,
          dateStart: currentTrip.dateStart,
          dateEnd: currentTrip.dateEnd,
        });
        currentTrip = {
          dateStart: visit.dateStart,
          dateEnd: visit.dateEnd || visit.dateStart,
        };
      }
    }

    if (currentTrip) {
      trips.push({
        city: group.city,
        country: group.country,
        lat: Math.round(group.lat * 1e5) / 1e5,
        lng: Math.round(group.lng * 1e5) / 1e5,
        dateStart: currentTrip.dateStart,
        dateEnd: currentTrip.dateEnd,
      });
    }
  }

  return trips;
}

// ---- Main export: parseGoogleTimeline ----
export function parseGoogleTimeline(jsonData) {
  if (!jsonData || typeof jsonData !== "object") {
    throw new Error("Invalid data: expected a JSON object.");
  }

  let visits;

  const isOldFormat = Array.isArray(jsonData.locations);
  const isNewSemanticSegments = Array.isArray(jsonData.semanticSegments);
  const isNewTimelineObjects = Array.isArray(jsonData.timelineObjects);
  const isRawArray = Array.isArray(jsonData);

  if (isOldFormat) {
    visits = parseOldFormat(jsonData);
  } else if (isNewTimelineObjects || isNewSemanticSegments || isRawArray) {
    visits = parseNewFormat(jsonData);
  } else {
    const keys = Object.keys(jsonData);
    let found = false;
    for (const key of keys) {
      const val = jsonData[key];
      if (Array.isArray(val) && val.length > 0) {
        const sample = val[0];
        if (sample.placeVisit || sample.timelineObjects || sample.visit || sample.location) {
          visits = parseNewFormat(val);
          found = true;
          break;
        }
      }
    }
    if (!found) {
      throw new Error(
        "Unrecognized Google Timeline format. Expected Records.json (with 'locations' array) " +
        "or Semantic Location History (with 'timelineObjects' or 'semanticSegments')."
      );
    }
  }

  if (!visits || visits.length === 0) return [];

  const groups = groupByCity(visits);
  const trips = mergeConsecutiveVisits(groups);
  trips.sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));

  return trips.map((trip, i) => ({
    id: `gt-${Date.now()}-${i}`,
    city: trip.city || "Unknown",
    country: trip.country || "",
    lat: trip.lat,
    lng: trip.lng,
    dateStart: trip.dateStart,
    dateEnd: trip.dateEnd !== trip.dateStart ? trip.dateEnd : null,
    type: "adventure",
    entry_type: "adventure",
    who: "solo",
    notes: "Imported from Google Maps Timeline",
    highlights: [],
    museums: [],
    restaurants: [],
    photos: [],
    stops: [],
    favorite: false,
  }));
}

// ---- Summary stats for preview ----
export function getTimelineSummary(entries) {
  const countries = new Set(entries.map(e => e.country).filter(Boolean));
  const cities = new Set(entries.map(e => e.city).filter(Boolean));
  const years = new Set(entries.map(e => e.dateStart?.slice(0, 4)).filter(Boolean));
  const yearRange = years.size > 0
    ? Math.max(...[...years].map(Number)) - Math.min(...[...years].map(Number)) + 1
    : 0;

  return {
    tripCount: entries.length,
    countryCount: countries.size,
    cityCount: cities.size,
    yearCount: yearRange,
    countries: [...countries].sort(),
    years: [...years].sort(),
    firstDate: entries[0]?.dateStart || null,
    lastDate: entries[entries.length - 1]?.dateStart || null,
  };
}

// ---- Find overlapping trips between two users ----
export function findOverlappingTrips(entriesA, entriesB) {
  const overlaps = [];

  for (const a of entriesA) {
    for (const b of entriesB) {
      const aStart = a.dateStart;
      const aEnd = a.dateEnd || a.dateStart;
      const bStart = b.dateStart;
      const bEnd = b.dateEnd || b.dateStart;

      if (!aStart || !bStart) continue;

      const datesOverlap = aStart <= bEnd && bStart <= aEnd;
      if (!datesOverlap) continue;

      const dist = haversineKm(a.lat, a.lng, b.lat, b.lng);
      if (dist > 50) continue;

      overlaps.push({
        city: a.city || b.city,
        country: a.country || b.country,
        dateStart: aStart > bStart ? aStart : bStart,
        dateEnd: aEnd < bEnd ? aEnd : bEnd,
        entryIdA: a.id,
        entryIdB: b.id,
      });
    }
  }

  const seen = new Set();
  return overlaps.filter(o => {
    const key = `${o.city}-${o.dateStart}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
