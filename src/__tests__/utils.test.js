import { describe, it, expect } from 'vitest'
import { haversine, daysBetween } from '../geodata.js'
import { countryFlag, COUNTRY_CODES } from '../utils.js'

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

  it('handles negative latitudes (Sydney to Buenos Aires)', () => {
    const dist = haversine(-33.8688, 151.2093, -34.6037, -58.3816)
    expect(dist).toBeGreaterThan(7300)
    expect(dist).toBeLessThan(7500)
  })

  it('handles equator to pole', () => {
    const dist = haversine(0, 0, 90, 0)
    // Quarter of Earth circumference ~6225 miles
    expect(dist).toBeGreaterThan(6100)
    expect(dist).toBeLessThan(6300)
  })
})

describe('daysBetween', () => {
  it('returns 0 for same day', () => {
    expect(daysBetween('2024-01-01', '2024-01-01')).toBe(0)
  })

  it('calculates days between two dates', () => {
    expect(daysBetween('2024-01-01', '2024-01-10')).toBe(9)
  })

  it('returns negative for reverse order', () => {
    expect(daysBetween('2024-01-10', '2024-01-01')).toBe(-9)
  })

  it('handles cross-year dates', () => {
    expect(daysBetween('2023-12-31', '2024-01-02')).toBe(2)
  })
})

describe('countryFlag', () => {
  it('returns US flag for United States', () => {
    expect(countryFlag('United States')).toBe('\u{1F1FA}\u{1F1F8}')
  })

  it('returns GB flag for United Kingdom', () => {
    expect(countryFlag('United Kingdom')).toBe('\u{1F1EC}\u{1F1E7}')
  })

  it('returns empty string for unknown country', () => {
    expect(countryFlag('Atlantis')).toBe('')
  })

  it('handles alias codes (USA, UK, UAE)', () => {
    expect(countryFlag('USA')).toBe(countryFlag('United States'))
    expect(countryFlag('UK')).toBe(countryFlag('United Kingdom'))
    expect(countryFlag('UAE')).toBe(countryFlag('United Arab Emirates'))
  })

  it('returns JP flag for Japan', () => {
    expect(countryFlag('Japan')).toBe('\u{1F1EF}\u{1F1F5}')
  })
})

describe('COUNTRY_CODES', () => {
  it('contains major countries', () => {
    expect(COUNTRY_CODES['France']).toBe('FR')
    expect(COUNTRY_CODES['Germany']).toBe('DE')
    expect(COUNTRY_CODES['Japan']).toBe('JP')
  })

  it('maps Czechia and Czech Republic to same code', () => {
    expect(COUNTRY_CODES['Czechia']).toBe('CZ')
    expect(COUNTRY_CODES['Czech Republic']).toBe('CZ')
  })
})
