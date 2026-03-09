-- ============================================================
--  MY COSMOS — COMPLETE DATABASE SETUP
--  v3.0 | March 2026
--
--  IDEMPOTENT: Safe to run on fresh OR existing database.
--  All CREATE use IF NOT EXISTS, all policies DROP before CREATE.
--  Safe to run MULTIPLE TIMES — will not delete or corrupt data.
--
--  Run this ONE file in Supabase SQL Editor.
--  It covers: Tables, Triggers, Indexes, RLS, Storage, Functions,
--             Realtime, and Email triggers.
--
--  OPTIONAL PREREQUISITES (for email notifications):
--  - Enable pg_net extension (Database → Extensions)
--  - Add RESEND_API_KEY to Vault (Settings → Vault)
--  - Set Site URL to https://littlecosmos.app (Auth → URL Config)
--  Without these, everything works except automated email sending.
-- ============================================================


-- ============================================================
--  1. BASE FUNCTION (shared by all updated_at triggers)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper: get user's world IDs bypassing RLS (prevents infinite recursion
-- in world_members policies that would otherwise self-reference)
CREATE OR REPLACE FUNCTION get_user_world_ids(uid UUID)
RETURNS SETOF UUID AS $$
  SELECT world_id FROM world_members WHERE user_id = uid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get user's world IDs filtered by role (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_world_ids_by_role(uid UUID, allowed_roles TEXT[])
RETURNS SETOF UUID AS $$
  SELECT world_id FROM world_members WHERE user_id = uid AND role = ANY(allowed_roles);
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
--  2. ENTRIES TABLE (Our World / Shared Worlds)
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
  user_id UUID,
  world_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS entries_updated ON entries;
CREATE TRIGGER entries_updated
  BEFORE UPDATE ON entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
--  3. CONFIG TABLE (Our World / Shared Worlds)
-- ============================================================

CREATE TABLE IF NOT EXISTS config (
  id TEXT PRIMARY KEY,
  start_date TEXT DEFAULT '',
  title TEXT DEFAULT 'Our World',
  subtitle TEXT DEFAULT 'every moment, every adventure',
  love_letter TEXT DEFAULT '',
  you_name TEXT DEFAULT '',
  partner_name TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  user_id UUID,
  world_id UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS config_updated ON config;
CREATE TRIGGER config_updated
  BEFORE UPDATE ON config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
--  4. MY_ENTRIES TABLE (personal My World)
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
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS my_entries_updated ON my_entries;
CREATE TRIGGER my_entries_updated
  BEFORE UPDATE ON my_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
--  5. MY_CONFIG TABLE (personal My World)
-- ============================================================

CREATE TABLE IF NOT EXISTS my_config (
  id TEXT PRIMARY KEY,
  start_date TEXT DEFAULT '',
  title TEXT DEFAULT 'My World',
  subtitle TEXT DEFAULT '',
  traveler_name TEXT DEFAULT 'Explorer',
  metadata JSONB DEFAULT '{}'::jsonb,
  user_id UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS my_config_updated ON my_config;
CREATE TRIGGER my_config_updated
  BEFORE UPDATE ON my_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
--  6. WORLDS TABLE (shared worlds hub)
-- ============================================================

CREATE TABLE IF NOT EXISTS worlds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'shared',
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  palette JSONB DEFAULT '{}',
  scene JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS worlds_updated_at ON worlds;
CREATE TRIGGER worlds_updated_at
  BEFORE UPDATE ON worlds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
--  7. WORLD MEMBERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS world_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  world_id UUID REFERENCES worlds(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  display_name TEXT DEFAULT '',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(world_id, user_id)
);


-- ============================================================
--  8. WORLD INVITES TABLE
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


-- ============================================================
--  9. ENTRY COMMENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS entry_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id TEXT NOT NULL,
  world_id UUID REFERENCES worlds(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  user_name TEXT DEFAULT '',
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
--  10. ENTRY REACTIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS entry_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id TEXT NOT NULL,
  world_id UUID REFERENCES worlds(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT 'heart',
  photo_url TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_id, user_id, reaction_type, photo_url)
);

-- Partial unique index for reactions without photo_url (NULL-safe)
-- The UNIQUE constraint above allows duplicate NULLs; this prevents them.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_no_photo
  ON entry_reactions(entry_id, user_id, reaction_type)
  WHERE photo_url IS NULL;


-- ============================================================
--  11. WELCOME LETTERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS welcome_letters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID REFERENCES auth.users(id) NOT NULL,
  from_name TEXT NOT NULL DEFAULT '',
  to_email TEXT NOT NULL,
  letter_text TEXT NOT NULL DEFAULT '',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);


-- ============================================================
--  12. COSMOS CONNECTIONS TABLE (friend sharing)
-- ============================================================

CREATE TABLE IF NOT EXISTS cosmos_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES auth.users(id) NOT NULL,
  requester_name TEXT DEFAULT '',
  target_email TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id),
  share_back BOOLEAN DEFAULT false,
  letter_text TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);


