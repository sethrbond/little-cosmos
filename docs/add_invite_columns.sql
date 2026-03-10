-- ============================================================
-- ADD: target_email on world_invites + invite_token on welcome_letters
-- Run once in Supabase SQL Editor. Safe to re-run (uses IF NOT EXISTS).
-- ============================================================

-- 1. Add target_email to world_invites (direct email lookup, no letter dependency)
ALTER TABLE world_invites ADD COLUMN IF NOT EXISTS target_email TEXT;
CREATE INDEX IF NOT EXISTS idx_world_invites_target_email ON world_invites(target_email);

-- 2. Add invite_token to welcome_letters (direct link to invite)
ALTER TABLE welcome_letters ADD COLUMN IF NOT EXISTS invite_token TEXT;
CREATE INDEX IF NOT EXISTS idx_welcome_letters_invite_token ON welcome_letters(invite_token);

-- Done. New invites will store target_email directly on the invite,
-- so the notification system no longer depends on welcome_letters.
