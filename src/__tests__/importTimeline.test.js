import { describe, it, expect } from 'vitest'
import { parseGoogleTimeline, getTimelineSummary, findOverlappingTrips } from '../importTimeline.js'

describe('parseGoogleTimeline', () => {
  it('returns empty array for null input', () => {
    expect(parseGoogleTimeline(null)).toEqual([])
  })

  it('returns empty array for undefined input', () => {
    expect(parseGoogleTimeline(undefined)).toEqual([])
  })

  it('returns empty array for non-object input', () => {
    expect(parseGoogleTimeline('string')).toEqual([])
    expect(parseGoogleTimeline(42)).toEqual([])
  })

  it('returns empty array for empty object', () => {
    expect(parseGoogleTimeline({})).toEqual([])
  })

  describe('old format (latitudeE7)', () => {
    it('parses Records.json format with latitudeE7/longitudeE7', () => {
      const data = {
        locations: [
          {
            latitudeE7: 488566101,
            longitudeE7: 23522219,
            timestampMs: '1700000000000',
            name: 'Paris',
            address: 'Paris, France',
          },
        ],
      }
      const result = parseGoogleTimeline(data)
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].lat).toBeCloseTo(48.8566, 3)
      expect(result[0].lng).toBeCloseTo(2.3522, 3)
      expect(result[0].city).toBe('Paris')
      expect(result[0].entry_type).toBe('adventure')
    })

    it('parses records array key', () => {
      const data = {
        records: [
          {
            latitudeE7: 356762000,
            longitudeE7: 1396503000,
            timestamp: '2023-11-14T12:00:00Z',
            address: 'Tokyo, Japan',
          },
        ],
      }
      const result = parseGoogleTimeline(data)
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].city).toBe('Tokyo')
      expect(result[0].country).toBe('Japan')
    })

    it('skips records with missing lat/lng', () => {
      const data = {
        locations: [
          { timestampMs: '1700000000000', address: 'Nowhere' },
        ],
      }
      const result = parseGoogleTimeline(data)
      expect(result).toEqual([])
    })

    it('skips records with missing timestamp', () => {
      const data = {
        locations: [
          { latitudeE7: 488566101, longitudeE7: 23522219 },
        ],
      }
      const result = parseGoogleTimeline(data)
      expect(result).toEqual([])
    })
  })

  describe('new format (placeVisit)', () => {
    it('parses Semantic Location History format', () => {
      const data = {
        timelineObjects: [
          {
            placeVisit: {
              location: {
                latitudeE7: 515074000,
                longitudeE7: -1278000,
                name: 'London',
                address: 'London, United Kingdom',
              },
              duration: {
                startTimestamp: '2023-06-15T09:00:00Z',
                endTimestamp: '2023-06-18T18:00:00Z',
              },
            },
          },
        ],
      }
      const result = parseGoogleTimeline(data)
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].city).toBe('London')
      expect(result[0].country).toBe('United Kingdom')
      expect(result[0].dateStart).toBe('2023-06-15')
    })

    it('handles timestampMs in duration', () => {
      const data = {
        timelineObjects: [
          {
            placeVisit: {
              location: {
                latitudeE7: 488566101,
                longitudeE7: 23522219,
                name: 'Eiffel Tower',
              },
              duration: {
                startTimestampMs: '1686830400000',
                endTimestampMs: '1687089600000',
              },
            },
          },
        ],
      }
      const result = parseGoogleTimeline(data)
      expect(result.length).toBeGreaterThanOrEqual(1)
    })

    it('skips non-placeVisit timeline objects', () => {
      const data = {
        timelineObjects: [
          { activitySegment: { distance: 1000 } },
        ],
      }
      const result = parseGoogleTimeline(data)
      expect(result).toEqual([])
    })
  })

  describe('newer format (semanticSegments)', () => {
    it('parses semanticSegments with latLng geo string', () => {
      const data = {
        semanticSegments: [
          {
            visit: {
              topCandidate: {
                placeLocation: {
                  latLng: 'geo:48.8566,2.3522',
                  name: 'Paris',
                  address: 'Paris, France',
                },
              },
            },
            startTime: '2024-01-10T10:00:00Z',
            endTime: '2024-01-12T18:00:00Z',
          },
        ],
      }
      const result = parseGoogleTimeline(data)
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].lat).toBeCloseTo(48.8566, 3)
      expect(result[0].lng).toBeCloseTo(2.3522, 3)
      expect(result[0].city).toBe('Paris')
      expect(result[0].dateStart).toBe('2024-01-10')
    })

    it('parses semanticSegments with latitudeE7 fallback', () => {
      const data = {
        semanticSegments: [
          {
            visit: {
              topCandidate: {
                placeLocation: {
                  latitudeE7: 356762000,
                  longitudeE7: 1396503000,
                  name: 'Tokyo',
                },
              },
            },
            startTime: '2024-03-01T08:00:00Z',
            endTime: '2024-03-05T20:00:00Z',
          },
        ],
      }
      const result = parseGoogleTimeline(data)
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].city).toBe('Tokyo')
    })

    it('handles timeRange format', () => {
      const data = {
        semanticSegments: [
          {
            visit: {
              topCandidate: {
                placeLocation: { latLng: 'geo:40.7128,-74.006', name: 'NYC' },
              },
            },
            timeRange: {
              startTime: '2024-02-01T10:00:00Z',
              endTime: '2024-02-03T18:00:00Z',
            },
          },
        ],
      }
      const result = parseGoogleTimeline(data)
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].dateStart).toBe('2024-02-01')
    })
  })

  describe('trip merging', () => {
    it('merges consecutive days in same city', () => {
      const data = {
        locations: [
          {
            latitudeE7: 488566101,
            longitudeE7: 23522219,
            timestampMs: String(new Date('2023-07-10T12:00:00Z').getTime()),
            address: 'Paris, France',
          },
          {
            latitudeE7: 488570000,
            longitudeE7: 23520000,
            timestampMs: String(new Date('2023-07-11T14:00:00Z').getTime()),
            address: 'Paris, France',
          },
          {
            latitudeE7: 488560000,
            longitudeE7: 23525000,
            timestampMs: String(new Date('2023-07-12T10:00:00Z').getTime()),
            address: 'Paris, France',
          },
        ],
      }
      const result = parseGoogleTimeline(data)
      expect(result.length).toBe(1)
      expect(result[0].dateStart).toBe('2023-07-10')
      expect(result[0].dateEnd).toBe('2023-07-12')
    })

    it('keeps separate cities as separate trips', () => {
      const data = {
        locations: [
          {
            latitudeE7: 488566101,
            longitudeE7: 23522219,
            timestampMs: String(new Date('2023-07-10T12:00:00Z').getTime()),
            address: 'Paris, France',
          },
          {
            latitudeE7: 515074000,
            longitudeE7: -1278000,
            timestampMs: String(new Date('2023-07-15T12:00:00Z').getTime()),
            address: 'London, United Kingdom',
          },
        ],
      }
      const result = parseGoogleTimeline(data)
      expect(result.length).toBe(2)
    })
  })

  describe('output shape', () => {
    it('includes all expected fields', () => {
      const data = {
        locations: [
          {
            latitudeE7: 488566101,
            longitudeE7: 23522219,
            timestampMs: '1700000000000',
            address: 'Paris, France',
          },
        ],
      }
      const result = parseGoogleTimeline(data)
      expect(result[0]).toHaveProperty('city')
      expect(result[0]).toHaveProperty('country')
      expect(result[0]).toHaveProperty('lat')
      expect(result[0]).toHaveProperty('lng')
      expect(result[0]).toHaveProperty('dateStart')
      expect(result[0]).toHaveProperty('dateEnd')
      expect(result[0]).toHaveProperty('entry_type', 'adventure')
      expect(result[0]).toHaveProperty('type', 'adventure')
      expect(result[0]).toHaveProperty('notes', 'Imported from Google Maps Timeline')
    })
  })
})