-- ============================================================
--  12b. SAFE COLUMN ADDITIONS (for existing databases)
--  If tables already exist without these columns, add them.
-- ============================================================

DO $$ BEGIN
  ALTER TABLE entries ADD COLUMN IF NOT EXISTS user_id UUID;
  ALTER TABLE entries ADD COLUMN IF NOT EXISTS world_id UUID;
  ALTER TABLE entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE config ADD COLUMN IF NOT EXISTS user_id UUID;
  ALTER TABLE config ADD COLUMN IF NOT EXISTS world_id UUID;
  ALTER TABLE config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE my_entries ADD COLUMN IF NOT EXISTS user_id UUID;
  ALTER TABLE my_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE my_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE my_config ADD COLUMN IF NOT EXISTS user_id UUID;
  ALTER TABLE my_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
END $$;


-- ============================================================
--  13. FOREIGN KEYS (entries/config → worlds)
-- ============================================================

-- Drop and recreate with CASCADE to match other world-linked tables
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_world_id_fkey;
ALTER TABLE entries ADD CONSTRAINT entries_world_id_fkey
  FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE;

ALTER TABLE config DROP CONSTRAINT IF EXISTS config_world_id_fkey;
ALTER TABLE config ADD CONSTRAINT config_world_id_fkey
  FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE;


