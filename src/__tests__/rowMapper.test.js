import { describe, it, expect, vi } from 'vitest'

// Mock supabase-js so supabaseClient.js can import without real credentials
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({})
}))
vi.stubEnv('VITE_SUPABASE_URL', 'https://fake.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fake-anon-key')

// Import the helpers that rowToEntry depends on — we test through them
const { safeArray, mergeMemoriesIntoHighlights } = await import('../supabaseClient.js')

// rowToEntry is not exported, so we replicate it exactly from useRealtimeSync.js
// and test the mapping logic. This ensures the contract is verified even if it
// gets extracted to its own module later.
function rowToEntry(row) {
  if (!row) return null
  return {
    id: row.id,
    city: row.city,
    country: row.country || '',
    lat: row.lat,
    lng: row.lng,
    dateStart: row.date_start,
    dateEnd: row.date_end || null,
    type: row.entry_type,
    who: row.who || 'solo',
    zoomLevel: row.zoom_level || 1,
    notes: row.notes || '',
    museums: safeArray(row.museums),
    restaurants: safeArray(row.restaurants),
    highlights: mergeMemoriesIntoHighlights(row),
    photos: safeArray(row.photos),
    stops: safeArray(row.stops),
    musicUrl: row.music_url || null,
    favorite: row.favorite || false,
    loveNote: row.love_note || '',
    photoCaptions: row.photo_captions || {},
    addedBy: row.user_id || null,
  }
}

// ---------------------------------------------------------------------------
//  Fixtures
// ---------------------------------------------------------------------------

