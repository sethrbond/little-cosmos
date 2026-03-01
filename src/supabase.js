import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yvugwhbjfshycxoyrluk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2dWd3aGJqZnNoeWN4b3lybHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMDc3MDYsImV4cCI6MjA4Nzg4MzcwNn0.8bDtEyYmPf6h0Zkqr9josqP3xrJFuZLtVxgNMAFkEnE'

export const supabase = createClient(supabaseUrl, supabaseKey)

// ---- Photo upload to Supabase Storage ----

export async function uploadPhoto(file, entryId) {
  try {
    const ext = file.name.split('.').pop() || 'jpg'
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `${entryId}/${safeName}`
    
    const { data: uploadData, error } = await supabase.storage
      .from('photos')
      .upload(path, file, {
        cacheControl: '31536000',
        upsert: false,
        contentType: file.type || 'image/jpeg'
      })
    
    if (error) {
      console.error('[uploadPhoto] failed:', error.message)
      return null
    }
    
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
    return urlData?.publicUrl || null
  } catch (err) {
    console.error('[uploadPhoto] exception:', err)
    return null
  }
}

// ---- Retry helper ----
async function withRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await fn();
      return result;
    } catch (err) {
      if (i === retries) { console.error('All retries failed:', err); return false; }
      console.warn(`Retry ${i + 1}/${retries}...`);
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// ---- Database operations ----

export async function loadEntries() {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .order('date_start', { ascending: true })
  if (error) { console.error('Load entries error:', error); return []; }
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
    if (error) { console.error('Save entry error:', error); throw error; }
    return true;
  });
}

export async function deleteEntry(id) {
  const { error } = await supabase.from('entries').delete().eq('id', id)
  if (error) console.error('Delete entry error:', error)
  return !error
}

export async function loadConfig() {
  const { data, error } = await supabase
    .from('config')
    .select('*')
    .eq('id', 'main')
    .single()
  if (error || !data) return null
  return {
    startDate: data.start_date || '2021-06-01',
    title: data.title || 'Our World',
    subtitle: data.subtitle || 'every moment, every adventure',
    loveLetter: data.love_letter || '',
    youName: data.you_name || 'Seth',
    partnerName: data.partner_name || 'Rosie Posie',
    chapters: data.chapters || [],
    dreamDestinations: data.dream_destinations || [],
    darkMode: data.dark_mode ?? true,
  }
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
    chapters: config.chapters || [],
    dream_destinations: config.dreamDestinations || [],
    dark_mode: config.darkMode ?? true,
  }
  const { error } = await supabase.from('config').upsert(row, { onConflict: 'id' })
  if (error) console.error('Save config error:', error)
}
