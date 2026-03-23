import { supabase, withRetry, safeArray } from './supabaseClient.js'
import { rowToEntry, entryToRow } from './rowMapper.js'

/* supabaseMyWorld.js — Personal world + friend world DB factories */

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

// ---- PHOTO HELPERS ----

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

// ---- PERSONAL WORLD FACTORY (uses entries + config with world_id) ----

export function createMyWorldDB(worldId, userId) {
  return {
    loadEntries: async () => {
      const { data, error } = await supabase.from('entries').select('*')
        .eq('world_id', worldId)
        .order('date_start', { ascending: true })
        .range(0, 499)
      if (error) { console.error('[my:loadEntries] error:', error); return [] }
      const myOverrides = { who: 'solo', loveNote: '' }
      return (data || []).map(row => rowToEntry(row, myOverrides))
    },


    loadMoreEntries: async (offset) => {
      const { data, error } = await supabase.from('entries').select('*')
        .eq('world_id', worldId)
        .order('date_start', { ascending: true })
        .range(offset, offset + 499)
      if (error) { console.error('[my:loadMoreEntries] error:', error); return [] }
      const myOverrides = { who: 'solo', loveNote: '' }
      return (data || []).map(row => rowToEntry(row, myOverrides))
    },

    saveEntry: async (entry) => {
      const row = entryToRow(entry, userId, worldId, { who: 'solo', love_note: '' })
      return withRetry(async () => {
        const { error } = await supabase.from('entries').upsert(row, { onConflict: 'id' })
        if (error) {
          console.error('[my:saveEntry] FAILED:', error.message)
          if (error.message?.includes('photo_captions') || error.code === '42703') {
            const { photo_captions, ...safeRow } = row
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
      const photosOk = await deleteEntryPhotos(id)
      if (!photosOk) { console.error('[my:deleteEntry] photo cleanup failed, aborting:', id); return false }
      const { error } = await supabase.from('entries').delete().eq('id', id)
      if (error) console.error('[my:deleteEntry] error:', error)
      return !error
    },

    loadConfig: async () => {
      const { data, error } = await supabase.from('config').select('*').eq('world_id', worldId).maybeSingle()
      if (error || !data) return null
      const cfg = {
        startDate: data.start_date ?? '',
        title: data.title ?? '',
        subtitle: data.subtitle ?? '',
        travelerName: data.metadata?.travelerName || data.traveler_name || '',
      }
      if (data.metadata && typeof data.metadata === 'object') {
        if (Array.isArray(data.metadata.dreamDestinations)) cfg.dreamDestinations = data.metadata.dreamDestinations
        if (Array.isArray(data.metadata.chapters))    cfg.chapters = data.metadata.chapters
        if (typeof data.metadata.darkMode === 'boolean') cfg.darkMode = data.metadata.darkMode
        if (data.metadata.customPalette && typeof data.metadata.customPalette === 'object') cfg.customPalette = data.metadata.customPalette
        if (data.metadata.customScene && typeof data.metadata.customScene === 'object') cfg.customScene = data.metadata.customScene
        if (data.metadata.ambientMusicUrl) cfg.ambientMusicUrl = data.metadata.ambientMusicUrl
        if (Array.isArray(data.metadata.timeCapsules)) cfg.timeCapsules = data.metadata.timeCapsules
      }
      return cfg
    },

    saveConfig: async (config) => {
      const row = {
        id: worldId, user_id: userId, world_id: worldId,
        start_date: config.startDate || null,
        title: config.title ?? '',
        subtitle: config.subtitle ?? '',
        metadata: {
          travelerName: config.travelerName ?? '',
          dreamDestinations: config.dreamDestinations || [],
          chapters: config.chapters || [],
          darkMode: config.darkMode ?? false,
          customPalette: config.customPalette || {},
          customScene: config.customScene || {},
          ambientMusicUrl: config.ambientMusicUrl || '',
          timeCapsules: config.timeCapsules || [],
        },
      }
      const { error } = await supabase.from('config').upsert(row, { onConflict: 'id' })
      if (error) {
        console.error('[my:saveConfig] error:', error)
        throw error
      }
    },

    uploadPhoto, deletePhoto, savePhotos, readPhotos,
  }
}

// Read-only factory for viewing a friend's My World
export function createFriendWorldDB(friendWorldId) {
  return {
    loadEntries: async () => {
      const { data, error } = await supabase.from('entries').select('*')
        .eq('world_id', friendWorldId)
        .order('date_start', { ascending: true })
        .range(0, 499)
      if (error) { console.error('[friend:loadEntries] error:', error); return [] }
      const friendOverrides = { who: 'solo', loveNote: '' }
      return (data || []).map(row => rowToEntry(row, friendOverrides))
    },
    loadMoreEntries: async (offset) => {
      const { data, error } = await supabase.from('entries').select('*')
        .eq('world_id', friendWorldId)
        .order('date_start', { ascending: true })
        .range(offset, offset + 499)
      if (error) { console.error('[friend:loadMoreEntries] error:', error); return [] }
      const friendOverrides = { who: 'solo', loveNote: '' }
      return (data || []).map(row => rowToEntry(row, friendOverrides))
    },
    loadConfig: async () => {
      const { data, error } = await supabase.from('config').select('*').eq('world_id', friendWorldId).maybeSingle()
      if (error || !data) return null
      const cfg = {
        startDate: data.start_date ?? '',
        title: data.title ?? '',
        subtitle: data.subtitle ?? '',
        travelerName: data.metadata?.travelerName || data.traveler_name || '',
      }
      if (data.metadata && typeof data.metadata === 'object') {
        if (Array.isArray(data.metadata.dreamDestinations)) cfg.dreamDestinations = data.metadata.dreamDestinations
        if (Array.isArray(data.metadata.chapters))    cfg.chapters = data.metadata.chapters
        if (typeof data.metadata.darkMode === 'boolean') cfg.darkMode = data.metadata.darkMode
        if (data.metadata.customPalette && typeof data.metadata.customPalette === 'object') cfg.customPalette = data.metadata.customPalette
        if (data.metadata.customScene && typeof data.metadata.customScene === 'object') cfg.customScene = data.metadata.customScene
        if (data.metadata.ambientMusicUrl) cfg.ambientMusicUrl = data.metadata.ambientMusicUrl
        if (Array.isArray(data.metadata.timeCapsules)) cfg.timeCapsules = data.metadata.timeCapsules
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
      const { data, error } = await supabase.from('entries').select('photos').eq('id', entryId).single()
      if (error) return { ok: false, error: error.message }
      const arr = safeArray(data?.photos); return { ok: true, photos: arr, count: arr.length }
    },
  }
}
