-- ============================================================
--  MY WORLD v1 — SUPABASE SETUP
--  Run this in Supabase SQL Editor AFTER the Our World setup
--  Safe to run on existing database — all statements are idempotent
-- ============================================================


-- ============================================================
--  STEP 1: MY_ENTRIES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS my_entries (
  id TEXT PRIMARY KEY,
  city TEXT NOT NULL DEFAULT '',
  country TEXT DEFAULT '',
  lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  date_start TEXT DEFAULT '',
  date_end TEXT DEFAULT '',
  entry_type TEXT DEFAULT 'adventure',
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
--  STEP 2: MY_CONFIG TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS my_config (
  id TEXT PRIMARY KEY,
  start_date TEXT DEFAULT '',
  title TEXT DEFAULT 'My World',
  subtitle TEXT DEFAULT 'every step, every discovery',
  traveler_name TEXT DEFAULT 'Explorer',
  metadata JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
--  STEP 3: UPDATED_AT TRIGGER
--  Reuses the same function from Our World setup
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS my_entries_updated ON my_entries;
CREATE TRIGGER my_entries_updated
  BEFORE UPDATE ON my_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
--  STEP 4: ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE my_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE my_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "my_entries_select" ON my_entries;
DROP POLICY IF EXISTS "my_entries_insert" ON my_entries;
DROP POLICY IF EXISTS "my_entries_update" ON my_entries;
DROP POLICY IF EXISTS "my_entries_delete" ON my_entries;
DROP POLICY IF EXISTS "my_config_select" ON my_config;
DROP POLICY IF EXISTS "my_config_insert" ON my_config;
DROP POLICY IF EXISTS "my_config_update" ON my_config;

CREATE POLICY "my_entries_select" ON my_entries FOR SELECT USING (true);
CREATE POLICY "my_entries_insert" ON my_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "my_entries_update" ON my_entries FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "my_entries_delete" ON my_entries FOR DELETE USING (true);

CREATE POLICY "my_config_select" ON my_config FOR SELECT USING (true);
CREATE POLICY "my_config_insert" ON my_config FOR INSERT WITH CHECK (true);
CREATE POLICY "my_config_update" ON my_config FOR UPDATE USING (true) WITH CHECK (true);


-- ============================================================
--  STEP 5: VERIFY
-- ============================================================

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'my_entries'
ORDER BY ordinal_position;
