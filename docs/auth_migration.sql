-- ============================================================
--  AUTH MIGRATION v1
--  Adds user_id columns, RLS policies, and storage policies
--  for multi-user support in My Cosmos.
--
--  DEPLOYMENT ORDER:
--  1. Run Steps 1-2 (add columns + indexes) — non-breaking
--  2. Create Seth's account in Supabase dashboard, get UUID
--  3. Run Step 3 (backfill Seth's data) with his UUID
--  4. Deploy new app code (auth gate + factory DB functions)
--  5. Run Steps 4-6 (drop old policies, create new ones)
-- ============================================================


-- ============================================================
--  STEP 1: Add user_id columns (non-breaking, nullable)
-- ============================================================

ALTER TABLE entries ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE config ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE my_entries ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE my_config ADD COLUMN IF NOT EXISTS user_id UUID;


-- ============================================================
--  STEP 2: Create indexes for efficient user-scoped queries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id);
CREATE INDEX IF NOT EXISTS idx_config_user_id ON config(user_id);
CREATE INDEX IF NOT EXISTS idx_my_entries_user_id ON my_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_my_config_user_id ON my_config(user_id);


-- ============================================================
--  STEP 3: Backfill Seth's existing data
--  Replace SETH_UUID with his actual auth.users UUID
-- ============================================================

-- UPDATE entries SET user_id = 'SETH_UUID' WHERE user_id IS NULL;
-- UPDATE config SET user_id = 'SETH_UUID' WHERE user_id IS NULL;
-- UPDATE my_entries SET user_id = 'SETH_UUID' WHERE user_id IS NULL;
-- UPDATE my_config SET user_id = 'SETH_UUID' WHERE user_id IS NULL;

-- Migrate config id from 'main' to user_id (each user gets their own config row)
-- UPDATE config SET id = 'SETH_UUID' WHERE id = 'main' AND user_id IS NOT NULL;
-- UPDATE my_config SET id = 'SETH_UUID' WHERE id = 'main' AND user_id IS NOT NULL;


-- ============================================================
--  STEP 4: Drop old PUBLIC policies
-- ============================================================

DROP POLICY IF EXISTS "entries_select" ON entries;
DROP POLICY IF EXISTS "entries_insert" ON entries;
DROP POLICY IF EXISTS "entries_update" ON entries;
DROP POLICY IF EXISTS "entries_delete" ON entries;

DROP POLICY IF EXISTS "config_select" ON config;
DROP POLICY IF EXISTS "config_insert" ON config;
DROP POLICY IF EXISTS "config_update" ON config;

DROP POLICY IF EXISTS "my_entries_select" ON my_entries;
DROP POLICY IF EXISTS "my_entries_insert" ON my_entries;
DROP POLICY IF EXISTS "my_entries_update" ON my_entries;
DROP POLICY IF EXISTS "my_entries_delete" ON my_entries;

DROP POLICY IF EXISTS "my_config_select" ON my_config;
DROP POLICY IF EXISTS "my_config_insert" ON my_config;
DROP POLICY IF EXISTS "my_config_update" ON my_config;


-- ============================================================
--  STEP 5: Create authenticated RLS policies
--  auth.uid() returns the UUID of the currently logged-in user
-- ============================================================

-- entries
CREATE POLICY "entries_select" ON entries FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "entries_insert" ON entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entries_update" ON entries FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entries_delete" ON entries FOR DELETE
  USING (auth.uid() = user_id);

-- config
CREATE POLICY "config_select" ON config FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "config_insert" ON config FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "config_update" ON config FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- my_entries
CREATE POLICY "my_entries_select" ON my_entries FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "my_entries_insert" ON my_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "my_entries_update" ON my_entries FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "my_entries_delete" ON my_entries FOR DELETE
  USING (auth.uid() = user_id);

-- my_config
CREATE POLICY "my_config_select" ON my_config FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "my_config_insert" ON my_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "my_config_update" ON my_config FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ============================================================
--  STEP 6: Update storage policies
--  Photos remain publicly readable, but only authenticated
--  users can upload and delete.
-- ============================================================

DROP POLICY IF EXISTS "photos_upload" ON storage.objects;
DROP POLICY IF EXISTS "photos_read" ON storage.objects;
DROP POLICY IF EXISTS "photos_delete" ON storage.objects;

CREATE POLICY "photos_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');

CREATE POLICY "photos_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'photos' AND auth.role() = 'authenticated'
  );

CREATE POLICY "photos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'photos' AND auth.role() = 'authenticated'
  );


-- ============================================================
--  BONUS: Add missing config triggers (found in audit)
--  These auto-set updated_at on config/my_config updates
-- ============================================================

CREATE TRIGGER config_updated
  BEFORE UPDATE ON config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER my_config_updated
  BEFORE UPDATE ON my_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
