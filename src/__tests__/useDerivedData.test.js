import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock useMemo to just execute the factory — removes React dependency
vi.mock("react", () => ({ useMemo: (fn) => fn() }));

// Mock the imported helpers so we don't pull in heavy deps
vi.mock("../entryReducer.js", () => ({
  getFirstBadges: (entries) => {
    const together = entries.filter((e) => e.who === "both").sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));
    const badges = {};
    if (together.length > 0) badges[together[0].id] = "First time together";
    return badges;
  },
}));
vi.mock("../worldConfigs.js", () => ({
  getSeasonalHue: (dateStr, isMyWorld) => isMyWorld ? { glow: "#88a890", particle: "#789880" } : { glow: "#f0c8e0", particle: "#f0a0c0" },
  getMilestoneConfig: () => [],
}));

import { useDerivedData } from "../useDerivedData.js";

// ---------------------------------------------------------------------------
//  Test fixtures
// ---------------------------------------------------------------------------
function makeEntry(overrides) {
  return {
    id: overrides.id || "e1",
    city: overrides.city || "Paris",
    country: overrides.country || "France",
    dateStart: overrides.dateStart || "2024-06-01",
    dateEnd: overrides.dateEnd || null,
    lat: overrides.lat ?? 48.8566,
    lng: overrides.lng ?? 2.3522,
    who: overrides.who || "both",
    type: overrides.type || "together",
    favorite: overrides.favorite || false,
    photos: overrides.photos || [],
    photoCaptions: overrides.photoCaptions || null,
    stops: overrides.stops || [],
    ...overrides,
  };
}

const ENTRIES = [
  makeEntry({ id: "e1", city: "Paris",     country: "France",  dateStart: "2024-06-01", dateEnd: "2024-06-05", lat: 48.8566, lng: 2.3522,    who: "both",  type: "together", photos: ["p1.jpg", "p2.jpg"], photoCaptions: { "p1.jpg": "Eiffel Tower" } }),
  makeEntry({ id: "e2", city: "London",    country: "UK",      dateStart: "2024-03-10", dateEnd: "2024-03-12", lat: 51.5074, lng: -0.1278,   who: "seth",  type: "seth-solo", photos: ["p3.jpg"] }),
  makeEntry({ id: "e3", city: "Tokyo",     country: "Japan",   dateStart: "2024-09-20", dateEnd: "2024-09-25", lat: 35.6762, lng: 139.6503,  who: "both",  type: "together", favorite: true, photos: ["p4.jpg", "p5.jpg", "p6.jpg"] }),
  makeEntry({ id: "e4", city: "New York",  country: "USA",     dateStart: "2024-01-15", dateEnd: null,          lat: 40.7128, lng: -74.006,   who: "rosie", type: "rosie-solo" }),
  makeEntry({ id: "e5", city: "Barcelona", country: "Spain",   dateStart: "2024-07-10", dateEnd: "2024-07-14", lat: 41.3874, lng: 2.1686,    who: "both",  type: "together", favorite: true }),
  makeEntry({ id: "e6", city: "Paris",     country: "France",  dateStart: "2025-01-05", dateEnd: "2025-01-08", lat: 48.8566, lng: 2.3522,    who: "both",  type: "special",  photos: ["p7.jpg"], photoCaptions: { "p7.jpg": "New Year in Paris" } }),
];

function makeDeps(overrides = {}) {
  return {
    data: { entries: overrides.entries || ENTRIES },
    config: { startDate: overrides.startDate || "" },
    markerFilter: overrides.markerFilter || "all",
    listSortMode: overrides.listSortMode || "newest",
    sliderDate: overrides.sliderDate || "2025-06-01",
    isPartnerWorld: overrides.isPartnerWorld ?? true,
    isMyWorld: overrides.isMyWorld ?? false,
    worldType: overrides.worldType || "partner",
    showLoveThread: overrides.showLoveThread ?? false,
    showConstellation: overrides.showConstellation ?? false,
    showRoutes: overrides.showRoutes ?? false,
    isPlaying: overrides.isPlaying ?? false,
    TYPES: overrides.TYPES || {},
  };
}

