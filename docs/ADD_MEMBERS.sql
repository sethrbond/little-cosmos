-- ============================================================
--  ADD_MEMBERS.sql — Directly add missing world members
--  Run in Supabase SQL Editor
-- ============================================================

-- STEP 1: Find all user accounts (to get partner/friend user IDs)
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at;

-- STEP 2: After you identify the user IDs from above, uncomment and
-- fill in the INSERTs below. Each INSERT adds a user as a 'member'
-- of a shared world.
--
-- "Our World" (your partner world with your partner):
-- INSERT INTO world_members (world_id, user_id, role)
-- VALUES ('616f4bd1-75ec-4459-bebf-506471e0fce0', 'PASTE_PARTNER_USER_ID_HERE', 'member')
-- ON CONFLICT (world_id, user_id) DO NOTHING;
--
-- "Anedde und Marianne" (your partner + her friend's shared world):
-- INSERT INTO world_members (world_id, user_id, role)
-- VALUES ('16926e5b-0c3f-4070-9a69-fd58b4aa84de', 'PASTE_FRIEND_USER_ID_HERE', 'member')
-- ON CONFLICT (world_id, user_id) DO NOTHING;
--
-- Also backfill target_email on existing invites so future auto-accept works:
-- UPDATE world_invites SET target_email = 'partner@email.com'
-- WHERE token = '79c4e63982c84e35';
-- UPDATE world_invites SET target_email = 'friend@email.com'
-- WHERE token = 'b25083c8ff324119';
-- UPDATE world_invites SET target_email = 'partner@email.com'
-- WHERE token = 'ca89f93d6d214626';

-- STEP 3: Verify members were added
SELECT wm.world_id, w.name, wm.user_id, wm.role,
  (SELECT email FROM auth.users u WHERE u.id = wm.user_id) AS email
FROM world_members wm
JOIN worlds w ON w.id = wm.world_id
WHERE w.type != 'personal'
ORDER BY w.name;
