-- ============================================================
-- FIX ALL POLICIES — Safe to run on ANY database state
-- Drops ALL existing policies then recreates them correctly.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- First, verify RLS is enabled on all tables
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE my_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE my_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE welcome_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE cosmos_connections ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- DROP ALL EXISTING POLICIES (safe — IF EXISTS)
-- ============================================================

-- entries
DROP POLICY IF EXISTS "entries_select" ON entries;
DROP POLICY IF EXISTS "entries_insert" ON entries;
DROP POLICY IF EXISTS "entries_update" ON entries;
DROP POLICY IF EXISTS "entries_delete" ON entries;
DROP POLICY IF EXISTS "entries_world_select" ON entries;
DROP POLICY IF EXISTS "entries_world_insert" ON entries;
DROP POLICY IF EXISTS "entries_world_update" ON entries;
DROP POLICY IF EXISTS "entries_world_delete" ON entries;

-- config
DROP POLICY IF EXISTS "config_select" ON config;
DROP POLICY IF EXISTS "config_insert" ON config;
DROP POLICY IF EXISTS "config_update" ON config;
DROP POLICY IF EXISTS "config_world_select" ON config;
DROP POLICY IF EXISTS "config_world_insert" ON config;
DROP POLICY IF EXISTS "config_world_update" ON config;
DROP POLICY IF EXISTS "config_world_delete" ON config;

-- my_entries
DROP POLICY IF EXISTS "my_entries_select" ON my_entries;
DROP POLICY IF EXISTS "my_entries_insert" ON my_entries;
DROP POLICY IF EXISTS "my_entries_update" ON my_entries;
DROP POLICY IF EXISTS "my_entries_delete" ON my_entries;
DROP POLICY IF EXISTS "my_entries_friend_access" ON my_entries;

-- my_config
DROP POLICY IF EXISTS "my_config_select" ON my_config;
DROP POLICY IF EXISTS "my_config_insert" ON my_config;
DROP POLICY IF EXISTS "my_config_update" ON my_config;
DROP POLICY IF EXISTS "my_config_friend_access" ON my_config;

-- worlds
DROP POLICY IF EXISTS "worlds_select" ON worlds;
DROP POLICY IF EXISTS "worlds_insert" ON worlds;
DROP POLICY IF EXISTS "worlds_update" ON worlds;
DROP POLICY IF EXISTS "worlds_delete" ON worlds;

-- world_members
DROP POLICY IF EXISTS "world_members_select" ON world_members;
DROP POLICY IF EXISTS "world_members_insert" ON world_members;
DROP POLICY IF EXISTS "world_members_update" ON world_members;
DROP POLICY IF EXISTS "world_members_delete" ON world_members;

-- world_invites
DROP POLICY IF EXISTS "world_invites_select" ON world_invites;
DROP POLICY IF EXISTS "world_invites_insert" ON world_invites;
DROP POLICY IF EXISTS "world_invites_update" ON world_invites;
DROP POLICY IF EXISTS "world_invites_delete" ON world_invites;

-- entry_comments
DROP POLICY IF EXISTS "entry_comments_select" ON entry_comments;
DROP POLICY IF EXISTS "entry_comments_insert" ON entry_comments;
DROP POLICY IF EXISTS "entry_comments_delete" ON entry_comments;

-- entry_reactions
DROP POLICY IF EXISTS "entry_reactions_select" ON entry_reactions;
DROP POLICY IF EXISTS "entry_reactions_insert" ON entry_reactions;
DROP POLICY IF EXISTS "entry_reactions_delete" ON entry_reactions;

-- welcome_letters
DROP POLICY IF EXISTS "letters_insert" ON welcome_letters;
DROP POLICY IF EXISTS "letters_select_author" ON welcome_letters;
DROP POLICY IF EXISTS "letters_update_author" ON welcome_letters;
DROP POLICY IF EXISTS "letters_delete_author" ON welcome_letters;
DROP POLICY IF EXISTS "letters_select_recipient" ON welcome_letters;
DROP POLICY IF EXISTS "letters_update_recipient" ON welcome_letters;