describe('getTimelineSummary', () => {
  it('returns zeroed summary for empty input', () => {
    expect(getTimelineSummary([])).toEqual({
      tripCount: 0,
      countryCount: 0,
      yearCount: 0,
      firstDate: null,
      lastDate: null,
    })
  })

  it('returns zeroed summary for null', () => {
    expect(getTimelineSummary(null)).toEqual({
      tripCount: 0,
      countryCount: 0,
      yearCount: 0,
      firstDate: null,
      lastDate: null,
    })
  })

  it('returns correct counts for entries', () => {
    const entries = [
      { city: 'Paris', country: 'France', dateStart: '2023-06-10', dateEnd: '2023-06-15' },
      { city: 'Tokyo', country: 'Japan', dateStart: '2023-11-01', dateEnd: '2023-11-05' },
      { city: 'London', country: 'UK', dateStart: '2024-03-01', dateEnd: '2024-03-10' },
    ]
    const summary = getTimelineSummary(entries)
    expect(summary.tripCount).toBe(3)
    expect(summary.countryCount).toBe(3)
    expect(summary.yearCount).toBe(2)
    expect(summary.firstDate).toBe('2023-06-10')
    expect(summary.lastDate).toBe('2024-03-10')
  })

  it('deduplicates countries', () => {
    const entries = [
      { city: 'Paris', country: 'France', dateStart: '2023-06-10', dateEnd: '2023-06-15' },
      { city: 'Lyon', country: 'France', dateStart: '2023-07-01', dateEnd: '2023-07-05' },
    ]
    const summary = getTimelineSummary(entries)
    expect(summary.countryCount).toBe(1)
  })

  it('handles entries with missing country', () => {
    const entries = [
      { city: 'Unknown', country: '', dateStart: '2023-01-01', dateEnd: '2023-01-02' },
      { city: 'Paris', country: 'France', dateStart: '2023-06-10', dateEnd: '2023-06-15' },
    ]
    const summary = getTimelineSummary(entries)
    expect(summary.countryCount).toBe(1)
  })

  it('includes yearRange string', () => {
    const entries = [
      { city: 'Paris', country: 'France', dateStart: '2020-06-10', dateEnd: '2020-06-15' },
      { city: 'Tokyo', country: 'Japan', dateStart: '2024-03-01', dateEnd: '2024-03-10' },
    ]
    const summary = getTimelineSummary(entries)
    expect(summary.yearRange).toBe('2020 - 2024')
  })
})

