import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock THREE.Vector3 before importing the module
vi.mock('three', () => ({
  default: { Vector3: class { constructor(x, y, z) { this.x = x; this.y = y; this.z = z } } },
  Vector3: class { constructor(x, y, z) { this.x = x; this.y = y; this.z = z } },
  Raycaster: class { setFromCamera() {} intersectObjects() { return [] } },
  Vector2: class { constructor() { this.x = 0; this.y = 0 } },
}))

// The clamp and ll2v functions are module-private in useGlobeInteraction.js.
// We replicate the exact logic here to validate the math independently.

describe('useGlobeInteraction utilities (replicated)', () => {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const ll2v = (lat, lng, r) => {
    const phi = (90 - lat) * Math.PI / 180
    const theta = (lng + 180) * Math.PI / 180
    return {
      x: -(r * Math.sin(phi) * Math.cos(theta)),
      y: r * Math.cos(phi),
      z: r * Math.sin(phi) * Math.sin(theta),
    }
  }

  describe('clamp', () => {
    it('returns value when within range', () => {
      expect(clamp(5, 0, 10)).toBe(5)
    })

    it('clamps to min when below range', () => {
      expect(clamp(-3, 0, 10)).toBe(0)
    })

    it('clamps to max when above range', () => {
      expect(clamp(15, 0, 10)).toBe(10)
    })

    it('returns min when value equals min', () => {
      expect(clamp(0, 0, 10)).toBe(0)
    })

    it('returns max when value equals max', () => {
      expect(clamp(10, 0, 10)).toBe(10)
    })

    it('works with negative ranges', () => {
      expect(clamp(0, -5, -1)).toBe(-1)
      expect(clamp(-10, -5, -1)).toBe(-5)
      expect(clamp(-3, -5, -1)).toBe(-3)
    })

    it('works with floating point values', () => {
      expect(clamp(1.5, 1.15, 6)).toBe(1.5)
      expect(clamp(0.5, 1.15, 6)).toBe(1.15)
      expect(clamp(7.0, 1.15, 6)).toBe(6)
    })
  })

  describe('ll2v (lat/lng to Vector3)', () => {
    it('converts north pole (90, 0) correctly', () => {
      const v = ll2v(90, 0, 1)
      expect(v.y).toBeCloseTo(1, 5)
      expect(Math.abs(v.x)).toBeLessThan(1e-10)
      expect(Math.abs(v.z)).toBeLessThan(1e-10)
    })

    it('converts south pole (-90, 0) correctly', () => {
      const v = ll2v(-90, 0, 1)
      expect(v.y).toBeCloseTo(-1, 5)
      expect(Math.abs(v.x)).toBeLessThan(1e-10)
      expect(Math.abs(v.z)).toBeLessThan(1e-10)
    })

    it('produces a vector with correct magnitude', () => {
      const r = 2.5
      const v = ll2v(45, 90, r)
      const mag = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2)
      expect(mag).toBeCloseTo(r, 5)
    })

    it('converts equator (0, 0) correctly', () => {
      const v = ll2v(0, 0, 1)
      // phi=90deg=PI/2, theta=180deg=PI
      // x = -(sin(PI/2)*cos(PI)) = -(1*(-1)) = 1
      // y = cos(PI/2) = 0
      // z = sin(PI/2)*sin(PI) ~= 0
      expect(v.x).toBeCloseTo(1, 5)
      expect(Math.abs(v.y)).toBeLessThan(1e-10)
      expect(Math.abs(v.z)).toBeLessThan(1e-10)
    })

    it('returns different vectors for different coordinates', () => {
      const v1 = ll2v(0, 0, 1)
      const v2 = ll2v(45, 90, 1)
      const same = Math.abs(v1.x - v2.x) < 1e-10 &&
                   Math.abs(v1.y - v2.y) < 1e-10 &&
                   Math.abs(v1.z - v2.z) < 1e-10
      expect(same).toBe(false)
    })
  })
})