-- cosmos_connections
DROP POLICY IF EXISTS "connections_insert" ON cosmos_connections;
DROP POLICY IF EXISTS "connections_select_requester" ON cosmos_connections;
DROP POLICY IF EXISTS "connections_select_target" ON cosmos_connections;
DROP POLICY IF EXISTS "connections_update_target" ON cosmos_connections;
DROP POLICY IF EXISTS "connections_select_accepted" ON cosmos_connections;

-- storage
DROP POLICY IF EXISTS "photos_read" ON storage.objects;
DROP POLICY IF EXISTS "photos_upload" ON storage.objects;
DROP POLICY IF EXISTS "photos_delete" ON storage.objects;


-- ============================================================
-- RECREATE ALL POLICIES
-- ============================================================

-- ENTRIES — personal (user_id based)
CREATE POLICY "entries_select" ON entries FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "entries_insert" ON entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entries_update" ON entries FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entries_delete" ON entries FOR DELETE
  USING (auth.uid() = user_id);

-- ENTRIES — shared world (world_id based)
CREATE POLICY "entries_world_select" ON entries FOR SELECT USING (
  world_id IS NOT NULL AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid())
);
CREATE POLICY "entries_world_insert" ON entries FOR INSERT WITH CHECK (
  world_id IS NOT NULL AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role IN ('owner', 'member'))
);
CREATE POLICY "entries_world_update" ON entries FOR UPDATE USING (
  world_id IS NOT NULL AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role IN ('owner', 'member'))
) WITH CHECK (
  world_id IS NOT NULL AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role IN ('owner', 'member'))
);
CREATE POLICY "entries_world_delete" ON entries FOR DELETE USING (
  world_id IS NOT NULL AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role IN ('owner', 'member'))
);

-- CONFIG — personal
CREATE POLICY "config_select" ON config FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "config_insert" ON config FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "config_update" ON config FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- CONFIG — shared world
CREATE POLICY "config_world_select" ON config FOR SELECT USING (
  world_id IS NOT NULL AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid())
);
CREATE POLICY "config_world_insert" ON config FOR INSERT WITH CHECK (
  world_id IS NOT NULL AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role IN ('owner', 'member'))
);
CREATE POLICY "config_world_update" ON config FOR UPDATE USING (
  world_id IS NOT NULL AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role IN ('owner', 'member'))
);
CREATE POLICY "config_world_delete" ON config FOR DELETE USING (
  world_id IS NOT NULL AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role = 'owner')
);

-- MY_ENTRIES
CREATE POLICY "my_entries_select" ON my_entries FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "my_entries_insert" ON my_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "my_entries_update" ON my_entries FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "my_entries_delete" ON my_entries FOR DELETE
  USING (auth.uid() = user_id);
CREATE POLICY "my_entries_friend_access" ON my_entries FOR SELECT USING (
  user_id IN (
    SELECT CASE WHEN requester_id = auth.uid() THEN target_user_id ELSE requester_id END
    FROM cosmos_connections
    WHERE status = 'accepted'
      AND (requester_id = auth.uid() OR target_user_id = auth.uid())
  )
);

-- MY_CONFIG
CREATE POLICY "my_config_select" ON my_config FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "my_config_insert" ON my_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "my_config_update" ON my_config FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "my_config_friend_access" ON my_config FOR SELECT USING (
  user_id IN (
    SELECT CASE WHEN requester_id = auth.uid() THEN target_user_id ELSE requester_id END
    FROM cosmos_connections
    WHERE status = 'accepted'
      AND (requester_id = auth.uid() OR target_user_id = auth.uid())
  )
);

-- WORLDS
CREATE POLICY "worlds_select" ON worlds FOR SELECT USING (
  id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid())
);
CREATE POLICY "worlds_insert" ON worlds FOR INSERT WITH CHECK (
  created_by = auth.uid()
);
CREATE POLICY "worlds_update" ON worlds FOR UPDATE USING (
  id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role = 'owner')
);
CREATE POLICY "worlds_delete" ON worlds FOR DELETE USING (
  created_by = auth.uid()
);