describe('findOverlappingTrips', () => {
  it('returns empty array when either input is empty', () => {
    expect(findOverlappingTrips([], [{ city: 'Paris' }])).toEqual([])
    expect(findOverlappingTrips([{ city: 'Paris' }], [])).toEqual([])
    expect(findOverlappingTrips(null, null)).toEqual([])
  })

  it('finds overlapping trips in same city and date range', () => {
    const myTrips = [
      { city: 'Paris', country: 'France', lat: 48.8, lng: 2.3, dateStart: '2023-06-10', dateEnd: '2023-06-20' },
    ]
    const partnerEntries = [
      { city: 'Paris', country: 'France', lat: 48.8, lng: 2.3, dateStart: '2023-06-15', dateEnd: '2023-06-25' },
    ]
    const overlaps = findOverlappingTrips(myTrips, partnerEntries)
    expect(overlaps).toHaveLength(1)
    expect(overlaps[0].city).toBe('Paris')
    expect(overlaps[0].dateStart).toBe('2023-06-15')
    expect(overlaps[0].dateEnd).toBe('2023-06-20')
  })

  it('returns empty when cities differ', () => {
    const myTrips = [
      { city: 'Paris', dateStart: '2023-06-10', dateEnd: '2023-06-20' },
    ]
    const partnerEntries = [
      { city: 'London', dateStart: '2023-06-10', dateEnd: '2023-06-20' },
    ]
    expect(findOverlappingTrips(myTrips, partnerEntries)).toEqual([])
  })

  it('returns empty when dates do not overlap', () => {
    const myTrips = [
      { city: 'Paris', dateStart: '2023-06-10', dateEnd: '2023-06-15' },
    ]
    const partnerEntries = [
      { city: 'Paris', dateStart: '2023-07-01', dateEnd: '2023-07-10' },
    ]
    expect(findOverlappingTrips(myTrips, partnerEntries)).toEqual([])
  })

  it('matches city case-insensitively', () => {
    const myTrips = [
      { city: 'PARIS', country: 'France', lat: 48.8, lng: 2.3, dateStart: '2023-06-10', dateEnd: '2023-06-20' },
    ]
    const partnerEntries = [
      { city: 'paris', dateStart: '2023-06-15', dateEnd: '2023-06-25' },
    ]
    const overlaps = findOverlappingTrips(myTrips, partnerEntries)
    expect(overlaps).toHaveLength(1)
  })
})
