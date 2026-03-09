-- ============================================================
-- FIX: Add invite_token to welcome_letters for direct linking
-- Eliminates fragile time-proximity matching between letters and invites
-- ============================================================

-- Step 1: Add invite_token column
ALTER TABLE welcome_letters ADD COLUMN IF NOT EXISTS invite_token TEXT;

-- Step 2: Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_welcome_letters_invite_token ON welcome_letters(invite_token);

-- Step 3: Backfill existing letters by matching to invites (same sender, closest time)
-- This is a one-time migration to link existing letters to their invites
DO $$
DECLARE
  letter RECORD;
  best_token TEXT;
BEGIN
  FOR letter IN
    SELECT id, from_user_id, created_at
    FROM welcome_letters
    WHERE invite_token IS NULL
  LOOP
    SELECT wi.token INTO best_token
    FROM world_invites wi
    WHERE wi.created_by = letter.from_user_id
      AND ABS(EXTRACT(EPOCH FROM (wi.created_at - letter.created_at))) < 300
    ORDER BY ABS(EXTRACT(EPOCH FROM (wi.created_at - letter.created_at)))
    LIMIT 1;

    IF best_token IS NOT NULL THEN
      UPDATE welcome_letters SET invite_token = best_token WHERE id = letter.id;
      RAISE NOTICE 'Linked letter % to invite token %', letter.id, best_token;
    END IF;
  END LOOP;
END $$;

-- Verify
SELECT wl.id, wl.to_email, wl.invite_token, wl.read,
       wi.world_id, w.name as world_name, wi.use_count, wi.max_uses
FROM welcome_letters wl
LEFT JOIN world_invites wi ON wi.token = wl.invite_token
LEFT JOIN worlds w ON w.id = wi.world_id
ORDER BY wl.created_at DESC;
