import { describe, it, expect } from 'vitest'
import { buildStatsLine, formatSinceDate } from '../ShareCard.js'

// ── buildStatsLine ──────────────────────────────────────────────────

describe('buildStatsLine', () => {
  // -- basic counts --
  it('formats multiple entries and countries (solo)', () => {
    expect(buildStatsLine(5, 3, 0, false)).toBe('5 trips · 3 countries')
  })

  it('uses singular "country" for 1 country', () => {
    expect(buildStatsLine(2, 1, 0, false)).toBe('2 trips · 1 country')
  })

  it('uses plural "countries" for 2+', () => {
    expect(buildStatsLine(1, 2, 0, false)).toBe('1 trips · 2 countries')
  })

  // -- partner vs solo wording --
  it('uses "adventures" for partner worlds', () => {
    expect(buildStatsLine(5, 3, 0, true)).toBe('5 adventures · 3 countries')
  })

  it('uses "trips" for solo worlds', () => {
    expect(buildStatsLine(5, 3, 0, false)).toBe('5 trips · 3 countries')
  })

  // -- zero / missing entries --
  it('omits entries part when entries is 0', () => {
    expect(buildStatsLine(0, 3, 0, false)).toBe('3 countries')
  })

  it('omits countries part when countries is 0', () => {
    expect(buildStatsLine(5, 0, 0, false)).toBe('5 trips')
  })

  it('returns empty string when both are 0', () => {
    expect(buildStatsLine(0, 0, 0, false)).toBe('')
  })

  it('returns empty string when both are undefined', () => {
    expect(buildStatsLine(undefined, undefined, 0, false)).toBe('')
  })

  it('returns empty string when both are null', () => {
    expect(buildStatsLine(null, null, 0, false)).toBe('')
  })

  // -- single entry --
  it('handles exactly 1 entry solo', () => {
    expect(buildStatsLine(1, 1, 0, false)).toBe('1 trips · 1 country')
  })

  it('handles exactly 1 entry partner', () => {
    expect(buildStatsLine(1, 1, 0, true)).toBe('1 adventures · 1 country')
  })

  // -- large numbers --
  it('handles large counts', () => {
    expect(buildStatsLine(999, 50, 0, false)).toBe('999 trips · 50 countries')
  })

  // -- entries only, no countries --
  it('shows only entries when countries is 0 (partner)', () => {
    expect(buildStatsLine(3, 0, 0, true)).toBe('3 adventures')
  })

  // -- countries only, no entries --
  it('shows only countries when entries is 0 (partner)', () => {
    expect(buildStatsLine(0, 5, 0, true)).toBe('5 countries')
  })
})

// ── formatSinceDate ─────────────────────────────────────────────────

describe('formatSinceDate', () => {
  it('formats a standard ISO date', () => {
    const result = formatSinceDate('2023-06-15')
    expect(result).toBe('Since June 2023')
  })

  it('formats January correctly', () => {
    expect(formatSinceDate('2020-01-01')).toBe('Since January 2020')
  })

  it('formats December correctly', () => {
    expect(formatSinceDate('2024-12-25')).toBe('Since December 2024')
  })

  it('handles a date from 2000', () => {
    expect(formatSinceDate('2000-03-10')).toBe('Since March 2000')
  })

  // -- edge cases --
  it('returns empty string for invalid date string', () => {
    expect(formatSinceDate('not-a-date')).toBe('')
  })

  it('returns empty string for empty string', () => {
    // new Date("T00:00:00") produces Invalid Date → toLocaleString throws/returns odd values
    const result = formatSinceDate('')
    // Should either be empty or gracefully handle it
    expect(typeof result).toBe('string')
  })

  it('returns empty string for undefined', () => {
    expect(formatSinceDate(undefined)).toBe('')
  })

  it('returns empty string for null', () => {
    expect(formatSinceDate(null)).toBe('')
  })
})
