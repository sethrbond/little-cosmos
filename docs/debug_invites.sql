-- ============================================================
-- DIAGNOSTIC: Debug world sharing issues
-- Run in Supabase SQL Editor to check invite/membership state
-- ============================================================

-- Replace these with actual values:
-- SET partner_email = 'partner@example.com';

-- 1. Find partner's user_id
SELECT id, email, raw_user_meta_data->>'display_name' as name
FROM auth.users
WHERE email ILIKE '%rosie%' OR email ILIKE '%partner%'
ORDER BY created_at;

-- 2. Check which worlds the partner is a member of
SELECT wm.world_id, wm.role, wm.joined_at, w.name, w.type
FROM world_members wm
JOIN worlds w ON w.id = wm.world_id
WHERE wm.user_id = '<PARTNER_USER_ID>'
ORDER BY wm.joined_at;

-- 3. Check ALL world_invites — are any pending/unused?
SELECT wi.id, wi.token, wi.world_id, w.name as world_name,
       wi.role, wi.max_uses, wi.use_count, wi.created_at,
       wi.created_by
FROM world_invites wi
JOIN worlds w ON w.id = wi.world_id
ORDER BY wi.created_at DESC;

-- 4. Check welcome_letters — are they read? email match?
SELECT id, from_name, to_email, read, created_at,
       substring(letter_text, 1, 80) as letter_preview
FROM welcome_letters
ORDER BY created_at DESC;

-- 5. Check if there's an email case mismatch
-- (the code lowercases on insert but the check might not)
SELECT DISTINCT to_email FROM welcome_letters;

-- 6. Quick fix: manually add partner to a world
-- UNCOMMENT and edit to force-add:
-- INSERT INTO world_members (world_id, user_id, role)
-- VALUES ('<WORLD_ID>', '<PARTNER_USER_ID>', 'member');
