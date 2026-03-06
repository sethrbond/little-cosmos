-- ============================================================
--  OUR WORLD v8.2 — COMPLETE SUPABASE SETUP
--  Run this in Supabase SQL Editor
--  Safe to run on existing database — all statements are idempotent
-- ============================================================


-- ============================================================
--  STEP 1: DROP OLD TRIGGERS (prevents "no field" errors)
-- ============================================================

DROP TRIGGER IF EXISTS entries_updated ON entries;
DROP TRIGGER IF EXISTS config_updated ON config;


-- ============================================================
--  STEP 2: ENTRIES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  city TEXT NOT NULL DEFAULT '',
  country TEXT DEFAULT '',
  lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  date_start TEXT DEFAULT '',
  date_end TEXT DEFAULT '',
  entry_type TEXT DEFAULT 'together',
  who TEXT DEFAULT 'both',
  zoom_level INTEGER DEFAULT 1,
  notes TEXT DEFAULT '',
  memories JSONB DEFAULT '[]'::jsonb,
  museums JSONB DEFAULT '[]'::jsonb,
  restaurants JSONB DEFAULT '[]'::jsonb,
  highlights JSONB DEFAULT '[]'::jsonb,
  photos JSONB DEFAULT '[]'::jsonb,
  stops JSONB DEFAULT '[]'::jsonb,
  music_url TEXT DEFAULT '',
  favorite BOOLEAN DEFAULT false,
  love_note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist (for databases created with earlier schemas)
ALTER TABLE entries ADD COLUMN IF NOT EXISTS country TEXT DEFAULT '';
ALTER TABLE entries ADD COLUMN IF NOT EXISTS entry_type TEXT DEFAULT 'together';
ALTER TABLE entries ADD COLUMN IF NOT EXISTS who TEXT DEFAULT 'both';
ALTER TABLE entries ADD COLUMN IF NOT EXISTS zoom_level INTEGER DEFAULT 1;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE entries ADD COLUMN IF NOT EXISTS music_url TEXT DEFAULT '';
ALTER TABLE entries ADD COLUMN IF NOT EXISTS favorite BOOLEAN DEFAULT false;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS love_note TEXT DEFAULT '';
ALTER TABLE entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure array columns are JSONB (converts from TEXT if needed)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entries' AND column_name = 'memories' AND data_type = 'text'
  ) THEN
    ALTER TABLE entries ALTER COLUMN memories TYPE JSONB USING COALESCE(memories, '[]')::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entries' AND column_name = 'museums' AND data_type = 'text'
  ) THEN
    ALTER TABLE entries ALTER COLUMN museums TYPE JSONB USING COALESCE(museums, '[]')::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entries' AND column_name = 'restaurants' AND data_type = 'text'
  ) THEN
    ALTER TABLE entries ALTER COLUMN restaurants TYPE JSONB USING COALESCE(restaurants, '[]')::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entries' AND column_name = 'highlights' AND data_type = 'text'
  ) THEN
    ALTER TABLE entries ALTER COLUMN highlights TYPE JSONB USING COALESCE(highlights, '[]')::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entries' AND column_name = 'photos' AND data_type = 'text'
  ) THEN
    ALTER TABLE entries ALTER COLUMN photos TYPE JSONB USING COALESCE(photos, '[]')::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entries' AND column_name = 'stops' AND data_type = 'text'
  ) THEN
    ALTER TABLE entries ALTER COLUMN stops TYPE JSONB USING COALESCE(stops, '[]')::jsonb;
  END IF;
END $$;

-- Set JSONB defaults
ALTER TABLE entries ALTER COLUMN memories SET DEFAULT '[]'::jsonb;
ALTER TABLE entries ALTER COLUMN museums SET DEFAULT '[]'::jsonb;
ALTER TABLE entries ALTER COLUMN restaurants SET DEFAULT '[]'::jsonb;
ALTER TABLE entries ALTER COLUMN highlights SET DEFAULT '[]'::jsonb;
ALTER TABLE entries ALTER COLUMN photos SET DEFAULT '[]'::jsonb;
ALTER TABLE entries ALTER COLUMN stops SET DEFAULT '[]'::jsonb;


-- ============================================================
--  STEP 3: CONFIG TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS config (
  id TEXT PRIMARY KEY,
  start_date TEXT DEFAULT '2021-06-01',
  title TEXT DEFAULT 'Our World',
  subtitle TEXT DEFAULT 'every moment, every adventure',
  love_letter TEXT DEFAULT '',
  you_name TEXT DEFAULT 'Seth',
  partner_name TEXT DEFAULT 'Rosie Posie',
  metadata JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist
ALTER TABLE config ADD COLUMN IF NOT EXISTS start_date TEXT DEFAULT '2021-06-01';
ALTER TABLE config ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Our World';
ALTER TABLE config ADD COLUMN IF NOT EXISTS subtitle TEXT DEFAULT 'every moment, every adventure';
ALTER TABLE config ADD COLUMN IF NOT EXISTS love_letter TEXT DEFAULT '';
ALTER TABLE config ADD COLUMN IF NOT EXISTS you_name TEXT DEFAULT 'Seth';
ALTER TABLE config ADD COLUMN IF NOT EXISTS partner_name TEXT DEFAULT 'Rosie Posie';
ALTER TABLE config ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


-- ============================================================
--  STEP 4: UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entries_updated
  BEFORE UPDATE ON entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
--  STEP 5: ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (prevents duplicates)
DROP POLICY IF EXISTS "entries_all" ON entries;
DROP POLICY IF EXISTS "entries_select" ON entries;
DROP POLICY IF EXISTS "entries_insert" ON entries;
DROP POLICY IF EXISTS "entries_update" ON entries;
DROP POLICY IF EXISTS "entries_delete" ON entries;
DROP POLICY IF EXISTS "config_all" ON config;
DROP POLICY IF EXISTS "config_select" ON config;
DROP POLICY IF EXISTS "config_insert" ON config;
DROP POLICY IF EXISTS "config_update" ON config;

-- Public access (anon key)
CREATE POLICY "entries_select" ON entries FOR SELECT USING (true);
CREATE POLICY "entries_insert" ON entries FOR INSERT WITH CHECK (true);
CREATE POLICY "entries_update" ON entries FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "entries_delete" ON entries FOR DELETE USING (true);

CREATE POLICY "config_select" ON config FOR SELECT USING (true);
CREATE POLICY "config_insert" ON config FOR INSERT WITH CHECK (true);
CREATE POLICY "config_update" ON config FOR UPDATE USING (true) WITH CHECK (true);


-- ============================================================
--  STEP 6: PHOTO STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing storage policies
DROP POLICY IF EXISTS "photos_upload" ON storage.objects;
DROP POLICY IF EXISTS "photos_read" ON storage.objects;
DROP POLICY IF EXISTS "photos_delete" ON storage.objects;
DROP POLICY IF EXISTS "photos_all" ON storage.objects;

-- Storage policies
CREATE POLICY "photos_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'photos');

CREATE POLICY "photos_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');

CREATE POLICY "photos_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'photos');


-- ============================================================
--  STEP 7: VERIFY
-- ============================================================

-- Show entries table columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'entries'
ORDER BY ordinal_position;
