import { supabase, withRetry, safeArray, cleanArray } from './supabaseClient.js'
export { supabase }

/* supabase.js v8.3 — Our World + Shared World DB factories */

// ---- PHOTO STORAGE ----

export async function uploadPhoto(file, entryId) {
  try {
    const ext = file.name.split('.').pop() || 'jpg'
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `${entryId}/${safeName}`
    const { error } = await supabase.storage.from('photos').upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type || 'image/jpeg' })
    if (error) { console.error('[uploadPhoto] FAILED:', error.message); return null }
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
    return urlData?.publicUrl || null
  } catch (err) { console.error('[uploadPhoto] EXCEPTION:', err); return null }
}

export async function deletePhoto(publicUrl) {
  try {
    const match = publicUrl.match(/\/photos\/(.+)$/)
    if (!match) { console.warn("[deletePhoto] bad URL:", publicUrl); return false }
    const { error } = await supabase.storage.from('photos').remove([match[1]])
    if (error) { console.error('[deletePhoto] error:', error); return false }
    return true
  } catch (err) { console.error('[deletePhoto] exception:', err); return false }
}

export async function deleteEntryPhotos(entryId) {
  try {
    const { data: files, error: listError } = await supabase.storage.from('photos').list(entryId)
    if (listError) { console.error('[deleteEntryPhotos] list error:', listError); return false }
    if (!files || files.length === 0) return true
    const paths = files.map(f => `${entryId}/${f.name}`)
    const { error } = await supabase.storage.from('photos').remove(paths)
    if (error) { console.error('[deleteEntryPhotos] remove error:', error); return false }
    return true
  } catch (err) { console.error('[deleteEntryPhotos] exception:', err); return false }
}

// ---- PHOTO HELPERS (used by factories) ----
// Note: These are not user-scoped at the function level — RLS policies on
// the entries/my_entries tables enforce that only the owning user can
// read/write their rows. Entry IDs are unique, so the RLS check is sufficient.

async function savePhotos(entryId, photos) {
  const arr = Array.isArray(photos) ? photos : []
  const { error } = await supabase.from('entries').update({ photos: arr }).eq('id', entryId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, count: arr.length }
}

async function readPhotos(entryId) {
  const { data, error } = await supabase.from('entries').select('photos').eq('id', entryId).single()
  if (error) return { ok: false, error: error.message }
  const arr = safeArray(data?.photos)
  return { ok: true, photos: arr, count: arr.length }
}

// ---- USER-SCOPED FACTORY (Phase 1 Auth) ----