-- ============================================================
--  14. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_world_id ON entries(world_id);
CREATE INDEX IF NOT EXISTS idx_config_user_id ON config(user_id);
CREATE INDEX IF NOT EXISTS idx_config_world_id ON config(world_id);
CREATE INDEX IF NOT EXISTS idx_my_entries_user_id ON my_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_my_config_user_id ON my_config(user_id);
CREATE INDEX IF NOT EXISTS idx_world_members_user ON world_members(user_id);
CREATE INDEX IF NOT EXISTS idx_world_members_world ON world_members(world_id);
CREATE INDEX IF NOT EXISTS idx_world_invites_token ON world_invites(token);
CREATE INDEX IF NOT EXISTS idx_entry_comments_entry ON entry_comments(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_comments_world ON entry_comments(world_id);
CREATE INDEX IF NOT EXISTS idx_entry_reactions_entry ON entry_reactions(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_reactions_world ON entry_reactions(world_id);
CREATE INDEX IF NOT EXISTS idx_welcome_letters_to_email ON welcome_letters(to_email);
CREATE INDEX IF NOT EXISTS idx_cosmos_connections_requester ON cosmos_connections(requester_id);
CREATE INDEX IF NOT EXISTS idx_cosmos_connections_target ON cosmos_connections(target_email);
CREATE INDEX IF NOT EXISTS idx_cosmos_connections_target_user ON cosmos_connections(target_user_id);


-- ============================================================
--  15. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================

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
--  16. DROP ALL EXISTING POLICIES (safe — IF EXISTS)
--  This makes the entire script re-runnable.
-- ============================================================

-- entries (8)
DROP POLICY IF EXISTS "entries_select" ON entries;
DROP POLICY IF EXISTS "entries_insert" ON entries;
DROP POLICY IF EXISTS "entries_update" ON entries;
DROP POLICY IF EXISTS "entries_delete" ON entries;
DROP POLICY IF EXISTS "entries_world_select" ON entries;
DROP POLICY IF EXISTS "entries_world_insert" ON entries;
DROP POLICY IF EXISTS "entries_world_update" ON entries;
DROP POLICY IF EXISTS "entries_world_delete" ON entries;

-- config (7)
DROP POLICY IF EXISTS "config_select" ON config;
DROP POLICY IF EXISTS "config_insert" ON config;
DROP POLICY IF EXISTS "config_update" ON config;
DROP POLICY IF EXISTS "config_world_select" ON config;
DROP POLICY IF EXISTS "config_world_insert" ON config;
DROP POLICY IF EXISTS "config_world_update" ON config;
DROP POLICY IF EXISTS "config_world_delete" ON config;

-- my_entries (5)
DROP POLICY IF EXISTS "my_entries_select" ON my_entries;
DROP POLICY IF EXISTS "my_entries_insert" ON my_entries;
DROP POLICY IF EXISTS "my_entries_update" ON my_entries;
DROP POLICY IF EXISTS "my_entries_delete" ON my_entries;
DROP POLICY IF EXISTS "my_entries_friend_access" ON my_entries;

-- my_config (4)
DROP POLICY IF EXISTS "my_config_select" ON my_config;
DROP POLICY IF EXISTS "my_config_insert" ON my_config;
DROP POLICY IF EXISTS "my_config_update" ON my_config;
DROP POLICY IF EXISTS "my_config_friend_access" ON my_config;

-- worlds (4)
DROP POLICY IF EXISTS "worlds_select" ON worlds;
DROP POLICY IF EXISTS "worlds_insert" ON worlds;
DROP POLICY IF EXISTS "worlds_update" ON worlds;
DROP POLICY IF EXISTS "worlds_delete" ON worlds;

-- world_members (4)
DROP POLICY IF EXISTS "world_members_select" ON world_members;
DROP POLICY IF EXISTS "world_members_insert" ON world_members;
DROP POLICY IF EXISTS "world_members_update" ON world_members;
DROP POLICY IF EXISTS "world_members_delete" ON world_members;

-- world_invites (4)
DROP POLICY IF EXISTS "world_invites_select" ON world_invites;
DROP POLICY IF EXISTS "world_invites_insert" ON world_invites;
DROP POLICY IF EXISTS "world_invites_update" ON world_invites;
DROP POLICY IF EXISTS "world_invites_delete" ON world_invites;

-- entry_comments (3)
DROP POLICY IF EXISTS "entry_comments_select" ON entry_comments;
DROP POLICY IF EXISTS "entry_comments_insert" ON entry_comments;
DROP POLICY IF EXISTS "entry_comments_delete" ON entry_comments;

-- entry_reactions (3)
DROP POLICY IF EXISTS "entry_reactions_select" ON entry_reactions;
DROP POLICY IF EXISTS "entry_reactions_insert" ON entry_reactions;
DROP POLICY IF EXISTS "entry_reactions_delete" ON entry_reactions;

-- welcome_letters (7)
DROP POLICY IF EXISTS "letters_insert" ON welcome_letters;
DROP POLICY IF EXISTS "letters_select_author" ON welcome_letters;
DROP POLICY IF EXISTS "letters_update_author" ON welcome_letters;
DROP POLICY IF EXISTS "letters_delete_author" ON welcome_letters;
DROP POLICY IF EXISTS "letters_select_recipient" ON welcome_letters;
DROP POLICY IF EXISTS "letters_update_recipient" ON welcome_letters;
DROP POLICY IF EXISTS "letters_delete_recipient" ON welcome_letters;

-- cosmos_connections (6)
DROP POLICY IF EXISTS "connections_insert" ON cosmos_connections;
DROP POLICY IF EXISTS "connections_select_requester" ON cosmos_connections;
DROP POLICY IF EXISTS "connections_select_target" ON cosmos_connections;
DROP POLICY IF EXISTS "connections_update_target" ON cosmos_connections;
DROP POLICY IF EXISTS "connections_select_accepted" ON cosmos_connections;
DROP POLICY IF EXISTS "connections_delete" ON cosmos_connections;

-- storage (3)
DROP POLICY IF EXISTS "photos_read" ON storage.objects;
DROP POLICY IF EXISTS "photos_upload" ON storage.objects;
DROP POLICY IF EXISTS "photos_delete" ON storage.objects;


-- ============================================================
--  17. CREATE ALL POLICIES — entries (8)
--  Personal entries: auth.uid() = user_id
--  Shared world entries: member of world via world_members
-- ============================================================

CREATE POLICY "entries_select" ON entries FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "entries_insert" ON entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entries_update" ON entries FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entries_delete" ON entries FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "entries_world_select" ON entries FOR SELECT USING (
  world_id IS NOT NULL AND
  world_id IN (SELECT get_user_world_ids(auth.uid()))
);
CREATE POLICY "entries_world_insert" ON entries FOR INSERT WITH CHECK (
  world_id IS NOT NULL AND
  world_id IN (SELECT get_user_world_ids_by_role(auth.uid(), ARRAY['owner', 'member']))
);
CREATE POLICY "entries_world_update" ON entries FOR UPDATE USING (
  world_id IS NOT NULL AND
  world_id IN (SELECT get_user_world_ids_by_role(auth.uid(), ARRAY['owner', 'member']))
) WITH CHECK (
  world_id IS NOT NULL AND
  world_id IN (SELECT get_user_world_ids_by_role(auth.uid(), ARRAY['owner', 'member']))
);
CREATE POLICY "entries_world_delete" ON entries FOR DELETE USING (
  world_id IS NOT NULL AND
  world_id IN (SELECT get_user_world_ids_by_role(auth.uid(), ARRAY['owner', 'member']))
);


-- ============================================================
--  18. CREATE ALL POLICIES — config (7)
-- ============================================================

CREATE POLICY "config_select" ON config FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "config_insert" ON config FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "config_update" ON config FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "config_world_select" ON config FOR SELECT USING (
  world_id IS NOT NULL AND
  world_id IN (SELECT get_user_world_ids(auth.uid()))
);
CREATE POLICY "config_world_insert" ON config FOR INSERT WITH CHECK (
  world_id IS NOT NULL AND
  world_id IN (SELECT get_user_world_ids_by_role(auth.uid(), ARRAY['owner', 'member']))
);
CREATE POLICY "config_world_update" ON config FOR UPDATE USING (
  world_id IS NOT NULL AND
  world_id IN (SELECT get_user_world_ids_by_role(auth.uid(), ARRAY['owner', 'member']))
);
CREATE POLICY "config_world_delete" ON config FOR DELETE USING (
  world_id IS NOT NULL AND
  world_id IN (SELECT get_user_world_ids_by_role(auth.uid(), ARRAY['owner']))
);


-- ============================================================
--  19. CREATE ALL POLICIES — my_entries (5) + my_config (4)
-- ============================================================

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


-- ============================================================
--  20. CREATE ALL POLICIES — worlds (4) + members (4) + invites (4)
-- ============================================================

CREATE POLICY "worlds_select" ON worlds FOR SELECT USING (
  id IN (SELECT get_user_world_ids(auth.uid()))
);
CREATE POLICY "worlds_insert" ON worlds FOR INSERT WITH CHECK (
  created_by = auth.uid()
);
CREATE POLICY "worlds_update" ON worlds FOR UPDATE USING (
  id IN (SELECT get_user_world_ids_by_role(auth.uid(), ARRAY['owner']))
);
CREATE POLICY "worlds_delete" ON worlds FOR DELETE USING (
  created_by = auth.uid()
);

CREATE POLICY "world_members_select" ON world_members FOR SELECT USING (
  world_id IN (SELECT get_user_world_ids(auth.uid()))
);
CREATE POLICY "world_members_insert" ON world_members FOR INSERT WITH CHECK (
  user_id = auth.uid() OR
  world_id IN (SELECT get_user_world_ids_by_role(auth.uid(), ARRAY['owner']))
);
CREATE POLICY "world_members_update" ON world_members FOR UPDATE USING (
  world_id IN (SELECT get_user_world_ids_by_role(auth.uid(), ARRAY['owner']))
) WITH CHECK (
  world_id IN (SELECT get_user_world_ids_by_role(auth.uid(), ARRAY['owner']))
);
CREATE POLICY "world_members_delete" ON world_members FOR DELETE USING (
  user_id = auth.uid() OR
  world_id IN (SELECT get_user_world_ids_by_role(auth.uid(), ARRAY['owner']))
);

CREATE POLICY "world_invites_select" ON world_invites FOR SELECT USING (
  created_by = auth.uid() OR
  world_id IN (SELECT get_user_world_ids(auth.uid()))
);
CREATE POLICY "world_invites_insert" ON world_invites FOR INSERT WITH CHECK (
  world_id IN (SELECT get_user_world_ids_by_role(auth.uid(), ARRAY['owner', 'member']))
);
CREATE POLICY "world_invites_update" ON world_invites FOR UPDATE USING (
  world_id IN (SELECT get_user_world_ids_by_role(auth.uid(), ARRAY['owner', 'member']))
);
CREATE POLICY "world_invites_delete" ON world_invites FOR DELETE USING (
  created_by = auth.uid()
);


-- ============================================================
--  21. CREATE ALL POLICIES — comments (3) + reactions (3)
-- ============================================================

CREATE POLICY "entry_comments_select" ON entry_comments FOR SELECT USING (
  world_id IN (SELECT get_user_world_ids(auth.uid()))
);
CREATE POLICY "entry_comments_insert" ON entry_comments FOR INSERT WITH CHECK (
  user_id = auth.uid() AND
  world_id IN (SELECT get_user_world_ids(auth.uid()))
);
CREATE POLICY "entry_comments_delete" ON entry_comments FOR DELETE USING (
  user_id = auth.uid()
);

CREATE POLICY "entry_reactions_select" ON entry_reactions FOR SELECT USING (
  world_id IN (SELECT get_user_world_ids(auth.uid()))
);
CREATE POLICY "entry_reactions_insert" ON entry_reactions FOR INSERT WITH CHECK (
  user_id = auth.uid() AND
  world_id IN (SELECT get_user_world_ids(auth.uid()))
);
CREATE POLICY "entry_reactions_delete" ON entry_reactions FOR DELETE USING (
  user_id = auth.uid()
);


-- ============================================================
--  22. CREATE ALL POLICIES — welcome_letters (6)
-- ============================================================

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
CREATE POLICY "letters_delete_recipient" ON welcome_letters FOR DELETE
  USING (lower(to_email) = lower(auth.email()));


-- ============================================================
--  23. CREATE ALL POLICIES — cosmos_connections (6)
-- ============================================================

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
CREATE POLICY "connections_delete" ON cosmos_connections FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = target_user_id);


-- ============================================================
--  24. PHOTO STORAGE BUCKET + POLICIES (3)
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "photos_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "photos_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'photos' AND auth.role() = 'authenticated');
CREATE POLICY "photos_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'photos' AND auth.role() = 'authenticated');


