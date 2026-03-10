-- ============================================================
--  FIX_SHARING.sql — Fix world invite + membership issues
--  Run in Supabase SQL Editor
--
--  Problem: world_invites table may have been created before
--  target_email, max_uses, use_count, role columns were added.
--  CREATE TABLE IF NOT EXISTS skips existing tables, so the
--  columns were never added. This breaks the entire
--  invite → accept → membership flow.
-- ============================================================


-- ============================================================
--  STEP 1: DIAGNOSTIC — See current state
-- ============================================================

-- Check what columns world_invites actually has
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'world_invites'
ORDER BY ordinal_position;


-- ============================================================
--  STEP 2: Add missing columns to world_invites
-- ============================================================

ALTER TABLE world_invites ADD COLUMN IF NOT EXISTS target_email TEXT;
ALTER TABLE world_invites ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE world_invites ADD COLUMN IF NOT EXISTS max_uses INT DEFAULT 1;
ALTER TABLE world_invites ADD COLUMN IF NOT EXISTS use_count INT DEFAULT 0;

-- Add index for target_email lookups
CREATE INDEX IF NOT EXISTS idx_world_invites_target_email ON world_invites(target_email);


-- ============================================================
--  STEP 3: Fix expires_at default (old schema had no default)
-- ============================================================

ALTER TABLE world_invites
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '7 days');


-- ============================================================
--  STEP 4: Re-create accept_world_invite RPC
--  (in case it was created before columns existed)
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
  VALUES (inv.world_id, auth.uid(), COALESCE(inv.role, 'member'));

  UPDATE world_invites SET use_count = COALESCE(use_count, 0) + 1 WHERE id = inv.id;

  RETURN jsonb_build_object('ok', true, 'world_id', inv.world_id, 'already_member', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
--  STEP 5: Update RLS policy for world_invites SELECT
--  (needs target_email column to exist)
-- ============================================================

DROP POLICY IF EXISTS "world_invites_select" ON world_invites;
DROP POLICY IF EXISTS "world_invites_select_by_token" ON world_invites;

CREATE POLICY "world_invites_select" ON world_invites FOR SELECT USING (
  created_by = auth.uid()
  OR lower(target_email) = lower(auth.email())
  OR world_id IN (SELECT get_user_world_ids_by_role(auth.uid(), ARRAY['owner', 'member']))
);


-- ============================================================
--  STEP 6: Fix any expired invites — reset expiry for
--  invites that haven't been fully used yet
-- ============================================================

UPDATE world_invites
SET expires_at = NOW() + INTERVAL '30 days'
WHERE (expires_at IS NOT NULL AND expires_at < NOW())
  AND (max_uses IS NULL OR use_count < max_uses);


-- ============================================================
--  STEP 7: DIAGNOSTIC — Show all worlds, members, and invites
--  so you can verify the state
-- ============================================================

-- All shared worlds
SELECT w.id, w.name, w.type, w.created_by,
  (SELECT count(*) FROM world_members wm WHERE wm.world_id = w.id) AS member_count,
  (SELECT count(*) FROM entries e WHERE e.world_id = w.id) AS entry_count
FROM worlds w
WHERE w.type != 'personal'
ORDER BY w.created_at;

-- All world members (who is in which world)
SELECT wm.world_id, w.name AS world_name, wm.user_id, wm.role,
  (SELECT email FROM auth.users u WHERE u.id = wm.user_id) AS user_email
FROM world_members wm
JOIN worlds w ON w.id = wm.world_id
WHERE w.type != 'personal'
ORDER BY w.name, wm.role;

-- All invites (check status)
SELECT wi.token, wi.world_id, w.name AS world_name,
  wi.target_email, wi.role, wi.max_uses, wi.use_count,
  wi.expires_at,
  CASE
    WHEN wi.expires_at IS NOT NULL AND wi.expires_at < NOW() THEN 'EXPIRED'
    WHEN wi.max_uses IS NOT NULL AND wi.use_count >= wi.max_uses THEN 'USED UP'
    ELSE 'ACTIVE'
  END AS status
FROM world_invites wi
JOIN worlds w ON w.id = wi.world_id
ORDER BY wi.created_at DESC;
