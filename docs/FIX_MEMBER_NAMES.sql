-- ============================================================
--  FIX_MEMBER_NAMES.sql — Backfill display_name + fix RPCs
--  Run in Supabase SQL Editor
-- ============================================================

-- STEP 1: Backfill display_name from auth metadata for all existing members
UPDATE world_members wm
SET display_name = COALESCE(u.raw_user_meta_data->>'display_name', '')
FROM auth.users u
WHERE wm.user_id = u.id
  AND (wm.display_name IS NULL OR wm.display_name = '');

-- STEP 2: Verify — show all members with their display names
SELECT wm.world_id, w.name AS world_name, wm.user_id, wm.role, wm.display_name,
  (SELECT email FROM auth.users u WHERE u.id = wm.user_id) AS email
FROM world_members wm
JOIN worlds w ON w.id = wm.world_id
WHERE w.type != 'personal'
ORDER BY w.name, wm.role;

-- STEP 3: Update create_world RPC to set display_name on creation
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

  INSERT INTO world_members (world_id, user_id, role, display_name)
  VALUES (new_world_id, auth.uid(), 'owner',
    COALESCE((SELECT raw_user_meta_data->>'display_name' FROM auth.users WHERE id = auth.uid()), ''));

  INSERT INTO config (id, world_id, user_id, title, subtitle, you_name, partner_name, metadata)
  VALUES (
    new_world_id::text,
    new_world_id,
    auth.uid(),
    world_name,
    CASE
      WHEN world_type = 'partner' THEN 'every moment, every adventure'
      WHEN world_type = 'friends' THEN 'every trip, every story'
      WHEN world_type = 'family' THEN 'every gathering, every memory'
      ELSE 'our shared adventures'
    END,
    you_name,
    partner_name,
    CASE
      WHEN is_group AND jsonb_array_length(member_names) > 0 THEN
        jsonb_build_object('members', member_names)
      ELSE '{}'::jsonb
    END
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

-- STEP 4: Update accept_world_invite RPC to set display_name
CREATE OR REPLACE FUNCTION accept_world_invite(invite_token TEXT)
RETURNS JSONB AS $$
DECLARE
  inv RECORD;
  uname TEXT;
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

  SELECT COALESCE(raw_user_meta_data->>'display_name', '') INTO uname
  FROM auth.users WHERE id = auth.uid();

  INSERT INTO world_members (world_id, user_id, role, display_name)
  VALUES (inv.world_id, auth.uid(), COALESCE(inv.role, 'member'), COALESCE(uname, ''));

  UPDATE world_invites SET use_count = COALESCE(use_count, 0) + 1 WHERE id = inv.id;

  RETURN jsonb_build_object('ok', true, 'world_id', inv.world_id, 'already_member', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