export function createOurWorldDB(userId) {
  // Legacy path — no world_id on entries. Kept for backward compat.
  return {
    loadEntries: async () => {
      const { data, error } = await supabase.from('entries').select('*')
        .eq('user_id', userId)
        .order('date_start', { ascending: true })
      if (error) { console.error('[loadEntries] error:', error); return [] }
      return (data || []).map(row => ({
        id: row.id, city: row.city, country: row.country || '',
        lat: row.lat, lng: row.lng,
        dateStart: row.date_start, dateEnd: row.date_end || null,
        type: row.entry_type, who: row.who,
        zoomLevel: row.zoom_level || 1, notes: row.notes || '',
        memories: safeArray(row.memories), museums: safeArray(row.museums),
        restaurants: safeArray(row.restaurants), highlights: safeArray(row.highlights),
        photos: safeArray(row.photos), stops: safeArray(row.stops),
        musicUrl: row.music_url || null, favorite: row.favorite || false,
        loveNote: row.love_note || '',
      }))
    },

    saveEntry: async (entry) => {
      const row = {
        id: entry.id, user_id: userId,
        city: entry.city, country: entry.country || '',
        lat: entry.lat, lng: entry.lng,
        date_start: entry.dateStart, date_end: entry.dateEnd || null,
        entry_type: entry.type, who: entry.who,
        zoom_level: entry.zoomLevel || 1, notes: entry.notes || '',
        memories: cleanArray(entry.memories), museums: cleanArray(entry.museums),
        restaurants: cleanArray(entry.restaurants), highlights: cleanArray(entry.highlights),
        photos: cleanArray(entry.photos), stops: cleanArray(entry.stops),
        music_url: entry.musicUrl || null, favorite: entry.favorite || false,
        love_note: entry.loveNote || '',
      }
      return withRetry(async () => {
        const { error } = await supabase.from('entries').upsert(row, { onConflict: 'id' })
        if (error) {
          console.error('[saveEntry] FAILED:', error.message)
          if (error.message?.includes('love_note') || error.message?.includes('favorite') || error.code === '42703') {
            const { love_note, favorite, ...safeRow } = row
            const { error: e2 } = await supabase.from('entries').upsert(safeRow, { onConflict: 'id' })
            if (e2) throw e2
            return true
          }
          throw error
        }
        return true
      })
    },

    deleteEntry: async (id) => {
      await deleteEntryPhotos(id)
      const { error } = await supabase.from('entries').delete().eq('id', id)
      if (error) console.error('[deleteEntry] error:', error)
      return !error
    },

    loadConfig: async () => {
      const { data, error } = await supabase.from('config').select('*').eq('id', userId).maybeSingle()
      if (error || !data) return null
      const cfg = {
        startDate: data.start_date ?? '',
        title: data.title ?? '',
        subtitle: data.subtitle ?? '',
        loveLetter: data.love_letter ?? '',
        youName: data.you_name ?? '',
        partnerName: data.partner_name ?? '',
      }
      if (data.metadata && typeof data.metadata === 'object') {
        if (Array.isArray(data.metadata.loveLetters))       cfg.loveLetters = data.metadata.loveLetters
        if (Array.isArray(data.metadata.dreamDestinations))  cfg.dreamDestinations = data.metadata.dreamDestinations
        if (Array.isArray(data.metadata.chapters))           cfg.chapters = data.metadata.chapters
        if (typeof data.metadata.darkMode === 'boolean')     cfg.darkMode = data.metadata.darkMode
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
        title: config.title ?? '', subtitle: config.subtitle ?? '',
        love_letter: config.loveLetter ?? '',
        you_name: config.youName ?? '', partner_name: config.partnerName ?? '',
        metadata: {
          loveLetters: config.loveLetters || [],
          dreamDestinations: config.dreamDestinations || [],
          chapters: config.chapters || [],
          darkMode: config.darkMode ?? false,
          customPalette: config.customPalette || {},
          customScene: config.customScene || {},
          ambientMusicUrl: config.ambientMusicUrl || '',
        },
      }
      const { error } = await supabase.from('config').upsert(row, { onConflict: 'id' })
      if (error) {
        console.error('[ourWorld:saveConfig]', error.message, error.code)
        if (error.message?.includes('metadata') || error.code === '42703') {
          const { metadata, ...basic } = row
          const { error: e2 } = await supabase.from('config').upsert(basic, { onConflict: 'id' })
          if (e2) { console.error('[ourWorld:saveConfig] fallback error:', e2); throw e2 }
        } else { throw error }
      }
    },

    uploadPhoto, deletePhoto, savePhotos, readPhotos,
  }
}

// ---- SHARED WORLD DB (Phase 3: queries by world_id) ----