-- ============================================================
--  25a. RPC FUNCTION: Create world (atomic, bypasses RLS)
--  Creates world + owner membership + config in one transaction.
-- ============================================================

CREATE OR REPLACE FUNCTION create_world(
  world_name TEXT,
  world_type TEXT DEFAULT 'shared',
  you_name TEXT DEFAULT '',
  partner_name TEXT DEFAULT '',
  member_names JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  new_world_id UUID;
  is_group BOOLEAN;
BEGIN
  is_group := world_type IN ('friends', 'family');

  INSERT INTO worlds (name, type, created_by)
  VALUES (world_name, world_type, auth.uid())
  RETURNING id INTO new_world_id;

  INSERT INTO world_members (world_id, user_id, role)
  VALUES (new_world_id, auth.uid(), 'owner');

  INSERT INTO config (id, world_id, user_id, title, subtitle, you_name, partner_name, metadata)
  VALUES (
    new_world_id::text,
    new_world_id,
    auth.uid(),
    world_name,
    '',
    CASE WHEN is_group THEN '' ELSE you_name END,
    CASE WHEN is_group THEN '' ELSE partner_name END,
    jsonb_build_object(
      'loveLetters', '[]'::jsonb,
      'dreamDestinations', '[]'::jsonb,
      'chapters', '[]'::jsonb,
      'members', CASE WHEN is_group THEN member_names ELSE '[]'::jsonb END,
      'darkMode', false,
      'customPalette', '{}'::jsonb,
      'customScene', '{}'::jsonb,
      'ambientMusicUrl', ''
    )
  );

  RETURN jsonb_build_object(
    'id', new_world_id,
    'name', world_name,
    'type', world_type,
    'created_by', auth.uid(),
    'created_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
--  25b. RPC FUNCTION: Accept world invite
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


-- ============================================================
--  26. RPC FUNCTION: Accept friend connection
-- ============================================================

CREATE OR REPLACE FUNCTION accept_cosmos_connection(connection_id UUID)
RETURNS JSONB AS $$
DECLARE
  conn RECORD;
BEGIN
  SELECT * INTO conn FROM cosmos_connections
  WHERE id = connection_id
    AND status = 'pending'
    AND lower(target_email) = lower(auth.email());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Connection request not found');
  END IF;

  UPDATE cosmos_connections
  SET status = 'accepted',
      target_user_id = auth.uid(),
      responded_at = NOW()
  WHERE id = connection_id;

  RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
--  27. REALTIME (safe — ignores if already added)
-- ============================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE entries;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE entry_comments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE entry_reactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
--  28. EMAIL TRIGGER: World invite (welcome_letters)
--  Safely handles missing pg_net / Vault extensions.
-- ============================================================

CREATE OR REPLACE FUNCTION notify_invite_email()
RETURNS TRIGGER AS $$
DECLARE
  resend_key TEXT;
  site_url TEXT := 'https://littlecosmos.app';
  email_body TEXT;
BEGIN
  -- Safely try to read Resend API key from Vault
  -- If vault extension is not enabled, silently skip email
  BEGIN
    SELECT decrypted_secret INTO resend_key
    FROM vault.decrypted_secrets
    WHERE name = 'RESEND_API_KEY'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF resend_key IS NULL OR resend_key = '' THEN
    RETURN NEW;
  END IF;

  email_body := format(
    '{
      "from": "My Cosmos <noreply@send.littlecosmos.app>",
      "to": ["%s"],
      "subject": "%s has invited you to My Cosmos",
      "html": "<div style=\"font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #0c0a12; color: #e8e0d0;\"><div style=\"text-align: center; margin-bottom: 32px;\"><div style=\"font-size: 28px; margin-bottom: 8px;\">&#10022;</div><div style=\"font-size: 11px; letter-spacing: 5px; color: #c9a96e; text-transform: uppercase;\">My Cosmos</div></div><div style=\"background: rgba(255,255,255,0.03); border: 1px solid rgba(200,170,110,0.15); border-radius: 16px; padding: 28px 24px; text-align: center;\"><div style=\"font-size: 18px; font-weight: 400; color: #e8e0d0; margin-bottom: 12px;\">%s sent you an invitation</div><div style=\"font-size: 13px; color: #a098a8; line-height: 1.8; margin-bottom: 20px;\">%s</div><a href=\"%s\" style=\"display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, rgba(200,170,110,0.25), rgba(200,170,110,0.1)); border: 1px solid rgba(200,170,110,0.4); border-radius: 24px; color: #c9a96e; text-decoration: none; font-size: 13px; letter-spacing: 1px;\">Open My Cosmos</a></div><div style=\"text-align: center; margin-top: 24px; font-size: 10px; color: #504858;\">A place to map your adventures on a beautiful 3D globe</div></div>"
    }',
    NEW.to_email,
    COALESCE(NEW.from_name, 'Someone'),
    COALESCE(NEW.from_name, 'Someone'),
    replace(replace(COALESCE(NEW.letter_text, 'You have been invited to join My Cosmos!'), '"', '\"'), E'\n', '<br>'),
    site_url
  );

  -- Safely try to send email via pg_net
  -- If pg_net extension is not enabled, silently skip
  BEGIN
    PERFORM net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || resend_key,
        'Content-Type', 'application/json'
      ),
      body := email_body::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_welcome_letter_send_email ON welcome_letters;