-- WORLD_MEMBERS
CREATE POLICY "world_members_select" ON world_members FOR SELECT USING (
  world_id IN (SELECT wm.world_id FROM world_members wm WHERE wm.user_id = auth.uid())
);
CREATE POLICY "world_members_insert" ON world_members FOR INSERT WITH CHECK (
  user_id = auth.uid() OR
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role = 'owner')
);
CREATE POLICY "world_members_update" ON world_members FOR UPDATE USING (
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role = 'owner')
) WITH CHECK (
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role = 'owner')
);
CREATE POLICY "world_members_delete" ON world_members FOR DELETE USING (
  user_id = auth.uid() OR
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role = 'owner')
);

-- WORLD_INVITES
CREATE POLICY "world_invites_select" ON world_invites FOR SELECT USING (
  created_by = auth.uid() OR
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid())
);
CREATE POLICY "world_invites_insert" ON world_invites FOR INSERT WITH CHECK (
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role IN ('owner', 'member'))
);
CREATE POLICY "world_invites_update" ON world_invites FOR UPDATE USING (
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role IN ('owner', 'member'))
);
CREATE POLICY "world_invites_delete" ON world_invites FOR DELETE USING (
  created_by = auth.uid()
);

-- ENTRY_COMMENTS
CREATE POLICY "entry_comments_select" ON entry_comments FOR SELECT USING (
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid())
);
CREATE POLICY "entry_comments_insert" ON entry_comments FOR INSERT WITH CHECK (
  user_id = auth.uid() AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid())
);
CREATE POLICY "entry_comments_delete" ON entry_comments FOR DELETE USING (
  user_id = auth.uid()
);

-- ENTRY_REACTIONS
CREATE POLICY "entry_reactions_select" ON entry_reactions FOR SELECT USING (
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid())
);
CREATE POLICY "entry_reactions_insert" ON entry_reactions FOR INSERT WITH CHECK (
  user_id = auth.uid() AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid())
);
CREATE POLICY "entry_reactions_delete" ON entry_reactions FOR DELETE USING (
  user_id = auth.uid()
);

-- WELCOME_LETTERS
CREATE POLICY "letters_insert" ON welcome_letters FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "letters_select_author" ON welcome_letters FOR SELECT
  USING (auth.uid() = from_user_id);
CREATE POLICY "letters_update_author" ON welcome_letters FOR UPDATE
  USING (auth.uid() = from_user_id);
CREATE POLICY "letters_delete_author" ON welcome_letters FOR DELETE
  USING (auth.uid() = from_user_id);
CREATE POLICY "letters_select_recipient" ON welcome_letters FOR SELECT
  USING (lower(to_email) = lower(auth.email()));
CREATE POLICY "letters_update_recipient" ON welcome_letters FOR UPDATE
  USING (lower(to_email) = lower(auth.email()))
  WITH CHECK (lower(to_email) = lower(auth.email()));

-- COSMOS_CONNECTIONS
CREATE POLICY "connections_insert" ON cosmos_connections FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "connections_select_requester" ON cosmos_connections FOR SELECT
  USING (auth.uid() = requester_id);
CREATE POLICY "connections_select_target" ON cosmos_connections FOR SELECT
  USING (lower(target_email) = lower(auth.email()));
CREATE POLICY "connections_update_target" ON cosmos_connections FOR UPDATE
  USING (lower(target_email) = lower(auth.email()));
CREATE POLICY "connections_select_accepted" ON cosmos_connections FOR SELECT
  USING (status = 'accepted' AND (auth.uid() = requester_id OR auth.uid() = target_user_id));

-- STORAGE
CREATE POLICY "photos_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "photos_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'photos' AND auth.role() = 'authenticated');
CREATE POLICY "photos_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'photos' AND auth.role() = 'authenticated');


-- ============================================================
-- CLEANUP: Remove orphaned data from failed world creation attempts
-- ============================================================
DELETE FROM worlds WHERE id NOT IN (SELECT world_id FROM world_members);
DELETE FROM config WHERE world_id IS NOT NULL AND world_id NOT IN (SELECT id FROM worlds);


-- ============================================================
-- VERIFY: List all policies
-- ============================================================
SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
