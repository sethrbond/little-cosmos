import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
//  Mock React hooks — extract pure computation without React runtime
// ---------------------------------------------------------------------------
let useMemoFn, useStateSetter, useEffectCallbacks
beforeEach(() => {
  useEffectCallbacks = []
  useStateSetter = vi.fn()
})

vi.mock('react', () => ({
  useState: (init) => [init, useStateSetter],
  useEffect: (fn) => { useEffectCallbacks.push(fn) },
  useRef: (init) => ({ current: init }),
  useMemo: (fn) => fn(),
}))

vi.mock('../worldConfigs.js', async () => {
  const actual = await vi.importActual('../worldConfigs.js')
  return actual
})

import { useCelebrations } from '../useCelebrations.js'

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides = {}) {
  return {
    id: overrides.id || 'e1',
    city: overrides.city || 'Paris',
    country: overrides.country || 'France',
    dateStart: overrides.dateStart || '2024-06-15',
    dateEnd: overrides.dateEnd || null,
    lat: overrides.lat ?? 48.85,
    lng: overrides.lng ?? 2.35,
    who: overrides.who || 'both',
    type: overrides.type || 'together',
    favorite: overrides.favorite || false,
    photos: overrides.photos || [],
    stops: overrides.stops || [],
    ...overrides,
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function makeDeps(overrides = {}) {
  return {
    introComplete: overrides.introComplete ?? true,
    isPartnerWorld: overrides.isPartnerWorld ?? true,
    isMyWorld: overrides.isMyWorld ?? false,
    worldType: overrides.worldType || 'partner',
    worldName: overrides.worldName || 'Our World',
    config: overrides.config || { startDate: '2023-06-15', youName: 'Seth', partnerName: 'Rosie' },
    worldId: overrides.worldId || 'world-1',
    userId: overrides.userId || 'user-1',
    stats: overrides.stats || { trips: 10, countries: 5, totalMiles: 5000 },
    entries: overrides.entries || [],
    selected: overrides.selected ?? null,
    sliderDate: overrides.sliderDate || todayStr(),
    modalDispatch: overrides.modalDispatch || vi.fn(),
    setCelebrationData: overrides.setCelebrationData || vi.fn(),
  }
}

// ---------------------------------------------------------------------------
//  Tests: isAnniversary (computed via useMemo)
// ---------------------------------------------------------------------------

describe('useCelebrations — isAnniversary', () => {
  it('returns true when sliderDate has same month+day as startDate but different year', () => {
    const deps = makeDeps({
      config: { startDate: '2020-03-24' },
      sliderDate: '2026-03-24',
    })
    const { isAnniversary } = useCelebrations(deps)
    expect(isAnniversary).toBe(true)
  })

  it('returns false when same month but different day', () => {
    const deps = makeDeps({
      config: { startDate: '2020-03-24' },
      sliderDate: '2026-03-25',
    })
    const { isAnniversary } = useCelebrations(deps)
    expect(isAnniversary).toBe(false)
  })

  it('returns false when same full date (startDate itself — not an anniversary)', () => {
    const deps = makeDeps({
      config: { startDate: '2020-03-24' },
      sliderDate: '2020-03-24',
    })
    const { isAnniversary } = useCelebrations(deps)
    expect(isAnniversary).toBe(false)
  })

  it('returns false when no startDate is configured', () => {
    const deps = makeDeps({
      config: { startDate: '' },
      sliderDate: '2026-03-24',
    })
    const { isAnniversary } = useCelebrations(deps)
    expect(isAnniversary).toBe(false)
  })

  it('returns true for a 1-year anniversary', () => {
    const deps = makeDeps({
      config: { startDate: '2025-07-10' },
      sliderDate: '2026-07-10',
    })
    const { isAnniversary } = useCelebrations(deps)
    expect(isAnniversary).toBe(true)
  })

  it('handles January 1st anniversary', () => {
    const deps = makeDeps({
      config: { startDate: '2020-01-01' },
      sliderDate: '2026-01-01',
    })
    const { isAnniversary } = useCelebrations(deps)
    expect(isAnniversary).toBe(true)
  })

  it('handles December 31st anniversary', () => {
    const deps = makeDeps({
      config: { startDate: '2020-12-31' },
      sliderDate: '2026-12-31',
    })
    const { isAnniversary } = useCelebrations(deps)
    expect(isAnniversary).toBe(true)
  })

  // February 29th edge case: sliderDate of "02-28" won't match startDate "02-29"
  it('Feb 29 startDate does NOT match Feb 28 sliderDate', () => {
    const deps = makeDeps({
      config: { startDate: '2020-02-29' },
      sliderDate: '2026-02-28',
    })
    const { isAnniversary } = useCelebrations(deps)
    expect(isAnniversary).toBe(false)
  })

  it('Feb 29 startDate matches Feb 29 sliderDate in leap year', () => {
    const deps = makeDeps({
      config: { startDate: '2020-02-29' },
      sliderDate: '2024-02-29',
    })
    const { isAnniversary } = useCelebrations(deps)
    expect(isAnniversary).toBe(true)
  })
})

// ---------------------------------------------------------------------------
//  Tests: onThisDay (computed via useMemo — the list, not the toast effect)
// ---------------------------------------------------------------------------

describe('useCelebrations — onThisDay list', () => {
  it('returns entries from previous years matching today month+day', () => {
    const today = todayStr()
    const md = today.slice(5) // e.g. "03-24"
    const pastYear = String(parseInt(today.slice(0, 4)) - 2)
    const entries = [
      makeEntry({ id: 'otd-1', dateStart: `${pastYear}-${md}` }),
      makeEntry({ id: 'otd-2', dateStart: `${pastYear}-01-01` }), // different day
    ]
    const deps = makeDeps({ entries })
    const { onThisDay } = useCelebrations(deps)
    expect(onThisDay).toHaveLength(1)
    expect(onThisDay[0].id).toBe('otd-1')
  })

  it('adds yearsAgo field', () => {
    const today = todayStr()
    const md = today.slice(5)
    const year = parseInt(today.slice(0, 4))
    const entries = [
      makeEntry({ id: 'y1', dateStart: `${year - 3}-${md}` }),
    ]
    const { onThisDay } = useCelebrations(makeDeps({ entries }))
    expect(onThisDay[0].yearsAgo).toBe(3)
  })

  it('excludes entries from the current year', () => {
    const today = todayStr()
    const entries = [
      makeEntry({ id: 'same-year', dateStart: today }),
    ]
    const { onThisDay } = useCelebrations(makeDeps({ entries }))
    expect(onThisDay).toHaveLength(0)
  })

  it('returns empty when no entries match', () => {
    const entries = [
      makeEntry({ id: 'no-match', dateStart: '2020-01-01' }),
    ]
    const { onThisDay } = useCelebrations(makeDeps({ entries }))
    // Only matches if today is Jan 1
    if (todayStr().slice(5) !== '01-01') {
      expect(onThisDay).toHaveLength(0)
    }
  })

  it('returns empty when no entries at all', () => {
    const { onThisDay } = useCelebrations(makeDeps({ entries: [] }))
    expect(onThisDay).toEqual([])
  })

  it('skips entries without dateStart', () => {
    const today = todayStr()
    const md = today.slice(5)
    const entries = [
      makeEntry({ id: 'no-date', dateStart: undefined }),
      makeEntry({ id: 'has-date', dateStart: `2020-${md}` }),
    ]
    const { onThisDay } = useCelebrations(makeDeps({ entries }))
    const ids = onThisDay.map(e => e.id)
    expect(ids).not.toContain('no-date')
  })

  it('handles multiple matches from different years', () => {
    const today = todayStr()
    const md = today.slice(5)
    const year = parseInt(today.slice(0, 4))
    const entries = [
      makeEntry({ id: 'y1', dateStart: `${year - 1}-${md}` }),
      makeEntry({ id: 'y2', dateStart: `${year - 2}-${md}` }),
      makeEntry({ id: 'y3', dateStart: `${year - 3}-${md}` }),
    ]
    const { onThisDay } = useCelebrations(makeDeps({ entries }))
    expect(onThisDay).toHaveLength(3)
    expect(onThisDay.map(e => e.yearsAgo).sort()).toEqual([1, 2, 3])
  })
})

// ---------------------------------------------------------------------------
//  Tests: milestone detection via getMilestoneConfig
// ---------------------------------------------------------------------------

describe('useCelebrations — milestone config', () => {
  // We test getMilestoneConfig directly since the hook's milestone effect
  // depends on localStorage and React effects we can't easily trigger.
  // The real test is: does getMilestoneConfig return correct thresholds?

  it('partner milestones fire at 5, 10, 25, 50, 100 entries', async () => {
    const { getMilestoneConfig } = await import('../worldConfigs.js')
    const ms = getMilestoneConfig('partner', false)
    const counts = ms.entries.map(m => m.count)
    expect(counts).toEqual([5, 10, 25, 50, 100])
  })

  it('personal milestones fire at 5, 10, 25, 50, 100 entries', async () => {
    const { getMilestoneConfig } = await import('../worldConfigs.js')
    const ms = getMilestoneConfig('partner', true) // isMyWorld = true
    const counts = ms.entries.map(m => m.count)
    expect(counts).toEqual([5, 10, 25, 50, 100])
  })

  it('friends milestones have entries, countries, and distance arrays', async () => {
    const { getMilestoneConfig } = await import('../worldConfigs.js')
    const ms = getMilestoneConfig('friends', false)
    expect(ms.entries.length).toBeGreaterThan(0)
    expect(ms.countries.length).toBeGreaterThan(0)
    expect(ms.distance.length).toBeGreaterThan(0)
  })

  it('family milestones have entries, countries, and distance arrays', async () => {
    const { getMilestoneConfig } = await import('../worldConfigs.js')
    const ms = getMilestoneConfig('family', false)
    expect(ms.entries.length).toBeGreaterThan(0)
    expect(ms.countries.length).toBeGreaterThan(0)
    expect(ms.distance.length).toBeGreaterThan(0)
  })

  it('distance milestones fire at 1000, 10000, 25000 miles', async () => {
    const { getMilestoneConfig } = await import('../worldConfigs.js')
    const ms = getMilestoneConfig('partner', false)
    const miles = ms.distance.map(m => m.miles)
    expect(miles).toEqual([1000, 10000, 25000])
  })

  it('country milestones fire at 5, 10, 25', async () => {
    const { getMilestoneConfig } = await import('../worldConfigs.js')
    const ms = getMilestoneConfig('partner', false)
    const counts = ms.countries.map(m => m.count)
    expect(counts).toEqual([5, 10, 25])
  })

  it('each milestone has msg, sub, and icon fields', async () => {
    const { getMilestoneConfig } = await import('../worldConfigs.js')
    const ms = getMilestoneConfig('partner', false)
    for (const m of [...ms.entries, ...ms.countries, ...ms.distance]) {
      expect(m).toHaveProperty('msg')
      expect(m).toHaveProperty('sub')
      expect(m).toHaveProperty('icon')
      expect(typeof m.msg).toBe('string')
      expect(typeof m.sub).toBe('string')
    }
  })
})

// ---------------------------------------------------------------------------
//  Tests: return shape
// ---------------------------------------------------------------------------

describe('useCelebrations — return shape', () => {
  it('returns all expected keys', () => {
    const result = useCelebrations(makeDeps())
    expect(result).toHaveProperty('isAnniversary')
    expect(result).toHaveProperty('milestoneRef')
    expect(result).toHaveProperty('onThisDayEntry')
    expect(result).toHaveProperty('setOnThisDayEntry')
    expect(result).toHaveProperty('onThisDay')
    expect(result).toHaveProperty('dismissOnThisDay')
    expect(result).toHaveProperty('setDismissOnThisDay')
  })

  it('onThisDay is always an array', () => {
    const { onThisDay } = useCelebrations(makeDeps())
    expect(Array.isArray(onThisDay)).toBe(true)
  })

  it('isAnniversary is a boolean', () => {
    const { isAnniversary } = useCelebrations(makeDeps())
    expect(typeof isAnniversary).toBe('boolean')
  })
})