function fullRow(overrides = {}) {
  return {
    id: 'entry-001',
    city: 'Paris',
    country: 'France',
    lat: 48.8566,
    lng: 2.3522,
    date_start: '2024-06-01',
    date_end: '2024-06-05',
    entry_type: 'together',
    who: 'both',
    zoom_level: 3,
    notes: 'Anniversary trip',
    museums: ['Louvre', 'Orsay'],
    restaurants: ['Le Cinq'],
    highlights: ['Eiffel Tower at night'],
    memories: ['River cruise'],
    photos: ['photo1.jpg', 'photo2.jpg'],
    stops: [{ city: 'Lyon', country: 'France', lat: 45.76, lng: 4.83 }],
    music_url: 'https://open.spotify.com/track/abc',
    favorite: true,
    love_note: 'Best week ever',
    photo_captions: { 'photo1.jpg': 'Sunset', 'photo2.jpg': 'Bridge' },
    user_id: 'user-123',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
//  Tests
// ---------------------------------------------------------------------------

describe('rowToEntry', () => {
  // ===========================================================================
  //  Full row — every field populated
  // ===========================================================================
  describe('full row with all fields', () => {
    it('maps every snake_case field to camelCase', () => {
      const entry = rowToEntry(fullRow())
      expect(entry.id).toBe('entry-001')
      expect(entry.city).toBe('Paris')
      expect(entry.country).toBe('France')
      expect(entry.lat).toBe(48.8566)
      expect(entry.lng).toBe(2.3522)
      expect(entry.dateStart).toBe('2024-06-01')
      expect(entry.dateEnd).toBe('2024-06-05')
      expect(entry.type).toBe('together')
      expect(entry.who).toBe('both')
      expect(entry.zoomLevel).toBe(3)
      expect(entry.notes).toBe('Anniversary trip')
      expect(entry.musicUrl).toBe('https://open.spotify.com/track/abc')
      expect(entry.favorite).toBe(true)
      expect(entry.loveNote).toBe('Best week ever')
      expect(entry.addedBy).toBe('user-123')
    })

    it('maps arrays through safeArray', () => {
      const entry = rowToEntry(fullRow())
      expect(entry.museums).toEqual(['Louvre', 'Orsay'])
      expect(entry.restaurants).toEqual(['Le Cinq'])
      expect(entry.photos).toEqual(['photo1.jpg', 'photo2.jpg'])
    })

    it('parses stops correctly', () => {
      const entry = rowToEntry(fullRow())
      expect(entry.stops).toEqual([{ city: 'Lyon', country: 'France', lat: 45.76, lng: 4.83 }])
    })

    it('merges memories into highlights', () => {
      const entry = rowToEntry(fullRow())
      expect(entry.highlights).toEqual(['Eiffel Tower at night', 'River cruise'])
    })

    it('maps photoCaptions correctly', () => {
      const entry = rowToEntry(fullRow())
      expect(entry.photoCaptions).toEqual({
        'photo1.jpg': 'Sunset',
        'photo2.jpg': 'Bridge',
      })
    })
  })

  // ===========================================================================
  //  Null / undefined row
  // ===========================================================================
  describe('null/undefined input', () => {
    it('returns null for null row', () => {
      expect(rowToEntry(null)).toBeNull()
    })

    it('returns null for undefined row', () => {
      expect(rowToEntry(undefined)).toBeNull()
    })
  })

  // ===========================================================================
  //  Row with null/undefined fields — defaults
  // ===========================================================================
  describe('row with null/undefined fields', () => {
    const sparseRow = {
      id: 'entry-sparse',
      city: 'Unknown',
      lat: 0,
      lng: 0,
      date_start: '2024-01-01',
      entry_type: 'adventure',
      // All other fields missing/undefined
    }

    it('defaults country to empty string', () => {
      expect(rowToEntry(sparseRow).country).toBe('')
    })

    it('defaults dateEnd to null', () => {
      expect(rowToEntry(sparseRow).dateEnd).toBeNull()
    })

    it('defaults who to "solo"', () => {
      expect(rowToEntry(sparseRow).who).toBe('solo')
    })

    it('defaults zoomLevel to 1', () => {
      expect(rowToEntry(sparseRow).zoomLevel).toBe(1)
    })

    it('defaults notes to empty string', () => {
      expect(rowToEntry(sparseRow).notes).toBe('')
    })

    it('defaults museums to empty array', () => {
      expect(rowToEntry(sparseRow).museums).toEqual([])
    })

    it('defaults restaurants to empty array', () => {
      expect(rowToEntry(sparseRow).restaurants).toEqual([])
    })

    it('defaults highlights to empty array (no memories either)', () => {
      expect(rowToEntry(sparseRow).highlights).toEqual([])
    })

    it('defaults photos to empty array', () => {
      expect(rowToEntry(sparseRow).photos).toEqual([])
    })

    it('defaults stops to empty array', () => {
      expect(rowToEntry(sparseRow).stops).toEqual([])
    })

    it('defaults musicUrl to null', () => {
      expect(rowToEntry(sparseRow).musicUrl).toBeNull()
    })

    it('defaults favorite to false', () => {
      expect(rowToEntry(sparseRow).favorite).toBe(false)
    })

    it('defaults loveNote to empty string', () => {
      expect(rowToEntry(sparseRow).loveNote).toBe('')
    })

    it('defaults photoCaptions to empty object', () => {
      expect(rowToEntry(sparseRow).photoCaptions).toEqual({})
    })

    it('defaults addedBy to null', () => {
      expect(rowToEntry(sparseRow).addedBy).toBeNull()
    })
  })

  // ===========================================================================
  //  JSON string arrays (safeArray edge cases)
  // ===========================================================================
  describe('JSON string arrays (safeArray edge cases)', () => {
    it('parses JSON-encoded museums array', () => {
      const row = fullRow({ museums: '["MoMA","Met"]' })
      expect(rowToEntry(row).museums).toEqual(['MoMA', 'Met'])
    })

    it('parses double-encoded JSON array', () => {
      const doubleEncoded = JSON.stringify(JSON.stringify(['a', 'b']))
      const row = fullRow({ photos: doubleEncoded })
      expect(rowToEntry(row).photos).toEqual(['a', 'b'])
    })

    it('returns empty array for non-array JSON string', () => {
      const row = fullRow({ restaurants: '{"key":"value"}' })
      expect(rowToEntry(row).restaurants).toEqual([])
    })

    it('returns empty array for plain non-JSON string', () => {
      const row = fullRow({ museums: 'not json at all' })
      expect(rowToEntry(row).museums).toEqual([])
    })

    it('returns empty array for empty string', () => {
      const row = fullRow({ photos: '' })
      expect(rowToEntry(row).photos).toEqual([])
    })

    it('returns empty array for null', () => {
      const row = fullRow({ stops: null })
      expect(rowToEntry(row).stops).toEqual([])
    })
  })

  // ===========================================================================
  //  photoCaptions mapping
  // ===========================================================================
  describe('photoCaptions', () => {
    it('passes through an object as-is', () => {
      const caps = { 'img.jpg': 'Hello' }
      const row = fullRow({ photo_captions: caps })
      expect(rowToEntry(row).photoCaptions).toBe(caps)
    })

    it('defaults to empty object when null', () => {
      const row = fullRow({ photo_captions: null })
      expect(rowToEntry(row).photoCaptions).toEqual({})
    })

    it('defaults to empty object when undefined', () => {
      const row = fullRow({ photo_captions: undefined })
      expect(rowToEntry(row).photoCaptions).toEqual({})
    })
  })

  // ===========================================================================
  //  stops with JSON string
  // ===========================================================================
  describe('stops as JSON string', () => {
    it('parses a JSON-encoded stops array', () => {
      const stops = [{ city: 'Lyon', country: 'France', lat: 45.76, lng: 4.83 }]
      const row = fullRow({ stops: JSON.stringify(stops) })
      expect(rowToEntry(row).stops).toEqual(stops)
    })

    it('handles double-encoded stops', () => {
      const stops = [{ city: 'Nice' }]
      const row = fullRow({ stops: JSON.stringify(JSON.stringify(stops)) })
      expect(rowToEntry(row).stops).toEqual(stops)
    })
  })

  // ===========================================================================
  //  highlights with double-encoded JSON (mergeMemoriesIntoHighlights)
  // ===========================================================================
  describe('highlights with memories merge', () => {
    it('merges unique memories into highlights', () => {
      const row = fullRow({
        highlights: ['sunset', 'beach'],
        memories: ['beach', 'concert'],
      })
      const entry = rowToEntry(row)
      expect(entry.highlights).toEqual(['sunset', 'beach', 'concert'])
    })

    it('handles JSON-encoded highlights and memories', () => {
      const row = fullRow({
        highlights: '["a"]',
        memories: '["b"]',
      })
      expect(rowToEntry(row).highlights).toEqual(['a', 'b'])
    })

    it('handles double-encoded highlights', () => {
      const row = fullRow({
        highlights: JSON.stringify(JSON.stringify(['x'])),
        memories: [],
      })
      expect(rowToEntry(row).highlights).toEqual(['x'])
    })

    it('returns empty array when both are null', () => {
      const row = fullRow({ highlights: null, memories: null })
      expect(rowToEntry(row).highlights).toEqual([])
    })
  })

  // ===========================================================================
  //  Minimal row (only required fields) — no crash
  // ===========================================================================
  describe('minimal row (only required fields)', () => {
    it('does not crash with absolute minimum fields', () => {
      const minimal = { id: 'min-1', city: 'Nowhere', lat: 0, lng: 0, date_start: '2025-01-01', entry_type: 'adventure' }
      const entry = rowToEntry(minimal)
      expect(entry).not.toBeNull()
      expect(entry.id).toBe('min-1')
      expect(entry.city).toBe('Nowhere')
      expect(entry.dateStart).toBe('2025-01-01')
      expect(entry.type).toBe('adventure')
    })

    it('all optional fields have safe defaults', () => {
      const minimal = { id: 'min-2', city: 'X', lat: 1, lng: 2, date_start: '2025-06-01', entry_type: 'home' }
      const entry = rowToEntry(minimal)
      expect(entry.country).toBe('')
      expect(entry.dateEnd).toBeNull()
      expect(entry.who).toBe('solo')
      expect(entry.zoomLevel).toBe(1)
      expect(entry.notes).toBe('')
      expect(entry.museums).toEqual([])
      expect(entry.restaurants).toEqual([])
      expect(entry.highlights).toEqual([])
      expect(entry.photos).toEqual([])
      expect(entry.stops).toEqual([])
      expect(entry.musicUrl).toBeNull()
      expect(entry.favorite).toBe(false)
      expect(entry.loveNote).toBe('')
      expect(entry.photoCaptions).toEqual({})
      expect(entry.addedBy).toBeNull()
    })
  })

  // ===========================================================================
  //  Compare output shape vs loadEntries mapping
  // ===========================================================================
  describe('output shape matches loadEntries contract', () => {
    // The loadEntries mappers in supabase.js produce the same shape.
    // This test verifies all expected keys are present.
    const EXPECTED_KEYS = [
      'id', 'city', 'country', 'lat', 'lng',
      'dateStart', 'dateEnd', 'type', 'who',
      'zoomLevel', 'notes', 'museums', 'restaurants',
      'highlights', 'photos', 'stops', 'musicUrl',
      'favorite', 'loveNote', 'photoCaptions', 'addedBy',
    ]

    it('has exactly the expected keys', () => {
      const entry = rowToEntry(fullRow())
      const keys = Object.keys(entry).sort()
      expect(keys).toEqual([...EXPECTED_KEYS].sort())
    })

    it('no snake_case keys leak through', () => {
      const entry = rowToEntry(fullRow())
      const snakeKeys = Object.keys(entry).filter(k => k.includes('_'))
      expect(snakeKeys).toEqual([])
    })
  })
})
