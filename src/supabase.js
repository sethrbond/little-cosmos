import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yvugwhbjfshycxoyrluk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2dWd3aGJqZnNoeWN4b3lybHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMDc3MDYsImV4cCI6MjA4Nzg4MzcwNn0.8bDtEyYmPf6h0Zkqr9josqP3xrJFuZLtVxgNMAFkEnE'

export const supabase = createClient(supabaseUrl, supabaseKey)

/* supabase.js v7.9.2 — love_note persistence fix included */

// ---- Retry helper ----
async function withRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === retries) { console.error('All retries failed:', err); return null }
      await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
}

// ============================================================
//  PHOTO STORAGE
// ============================================================

export async function uploadPhoto(file, entryId) {
  try {
    const ext = file.name.split('.').pop() || 'jpg'
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `${entryId}/${safeName}`

    const { error } = await supabase.storage
      .from('photos')
      .upload(path, file, {
        cacheControl: '31536000',
        upsert: false,
        contentType: file.type || 'image/jpeg'
      })

    if (error) {
      console.error('[uploadPhoto] UPLOAD FAILED:', error.message)
      return null
    }

    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
    return urlData?.publicUrl || null
  } catch (err) {
    console.error('[uploadPhoto] EXCEPTION:', err)
    return null
  }
}

export async function deletePhoto(publicUrl) {
  try {
    const match = publicUrl.match(/\/photos\/(.+)$/)
    if (!match) return false

    const { error } = await supabase.storage
      .from('photos')
      .remove([match[1]])

    if (error) { console.error('[deletePhoto] error:', error); return false }
    return true
  } catch (err) {
    console.error('[deletePhoto] exception:', err)
    return false
  }
}

export async function deleteEntryPhotos(entryId) {
  try {
    const { data: files, error: listError } = await supabase.storage
      .from('photos')
      .list(entryId)

    if (listError) { console.error('[deleteEntryPhotos] list error:', listError); return false }
    if (!files || files.length === 0) return true

    const paths = files.map(f => `${entryId}/${f.name}`)
    const { error } = await supabase.storage
      .from('photos')
      .remove(paths)

    if (error) { console.error('[deleteEntryPhotos] remove error:', error); return false }
    return true
  } catch (err) {
    console.error('[deleteEntryPhotos] exception:', err)
    return false
  }
}

// ============================================================
//  ENTRIES (travels / locations)
// ============================================================

export async function loadEntries() {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .order('date_start', { ascending: true })

  if (error) { console.error('[loadEntries] error:', error); return [] }

  return (data || []).map(row => ({
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
    memories: row.memories || [],
    museums: row.museums || [],
    restaurants: row.restaurants || [],
    highlights: row.highlights || [],
    photos: row.photos || [],
    stops: row.stops || [],
    musicUrl: row.music_url || null,
    favorite: row.favorite || false,
    loveNote: row.love_note || '',
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
    who: entry.who,
    zoom_level: entry.zoomLevel || 1,
    notes: entry.notes || '',
    memories: entry.memories || [],
    museums: entry.museums || [],
    restaurants: entry.restaurants || [],
    highlights: entry.highlights || [],
    photos: entry.photos || [],
    stops: entry.stops || [],
    music_url: entry.musicUrl || null,
    favorite: entry.favorite || false,
    love_note: entry.loveNote || '',
  }
  return withRetry(async () => {
    const { error } = await supabase.from('entries').upsert(row, { onConflict: 'id' })
    if (error) throw error
    return true
  })
}

export async function deleteEntry(id) {
  await deleteEntryPhotos(id)
  const { error } = await supabase.from('entries').delete().eq('id', id)
  if (error) console.error('[deleteEntry] error:', error)
  return !error
}

// ============================================================
//  CONFIG — persists ALL settings including complex arrays
// ============================================================

export async function loadConfig() {
  const { data, error } = await supabase
    .from('config')
    .select('*')
    .eq('id', 'main')
    .single()

  if (error || !data) return null

  const cfg = {
    startDate: data.start_date || '2021-06-01',
    title: data.title || 'Our World',
    subtitle: data.subtitle || 'every moment, every adventure',
    loveLetter: data.love_letter || '',
    youName: data.you_name || 'Seth',
    partnerName: data.partner_name || 'Rosie Posie',
  }

  if (data.metadata && typeof data.metadata === 'object') {
    if (Array.isArray(data.metadata.loveLetters))       cfg.loveLetters = data.metadata.loveLetters
    if (Array.isArray(data.metadata.dreamDestinations))  cfg.dreamDestinations = data.metadata.dreamDestinations
    if (Array.isArray(data.metadata.chapters))           cfg.chapters = data.metadata.chapters
    if (typeof data.metadata.darkMode === 'boolean')     cfg.darkMode = data.metadata.darkMode
  }

  return cfg
}

export async function saveConfig(config) {
  const row = {
    id: 'main',
    start_date: config.startDate,
    title: config.title,
    subtitle: config.subtitle,
    love_letter: config.loveLetter || '',
    you_name: config.youName,
    partner_name: config.partnerName,
    metadata: {
      loveLetters: config.loveLetters || [],
      dreamDestinations: config.dreamDestinations || [],
      chapters: config.chapters || [],
      darkMode: config.darkMode ?? true,
    },
  }

  const { error } = await supabase.from('config').upsert(row, { onConflict: 'id' })
  if (error) {
    if (error.message?.includes('metadata') || error.code === '42703') {
      console.warn('[saveConfig] metadata column missing — saving basic fields only. Run migration SQL.')
      const { metadata, ...basic } = row
      const { error: e2 } = await supabase.from('config').upsert(basic, { onConflict: 'id' })
      if (e2) console.error('[saveConfig] fallback error:', e2)
    } else {
      console.error('[saveConfig] error:', error)
    }
  }
}
