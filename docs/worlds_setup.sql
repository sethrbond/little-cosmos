-- worlds_setup.sql — Phase 3: World Creation, Sharing, Viewer Access, Social
-- Run this ENTIRE script in Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE throughout)

-- ============================================================
-- 1. WORLDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS worlds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'shared',  -- 'shared' | 'personal'
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  palette JSONB DEFAULT '{}',
  scene JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_worlds_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS worlds_updated_at ON worlds;
CREATE TRIGGER worlds_updated_at
  BEFORE UPDATE ON worlds
  FOR EACH ROW EXECUTE FUNCTION update_worlds_updated_at();

-- ============================================================
-- 2. WORLD MEMBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS world_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  world_id UUID REFERENCES worlds(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'member' | 'viewer'
  display_name TEXT DEFAULT '',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(world_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_world_members_user ON world_members(user_id);
CREATE INDEX IF NOT EXISTS idx_world_members_world ON world_members(world_id);

-- ============================================================
-- 3. WORLD INVITES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS world_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  world_id UUID REFERENCES worlds(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',  -- role the invitee gets: 'member' | 'viewer'
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  max_uses INT DEFAULT 1,
  use_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_world_invites_token ON world_invites(token);

-- ============================================================
-- 4. ADD world_id TO EXISTING TABLES
-- ============================================================
ALTER TABLE entries ADD COLUMN IF NOT EXISTS world_id UUID REFERENCES worlds(id);
ALTER TABLE config ADD COLUMN IF NOT EXISTS world_id UUID REFERENCES worlds(id);

CREATE INDEX IF NOT EXISTS idx_entries_world_id ON entries(world_id);
CREATE INDEX IF NOT EXISTS idx_config_world_id ON config(world_id);

-- ============================================================
-- 5. ENTRY COMMENTS (viewers + members can comment)
-- ============================================================
CREATE TABLE IF NOT EXISTS entry_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id TEXT NOT NULL,           -- matches entries.id (e.g. "e1709312345678")
  world_id UUID REFERENCES worlds(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  user_name TEXT DEFAULT '',
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entry_comments_entry ON entry_comments(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_comments_world ON entry_comments(world_id);

-- ============================================================
-- 6. ENTRY REACTIONS (likes, hearts on entries/photos)
-- ============================================================
CREATE TABLE IF NOT EXISTS entry_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id TEXT NOT NULL,
  world_id UUID REFERENCES worlds(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT 'heart',  -- 'heart' | 'star' | 'fire' | 'wow'
  photo_url TEXT DEFAULT NULL,     -- if reacting to a specific photo (null = entry itself)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_id, user_id, reaction_type, photo_url)  -- one reaction type per user per target
);

CREATE INDEX IF NOT EXISTS idx_entry_reactions_entry ON entry_reactions(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_reactions_world ON entry_reactions(world_id);

-- ============================================================
-- 7. RLS POLICIES
-- ============================================================

ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_reactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DO $$ BEGIN
  -- worlds
  DROP POLICY IF EXISTS worlds_select ON worlds;
  DROP POLICY IF EXISTS worlds_insert ON worlds;
  DROP POLICY IF EXISTS worlds_update ON worlds;
  DROP POLICY IF EXISTS worlds_delete ON worlds;
  -- world_members
  DROP POLICY IF EXISTS world_members_select ON world_members;
  DROP POLICY IF EXISTS world_members_insert ON world_members;
  DROP POLICY IF EXISTS world_members_delete ON world_members;
  -- world_invites
  DROP POLICY IF EXISTS world_invites_select ON world_invites;
  DROP POLICY IF EXISTS world_invites_insert ON world_invites;
  DROP POLICY IF EXISTS world_invites_update ON world_invites;
  DROP POLICY IF EXISTS world_invites_delete ON world_invites;
  -- entries world policies
  DROP POLICY IF EXISTS entries_world_select ON entries;
  DROP POLICY IF EXISTS entries_world_insert ON entries;
  DROP POLICY IF EXISTS entries_world_update ON entries;
  DROP POLICY IF EXISTS entries_world_delete ON entries;
  -- config world policies
  DROP POLICY IF EXISTS config_world_select ON config;
  DROP POLICY IF EXISTS config_world_insert ON config;
  DROP POLICY IF EXISTS config_world_update ON config;
  DROP POLICY IF EXISTS config_world_delete ON config;
  -- comments/reactions
  DROP POLICY IF EXISTS entry_comments_select ON entry_comments;
  DROP POLICY IF EXISTS entry_comments_insert ON entry_comments;
  DROP POLICY IF EXISTS entry_comments_delete ON entry_comments;
  DROP POLICY IF EXISTS entry_reactions_select ON entry_reactions;
  DROP POLICY IF EXISTS entry_reactions_insert ON entry_reactions;
  DROP POLICY IF EXISTS entry_reactions_delete ON entry_reactions;
END $$;

-- WORLDS
CREATE POLICY worlds_select ON worlds FOR SELECT USING (
  id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid())
);
CREATE POLICY worlds_insert ON worlds FOR INSERT WITH CHECK (
  created_by = auth.uid()
);
CREATE POLICY worlds_update ON worlds FOR UPDATE USING (
  id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role = 'owner')
);
CREATE POLICY worlds_delete ON worlds FOR DELETE USING (
  created_by = auth.uid()
);

-- WORLD_MEMBERS
CREATE POLICY world_members_select ON world_members FOR SELECT USING (
  world_id IN (SELECT wm.world_id FROM world_members wm WHERE wm.user_id = auth.uid())
);
CREATE POLICY world_members_insert ON world_members FOR INSERT WITH CHECK (
  user_id = auth.uid() OR
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role = 'owner')
);
CREATE POLICY world_members_delete ON world_members FOR DELETE USING (
  user_id = auth.uid() OR
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role = 'owner')
);

-- WORLD_INVITES
CREATE POLICY world_invites_select ON world_invites FOR SELECT USING (true);
CREATE POLICY world_invites_insert ON world_invites FOR INSERT WITH CHECK (
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role IN ('owner', 'member'))
);
CREATE POLICY world_invites_update ON world_invites FOR UPDATE USING (
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role IN ('owner', 'member'))
);
CREATE POLICY world_invites_delete ON world_invites FOR DELETE USING (
  created_by = auth.uid()
);

