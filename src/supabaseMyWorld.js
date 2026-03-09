import { supabase } from './supabaseClient.js'

/* supabaseMyWorld.js — DB ops for my_entries + my_config tables */

async function withRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try { return await fn() }
    catch (err) {
      if (i === retries) { console.error('[my] All retries failed:', err); return null }
      await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
}

function safeArray(v) {
  if (Array.isArray(v)) return v
  if (v == null || v === '') return []
  if (typeof v === 'string') {
    let parsed = v
    for (let i = 0; i < 3; i++) {
      try { parsed = JSON.parse(parsed); if (Array.isArray(parsed)) return parsed }
      catch { return [] }
    }
  }
  return []
}

function cleanArray(v) { return Array.isArray(v) ? v : safeArray(v) }

// ---- PHOTO STORAGE (shared bucket, "my/" prefix) ----

export async function uploadPhoto(file, entryId) {
  try {
    const ext = file.name.split('.').pop() || 'jpg'
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `my/${entryId}/${safeName}`
    const { error } = await supabase.storage.from('photos').upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type || 'image/jpeg' })
    if (error) { console.error('[my:uploadPhoto] FAILED:', error.message); return null }
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
    return urlData?.publicUrl || null
  } catch (err) { console.error('[my:uploadPhoto] EXCEPTION:', err); return null }
}

export async function deletePhoto(publicUrl) {
  try {
    const match = publicUrl.match(/\/photos\/(.+)$/)
    if (!match) { console.warn("[my:deletePhoto] bad URL:", publicUrl); return false }
    const { error } = await supabase.storage.from('photos').remove([match[1]])
    if (error) { console.error('[my:deletePhoto] error:', error); return false }
    return true
  } catch (err) { console.error('[my:deletePhoto] exception:', err); return false }
}

export async function deleteEntryPhotos(entryId) {
  try {
    const { data: files, error: listError } = await supabase.storage.from('photos').list(`my/${entryId}`)
    if (listError) { console.error('[my:deleteEntryPhotos] list error:', listError); return false }
    if (!files || files.length === 0) return true
    const paths = files.map(f => `my/${entryId}/${f.name}`)
    const { error } = await supabase.storage.from('photos').remove(paths)
    if (error) { console.error('[my:deleteEntryPhotos] remove error:', error); return false }
    return true
  } catch (err) { console.error('[my:deleteEntryPhotos] exception:', err); return false }
}

// ---- PHOTO HELPERS (used by factories) ----

async function savePhotos(entryId, photos) {
  const arr = Array.isArray(photos) ? photos : []
  const { error } = await supabase.from('my_entries').update({ photos: arr }).eq('id', entryId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, count: arr.length }
}

async function readPhotos(entryId) {
  const { data, error } = await supabase.from('my_entries').select('photos').eq('id', entryId).single()
  if (error) return { ok: false, error: error.message }
  const arr = safeArray(data?.photos)
  return { ok: true, photos: arr, count: arr.length }
}

// ---- USER-SCOPED FACTORY (Phase 1 Auth) ----

