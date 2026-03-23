import { safeArray, cleanArray, mergeMemoriesIntoHighlights } from './supabaseClient.js'

/* rowMapper.js — Canonical row-to-entry and entry-to-row mappings
 *
 * Single source of truth for converting between snake_case DB rows
 * and camelCase app entries. Used by supabase.js, supabaseMyWorld.js,
 * and useRealtimeSync.js.
 */

/**
 * Convert a snake_case DB row to a camelCase app entry.
 * @param {Object} row — raw Supabase row
 * @param {Object} [overrides] — optional field overrides (e.g. { who: 'solo', loveNote: '' })
 * @returns {Object|null} camelCase entry, or null if row is falsy
 */
export function rowToEntry(row, overrides) {
  if (!row) return null
  return {
    id: row.id,
    city: row.city,
    country: row.country || '',
    lat: row.lat,
    lng: row.lng,
    dateStart: row.date_start,
    dateEnd: row.date_end || null,
    type: row.entry_type,
    who: row.who,
    zoomLevel: row.zoom_level || 1,
    notes: row.notes || '',
    museums: safeArray(row.museums),
    restaurants: safeArray(row.restaurants),
    highlights: mergeMemoriesIntoHighlights(row),
    photos: safeArray(row.photos),
    stops: safeArray(row.stops),
    musicUrl: row.music_url || null,
    favorite: row.favorite || false,
    loveNote: row.love_note || '',
    photoCaptions: row.photo_captions || {},
    addedBy: row.user_id || null,
    ...overrides,
  }
}

/**
 * Convert a camelCase app entry to a snake_case DB row.
 * @param {Object} entry — app entry
 * @param {string} userId — current user's UUID
 * @param {string} [worldId] — world UUID (omitted for legacy ourWorld)
 * @param {Object} [overrides] — optional field overrides (e.g. { who: 'solo', love_note: '' })
 * @returns {Object} snake_case row ready for Supabase upsert
 */
export function entryToRow(entry, userId, worldId, overrides) {
  const row = {
    id: entry.id,
    user_id: userId,
    city: entry.city,
    country: entry.country || '',
    lat: entry.lat,
    lng: entry.lng,
    date_start: entry.dateStart,
    date_end: entry.dateEnd || null,
    entry_type: entry.type,
    who: entry.who,
    zoom_level: entry.zoomLevel || 1,
    notes: entry.notes || '',
    memories: [],
    museums: cleanArray(entry.museums),
    restaurants: cleanArray(entry.restaurants),
    highlights: cleanArray(entry.highlights),
    photos: cleanArray(entry.photos),
    stops: cleanArray(entry.stops),
    music_url: entry.musicUrl || null,
    favorite: entry.favorite || false,
    love_note: entry.loveNote || '',
    photo_captions: entry.photoCaptions || {},
    ...overrides,
  }
  if (worldId) row.world_id = worldId
  return row
}
