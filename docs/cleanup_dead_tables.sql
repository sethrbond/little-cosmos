-- ============================================================
--  MIGRATION: Remove dead my_entries and my_config tables
--  Date: March 2026
--
--  CONTEXT:
--  The app originally used 4 tables: entries, config, my_entries, my_config.
--  "entries" and "config" were for shared (partner) worlds.
--  "my_entries" and "my_config" were for personal (My World) data.
--
--  These were consolidated into 2 tables (entries, config) using a
--  world_id column to distinguish between worlds. The old my_entries
--  and my_config tables are no longer referenced by any app code but
--  still exist in the database with active RLS policies.
--
--  This migration removes them cleanly.
--
--  SAFE TO RE-RUN: All statements use IF EXISTS.
-- ============================================================


-- ============================================================
--  1. DROP RLS POLICIES on my_entries (5 policies)
-- ============================================================

DROP POLICY IF EXISTS "my_entries_select" ON my_entries;
DROP POLICY IF EXISTS "my_entries_insert" ON my_entries;
DROP POLICY IF EXISTS "my_entries_update" ON my_entries;
DROP POLICY IF EXISTS "my_entries_delete" ON my_entries;
DROP POLICY IF EXISTS "my_entries_friend_access" ON my_entries;


-- ============================================================
--  2. DROP RLS POLICIES on my_config (4 policies)
-- ============================================================

DROP POLICY IF EXISTS "my_config_select" ON my_config;
DROP POLICY IF EXISTS "my_config_insert" ON my_config;
DROP POLICY IF EXISTS "my_config_update" ON my_config;
DROP POLICY IF EXISTS "my_config_friend_access" ON my_config;


-- ============================================================
--  3. DROP INDEXES on my_entries and my_config
-- ============================================================

DROP INDEX IF EXISTS idx_my_entries_user_id;
DROP INDEX IF EXISTS idx_my_config_user_id;


-- ============================================================
--  4. DROP TRIGGERS on my_entries and my_config
-- ============================================================

DROP TRIGGER IF EXISTS my_entries_updated ON my_entries;
DROP TRIGGER IF EXISTS my_config_updated ON my_config;


-- ============================================================
--  5. DROP THE TABLES
--  Using CASCADE to handle any remaining dependent objects.
-- ============================================================

DROP TABLE IF EXISTS my_entries CASCADE;
DROP TABLE IF EXISTS my_config CASCADE;


-- ============================================================
--  6. VERIFY — Confirm the tables are gone
-- ============================================================

SELECT '--- VERIFICATION ---' AS section;

-- Should return 0 rows for my_entries and my_config
SELECT table_name, 'STILL EXISTS (unexpected)' AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('my_entries', 'my_config');

-- Show remaining tables for confirmation
SELECT '--- REMAINING TABLES ---' AS section;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- Show remaining policy count
SELECT '--- POLICIES (' || COUNT(*) || ' total) ---' AS section
FROM pg_policies WHERE schemaname = 'public';

SELECT '--- CLEANUP COMPLETE ---' AS section;
