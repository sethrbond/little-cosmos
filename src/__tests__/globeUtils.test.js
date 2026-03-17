import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock THREE before importing globeUtils
vi.mock('three', () => {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  }
  return {
    Vector3,
    CanvasTexture: class {},
    SpriteMaterial: class {},
    MeshBasicMaterial: class {},
    SphereGeometry: class {},
    PlaneGeometry: class {},
    NearestFilter: 1,
    SRGBColorSpace: 'srgb',
  }
})

import { clamp, lerp, haversine, daysBetween, addDays, todayStr, fmtDate, createPool } from '../globeUtils.js'

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps to min when value is below', () => {
    expect(clamp(-3, 0, 10)).toBe(0)
  })

  it('clamps to max when value is above', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0)
  })

  it('returns max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10)
  })
})

describe('lerp', () => {
  it('returns a when t=0', () => {
    expect(lerp(0, 10, 0)).toBe(0)
  })

  it('returns b when t=1', () => {
    expect(lerp(0, 10, 1)).toBe(10)
  })

  it('returns midpoint when t=0.5', () => {
    expect(lerp(0, 10, 0.5)).toBe(5)
  })

  it('interpolates correctly with negative values', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0)
  })

  it('extrapolates beyond t=1', () => {
    expect(lerp(0, 10, 2)).toBe(20)
  })
})

describe('haversine', () => {
  it('returns 0 for same point', () => {
    expect(haversine(40.7128, -74.006, 40.7128, -74.006)).toBe(0)
  })

  it('calculates NYC to LA (~2451 miles)', () => {
    const dist = haversine(40.7128, -74.006, 34.0522, -118.2437)
    expect(dist).toBeGreaterThan(2400)
    expect(dist).toBeLessThan(2500)
  })

  it('calculates London to Tokyo (~5956 miles)', () => {
    const dist = haversine(51.5074, -0.1278, 35.6762, 139.6503)
    expect(dist).toBeGreaterThan(5900)
    expect(dist).toBeLessThan(6050)
  })

  it('handles equator to pole', () => {
    const dist = haversine(0, 0, 90, 0)
    expect(dist).toBeGreaterThan(6100)
    expect(dist).toBeLessThan(6300)
  })
})

describe('daysBetween', () => {
  it('returns 0 for same date', () => {
    expect(daysBetween('2024-01-01', '2024-01-01')).toBe(0)
  })

  it('returns positive days for later date', () => {
    expect(daysBetween('2024-01-01', '2024-01-10')).toBe(9)
  })

  it('returns negative days for earlier date', () => {
    expect(daysBetween('2024-01-10', '2024-01-01')).toBe(-9)
  })

  it('handles month boundaries', () => {
    expect(daysBetween('2024-01-31', '2024-02-01')).toBe(1)
  })

  it('handles leap year', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2)
  })
})

describe('addDays', () => {
  it('adds days to date string', () => {
    expect(addDays('2024-01-01', 5)).toBe('2024-01-06')
  })

  it('handles month rollover', () => {
    expect(addDays('2024-01-31', 1)).toBe('2024-02-01')
  })

  it('handles negative days', () => {
    expect(addDays('2024-01-05', -3)).toBe('2024-01-02')
  })

  it('handles zero days', () => {
    expect(addDays('2024-06-15', 0)).toBe('2024-06-15')
  })
})

describe('todayStr', () => {
  it('returns today in YYYY-MM-DD format', () => {
    const result = todayStr()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('matches current date', () => {
    const expected = new Date().toISOString().slice(0, 10)
    expect(todayStr()).toBe(expected)
  })
})

describe('fmtDate', () => {
  it('returns empty string for falsy input', () => {
    expect(fmtDate('')).toBe('')
    expect(fmtDate(null)).toBe('')
    expect(fmtDate(undefined)).toBe('')
  })

  it('formats date string nicely', () => {
    const result = fmtDate('2024-01-15')
    expect(result).toContain('Jan')
    expect(result).toContain('15')
    expect(result).toContain('2024')
  })

  it('formats another date correctly', () => {
    const result = fmtDate('2024-12-25')
    expect(result).toContain('Dec')
    expect(result).toContain('25')
    expect(result).toContain('2024')
  })
})

describe('createPool', () => {
  let created

  beforeEach(() => {
    created = 0
  })

  const factory = () => {
    created++
    return { geometry: { dispose: vi.fn() }, material: { dispose: vi.fn() } }
  }

  it('pre-creates initial pool of objects', () => {
    createPool(factory, 3)
    expect(created).toBe(3)
  })

  it('acquire returns pre-created object', () => {
    const pool = createPool(factory, 2)
    const obj = pool.acquire()
    expect(obj).toBeDefined()
    expect(obj.geometry).toBeDefined()
  })

  it('acquire creates new object when pool is empty', () => {
    const pool = createPool(factory, 1)
    pool.acquire() // takes the pre-created one
    const countBefore = created
    pool.acquire() // pool empty, must create
    expect(created).toBe(countBefore + 1)
  })

  it('release returns object to pool for reuse', () => {
    const pool = createPool(factory, 0)
    const obj = pool.acquire()
    pool.release(obj)
    const reused = pool.acquire()
    expect(reused).toBe(obj)
  })

  it('disposeAll clears pool and disposes geometry/material', () => {
    const pool = createPool(factory, 3)
    const obj = pool.acquire()
    pool.release(obj)
    pool.disposeAll()
    const countBefore = created
    pool.acquire()
    expect(created).toBe(countBefore + 1)
  })

  it('disposeAll calls dispose on geometry and material', () => {
    const pool = createPool(factory, 1)
    const obj = pool.acquire()
    pool.release(obj)
    pool.disposeAll()
    expect(obj.geometry.dispose).toHaveBeenCalled()
    expect(obj.material.dispose).toHaveBeenCalled()
  })
})
