import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({})
}))

// Provide the required env vars before importing the module
vi.stubEnv('VITE_SUPABASE_URL', 'https://fake.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fake-anon-key')

const { safeArray, cleanArray, mergeMemoriesIntoHighlights, withRetry } =
  await import('../supabaseClient.js')

// ---------------------------------------------------------------------------
// safeArray
// ---------------------------------------------------------------------------
describe('safeArray', () => {
  it('returns the same array when given an array', () => {
    const arr = [1, 2, 3]
    expect(safeArray(arr)).toBe(arr)
  })

  it('returns empty array for null', () => {
    expect(safeArray(null)).toEqual([])
  })

  it('returns empty array for undefined', () => {
    expect(safeArray(undefined)).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(safeArray('')).toEqual([])
  })

  it('returns empty array for a non-array object', () => {
    expect(safeArray({ a: 1 })).toEqual([])
  })

  it('returns empty array for a number', () => {
    expect(safeArray(42)).toEqual([])
  })

  it('returns empty array for a boolean', () => {
    expect(safeArray(true)).toEqual([])
  })

  it('parses a JSON array string', () => {
    expect(safeArray('["a","b"]')).toEqual(['a', 'b'])
  })

  it('parses a double-encoded JSON array string', () => {
    const doubleEncoded = JSON.stringify(JSON.stringify(['x', 'y']))
    expect(safeArray(doubleEncoded)).toEqual(['x', 'y'])
  })

  it('returns empty array for a non-JSON string', () => {
    expect(safeArray('hello world')).toEqual([])
  })

  it('returns empty array for a JSON string that is not an array', () => {
    expect(safeArray('{"key":"value"}')).toEqual([])
  })

  it('returns empty array for a JSON number string', () => {
    expect(safeArray('123')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// cleanArray
// ---------------------------------------------------------------------------
describe('cleanArray', () => {
  it('returns the same array when given an array', () => {
    const arr = [1, 2, 3]
    expect(cleanArray(arr)).toBe(arr)
  })

  it('returns empty array for null', () => {
    expect(cleanArray(null)).toEqual([])
  })

  it('returns empty array for undefined', () => {
    expect(cleanArray(undefined)).toEqual([])
  })

  it('delegates to safeArray for string input', () => {
    expect(cleanArray('["a"]')).toEqual(['a'])
  })

  it('returns empty array for non-array object', () => {
    expect(cleanArray({ a: 1 })).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// mergeMemoriesIntoHighlights
// ---------------------------------------------------------------------------
describe('mergeMemoriesIntoHighlights', () => {
  it('returns highlights unchanged when memories is empty', () => {
    const row = { highlights: ['a', 'b'], memories: [] }
    expect(mergeMemoriesIntoHighlights(row)).toEqual(['a', 'b'])
  })

  it('returns highlights unchanged when memories is null', () => {
    const row = { highlights: ['a'], memories: null }
    expect(mergeMemoriesIntoHighlights(row)).toEqual(['a'])
  })

  it('merges unique memories into highlights', () => {
    const row = { highlights: ['a', 'b'], memories: ['c', 'd'] }
    expect(mergeMemoriesIntoHighlights(row)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('does not duplicate items already in highlights', () => {
    const row = { highlights: ['a', 'b'], memories: ['b', 'c'] }
    expect(mergeMemoriesIntoHighlights(row)).toEqual(['a', 'b', 'c'])
  })

  it('skips falsy memory values', () => {
    const row = { highlights: ['a'], memories: [null, '', undefined, 'b'] }
    expect(mergeMemoriesIntoHighlights(row)).toEqual(['a', 'b'])
  })

  it('handles both fields being null', () => {
    const row = { highlights: null, memories: null }
    expect(mergeMemoriesIntoHighlights(row)).toEqual([])
  })

  it('handles both fields being undefined', () => {
    const row = { highlights: undefined, memories: undefined }
    expect(mergeMemoriesIntoHighlights(row)).toEqual([])
  })

  it('handles JSON-encoded strings for both fields', () => {
    const row = { highlights: '["a"]', memories: '["b"]' }
    expect(mergeMemoriesIntoHighlights(row)).toEqual(['a', 'b'])
  })

  it('preserves order: highlights first, then new memories', () => {
    const row = { highlights: ['z'], memories: ['a', 'z', 'm'] }
    expect(mergeMemoriesIntoHighlights(row)).toEqual(['z', 'a', 'm'])
  })
})

// ---------------------------------------------------------------------------
// withRetry
// ---------------------------------------------------------------------------
describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns result on first successful call', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries and succeeds on second attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok')

    const promise = withRetry(fn, 2)
    await vi.advanceTimersByTimeAsync(1000)
    const result = await promise
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries and succeeds on third attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('ok')

    const promise = withRetry(fn, 2)
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)
    const result = await promise
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('throws after exhausting all retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'))

    // Attach .catch immediately to prevent unhandled rejection
    const promise = withRetry(fn, 2).catch(e => e)
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)
    const result = await promise
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('persistent failure')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('defaults to 2 retries (3 total attempts)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))

    const promise = withRetry(fn).catch(e => e)
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)
    const result = await promise
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('fail')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('uses increasing backoff delays', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('ok')

    const promise = withRetry(fn, 2)

    // After 999ms, second attempt should not have fired yet
    await vi.advanceTimersByTimeAsync(999)
    expect(fn).toHaveBeenCalledTimes(1)

    // At 1000ms, second attempt fires
    await vi.advanceTimersByTimeAsync(1)
    expect(fn).toHaveBeenCalledTimes(2)

    // After another 2000ms, third attempt fires
    await vi.advanceTimersByTimeAsync(2000)
    const result = await promise
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('works with retries set to 0 (no retries)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    const promise = withRetry(fn, 0).catch(e => e)
    const result = await promise
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('fail')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
