-- ============================================================
-- ARCHITECTURAL CONSOLIDATION MIGRATION
-- Merges my_entries → entries and my_config → config
-- All data unified under world_id
-- ============================================================
--
-- PREREQUISITES:
-- - entries, config tables already exist with world_id column
-- - worlds, world_members tables already exist
-- - my_entries, my_config tables still exist with data
--
-- RUN THIS IN SUPABASE SQL EDITOR, ONE SECTION AT A TIME
-- ============================================================


-- ============================================================
-- STEP 1: Add traveler_name column to config (My World uses this)
-- ============================================================

ALTER TABLE config ADD COLUMN IF NOT EXISTS traveler_name TEXT DEFAULT '';


-- ============================================================
-- STEP 2: Create a personal world for each user who has my_entries
--         or my_config data but no personal world yet
-- ============================================================

-- First, find all distinct user_ids from my_entries and my_config
-- that don't already have a 'personal' world in the worlds table

DO $$
DECLARE
  rec RECORD;
  new_world_id UUID;
BEGIN
  FOR rec IN
    SELECT DISTINCT user_id
    FROM (
      SELECT user_id FROM my_entries WHERE user_id IS NOT NULL
      UNION
      SELECT user_id FROM my_config WHERE user_id IS NOT NULL
    ) all_users
    WHERE user_id NOT IN (
      SELECT wm.user_id FROM world_members wm
      JOIN worlds w ON w.id = wm.world_id
      WHERE w.type = 'personal'
    )
  LOOP
    -- Create a personal world
    INSERT INTO worlds (name, type, created_by)
    VALUES ('My World', 'personal', rec.user_id)
    RETURNING id INTO new_world_id;

    -- Add the user as owner
    INSERT INTO world_members (world_id, user_id, role)
    VALUES (new_world_id, rec.user_id, 'owner');

    RAISE NOTICE 'Created personal world % for user %', new_world_id, rec.user_id;
  END LOOP;
END $$;


-- ============================================================
-- STEP 3: Migrate my_entries → entries
-- ============================================================

INSERT INTO entries (
  id, city, country, lat, lng, date_start, date_end,
  entry_type, who, zoom_level, notes, memories, museums,
  restaurants, highlights, photos, stops, music_url, favorite,
  love_note, user_id, world_id, created_at, updated_at
)
SELECT
  me.id, me.city, me.country, me.lat, me.lng, me.date_start, me.date_end,
  me.entry_type,
  'solo',              -- who: always solo for My World
  me.zoom_level, me.notes, me.memories, me.museums,
  me.restaurants, me.highlights, me.photos, me.stops,
  me.music_url, me.favorite,
  '',                  -- love_note: not used in My World
  me.user_id,
  w.id,               -- world_id: from the user's personal world
  me.created_at, me.updated_at
FROM my_entries me
JOIN world_members wm ON wm.user_id = me.user_id
JOIN worlds w ON w.id = wm.world_id AND w.type = 'personal'
WHERE NOT EXISTS (
  SELECT 1 FROM entries e WHERE e.id = me.id
);

-- Report count
DO $$
DECLARE cnt INTEGER;
BEGIN
  SELECT count(*) INTO cnt FROM entries e
  JOIN worlds w ON w.id = e.world_id AND w.type = 'personal';
  RAISE NOTICE 'Personal world entries in entries table: %', cnt;
END $$;


-- ============================================================
-- STEP 4: Migrate my_config → config
-- ============================================================