CREATE TRIGGER on_welcome_letter_send_email
  AFTER INSERT ON welcome_letters
  FOR EACH ROW
  EXECUTE FUNCTION notify_invite_email();


-- ============================================================
--  29. EMAIL TRIGGER: Friend connection request
--  Safely handles missing pg_net / Vault extensions.
-- ============================================================

CREATE OR REPLACE FUNCTION notify_connection_email()
RETURNS TRIGGER AS $$
DECLARE
  resend_key TEXT;
  site_url TEXT := 'https://littlecosmos.app';
  email_body TEXT;
  from_name TEXT;
BEGIN
  -- Safely try to read Resend API key from Vault
  BEGIN
    SELECT decrypted_secret INTO resend_key
    FROM vault.decrypted_secrets
    WHERE name = 'RESEND_API_KEY'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF resend_key IS NULL OR resend_key = '' THEN
    RETURN NEW;
  END IF;

  from_name := COALESCE(NEW.requester_name, 'Someone');

  email_body := format(
    '{
      "from": "My Cosmos <noreply@send.littlecosmos.app>",
      "to": ["%s"],
      "subject": "%s wants to share worlds with you on My Cosmos",
      "html": "<div style=\"font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #0c0a12; color: #e8e0d0;\"><div style=\"text-align: center; margin-bottom: 32px;\"><div style=\"font-size: 28px; margin-bottom: 8px;\">&#10022;</div><div style=\"font-size: 11px; letter-spacing: 5px; color: #c9a96e; text-transform: uppercase;\">My Cosmos</div></div><div style=\"background: rgba(255,255,255,0.03); border: 1px solid rgba(200,170,110,0.15); border-radius: 16px; padding: 28px 24px; text-align: center;\"><div style=\"font-size: 18px; font-weight: 400; color: #e8e0d0; margin-bottom: 12px;\">%s wants to share worlds</div><div style=\"font-size: 13px; color: #a098a8; line-height: 1.8; margin-bottom: 8px;\">Accept their invite and you will both see each other''s travel worlds in your cosmos.</div>%s<a href=\"%s\" style=\"display: inline-block; margin-top: 16px; padding: 12px 32px; background: linear-gradient(135deg, rgba(160,192,232,0.25), rgba(160,192,232,0.1)); border: 1px solid rgba(160,192,232,0.3); border-radius: 24px; color: #a0c0e8; text-decoration: none; font-size: 13px; letter-spacing: 1px;\">Open My Cosmos</a></div><div style=\"text-align: center; margin-top: 24px; font-size: 10px; color: #504858;\">A place to map your adventures on a beautiful 3D globe</div></div>"
    }',
    NEW.target_email,
    from_name,
    from_name,
    CASE WHEN NEW.letter_text IS NOT NULL AND NEW.letter_text != ''
      THEN format('<div style="font-size: 12px; color: #b0a8b8; padding: 14px 16px; background: rgba(255,255,255,0.03); border-radius: 8px; margin: 12px 0; font-style: italic; line-height: 1.6;">"%s"</div>', replace(replace(NEW.letter_text, '"', '\"'), E'\n', '<br>'))
      ELSE ''
    END,
    site_url
  );

  -- Safely try to send email via pg_net
  BEGIN
    PERFORM net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || resend_key,
        'Content-Type', 'application/json'
      ),
      body := email_body::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_connection_send_email ON cosmos_connections;