// ---------------------------------------------------------------------------
//  Tests
// ---------------------------------------------------------------------------
describe("useDerivedData", () => {

  // =======================================================================
  //  sorted
  // =======================================================================
  describe("sorted", () => {
    it("sorts entries by dateStart ascending", () => {
      const { sorted } = useDerivedData(makeDeps());
      const dates = sorted.map((e) => e.dateStart);
      expect(dates).toEqual([
        "2024-01-15", "2024-03-10", "2024-06-01", "2024-07-10", "2024-09-20", "2025-01-05",
      ]);
    });

    it("does not mutate the original array", () => {
      const entries = [...ENTRIES];
      const original = entries.map((e) => e.id);
      useDerivedData(makeDeps({ entries }));
      expect(entries.map((e) => e.id)).toEqual(original);
    });

    it("handles empty entries", () => {
      const { sorted } = useDerivedData(makeDeps({ entries: [] }));
      expect(sorted).toEqual([]);
    });

    it("handles entries with missing dateStart", () => {
      const entries = [
        makeEntry({ id: "x1", dateStart: "2024-05-01" }),
        makeEntry({ id: "x2", dateStart: undefined }),
        makeEntry({ id: "x3", dateStart: "2024-01-01" }),
      ];
      const { sorted } = useDerivedData(makeDeps({ entries }));
      // undefined dateStart becomes "" via || "" — sorts first
      expect(sorted[0].id).toBe("x2");
      expect(sorted[1].id).toBe("x3");
      expect(sorted[2].id).toBe("x1");
    });
  });

  // =======================================================================
  //  effectiveStartDate
  // =======================================================================
  describe("effectiveStartDate", () => {
    it("uses config.startDate when provided", () => {
      const { effectiveStartDate } = useDerivedData(makeDeps({ startDate: "2020-01-01" }));
      expect(effectiveStartDate).toBe("2020-01-01");
    });

    it("falls back to earliest entry dateStart when config is empty", () => {
      const { effectiveStartDate } = useDerivedData(makeDeps({ startDate: "" }));
      // earliest entry is "2024-01-15" (New York)
      expect(effectiveStartDate).toBe("2024-01-15");
    });

    it("falls back to today when no entries and no config", () => {
      const { effectiveStartDate } = useDerivedData(makeDeps({ entries: [], startDate: "" }));
      // Should be today's date string
      expect(effectiveStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // =======================================================================
  //  filteredList
  // =======================================================================
  describe("filteredList", () => {
    it("returns all entries for 'all' filter (sorted newest first by default)", () => {
      const { filteredList } = useDerivedData(makeDeps({ markerFilter: "all", listSortMode: "newest" }));
      expect(filteredList).toHaveLength(ENTRIES.length);
      // newest first = descending dateStart
      expect(filteredList[0].dateStart).toBe("2025-01-05");
      expect(filteredList[filteredList.length - 1].dateStart).toBe("2024-01-15");
    });

    it("filters by type", () => {
      const { filteredList } = useDerivedData(makeDeps({ markerFilter: "together" }));
      expect(filteredList.every((e) => e.type === "together")).toBe(true);
      expect(filteredList).toHaveLength(3); // e1, e3, e5
    });

    it("filters favorites", () => {
      const { filteredList } = useDerivedData(makeDeps({ markerFilter: "favorites" }));
      expect(filteredList.every((e) => e.favorite)).toBe(true);
      expect(filteredList).toHaveLength(2); // e3, e5
    });

    it("sorts by oldest first", () => {
      const { filteredList } = useDerivedData(makeDeps({ listSortMode: "oldest" }));
      const dates = filteredList.map((e) => e.dateStart);
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i] >= dates[i - 1]).toBe(true);
      }
    });

    it("sorts alphabetically by city", () => {
      const { filteredList } = useDerivedData(makeDeps({ listSortMode: "alpha" }));
      const cities = filteredList.map((e) => e.city);
      const expected = [...cities].sort((a, b) => a.localeCompare(b));
      expect(cities).toEqual(expected);
    });

    it("sorts by country then city", () => {
      const { filteredList } = useDerivedData(makeDeps({ listSortMode: "country" }));
      for (let i = 1; i < filteredList.length; i++) {
        const prev = filteredList[i - 1];
        const curr = filteredList[i];
        const cmp = (prev.country || "").localeCompare(curr.country || "");
        if (cmp === 0) {
          expect((prev.city || "").localeCompare(curr.city || "") <= 0).toBe(true);
        } else {
          expect(cmp <= 0).toBe(true);
        }
      }
    });

    it("returns empty for a type with no matches", () => {
      const { filteredList } = useDerivedData(makeDeps({ markerFilter: "cruise" }));
      expect(filteredList).toEqual([]);
    });
  });

  // =======================================================================
  //  togetherList
  // =======================================================================
  describe("togetherList", () => {
    it("only includes entries with who === 'both'", () => {
      const { togetherList } = useDerivedData(makeDeps());
      expect(togetherList.every((e) => e.who === "both")).toBe(true);
    });

    it("contains the correct entries", () => {
      const { togetherList } = useDerivedData(makeDeps());
      const ids = togetherList.map((e) => e.id);
      expect(ids).toEqual(["e1", "e5", "e3", "e6"]); // sorted by dateStart asc
    });

    it("is sorted by dateStart ascending (inherits from sorted)", () => {
      const { togetherList } = useDerivedData(makeDeps());
      const dates = togetherList.map((e) => e.dateStart);
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i] >= dates[i - 1]).toBe(true);
      }
    });

    it("is empty when no entries have who === 'both'", () => {
      const entries = [
        makeEntry({ id: "s1", who: "seth" }),
        makeEntry({ id: "s2", who: "rosie" }),
      ];
      const { togetherList } = useDerivedData(makeDeps({ entries }));
      expect(togetherList).toEqual([]);
    });
  });

  // =======================================================================
  //  allPhotos
  // =======================================================================
  describe("allPhotos", () => {
    it("flattens all photos from all entries", () => {
      const { allPhotos } = useDerivedData(makeDeps());
      // Total: e1=2, e2=1, e3=3, e4=0, e5=0, e6=1 = 7
      expect(allPhotos).toHaveLength(7);
    });

    it("each photo has url, id, city, country, date", () => {
      const { allPhotos } = useDerivedData(makeDeps());
      allPhotos.forEach((p) => {
        expect(p).toHaveProperty("url");
        expect(p).toHaveProperty("id");
        expect(p).toHaveProperty("city");
        expect(p).toHaveProperty("country");
        expect(p).toHaveProperty("date");
      });
    });

    it("photos are ordered by sorted entry order", () => {
      const { allPhotos } = useDerivedData(makeDeps());
      // sorted order: e4(0), e2(1), e1(2), e5(0), e3(3), e6(1)
      // photos: p3, p1, p2, p4, p5, p6, p7
      expect(allPhotos[0].url).toBe("p3.jpg");
      expect(allPhotos[1].url).toBe("p1.jpg");
      expect(allPhotos[2].url).toBe("p2.jpg");
    });

    it("returns empty for entries with no photos", () => {
      const entries = [makeEntry({ id: "np1", photos: [] })];
      const { allPhotos } = useDerivedData(makeDeps({ entries }));
      expect(allPhotos).toEqual([]);
    });
  });

  // =======================================================================
  //  allPhotoCaptions
  // =======================================================================
  describe("allPhotoCaptions", () => {
    it("merges captions from all entries", () => {
      const { allPhotoCaptions } = useDerivedData(makeDeps());
      expect(allPhotoCaptions).toEqual({
        "p1.jpg": "Eiffel Tower",
        "p7.jpg": "New Year in Paris",
      });
    });

    it("returns empty object when no captions", () => {
      const entries = [makeEntry({ id: "nc1" })];
      const { allPhotoCaptions } = useDerivedData(makeDeps({ entries }));
      expect(allPhotoCaptions).toEqual({});
    });

    it("later entries override earlier captions for same key", () => {
      const entries = [
        makeEntry({ id: "c1", dateStart: "2024-01-01", photoCaptions: { "a.jpg": "first" } }),
        makeEntry({ id: "c2", dateStart: "2024-02-01", photoCaptions: { "a.jpg": "second" } }),
      ];
      const { allPhotoCaptions } = useDerivedData(makeDeps({ entries }));
      expect(allPhotoCaptions["a.jpg"]).toBe("second");
    });
  });

  // =======================================================================
  //  stats
  // =======================================================================
  describe("stats", () => {
    it("counts days together from togetherList (partner world)", () => {
      const { stats } = useDerivedData(makeDeps({ isPartnerWorld: true }));
      // togetherList (sorted): e1(4d), e5(4d), e3(5d), e6(3d) = 16
      expect(stats.daysTog).toBe(16);
    });

    it("counts trips from togetherList (partner world)", () => {
      const { stats } = useDerivedData(makeDeps({ isPartnerWorld: true }));
      expect(stats.trips).toBe(4);
    });

    it("counts all entries as trips when not partner world", () => {
      const { stats } = useDerivedData(makeDeps({ isPartnerWorld: false }));
      expect(stats.trips).toBe(ENTRIES.length);
    });

    it("counts unique countries including stops", () => {
      const entries = [
        makeEntry({ id: "cs1", country: "France", stops: [{ country: "Belgium" }] }),
        makeEntry({ id: "cs2", country: "France", stops: [{ country: "Germany" }] }),
      ];
      const { stats } = useDerivedData(makeDeps({ entries, isPartnerWorld: false }));
      expect(stats.countries).toBe(3); // France, Belgium, Germany
    });

    it("counts total photos across all entries (not just statList)", () => {
      const { stats } = useDerivedData(makeDeps());
      // e1=2, e2=1, e3=3, e6=1 = 7
      expect(stats.photos).toBe(7);
    });

    it("totalMiles is non-negative", () => {
      const { stats } = useDerivedData(makeDeps());
      expect(stats.totalMiles).toBeGreaterThanOrEqual(0);
    });

    it("handles single entry (no distance)", () => {
      const entries = [makeEntry({ id: "se1" })];
      const { stats } = useDerivedData(makeDeps({ entries, isPartnerWorld: false }));
      expect(stats.totalMiles).toBe(0);
      expect(stats.trips).toBe(1);
    });

    it("counts 1 day for entries with no dateEnd", () => {
      const entries = [makeEntry({ id: "nd1", dateEnd: null })];
      const { stats } = useDerivedData(makeDeps({ entries, isPartnerWorld: false }));
      // daysBetween(dateStart, dateStart) = 0, but Math.max(1, 0) = 1
      expect(stats.daysTog).toBe(1);
    });
  });

  // =======================================================================
  //  milestones
  // =======================================================================
  describe("milestones", () => {
    it("includes milestones that have been reached", () => {
      // Set a start date far enough back to reach 100 days, 6 months, 1 year
      const { milestones } = useDerivedData(makeDeps({ startDate: "2023-01-01" }));
      const labels = milestones.map((m) => m.label);
      expect(labels).toContain("100 Days");
      expect(labels).toContain("6 Months");
      expect(labels).toContain("1 Year");
      expect(labels).toContain("2 Years");
      expect(labels).toContain("3 Years");
    });

    it("excludes milestones that haven't been reached", () => {
      // Start date very recent — nothing should be reached
      const { milestones } = useDerivedData(makeDeps({ startDate: "2026-03-20" }));
      expect(milestones).toEqual([]);
    });

    it("each milestone has date and pct fields", () => {
      const { milestones } = useDerivedData(makeDeps({ startDate: "2023-01-01" }));
      milestones.forEach((m) => {
        expect(m).toHaveProperty("date");
        expect(m).toHaveProperty("pct");
        expect(m).toHaveProperty("days");
        expect(m).toHaveProperty("label");
        expect(m.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(m.pct).toBeGreaterThan(0);
        expect(m.pct).toBeLessThanOrEqual(100);
      });
    });

    it("milestone dates are derived from effectiveStartDate + days", () => {
      const { milestones } = useDerivedData(makeDeps({ startDate: "2024-01-01" }));
      const m100 = milestones.find((m) => m.days === 100);
      if (m100) {
        const expected = new Date("2024-01-01");
        expected.setDate(expected.getDate() + 100);
        expect(m100.date).toBe(expected.toISOString().slice(0, 10));
      }
    });

    it("returns empty when effectiveStartDate is falsy", () => {
      // Impossible to hit with real data since effectiveStartDate always falls back,
      // but we can test the boundary: if sorted is empty and no config startDate,
      // effectiveStartDate = todayStr() which is truthy, so milestones = [] (0 days elapsed)
      const { milestones } = useDerivedData(makeDeps({ entries: [], startDate: "" }));
      // 0 days elapsed — no milestones reached
      expect(milestones).toEqual([]);
    });
  });

  // =======================================================================
  //  expandedStats
  // =======================================================================
  describe("expandedStats", () => {
    it("finds the longest trip", () => {
      const { expandedStats } = useDerivedData(makeDeps({ isPartnerWorld: true }));
      // togetherList trips: e1=4d, e5=4d, e3=5d, e6=3d — longest is e3 (5 days)
      expect(expandedStats.longestTrip.days).toBe(5);
      expect(expandedStats.longestTrip.entry.id).toBe("e3");
    });

    it("finds the top city by visit count", () => {
      const { expandedStats } = useDerivedData(makeDeps({ isPartnerWorld: true }));
      // togetherList cities: Paris(e1), Barcelona(e5), Tokyo(e3), Paris(e6) — Paris = 2 visits
      expect(expandedStats.topCity[0]).toBe("Paris");
      expect(expandedStats.topCity[1]).toBe(2);
    });

    it("computes countryList and cityCount from all entries", () => {
      const { expandedStats } = useDerivedData(makeDeps());
      // Countries: France, UK, Japan, USA, Spain = 5
      expect(expandedStats.countryList).toHaveLength(5);
      // Cities: Paris, London, Tokyo, New York, Barcelona = 5
      expect(expandedStats.cityCount).toBe(5);
    });

    it("includes stops in countryList", () => {
      const entries = [
        makeEntry({ id: "s1", country: "France", stops: [{ country: "Belgium", city: "Brussels" }] }),
      ];
      const { expandedStats } = useDerivedData(makeDeps({ entries, isPartnerWorld: false }));
      expect(expandedStats.countryList).toContain("France");
      expect(expandedStats.countryList).toContain("Belgium");
      expect(expandedStats.cityCount).toBe(2); // Paris (default), Brussels
    });

    it("computes longestApart for partner world", () => {
      const { expandedStats } = useDerivedData(makeDeps({ isPartnerWorld: true }));
      // togetherList sorted: e1(June 1-5), e5(July 10-14), e3(Sep 20-25), e6(Jan 5-8)
      // gaps: e1.end(Jun5) -> e5.start(Jul10) = 35, e5.end(Jul14) -> e3.start(Sep20) = 68, e3.end(Sep25) -> e6.start(Jan5) = 102
      expect(expandedStats.longestApart).toBe(102);
    });

    it("longestApart is 0 when not partner world", () => {
      const { expandedStats } = useDerivedData(makeDeps({ isPartnerWorld: false }));
      expect(expandedStats.longestApart).toBe(0);
    });

    it("computes avgTripLength", () => {
      const { expandedStats } = useDerivedData(makeDeps({ isPartnerWorld: true }));
      // togetherList: 4 + 4 + 5 + 3 = 16 days / 4 trips = 4
      expect(expandedStats.avgTripLength).toBe(4);
    });

    it("avgTripLength is 0 for empty tripList", () => {
      const { expandedStats } = useDerivedData(makeDeps({ entries: [], isPartnerWorld: false }));
      expect(expandedStats.avgTripLength).toBe(0);
    });

    it("extracts years from entries", () => {
      const { expandedStats } = useDerivedData(makeDeps());
      expect(expandedStats.years).toEqual([2024, 2025]);
    });

    it("farthestApart has dist >= 0", () => {
      const { expandedStats } = useDerivedData(makeDeps());
      expect(expandedStats.farthestApart.dist).toBeGreaterThanOrEqual(0);
    });
  });

  // =======================================================================
  //  reunionStats
  // =======================================================================
  describe("reunionStats", () => {
    it("counts reunions (transitions from apart to together)", () => {
      const { reunionStats } = useDerivedData(makeDeps());
      // sorted order: e4(rosie), e2(seth), e1(both), e5(both), e3(both), e6(both)
      // e4 -> lastState="apart"
      // e2 -> lastState="apart" (already apart)
      // e1 -> isTog && lastState="apart" -> reunions=1, lastState="together"
      // e5 -> isTog && lastState="together" -> no reunion, lastState="together"
      // e3 -> isTog && lastState="together" -> no reunion
      // e6 -> isTog && lastState="together" -> no reunion
      expect(reunionStats.reunions).toBe(1);
    });

    it("counts multiple reunions with alternating patterns", () => {
      const entries = [
        makeEntry({ id: "r1", dateStart: "2024-01-01", who: "both" }),
        makeEntry({ id: "r2", dateStart: "2024-02-01", who: "seth" }),
        makeEntry({ id: "r3", dateStart: "2024-03-01", who: "both" }),
        makeEntry({ id: "r4", dateStart: "2024-04-01", who: "rosie" }),
        makeEntry({ id: "r5", dateStart: "2024-05-01", who: "both" }),
      ];
      const { reunionStats } = useDerivedData(makeDeps({ entries }));
      // r1: both, lastState=null -> no reunion (null !== "apart"), lastState="together"
      // r2: seth, lastState="apart"
      // r3: both, lastState="apart" -> reunion! lastState="together"
      // r4: rosie, lastState="apart"
      // r5: both, lastState="apart" -> reunion!
      expect(reunionStats.reunions).toBe(2);
    });

    it("counts daysTogether", () => {
      const { reunionStats } = useDerivedData(makeDeps());
      // together entries: e1(4d), e5(4d), e3(5d), e6(3d) = 16
      expect(reunionStats.daysTogether).toBe(16);
    });

    it("computes togetherWinning correctly", () => {
      const entries = [
        makeEntry({ id: "tw1", dateStart: "2024-01-01", dateEnd: "2024-06-01", who: "both" }),
      ];
      const { reunionStats } = useDerivedData(makeDeps({ entries }));
      // 152 days together, 0 apart
      expect(reunionStats.togetherWinning).toBe(true);
    });

    it("handles all-together entries (no reunions, 0 apart)", () => {
      const entries = [
        makeEntry({ id: "at1", dateStart: "2024-01-01", dateEnd: "2024-01-05", who: "both" }),
        makeEntry({ id: "at2", dateStart: "2024-02-01", dateEnd: "2024-02-03", who: "both" }),
      ];
      const { reunionStats } = useDerivedData(makeDeps({ entries }));
      expect(reunionStats.reunions).toBe(0);
      expect(reunionStats.daysApart).toBe(0);
    });

    it("handles empty entries", () => {
      const { reunionStats } = useDerivedData(makeDeps({ entries: [] }));
      expect(reunionStats.reunions).toBe(0);
      expect(reunionStats.daysTogether).toBe(0);
      expect(reunionStats.daysApart).toBe(0);
      expect(reunionStats.togetherWinning).toBe(true);
    });
  });

  // =======================================================================
  //  favorites
  // =======================================================================
  describe("favorites", () => {
    it("returns only entries with favorite === true", () => {
      const { favorites } = useDerivedData(makeDeps());
      expect(favorites).toHaveLength(2);
      expect(favorites.every((e) => e.favorite)).toBe(true);
    });

    it("returns empty when no favorites", () => {
      const entries = [makeEntry({ id: "nf1", favorite: false })];
      const { favorites } = useDerivedData(makeDeps({ entries }));
      expect(favorites).toEqual([]);
    });
  });

  // =======================================================================
  //  loveThreadData
  // =======================================================================
  describe("loveThreadData", () => {
    it("returns empty when showLoveThread is false", () => {
      const { loveThreadData } = useDerivedData(makeDeps({ showLoveThread: false }));
      expect(loveThreadData).toEqual([]);
    });

    it("returns arcs between consecutive together entries", () => {
      const { loveThreadData } = useDerivedData(makeDeps({ showLoveThread: true }));
      // togetherList has 4 entries -> 3 arcs
      expect(loveThreadData).toHaveLength(3);
      loveThreadData.forEach((arc) => {
        expect(arc).toHaveProperty("from");
        expect(arc).toHaveProperty("to");
        expect(arc.from).toHaveProperty("lat");
        expect(arc.from).toHaveProperty("lng");
        expect(arc.to).toHaveProperty("lat");
        expect(arc.to).toHaveProperty("lng");
      });
    });

    it("first arc connects first two together entries", () => {
      const { loveThreadData } = useDerivedData(makeDeps({ showLoveThread: true }));
      // togetherList sorted: e1(Paris), e5(Barcelona), e3(Tokyo), e6(Paris)
      expect(loveThreadData[0].from.lat).toBe(48.8566); // Paris
      expect(loveThreadData[0].to.lat).toBe(41.3874);   // Barcelona
    });
  });

  // =======================================================================
  //  constellationData
  // =======================================================================
  describe("constellationData", () => {
    it("returns empty when showConstellation is false", () => {
      const { constellationData } = useDerivedData(makeDeps({ showConstellation: false }));
      expect(constellationData).toEqual([]);
    });

    it("returns MST edges when showConstellation is true", () => {
      const { constellationData } = useDerivedData(makeDeps({ showConstellation: true }));
      // 6 entries -> 5 MST edges
      expect(constellationData).toHaveLength(5);
      constellationData.forEach((edge) => {
        expect(edge).toHaveProperty("from");
        expect(edge).toHaveProperty("to");
      });
    });

    it("returns empty for fewer than 2 entries", () => {
      const entries = [makeEntry({ id: "c1" })];
      const { constellationData } = useDerivedData(makeDeps({ entries, showConstellation: true }));
      expect(constellationData).toEqual([]);
    });
  });

  // =======================================================================
  //  routeData
  // =======================================================================
  describe("routeData", () => {
    it("returns empty when showRoutes and isPlaying are both false", () => {
      const { routeData } = useDerivedData(makeDeps({ showRoutes: false, isPlaying: false }));
      expect(routeData).toEqual([]);
    });

    it("returns route pairs when showRoutes is true", () => {
      const { routeData } = useDerivedData(makeDeps({ showRoutes: true, sliderDate: "2025-12-31" }));
      expect(routeData.length).toBeGreaterThan(0);
      routeData.forEach((pair) => {
        expect(pair).toHaveProperty("from");
        expect(pair).toHaveProperty("to");
      });
    });

    it("filters entries by sliderDate", () => {
      // sliderDate before any entries
      const { routeData } = useDerivedData(makeDeps({ showRoutes: true, sliderDate: "2023-01-01" }));
      expect(routeData).toEqual([]);
    });

    it("skips pairs with identical coordinates", () => {
      const entries = [
        makeEntry({ id: "rd1", dateStart: "2024-01-01", lat: 48.0, lng: 2.0 }),
        makeEntry({ id: "rd2", dateStart: "2024-02-01", lat: 48.0, lng: 2.0 }), // same coords
        makeEntry({ id: "rd3", dateStart: "2024-03-01", lat: 40.0, lng: -74.0 }),
      ];
      const { routeData } = useDerivedData(makeDeps({ entries, showRoutes: true, sliderDate: "2025-01-01" }));
      // rd1->rd2 skipped (same coords), rd2->rd3 kept
      expect(routeData).toHaveLength(1);
    });
  });

  // =======================================================================
  //  firstBadges
  // =======================================================================
  describe("firstBadges", () => {
    it("returns badges for partner world", () => {
      const { firstBadges } = useDerivedData(makeDeps({ isPartnerWorld: true }));
      expect(Object.keys(firstBadges).length).toBeGreaterThan(0);
    });

    it("returns empty for non-partner world", () => {
      const { firstBadges } = useDerivedData(makeDeps({ isPartnerWorld: false }));
      expect(firstBadges).toEqual({});
    });
  });

  // =======================================================================
  //  Integration: full return shape
  // =======================================================================
  describe("return shape", () => {
    it("returns all expected keys", () => {
      const result = useDerivedData(makeDeps());
      const expectedKeys = [
        "sorted", "effectiveStartDate", "filteredList", "togetherList",
        "firstBadges", "season", "stats", "milestones", "expandedStats",
        "favorites", "reunionStats", "loveThreadData", "constellationData",
        "routeData", "allPhotos", "allPhotoCaptions",
      ];
      expectedKeys.forEach((key) => {
        expect(result).toHaveProperty(key);
      });
    });
  });
});
