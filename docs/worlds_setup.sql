-- worlds_setup.sql — Phase 3: World Creation & Sharing
-- Run this in Supabase SQL Editor BEFORE deploying Phase 3 code

-- ============================================================
-- 1. WORLDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS worlds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'shared',  -- 'shared' (couples/friends/family)
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  palette JSONB DEFAULT '{}',
  scene JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_worlds_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

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
  role TEXT NOT NULL DEFAULT 'member',
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
-- 5. RLS POLICIES
-- ============================================================

-- Enable RLS
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_invites ENABLE ROW LEVEL SECURITY;

-- WORLDS: users can see worlds they are a member of
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

-- WORLD_MEMBERS: users can see members of their worlds
CREATE POLICY world_members_select ON world_members FOR SELECT USING (
  world_id IN (SELECT world_id FROM world_members wm WHERE wm.user_id = auth.uid())
);
CREATE POLICY world_members_insert ON world_members FOR INSERT WITH CHECK (
  -- Owner can add members, or user can add themselves (via invite acceptance)
  user_id = auth.uid() OR
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role = 'owner')
);
CREATE POLICY world_members_delete ON world_members FOR DELETE USING (
  -- Owner can remove members, or user can leave
  user_id = auth.uid() OR
  world_id IN (SELECT world_id FROM world_members WHERE user_id = auth.uid() AND role = 'owner')
);

-- WORLD_INVITES: owners can manage invites, anyone can read by token
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

-- UPDATE entries/config policies to also allow world-based access
-- (Keep existing user_id policies, add world_id policies)

-- Entries: allow access if user is a member of the world
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

-- Config: same pattern
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

-- ============================================================
-- 6. HELPER FUNCTION: Accept invite
-- ============================================================
CREATE OR REPLACE FUNCTION accept_world_invite(invite_token TEXT)
RETURNS JSONB AS $$
DECLARE
  inv RECORD;
  result JSONB;
BEGIN
  -- Find valid invite
  SELECT * INTO inv FROM world_invites
  WHERE token = invite_token
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR use_count < max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid or expired invite');
  END IF;

  -- Check if already a member
  IF EXISTS (SELECT 1 FROM world_members WHERE world_id = inv.world_id AND user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', true, 'world_id', inv.world_id, 'already_member', true);
  END IF;

  -- Add as member
  INSERT INTO world_members (world_id, user_id, role)
  VALUES (inv.world_id, auth.uid(), inv.role);

  -- Increment use count
  UPDATE world_invites SET use_count = use_count + 1 WHERE id = inv.id;

  RETURN jsonb_build_object('ok', true, 'world_id', inv.world_id, 'already_member', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