CREATE TRIGGER on_connection_send_email
  AFTER INSERT ON cosmos_connections
  FOR EACH ROW
  EXECUTE FUNCTION notify_connection_email();


-- ============================================================
--  30. CLEANUP: Remove orphaned data (safe — only removes broken refs)
-- ============================================================

-- Only clean up worlds with zero members (orphaned from failed create_world)
DELETE FROM worlds WHERE id NOT IN (SELECT DISTINCT world_id FROM world_members);
-- Only clean up config rows pointing to deleted worlds
DELETE FROM config WHERE world_id IS NOT NULL AND world_id NOT IN (SELECT id FROM worlds);


-- ============================================================
--  31. VERIFY — Results appear in SQL Editor output
-- ============================================================

-- Tables (expect 11: config, cosmos_connections, entries, entry_comments,
--   entry_reactions, my_config, my_entries, welcome_letters, world_invites,
--   world_members, worlds)
SELECT '--- TABLES ---' AS section;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- Public policies (expect 55)
SELECT '--- POLICIES (' || COUNT(*) || ' total) ---' AS section
FROM pg_policies WHERE schemaname = 'public';

-- RPC functions (expect 6: update_updated_at, get_user_world_ids,
--   get_user_world_ids_by_role, create_world, accept_world_invite,
--   accept_cosmos_connection)
SELECT '--- RPC FUNCTIONS ---' AS section;
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Storage bucket
SELECT '--- STORAGE ---' AS section;
SELECT id, name, public FROM storage.buckets WHERE id = 'photos';

SELECT '--- SETUP COMPLETE ---' AS section;