-- ENTRIES: viewers can SELECT, owner/member can CRUD
CREATE POLICY entries_world_select ON entries FOR SELECT USING (
  world_id IS NOT NULL AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid())
);
CREATE POLICY entries_world_insert ON entries FOR INSERT WITH CHECK (
  world_id IS NOT NULL AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role IN ('owner', 'member'))
);
CREATE POLICY entries_world_update ON entries FOR UPDATE USING (
  world_id IS NOT NULL AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role IN ('owner', 'member'))
);
CREATE POLICY entries_world_delete ON entries FOR DELETE USING (
  world_id IS NOT NULL AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role IN ('owner', 'member'))
);

-- CONFIG: viewers can SELECT, owner/member can CRUD
CREATE POLICY config_world_select ON config FOR SELECT USING (
  world_id IS NOT NULL AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid())
);
CREATE POLICY config_world_insert ON config FOR INSERT WITH CHECK (
  world_id IS NOT NULL AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role IN ('owner', 'member'))
);
CREATE POLICY config_world_update ON config FOR UPDATE USING (
  world_id IS NOT NULL AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role IN ('owner', 'member'))
);
CREATE POLICY config_world_delete ON config FOR DELETE USING (
  world_id IS NOT NULL AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role = 'owner')
);

-- COMMENTS: all world members can read, all can write, own can delete
CREATE POLICY entry_comments_select ON entry_comments FOR SELECT USING (
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid())
);
CREATE POLICY entry_comments_insert ON entry_comments FOR INSERT WITH CHECK (
  user_id = auth.uid() AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid())
);
CREATE POLICY entry_comments_delete ON entry_comments FOR DELETE USING (
  user_id = auth.uid()
);

-- REACTIONS: all world members can read/write, own can delete
CREATE POLICY entry_reactions_select ON entry_reactions FOR SELECT USING (
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid())
);
CREATE POLICY entry_reactions_insert ON entry_reactions FOR INSERT WITH CHECK (
  user_id = auth.uid() AND
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid())
);
CREATE POLICY entry_reactions_delete ON entry_reactions FOR DELETE USING (
  user_id = auth.uid()
);

-- ============================================================
-- 8. HELPER FUNCTION: Accept invite
-- ============================================================
CREATE OR REPLACE FUNCTION accept_world_invite(invite_token TEXT)
RETURNS JSONB AS $$
DECLARE
  inv RECORD;
BEGIN
  SELECT * INTO inv FROM world_invites
  WHERE token = invite_token
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR use_count < max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid or expired invite');
  END IF;

  IF EXISTS (SELECT 1 FROM world_members WHERE world_id = inv.world_id AND user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', true, 'world_id', inv.world_id, 'already_member', true);
  END IF;

  INSERT INTO world_members (world_id, user_id, role)
  VALUES (inv.world_id, auth.uid(), inv.role);

  UPDATE world_invites SET use_count = use_count + 1 WHERE id = inv.id;

  RETURN jsonb_build_object('ok', true, 'world_id', inv.world_id, 'already_member', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
