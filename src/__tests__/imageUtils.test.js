import { describe, it, expect } from 'vitest'
import { thumbnail } from '../imageUtils.js'

describe('thumbnail', () => {
  const SUPABASE_BASE = 'https://example.supabase.co/storage/v1/object/public/photos/my/e-123/photo.jpg'

  it('transforms a Supabase storage URL', () => {
    const result = thumbnail(SUPABASE_BASE)
    expect(result).toContain('/storage/v1/render/image/public/')
    expect(result).toContain('?width=320&quality=75')
    expect(result).not.toContain('/storage/v1/object/public/')
  })

  it('uses custom width and quality', () => {
    const result = thumbnail(SUPABASE_BASE, 640, 90)
    expect(result).toContain('?width=640&quality=90')
  })

  it('passes through non-Supabase URLs unchanged', () => {
    const url = 'https://example.com/photo.jpg'
    expect(thumbnail(url)).toBe(url)
  })

  it('passes through URLs without storage path unchanged', () => {
    const url = 'https://example.supabase.co/other/path/photo.jpg'
    expect(thumbnail(url)).toBe(url)
  })

  it('returns null for null input', () => {
    expect(thumbnail(null)).toBe(null)
  })

  it('returns undefined for undefined input', () => {
    expect(thumbnail(undefined)).toBe(undefined)
  })

  it('returns non-string input as-is', () => {
    expect(thumbnail(123)).toBe(123)
    expect(thumbnail('')).toBe('')
  })

  it('preserves the rest of the URL path', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/photos/deep/nested/path/img.png'
    const result = thumbnail(url, 200, 50)
    expect(result).toBe(
      'https://abc.supabase.co/storage/v1/render/image/public/photos/deep/nested/path/img.png?width=200&quality=50'
    )
  })
})
