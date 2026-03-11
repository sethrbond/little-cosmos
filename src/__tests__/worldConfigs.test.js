import { describe, it, expect } from 'vitest'
import {
  OUR_WORLD_PALETTE, OUR_WORLD_TYPES, OUR_WORLD_DEFAULT_CONFIG, OUR_WORLD_SCENE,
  MY_WORLD_PALETTE, MY_WORLD_TYPES, MY_WORLD_DEFAULT_CONFIG, MY_WORLD_SCENE,
  FRIENDS_PALETTE, FRIENDS_TYPES, FRIENDS_DEFAULT_CONFIG, FRIENDS_SCENE,
  FAMILY_PALETTE, FAMILY_TYPES, FAMILY_DEFAULT_CONFIG, FAMILY_SCENE,
  PARTNER_PALETTE, PARTNER_SCENE,
  getSharedWorldConfig, getSeasonalHue, resolveTypes,
} from '../worldConfigs.js'

const REQUIRED_PALETTE_KEYS = [
  'cream', 'warm', 'parchment', 'text', 'textMid', 'textMuted', 'textFaint',
  'rose', 'roseLight', 'roseSoft', 'sky', 'skyLight', 'skySoft',
  'sage', 'gold', 'goldWarm', 'lavender',
  'together', 'togetherSoft', 'togetherLight',
  'heart', 'heartSoft', 'special', 'specialSoft',
  'card', 'glass', 'warmMist',
]

const REQUIRED_SCENE_KEYS = [
  'bg', 'fog', 'sphereColor', 'sphereEmissive',
  'ambientColor', 'sunColor', 'fillColor', 'rimColor', 'bottomColor',
  'glowColors', 'landColors', 'particleColor', 'particleColor2',
  'starTint', 'coastColor',
]

const allPalettes = [
  ['OUR_WORLD', OUR_WORLD_PALETTE],
  ['MY_WORLD', MY_WORLD_PALETTE],
  ['FRIENDS', FRIENDS_PALETTE],
  ['FAMILY', FAMILY_PALETTE],
]

const allScenes = [
  ['OUR_WORLD', OUR_WORLD_SCENE],
  ['MY_WORLD', MY_WORLD_SCENE],
  ['FRIENDS', FRIENDS_SCENE],
  ['FAMILY', FAMILY_SCENE],
]

describe('palettes', () => {
  it.each(allPalettes)('%s palette has all required keys', (name, palette) => {
    for (const key of REQUIRED_PALETTE_KEYS) {
      expect(palette).toHaveProperty(key)
    }
  })

  it.each(allPalettes)('%s palette values are non-empty strings', (name, palette) => {
    for (const key of REQUIRED_PALETTE_KEYS) {
      expect(typeof palette[key]).toBe('string')
      expect(palette[key].length).toBeGreaterThan(0)
    }
  })

  it('PARTNER_PALETTE is same reference as OUR_WORLD_PALETTE', () => {
    expect(PARTNER_PALETTE).toBe(OUR_WORLD_PALETTE)
  })
})

describe('scenes', () => {
  it.each(allScenes)('%s scene has all required keys', (name, scene) => {
    for (const key of REQUIRED_SCENE_KEYS) {
      expect(scene).toHaveProperty(key)
    }
  })

  it.each(allScenes)('%s scene glowColors is array of 8', (name, scene) => {
    expect(Array.isArray(scene.glowColors)).toBe(true)
    expect(scene.glowColors).toHaveLength(8)
  })

  it.each(allScenes)('%s scene landColors is array of 5', (name, scene) => {
    expect(Array.isArray(scene.landColors)).toBe(true)
    expect(scene.landColors).toHaveLength(5)
  })

  it('PARTNER_SCENE is same reference as OUR_WORLD_SCENE', () => {
    expect(PARTNER_SCENE).toBe(OUR_WORLD_SCENE)
  })
})

