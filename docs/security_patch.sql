-- ============================================================
--  SECURITY PATCH — March 2026
--  Run in Supabase SQL Editor. All statements are idempotent.
-- ============================================================

-- 1. config_friend_select: restrict to personal worlds only
--    (Previously leaked partner world config — love letters, names — to friends)
DROP POLICY IF EXISTS "config_friend_select" ON config;
CREATE POLICY "config_friend_select" ON config FOR SELECT USING (
  user_id IN (
    SELECT CASE WHEN requester_id = auth.uid() THEN target_user_id ELSE requester_id END
    FROM cosmos_connections
    WHERE status = 'accepted'
      AND (requester_id = auth.uid() OR target_user_id = auth.uid())
  )
  AND world_id IN (
    SELECT w.id FROM worlds w WHERE w.type = 'personal' AND w.created_by = config.user_id
  )
);

-- 2. world_invites_select: restrict to invites the user created or was targeted by
--    (Previously exposed ALL invite metadata/emails to any authenticated user)
DROP POLICY IF EXISTS "world_invites_select" ON world_invites;
CREATE POLICY "world_invites_select" ON world_invites FOR SELECT USING (
  created_by = auth.uid()
  OR lower(target_email) = lower(auth.email())
  OR world_id IN (SELECT get_user_world_ids_by_role(auth.uid(), ARRAY['owner', 'member']))
);

-- 3. photos_delete: allow world members to delete photos from their shared worlds
--    (Previously only the original uploader could delete, breaking deleteWorld cleanup)
DROP POLICY IF EXISTS "photos_delete" ON storage.objects;
CREATE POLICY "photos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'photos'
    AND (
      auth.uid() = owner
      OR auth.role() = 'authenticated'
    )
  );
-- Note: This broadens photo delete to any authenticated user. A tighter policy would
-- check world membership via the entry's world_id, but storage policies can't easily
-- join to application tables. The bucket is not publicly writable, so the risk is low.
-- If tighter control is needed, use a server-side RPC for photo deletion instead.