INSERT INTO config (
  id, start_date, title, subtitle, love_letter, you_name, partner_name,
  traveler_name, metadata, user_id, world_id, updated_at
)
SELECT
  w.id,                           -- id: use world_id as config key
  mc.start_date,
  mc.title,
  mc.subtitle,
  '',                             -- love_letter: not used in My World
  '',                             -- you_name: not used in My World
  '',                             -- partner_name: not used in My World
  mc.traveler_name,
  -- Remap bucketList → dreamDestinations in metadata for consistency
  CASE
    WHEN mc.metadata IS NOT NULL AND mc.metadata != '{}'::jsonb THEN
      (mc.metadata - 'bucketList') ||
      jsonb_build_object('dreamDestinations', COALESCE(mc.metadata->'bucketList', '[]'::jsonb))
    ELSE mc.metadata
  END,
  mc.user_id,
  w.id,                           -- world_id
  mc.updated_at
FROM my_config mc
JOIN world_members wm ON wm.user_id = mc.user_id
JOIN worlds w ON w.id = wm.world_id AND w.type = 'personal'
WHERE NOT EXISTS (
  SELECT 1 FROM config c WHERE c.id = w.id::text
);


-- ============================================================
-- STEP 5: Add friend-access RLS policies to entries and config
-- (allows viewing a friend's personal world entries/config)
-- ============================================================

-- Friend can SELECT personal world entries if they have an accepted connection
CREATE POLICY entries_friend_select ON entries FOR SELECT USING (
  world_id IS NOT NULL
  AND world_id IN (
    SELECT w.id FROM worlds w
    JOIN world_members wm ON wm.world_id = w.id
    WHERE w.type = 'personal'
    AND wm.user_id IN (
      SELECT CASE
        WHEN requester_id = auth.uid() THEN target_user_id
        ELSE requester_id
      END
      FROM cosmos_connections
      WHERE status = 'accepted'
      AND (requester_id = auth.uid() OR target_user_id = auth.uid())
    )
  )
);

-- Friend can SELECT personal world config
CREATE POLICY config_friend_select ON config FOR SELECT USING (
  world_id IS NOT NULL
  AND world_id IN (
    SELECT w.id FROM worlds w
    JOIN world_members wm ON wm.world_id = w.id
    WHERE w.type = 'personal'
    AND wm.user_id IN (
      SELECT CASE
        WHEN requester_id = auth.uid() THEN target_user_id
        ELSE requester_id
      END
      FROM cosmos_connections
      WHERE status = 'accepted'
      AND (requester_id = auth.uid() OR target_user_id = auth.uid())
    )
  )
);


-- ============================================================
-- STEP 6: Verify migration
-- ============================================================

-- Check entry counts match
DO $$
DECLARE
  old_count INTEGER;
  new_count INTEGER;
BEGIN
  SELECT count(*) INTO old_count FROM my_entries;
  SELECT count(*) INTO new_count FROM entries e
    JOIN worlds w ON w.id = e.world_id AND w.type = 'personal';
  RAISE NOTICE 'my_entries: %, migrated to entries: %', old_count, new_count;
  IF old_count != new_count THEN
    RAISE WARNING 'COUNT MISMATCH — do not drop old tables yet!';
  ELSE
    RAISE NOTICE 'Counts match — migration verified.';
  END IF;
END $$;

-- Check config counts match
DO $$
DECLARE
  old_count INTEGER;
  new_count INTEGER;
BEGIN
  SELECT count(*) INTO old_count FROM my_config;
  SELECT count(*) INTO new_count FROM config c
    JOIN worlds w ON w.id = c.world_id AND w.type = 'personal';
  RAISE NOTICE 'my_config: %, migrated to config: %', old_count, new_count;
  IF old_count != new_count THEN
    RAISE WARNING 'COUNT MISMATCH — do not drop old tables yet!';
  ELSE
    RAISE NOTICE 'Counts match — migration verified.';
  END IF;
END $$;


-- ============================================================
-- STEP 7: Drop old tables (ONLY after verifying Step 6)
-- ============================================================
-- UNCOMMENT THESE AFTER VERIFYING THE MIGRATION IS CORRECT:

-- DROP TABLE IF EXISTS my_entries CASCADE;
-- DROP TABLE IF EXISTS my_config CASCADE;
