/* geocode.js — OpenStreetMap Nominatim geocoding
 * Provides unlimited location search (every place on Earth)
 * Returns results in [name, country, lat, lng] format
 * Built-in debounce + rate limiting for Nominatim usage policy
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

let debounceTimer = null
let lastFetch = 0
const DEBOUNCE_MS = 300
const MIN_INTERVAL = 400 // Nominatim asks for ≤1 req/sec

/**
 * Debounced geocode search. Call freely from onChange handlers.
 * @param {string} query - Search text (at least 2 chars)
 * @param {function} callback - Receives array of [name, country, lat, lng]
 */
export function geocodeSearch(query, callback) {
  clearTimeout(debounceTimer)

  if (!query || query.trim().length < 2) {
    callback([])
    return
  }

  debounceTimer = setTimeout(async () => {
    // Rate limit
    const now = Date.now()
    const wait = MIN_INTERVAL - (now - lastFetch)
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    lastFetch = Date.now()

    try {
      const params = new URLSearchParams({
        q: query.trim(),
        format: 'json',
        limit: '10',
        addressdetails: '1',
        'accept-language': 'en',
      })

      const res = await fetch(`${NOMINATIM}?${params}`, {
        headers: { 'User-Agent': 'OurWorldGlobe/7.9 (personal anniversary gift)' }
      })

      if (!res.ok) { callback([]); return }
      const data = await res.json()

      const results = data.map(item => {
        const addr = item.address || {}
        // Pick best "place name" — city > town > village > county > state > raw name
        const name = addr.city || addr.town || addr.village || addr.hamlet
          || addr.county || addr.state || addr.municipality || item.name || query
        const country = addr.country || ''
        return [name, country, parseFloat(item.lat), parseFloat(item.lon)]
      })

      // Deduplicate by name+country
      const seen = new Set()
      const unique = results.filter(r => {
        const key = `${r[0]}|${r[1]}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      callback(unique.slice(0, 8))
    } catch (err) {
      console.error('[geocode] error:', err)
      callback([])
    }
  }, DEBOUNCE_MS)
}
