import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetch globally before importing the module
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// We need to reset module state between tests because geocode.js has module-level
// mutable state (debounceTimer, lastFetch). Use dynamic import + vi.resetModules().
let geocodeSearch

beforeEach(() => {
  vi.useFakeTimers()
  mockFetch.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetModules()
})

async function loadModule() {
  const mod = await import('../geocode.js')
  geocodeSearch = mod.geocodeSearch
}

function makeNominatimResponse(items) {
  return {
    ok: true,
    json: () => Promise.resolve(items),
  }
}

describe('geocodeSearch', () => {
  it('returns empty array for empty query', async () => {
    await loadModule()
    const cb = vi.fn()
    geocodeSearch('', cb)
    expect(cb).toHaveBeenCalledWith([])
  })

  it('returns empty array for short query (< 2 chars)', async () => {
    await loadModule()
    const cb = vi.fn()
    geocodeSearch('a', cb)
    expect(cb).toHaveBeenCalledWith([])
  })

  it('returns empty array for whitespace-only query', async () => {
    await loadModule()
    const cb = vi.fn()
    geocodeSearch('   ', cb)
    expect(cb).toHaveBeenCalledWith([])
  })

  it('debounces calls by 300ms', async () => {
    await loadModule()
    mockFetch.mockResolvedValue(makeNominatimResponse([]))

    const cb = vi.fn()
    geocodeSearch('Paris', cb)

    // Before 300ms: fetch should not have been called
    await vi.advanceTimersByTimeAsync(200)
    expect(mockFetch).not.toHaveBeenCalled()

    // After 300ms: fetch should fire
    await vi.advanceTimersByTimeAsync(200)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('only fires the last call when multiple calls happen within debounce window', async () => {
    await loadModule()
    mockFetch.mockResolvedValue(makeNominatimResponse([]))

    const cb1 = vi.fn()
    const cb2 = vi.fn()
    geocodeSearch('Pa', cb1)
    await vi.advanceTimersByTimeAsync(100)
    geocodeSearch('Paris', cb2)

    await vi.advanceTimersByTimeAsync(400)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    // The URL should contain the second query
    const url = mockFetch.mock.calls[0][0]
    expect(url).toContain('q=Paris')
  })

  it('enforces rate limiting (MIN_INTERVAL 400ms) between fetches', async () => {
    await loadModule()
    mockFetch.mockResolvedValue(makeNominatimResponse([]))

    const cb1 = vi.fn()
    geocodeSearch('Paris', cb1)
    // Fire the first debounced call
    await vi.advanceTimersByTimeAsync(300)
    // Wait for the fetch promise to resolve
    await vi.advanceTimersByTimeAsync(0)

    // Immediately trigger a second search
    const cb2 = vi.fn()
    geocodeSearch('London', cb2)
    // Advance past debounce
    await vi.advanceTimersByTimeAsync(300)
    // The rate limiter should impose a wait — advance enough to cover it
    await vi.advanceTimersByTimeAsync(500)

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('parses successful response into [name, country, lat, lon] tuples', async () => {
    await loadModule()
    const nominatimData = [
      {
        lat: '48.8566',
        lon: '2.3522',
        name: 'Paris',
        address: { city: 'Paris', country: 'France' },
      },
    ]
    mockFetch.mockResolvedValue(makeNominatimResponse(nominatimData))

    const cb = vi.fn()
    geocodeSearch('Paris', cb)
    await vi.advanceTimersByTimeAsync(500)

    expect(cb).toHaveBeenCalledWith([['Paris', 'France', 48.8566, 2.3522]])
  })

  it('deduplicates results with the same name and country', async () => {
    await loadModule()
    const nominatimData = [
      { lat: '48.8566', lon: '2.3522', name: 'Paris', address: { city: 'Paris', country: 'France' } },
      { lat: '48.8570', lon: '2.3530', name: 'Dup', address: { city: 'Paris', country: 'France' } },
      { lat: '33.6609', lon: '-95.5555', name: 'Paris', address: { city: 'Paris', country: 'United States' } },
    ]
    mockFetch.mockResolvedValue(makeNominatimResponse(nominatimData))

    const cb = vi.fn()
    geocodeSearch('Paris', cb)
    await vi.advanceTimersByTimeAsync(500)

    const results = cb.mock.calls[0][0]
    expect(results).toHaveLength(2)
    expect(results[0]).toEqual(['Paris', 'France', 48.8566, 2.3522])
    expect(results[1]).toEqual(['Paris', 'United States', 33.6609, -95.5555])
  })

  it('returns empty array on fetch failure', async () => {
    await loadModule()
    mockFetch.mockRejectedValue(new Error('Network error'))

    const cb = vi.fn()
    geocodeSearch('Paris', cb)
    await vi.advanceTimersByTimeAsync(500)

    expect(cb).toHaveBeenCalledWith([])
  })

  it('returns empty array when response is not ok', async () => {
    await loadModule()
    mockFetch.mockResolvedValue({ ok: false })

    const cb = vi.fn()
    geocodeSearch('Paris', cb)
    await vi.advanceTimersByTimeAsync(500)

    expect(cb).toHaveBeenCalledWith([])
  })

  it('sends correct User-Agent header', async () => {
    await loadModule()
    mockFetch.mockResolvedValue(makeNominatimResponse([]))

    const cb = vi.fn()
    geocodeSearch('Paris', cb)
    await vi.advanceTimersByTimeAsync(500)

    const options = mockFetch.mock.calls[0][1]
    expect(options.headers['User-Agent']).toBe('LittleCosmos/1.0 (travel diary app)')
  })

  it('returns empty array when response JSON is not an array', async () => {
    await loadModule()
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ error: 'bad' }) })

    const cb = vi.fn()
    geocodeSearch('Paris', cb)
    await vi.advanceTimersByTimeAsync(500)

    expect(cb).toHaveBeenCalledWith([])
  })

  it('limits results to 8', async () => {
    await loadModule()
    const items = Array.from({ length: 10 }, (_, i) => ({
      lat: String(i), lon: String(i),
      name: `Place${i}`,
      address: { city: `City${i}`, country: `Country${i}` },
    }))
    mockFetch.mockResolvedValue(makeNominatimResponse(items))

    const cb = vi.fn()
    geocodeSearch('test query', cb)
    await vi.advanceTimersByTimeAsync(500)

    expect(cb.mock.calls[0][0].length).toBeLessThanOrEqual(8)
  })
})