export function createMyWorldDB(userId) {
  return {
    loadEntries: async () => {
      const { data, error } = await supabase.from('my_entries').select('*')
        .eq('user_id', userId)
        .order('date_start', { ascending: true })
      if (error) { console.error('[my:loadEntries] error:', error); return [] }
      return (data || []).map(row => ({
        id: row.id, city: row.city, country: row.country || '',
        lat: row.lat, lng: row.lng,
        dateStart: row.date_start, dateEnd: row.date_end || null,
        type: row.entry_type, who: 'solo',
        zoomLevel: row.zoom_level || 1, notes: row.notes || '',
        memories: safeArray(row.memories), museums: safeArray(row.museums),
        restaurants: safeArray(row.restaurants), highlights: safeArray(row.highlights),
        photos: safeArray(row.photos), stops: safeArray(row.stops),
        musicUrl: row.music_url || null, favorite: row.favorite || false,
        loveNote: '',
      }))
    },

    saveEntry: async (entry) => {
      const row = {
        id: entry.id, user_id: userId,
        city: entry.city, country: entry.country || '',
        lat: entry.lat, lng: entry.lng,
        date_start: entry.dateStart, date_end: entry.dateEnd || null,
        entry_type: entry.type,
        zoom_level: entry.zoomLevel || 1, notes: entry.notes || '',
        memories: cleanArray(entry.memories), museums: cleanArray(entry.museums),
        restaurants: cleanArray(entry.restaurants), highlights: cleanArray(entry.highlights),
        photos: cleanArray(entry.photos), stops: cleanArray(entry.stops),
        music_url: entry.musicUrl || null, favorite: entry.favorite || false,
      }
      return withRetry(async () => {
        const { error } = await supabase.from('my_entries').upsert(row, { onConflict: 'id' })
        if (error) { console.error('[my:saveEntry] FAILED:', error.message); throw error }
        return true
      })
    },

    deleteEntry: async (id) => {
      await deleteEntryPhotos(id)
      const { error } = await supabase.from('my_entries').delete().eq('id', id)
      if (error) console.error('[my:deleteEntry] error:', error)
      return !error
    },

    loadConfig: async () => {
      const { data, error } = await supabase.from('my_config').select('*').eq('id', userId).maybeSingle()
      if (error || !data) return null
      const cfg = {
        startDate: data.start_date ?? '',
        title: data.title ?? '',
        subtitle: data.subtitle ?? '',
        travelerName: data.traveler_name ?? '',
      }
      if (data.metadata && typeof data.metadata === 'object') {
        if (Array.isArray(data.metadata.bucketList))  cfg.bucketList = data.metadata.bucketList
        if (Array.isArray(data.metadata.chapters))    cfg.chapters = data.metadata.chapters
        if (typeof data.metadata.darkMode === 'boolean') cfg.darkMode = data.metadata.darkMode
        if (data.metadata.customPalette && typeof data.metadata.customPalette === 'object') cfg.customPalette = data.metadata.customPalette
        if (data.metadata.customScene && typeof data.metadata.customScene === 'object') cfg.customScene = data.metadata.customScene
        if (data.metadata.ambientMusicUrl) cfg.ambientMusicUrl = data.metadata.ambientMusicUrl
      }
      return cfg
    },

    saveConfig: async (config) => {
      const row = {
        id: userId, user_id: userId,
        start_date: config.startDate || null,
        title: config.title ?? '',
        subtitle: config.subtitle ?? '',
        traveler_name: config.travelerName ?? '',
        metadata: {
          bucketList: config.bucketList || [],
          chapters: config.chapters || [],
          darkMode: config.darkMode ?? false,
          customPalette: config.customPalette || {},
          customScene: config.customScene || {},
          ambientMusicUrl: config.ambientMusicUrl || '',
        },
      }
      const { error } = await supabase.from('my_config').upsert(row, { onConflict: 'id' })
      if (error) {
        console.error('[my:saveConfig] error:', error)
        throw error
      }
    },

    uploadPhoto, deletePhoto, savePhotos, readPhotos,
  }
}

// Read-only factory for viewing a friend's My World
export function createFriendWorldDB(friendUserId) {
  return {
    loadEntries: async () => {
      const { data, error } = await supabase.from('my_entries').select('*')
        .eq('user_id', friendUserId)
        .order('date_start', { ascending: true })
      if (error) { console.error('[friend:loadEntries] error:', error); return [] }
      return (data || []).map(row => ({
        id: row.id, city: row.city, country: row.country || '',
        lat: row.lat, lng: row.lng,
        dateStart: row.date_start, dateEnd: row.date_end || null,
        type: row.entry_type, who: 'solo',
        zoomLevel: row.zoom_level || 1, notes: row.notes || '',
        memories: safeArray(row.memories), museums: safeArray(row.museums),
        restaurants: safeArray(row.restaurants), highlights: safeArray(row.highlights),
        photos: safeArray(row.photos), stops: safeArray(row.stops),
        musicUrl: row.music_url || null, favorite: row.favorite || false,
        loveNote: '',
      }))
    },
    loadConfig: async () => {
      const { data, error } = await supabase.from('my_config').select('*').eq('id', friendUserId).maybeSingle()
      if (error || !data) return null
      const cfg = {
        startDate: data.start_date ?? '',
        title: data.title ?? '',
        subtitle: data.subtitle ?? '',
        travelerName: data.traveler_name ?? '',
      }
      if (data.metadata && typeof data.metadata === 'object') {
        if (Array.isArray(data.metadata.bucketList))  cfg.bucketList = data.metadata.bucketList
        if (Array.isArray(data.metadata.chapters))    cfg.chapters = data.metadata.chapters
        if (typeof data.metadata.darkMode === 'boolean') cfg.darkMode = data.metadata.darkMode
        if (data.metadata.customPalette && typeof data.metadata.customPalette === 'object') cfg.customPalette = data.metadata.customPalette
        if (data.metadata.customScene && typeof data.metadata.customScene === 'object') cfg.customScene = data.metadata.customScene
        if (data.metadata.ambientMusicUrl) cfg.ambientMusicUrl = data.metadata.ambientMusicUrl
      }
      return cfg
    },
    // All write operations are no-ops for friend worlds
    saveEntry: async () => {},
    deleteEntry: async () => false,
    saveConfig: async () => {},
    uploadPhoto: async () => null,
    deletePhoto: async () => false,
    savePhotos: async () => ({ ok: false }),
    readPhotos: async (entryId) => {
      const { data, error } = await supabase.from('my_entries').select('photos').eq('id', entryId).single()
      if (error) return { ok: false, error: error.message }
      const arr = safeArray(data?.photos); return { ok: true, photos: arr, count: arr.length }
    },
  }
}
