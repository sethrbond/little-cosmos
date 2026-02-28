import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yvugwhbjfshycxoyrluk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2dWd3aGJqZnNoeWN4b3lybHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMDc3MDYsImV4cCI6MjA4Nzg4MzcwNn0.8bDtEyYmPf6h0Zkqr9josqP3xrJFuZLtVxgNMAFkEnE'

export const supabase = createClient(supabaseUrl, supabaseKey)

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
  }
  const { error } = await supabase.from('entries').upsert(row, { onConflict: 'id' })
  if (error) console.error('Save entry error:', error)
  return !error
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
  }
  const { error } = await supabase.from('config').upsert(row, { onConflict: 'id' })
  if (error) console.error('Save config error:', error)
}

// ---- Setup: creates tables if they don't exist ----
// Run this SQL in the Supabase SQL editor:
export const SETUP_SQL = `
-- Entries table
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  city TEXT NOT NULL,
  country TEXT DEFAULT '',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  date_start DATE NOT NULL,
  date_end DATE,
  entry_type TEXT NOT NULL DEFAULT 'together',
  who TEXT NOT NULL DEFAULT 'both',
  zoom_level INTEGER DEFAULT 1,
  notes TEXT DEFAULT '',
  memories JSONB DEFAULT '[]',
  museums JSONB DEFAULT '[]',
  restaurants JSONB DEFAULT '[]',
  highlights JSONB DEFAULT '[]',
  photos JSONB DEFAULT '[]',
  stops JSONB DEFAULT '[]',
  music_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Config table
CREATE TABLE IF NOT EXISTS config (
  id TEXT PRIMARY KEY DEFAULT 'main',
  start_date DATE DEFAULT '2021-06-01',
  title TEXT DEFAULT 'Our World',
  subtitle TEXT DEFAULT 'every moment, every adventure',
  love_letter TEXT DEFAULT '',
  you_name TEXT DEFAULT 'Seth',
  partner_name TEXT DEFAULT 'Rosie Posie'
);

-- Enable RLS but allow all operations with anon key
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on entries" ON entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on config" ON config FOR ALL USING (true) WITH CHECK (true);

-- Insert default config
INSERT INTO config (id) VALUES ('main') ON CONFLICT DO NOTHING;
`;