describe('world types', () => {
  const allTypes = [
    ['OUR_WORLD', OUR_WORLD_TYPES],
    ['MY_WORLD', MY_WORLD_TYPES],
    ['FRIENDS', FRIENDS_TYPES],
    ['FAMILY', FAMILY_TYPES],
  ]

  it.each(allTypes)('%s types has entries', (name, types) => {
    expect(Object.keys(types).length).toBeGreaterThan(0)
  })

  it.each(allTypes)('%s types all have label, icon, color, who, symbol', (name, types) => {
    for (const [key, val] of Object.entries(types)) {
      expect(val).toHaveProperty('label')
      expect(val).toHaveProperty('icon')
      expect(val).toHaveProperty('color')
      expect(val).toHaveProperty('who')
      expect(val).toHaveProperty('symbol')
    }
  })

  it('OUR_WORLD has 6 types, MY_WORLD has 12', () => {
    expect(Object.keys(OUR_WORLD_TYPES)).toHaveLength(6)
    expect(Object.keys(MY_WORLD_TYPES)).toHaveLength(12)
  })

  it('FRIENDS has 10 types, FAMILY has 10', () => {
    expect(Object.keys(FRIENDS_TYPES)).toHaveLength(10)
    expect(Object.keys(FAMILY_TYPES)).toHaveLength(10)
  })
})

describe('default configs', () => {
  const configs = [
    ['OUR_WORLD', OUR_WORLD_DEFAULT_CONFIG],
    ['MY_WORLD', MY_WORLD_DEFAULT_CONFIG],
    ['FRIENDS', FRIENDS_DEFAULT_CONFIG],
    ['FAMILY', FAMILY_DEFAULT_CONFIG],
  ]

  it.each(configs)('%s default config has title and darkMode', (name, cfg) => {
    expect(cfg).toHaveProperty('title')
    expect(cfg).toHaveProperty('darkMode', false)
    expect(cfg).toHaveProperty('customPalette')
    expect(cfg).toHaveProperty('customScene')
    expect(cfg).toHaveProperty('chapters')
    expect(cfg).toHaveProperty('dreamDestinations')
  })
})

describe('getSharedWorldConfig', () => {
  it('returns friends config', () => {
    const { palette, scene } = getSharedWorldConfig('friends')
    expect(palette).toBe(FRIENDS_PALETTE)
    expect(scene).toBe(FRIENDS_SCENE)
  })

  it('returns family config', () => {
    const { palette, scene } = getSharedWorldConfig('family')
    expect(palette).toBe(FAMILY_PALETTE)
    expect(scene).toBe(FAMILY_SCENE)
  })

  it('returns partner config for partner type', () => {
    const { palette, scene } = getSharedWorldConfig('partner')
    expect(palette).toBe(PARTNER_PALETTE)
    expect(scene).toBe(PARTNER_SCENE)
  })

  it('defaults to partner config for unknown type', () => {
    const { palette, scene } = getSharedWorldConfig('unknown')
    expect(palette).toBe(PARTNER_PALETTE)
  })
})

describe('getSeasonalHue', () => {
  it('returns default hue when no date provided (My World)', () => {
    const result = getSeasonalHue(null, true)
    expect(result).toHaveProperty('glow')
    expect(result).toHaveProperty('particle')
  })

  it('returns summer hue for June (Our World)', () => {
    const result = getSeasonalHue('2024-06-15', false)
    expect(result.glow).toBe('#f0c8e0')
  })

  it('returns winter hue for December (My World)', () => {
    const result = getSeasonalHue('2024-12-15', true)
    expect(result.glow).toBe('#7888a0')
  })

  it('returns autumn hue for October', () => {
    const result = getSeasonalHue('2024-10-15', true)
    expect(result.glow).toBe('#c0a058')
  })
})

describe('resolveTypes', () => {
  it('replaces color key with palette value', () => {
    const types = { test: { label: 'Test', color: 'rose' } }
    const palette = { rose: '#ff0000' }
    const resolved = resolveTypes(types, palette)
    expect(resolved.test.color).toBe('#ff0000')
  })

  it('keeps color as-is if not in palette', () => {
    const types = { test: { label: 'Test', color: '#abcdef' } }
    const resolved = resolveTypes(types, {})
    expect(resolved.test.color).toBe('#abcdef')
  })
})