export function createSharedWorldDB(worldId, userId) {
  return {
    loadEntries: async () => {
      const { data, error } = await supabase.from('entries').select('*')
        .eq('world_id', worldId)
        .order('date_start', { ascending: true })
      if (error) { console.error('[shared:loadEntries] error:', error); return [] }
      return (data || []).map(row => ({
        id: row.id, city: row.city, country: row.country || '',
        lat: row.lat, lng: row.lng,
        dateStart: row.date_start, dateEnd: row.date_end || null,
        type: row.entry_type, who: row.who,
        zoomLevel: row.zoom_level || 1, notes: row.notes || '',
        memories: safeArray(row.memories), museums: safeArray(row.museums),
        restaurants: safeArray(row.restaurants), highlights: safeArray(row.highlights),
        photos: safeArray(row.photos), stops: safeArray(row.stops),
        musicUrl: row.music_url || null, favorite: row.favorite || false,
        loveNote: row.love_note || '',
        addedBy: row.user_id || null,
      }))
    },

    saveEntry: async (entry) => {
      const row = {
        id: entry.id, user_id: userId, world_id: worldId,
        city: entry.city, country: entry.country || '',
        lat: entry.lat, lng: entry.lng,
        date_start: entry.dateStart, date_end: entry.dateEnd || null,
        entry_type: entry.type, who: entry.who,
        zoom_level: entry.zoomLevel || 1, notes: entry.notes || '',
        memories: cleanArray(entry.memories), museums: cleanArray(entry.museums),
        restaurants: cleanArray(entry.restaurants), highlights: cleanArray(entry.highlights),
        photos: cleanArray(entry.photos), stops: cleanArray(entry.stops),
        music_url: entry.musicUrl || null, favorite: entry.favorite || false,
        love_note: entry.loveNote || '',
      }
      return withRetry(async () => {
        const { error } = await supabase.from('entries').upsert(row, { onConflict: 'id' })
        if (error) {
          console.error('[shared:saveEntry] FAILED:', error.message)
          if (error.message?.includes('love_note') || error.message?.includes('favorite') || error.code === '42703') {
            const { love_note, favorite, ...safeRow } = row
            const { error: e2 } = await supabase.from('entries').upsert(safeRow, { onConflict: 'id' })
            if (e2) throw e2
            return true
          }
          throw error
        }
        return true
      })
    },

    deleteEntry: async (id) => {
      await deleteEntryPhotos(id)
      // Clean up orphaned comments/reactions before deleting entry
      await supabase.from('entry_comments').delete().eq('entry_id', id).eq('world_id', worldId).then(() => {})
      await supabase.from('entry_reactions').delete().eq('entry_id', id).eq('world_id', worldId).then(() => {})
      const { error } = await supabase.from('entries').delete().eq('id', id)
      if (error) console.error('[shared:deleteEntry] error:', error)
      return !error
    },

    loadConfig: async () => {
      const { data, error } = await supabase.from('config').select('*').eq('world_id', worldId).maybeSingle()
      if (error) console.error('[shared:loadConfig]', error.message, error.code)
      if (!data) return null
      const cfg = {
        startDate: data.start_date ?? '',
        title: data.title ?? '',
        subtitle: data.subtitle ?? '',
        loveLetter: data.love_letter ?? '',
        youName: data.you_name ?? '',
        partnerName: data.partner_name ?? '',
      }
      if (data.metadata && typeof data.metadata === 'object') {
        if (Array.isArray(data.metadata.loveLetters))       cfg.loveLetters = data.metadata.loveLetters
        if (Array.isArray(data.metadata.dreamDestinations))  cfg.dreamDestinations = data.metadata.dreamDestinations
        if (Array.isArray(data.metadata.chapters))           cfg.chapters = data.metadata.chapters
        if (Array.isArray(data.metadata.members))            cfg.members = data.metadata.members
        if (typeof data.metadata.darkMode === 'boolean')     cfg.darkMode = data.metadata.darkMode
        if (data.metadata.customPalette && typeof data.metadata.customPalette === 'object') cfg.customPalette = data.metadata.customPalette
        if (data.metadata.customScene && typeof data.metadata.customScene === 'object') cfg.customScene = data.metadata.customScene
        if (data.metadata.ambientMusicUrl) cfg.ambientMusicUrl = data.metadata.ambientMusicUrl
      }
      return cfg
    },

    saveConfig: async (config) => {
      const row = {
        id: worldId, user_id: userId, world_id: worldId,
        start_date: config.startDate || null,
        title: config.title ?? '', subtitle: config.subtitle ?? '',
        love_letter: config.loveLetter ?? '',
        you_name: config.youName ?? '', partner_name: config.partnerName ?? '',
        metadata: {
          loveLetters: config.loveLetters || [],
          dreamDestinations: config.dreamDestinations || [],
          chapters: config.chapters || [],
          members: config.members || [],
          darkMode: config.darkMode ?? false,
          customPalette: config.customPalette || {},
          customScene: config.customScene || {},
          ambientMusicUrl: config.ambientMusicUrl || '',
        },
      }
      const { error } = await supabase.from('config').upsert(row, { onConflict: 'id' })
      if (error) {
        console.error('[shared:saveConfig]', error.message, error.code)
        if (error.message?.includes('metadata') || error.code === '42703') {
          const { metadata, ...basic } = row
          const { error: e2 } = await supabase.from('config').upsert(basic, { onConflict: 'id' })
          if (e2) { console.error('[shared:saveConfig] fallback error:', e2); throw e2 }
        } else {
          throw error
        }
      }
    },

    uploadPhoto, deletePhoto, savePhotos, readPhotos,
  }
}
