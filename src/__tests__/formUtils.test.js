import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock cosmosGetP before importing formUtils
vi.mock('../cosmosGetP.js', () => ({
  getP: () => ({
    text: '#333',
    textFaint: '#999',
    textMid: '#666',
    cream: '#fdf8f0',
  }),
}))

// Mock react (needed by formUtils.jsx for StarRating)
vi.mock('react', () => ({
  useState: vi.fn((init) => [init, vi.fn()]),
}))

import { hasDraft, getDraftSummary, inputStyle, navStyle, imageNavBtn, FONT_FAMILY } from '../formUtils.jsx'

describe('FONT_FAMILY', () => {
  it('is a non-empty string containing Palatino', () => {
    expect(typeof FONT_FAMILY).toBe('string')
    expect(FONT_FAMILY).toContain('Palatino')
  })
})

describe('hasDraft', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
  })

  it('returns false when no draftKey provided', () => {
    expect(hasDraft(null)).toBe(false)
    expect(hasDraft(undefined)).toBe(false)
    expect(hasDraft('')).toBe(false)
  })

  it('returns false when localStorage has no data for key', () => {
    localStorage.getItem.mockReturnValue(null)
    expect(hasDraft('draft-123')).toBe(false)
  })

  it('returns true when draft has a city', () => {
    localStorage.getItem.mockReturnValue(JSON.stringify({ city: 'Paris' }))
    expect(hasDraft('draft-123')).toBe(true)
  })

  it('returns true when draft has notes', () => {
    localStorage.getItem.mockReturnValue(JSON.stringify({ notes: 'Some notes' }))
    expect(hasDraft('draft-123')).toBe(true)
  })

  it('returns true when draft has dateStart', () => {
    localStorage.getItem.mockReturnValue(JSON.stringify({ dateStart: '2024-01-01' }))
    expect(hasDraft('draft-123')).toBe(true)
  })

  it('returns false when draft has no meaningful fields', () => {
    localStorage.getItem.mockReturnValue(JSON.stringify({ rating: 5 }))
    expect(hasDraft('draft-123')).toBe(false)
  })

  it('returns false when localStorage has invalid JSON', () => {
    localStorage.getItem.mockReturnValue('not valid json')
    expect(hasDraft('draft-123')).toBe(false)
  })
})

describe('getDraftSummary', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
  })

  it('returns null when no draftKey provided', () => {
    expect(getDraftSummary(null)).toBeNull()
    expect(getDraftSummary(undefined)).toBeNull()
    expect(getDraftSummary('')).toBeNull()
  })

  it('returns null when localStorage has no data', () => {
    localStorage.getItem.mockReturnValue(null)
    expect(getDraftSummary('draft-123')).toBeNull()
  })

  it('returns summary with city and dateStart', () => {
    localStorage.getItem.mockReturnValue(JSON.stringify({ city: 'Tokyo', dateStart: '2024-06-15' }))
    const result = getDraftSummary('draft-123')
    expect(result).toEqual({ city: 'Tokyo', dateStart: '2024-06-15' })
  })

  it('returns summary with empty strings for missing fields', () => {
    localStorage.getItem.mockReturnValue(JSON.stringify({ city: 'Berlin' }))
    const result = getDraftSummary('draft-123')
    expect(result).toEqual({ city: 'Berlin', dateStart: '' })
  })

  it('returns null when draft has no meaningful fields', () => {
    localStorage.getItem.mockReturnValue(JSON.stringify({ rating: 3 }))
    expect(getDraftSummary('draft-123')).toBeNull()
  })

  it('returns null on invalid JSON', () => {
    localStorage.getItem.mockReturnValue('{broken')
    expect(getDraftSummary('draft-123')).toBeNull()
  })
})

describe('inputStyle', () => {
  it('returns an object with expected CSS properties', () => {
    const style = inputStyle()
    expect(style).toHaveProperty('width', '100%')
    expect(style).toHaveProperty('borderRadius', 10)
    expect(style).toHaveProperty('fontSize', 13)
    expect(style).toHaveProperty('boxSizing', 'border-box')
    expect(style).toHaveProperty('outline', 'none')
  })

  it('uses provided palette values', () => {
    const palette = { text: '#000', textFaint: '#aaa', cream: '#fff' }
    const style = inputStyle(palette)
    expect(style.color).toBe('#000')
    expect(style.background).toBe('#fff')
    expect(style.border).toContain('#aaa')
  })

  it('falls back to getP() when no palette given', () => {
    const style = inputStyle()
    expect(style.color).toBe('#333')
    expect(style.background).toBe('#fdf8f0')
  })
})

describe('navStyle', () => {
  it('returns an object with expected CSS properties', () => {
    const style = navStyle()
    expect(style).toHaveProperty('background', 'none')
    expect(style).toHaveProperty('borderRadius', 8)
    expect(style).toHaveProperty('cursor', 'pointer')
    expect(style).toHaveProperty('fontSize', 11)
    expect(style).toHaveProperty('minHeight', 44)
  })

  it('uses provided palette', () => {
    const palette = { textFaint: '#bbb', textMid: '#555' }
    const style = navStyle(palette)
    expect(style.color).toBe('#555')
    expect(style.border).toContain('#bbb')
  })
})

describe('imageNavBtn', () => {
  it('positions button on the left', () => {
    const style = imageNavBtn('left')
    expect(style.left).toBe(5)
    expect(style.right).toBeUndefined()
    expect(style.borderRadius).toBe('50%')
    expect(style.width).toBe(44)
    expect(style.height).toBe(44)
  })

  it('positions button on the right', () => {
    const style = imageNavBtn('right')
    expect(style.right).toBe(5)
    expect(style.left).toBeUndefined()
  })
})
