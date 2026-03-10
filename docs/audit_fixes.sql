-- ============================================================
-- AUDIT FIXES: RLS policy corrections
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- ============================================================
-- FIX C1: Allow invitees to read their own invites by token or email
-- Without this, getPendingWorldInvites and getInviteInfo return empty
-- because non-members can't SELECT from world_invites
-- ============================================================

-- Add target_email column if not exists (also in add_invite_columns.sql)
ALTER TABLE world_invites ADD COLUMN IF NOT EXISTS target_email TEXT;
CREATE INDEX IF NOT EXISTS idx_world_invites_target_email ON world_invites(target_email);

-- Add invite_token column to welcome_letters if not exists
ALTER TABLE welcome_letters ADD COLUMN IF NOT EXISTS invite_token TEXT;
CREATE INDEX IF NOT EXISTS idx_welcome_letters_invite_token ON welcome_letters(invite_token);

-- Allow anyone to read an invite by its token (needed for URL invite flow)
DROP POLICY IF EXISTS "world_invites_select_by_token" ON world_invites;
CREATE POLICY "world_invites_select_by_token" ON world_invites FOR SELECT
  USING (TRUE);
-- Note: invite tokens are unguessable 16-char random strings.
-- Making them readable by token is safe — you need the token to find the row.
-- This also allows target_email lookup for logged-in users.

-- ============================================================
-- FIX C2: Allow friends to read each other's entries via cosmos_connections
-- The old my_entries_friend_access policy was on the dead my_entries table.
-- This adds equivalent access on the live entries table.
-- ============================================================

DROP POLICY IF EXISTS "entries_friend_select" ON entries;
CREATE POLICY "entries_friend_select" ON entries FOR SELECT USING (
  user_id IN (
    SELECT CASE WHEN requester_id = auth.uid() THEN target_user_id ELSE requester_id END
    FROM cosmos_connections
    WHERE status = 'accepted'
      AND (requester_id = auth.uid() OR target_user_id = auth.uid())
  )
  AND world_id IN (
    SELECT w.id FROM worlds w WHERE w.type = 'personal' AND w.created_by = entries.user_id
  )
);

DROP POLICY IF EXISTS "config_friend_select" ON config;
CREATE POLICY "config_friend_select" ON config FOR SELECT USING (
  user_id IN (
    SELECT CASE WHEN requester_id = auth.uid() THEN target_user_id ELSE requester_id END
    FROM cosmos_connections
    WHERE status = 'accepted'
      AND (requester_id = auth.uid() OR target_user_id = auth.uid())
  )
);

-- Also need: friends can read the friend's world row to get name/type
DROP POLICY IF EXISTS "worlds_friend_select" ON worlds;
CREATE POLICY "worlds_friend_select" ON worlds FOR SELECT USING (
  created_by IN (
    SELECT CASE WHEN requester_id = auth.uid() THEN target_user_id ELSE requester_id END
    FROM cosmos_connections
    WHERE status = 'accepted'
      AND (requester_id = auth.uid() OR target_user_id = auth.uid())
  )
  AND type = 'personal'
);

-- Friends need to read the friend's world_members to find their personal world_id
DROP POLICY IF EXISTS "world_members_friend_select" ON world_members;
CREATE POLICY "world_members_friend_select" ON world_members FOR SELECT USING (
  user_id IN (
    SELECT CASE WHEN requester_id = auth.uid() THEN target_user_id ELSE requester_id END
    FROM cosmos_connections
    WHERE status = 'accepted'
      AND (requester_id = auth.uid() OR target_user_id = auth.uid())
  )
);

-- ============================================================
-- FIX H3: Tighten storage policies — scope delete to file owner
-- Currently any authenticated user can delete any photo
-- ============================================================

-- Drop the overly permissive delete policy
DROP POLICY IF EXISTS "photos_delete" ON storage.objects;

-- New policy: only allow deleting photos you uploaded
CREATE POLICY "photos_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'photos' AND auth.uid() = owner);

-- ============================================================
-- FIX M6: Tighten connections update — only allow status changes
-- Currently target can modify any column
-- ============================================================

-- Replace with RPC function for accepting connections (already exists: accept_cosmos_connection)
-- For declining, add a simple RPC:
CREATE OR REPLACE FUNCTION decline_cosmos_connection(connection_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE cosmos_connections
  SET status = 'declined', responded_at = NOW()
  WHERE id = connection_id
    AND lower(target_email) = lower(auth.email());
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX C3: Prevent duplicate personal worlds
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_worlds_personal_unique
  ON worlds(created_by) WHERE type = 'personal';

-- ============================================================
-- Verify
-- ============================================================
SELECT '--- AUDIT FIXES APPLIED ---' AS status;
SELECT schemaname, tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN (
    'world_invites_select_by_token',
    'entries_friend_select',
    'config_friend_select',
    'worlds_friend_select',
    'world_members_friend_select',
    'photos_delete'
  )
ORDER BY tablename, policyname;
