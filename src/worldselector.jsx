import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yvugwhbjfshycxoyrluk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2dWd3aGJqZnNoeWN4b3lybHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMDc3MDYsImV4cCI6MjA4Nzg4MzcwNn0.8bDtEyYmPf6h0Zkqr9josqP3xrJFuZLtVxgNMAFkEnE'

const supabase = createClient(supabaseUrl, supabaseKey)

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

// ---- ENTRIES ----

export async function loadEntries() {
  const { data, error } = await supabase.from('my_entries').select('*').order('date_start', { ascending: true })
  if (error) { console.error('[my:loadEntries] error:', error); return [] }
  return (data || []).map(row => ({
    id: row.id,
    city: row.city,
    country: row.country || '',
    lat: row.lat,
    lng: row.lng,
    dateStart: row.date_start,
    dateEnd: row.date_end || null,
    type: row.entry_type,
    who: 'solo',
    zoomLevel: row.zoom_level || 1,
    notes: row.notes || '',
    memories: safeArray(row.memories),
    museums: safeArray(row.museums),
    restaurants: safeArray(row.restaurants),
    highlights: safeArray(row.highlights),
    photos: safeArray(row.photos),
    stops: safeArray(row.stops),
    musicUrl: row.music_url || null,
    favorite: row.favorite || false,
    loveNote: '',
  }))
}

export async function saveEntry(entry) {
  const row = {
    id: entry.id,
    city: entry.city,
    country: entry.country || '',
    lat: entry.lat,
    lng: entry.lng,
    date_start: entry.dateStart,
    date_end: entry.dateEnd || null,
    entry_type: entry.type,
    zoom_level: entry.zoomLevel || 1,
    notes: entry.notes || '',
    memories: cleanArray(entry.memories),
    museums: cleanArray(entry.museums),
    restaurants: cleanArray(entry.restaurants),
    highlights: cleanArray(entry.highlights),
    photos: cleanArray(entry.photos),
    stops: cleanArray(entry.stops),
    music_url: entry.musicUrl || null,
    favorite: entry.favorite || false,
  }
  return withRetry(async () => {
    const { error } = await supabase.from('my_entries').upsert(row, { onConflict: 'id' })
    if (error) {
      console.error('[my:saveEntry] FAILED:', error.message)
      throw error
    }
    return true
  })
}

export async function savePhotos(entryId, photos) {
  const arr = Array.isArray(photos) ? photos : []
  const { error } = await supabase.from('my_entries').update({ photos: arr }).eq('id', entryId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, count: arr.length }
}

export async function readPhotos(entryId) {
  const { data, error } = await supabase.from('my_entries').select('photos').eq('id', entryId).single()
  if (error) return { ok: false, error: error.message }
  const arr = safeArray(data?.photos)
  return { ok: true, photos: arr, count: arr.length }
}

export async function deleteEntry(id) {
  await deleteEntryPhotos(id)
  const { error } = await supabase.from('my_entries').delete().eq('id', id)
  if (error) console.error('[my:deleteEntry] error:', error)
  return !error
}

// ---- CONFIG ----

export async function loadConfig() {
  const { data, error } = await supabase.from('my_config').select('*').eq('id', 'main').single()
  if (error || !data) return null
  const cfg = {
    startDate: data.start_date || '',
    title: data.title || 'My World',
    subtitle: data.subtitle || 'every step, every discovery',
    travelerName: data.traveler_name || 'Explorer',
  }
  if (data.metadata && typeof data.metadata === 'object') {
    if (Array.isArray(data.metadata.bucketList))  cfg.bucketList = data.metadata.bucketList
    if (Array.isArray(data.metadata.chapters))    cfg.chapters = data.metadata.chapters
    if (typeof data.metadata.darkMode === 'boolean') cfg.darkMode = data.metadata.darkMode
  }
  return cfg
}

export async function saveConfig(config) {
  const row = {
    id: 'main',
    start_date: config.startDate || '',
    title: config.title || 'My World',
    subtitle: config.subtitle || 'every step, every discovery',
    traveler_name: config.travelerName || 'Explorer',
    metadata: {
      bucketList: config.bucketList || [],
      chapters: config.chapters || [],
      darkMode: config.darkMode ?? false,
    },
  }
  const { error } = await supabase.from('my_config').upsert(row, { onConflict: 'id' })
  if (error) console.error('[my:saveConfig] error:', error)
}
