-- ============================================================
--  BACKFILL: world_id on legacy entries and config
--
--  Legacy entries (from before multi-world) have world_id = NULL.
--  This makes them invisible to cross-world search, activity feed,
--  and entry counts on the cosmos dashboard.
--
--  Run this AFTER creating proper worlds for legacy users.
-- ============================================================

-- Step 1: Find entries with NULL world_id (these are legacy)
-- SELECT user_id, count(*) FROM entries WHERE world_id IS NULL GROUP BY user_id;

-- Step 2: For each user_id found, look up their partner world
-- SELECT id, name, type FROM worlds WHERE created_by = '<USER_ID>' AND type = 'partner';

-- Step 3: If they have a partner world, backfill their entries
-- UPDATE entries SET world_id = '<PARTNER_WORLD_ID>' WHERE user_id = '<USER_ID>' AND world_id IS NULL;
-- UPDATE config SET world_id = '<PARTNER_WORLD_ID>' WHERE user_id = '<USER_ID>' AND world_id IS NULL;

-- Step 4: If they do NOT have a partner world yet, create one first:
-- Use the app's "Create World" flow, or manually insert into worlds + world_members + config.

-- ============================================================
--  AUTOMATED VERSION (if all legacy users should get a partner world)
-- ============================================================

-- This creates a partner world for each user who has entries without world_id,
-- then backfills the entries. Run with caution.

/*
DO $$
DECLARE
  r RECORD;
  new_world_id UUID;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM entries WHERE world_id IS NULL AND user_id IS NOT NULL
  LOOP
    -- Check if user already has a partner world
    SELECT id INTO new_world_id FROM worlds WHERE created_by = r.user_id AND type = 'partner' LIMIT 1;

    IF new_world_id IS NULL THEN
      -- Create a partner world for this user
      new_world_id := gen_random_uuid();
      INSERT INTO worlds (id, name, type, created_by) VALUES (new_world_id, 'Our World', 'partner', r.user_id);
      INSERT INTO world_members (world_id, user_id, role) VALUES (new_world_id, r.user_id, 'owner');
      INSERT INTO config (id, user_id, world_id) VALUES (new_world_id, r.user_id, new_world_id);
    END IF;

    -- Backfill entries
    UPDATE entries SET world_id = new_world_id WHERE user_id = r.user_id AND world_id IS NULL;
    -- Backfill config (the legacy config row has id = user_id)
    UPDATE config SET world_id = new_world_id WHERE user_id = r.user_id AND world_id IS NULL;

    RAISE NOTICE 'Backfilled user % → world %', r.user_id, new_world_id;
  END LOOP;
END $$;
*/
