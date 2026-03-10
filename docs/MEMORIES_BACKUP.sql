-- MEMORIES → HIGHLIGHTS MIGRATION BACKUP
-- Run this BEFORE deploying the code changes to capture the current state
-- of both fields for every entry. This creates a backup table that preserves
-- the original data in case manual recovery is needed.
--
-- The app code now:
--   1. On READ: merges memories[] into highlights[] (deduplicated)
--   2. On WRITE: saves merged data to highlights[], clears memories to []
--   3. The memories column stays in the DB but is no longer written to
--
-- Date: 2026-03-10

-- Create backup table (idempotent)
CREATE TABLE IF NOT EXISTS _memories_backup (
  entry_id TEXT PRIMARY KEY,
  memories JSONB DEFAULT '[]'::jsonb,
  highlights JSONB DEFAULT '[]'::jsonb,
  backed_up_at TIMESTAMPTZ DEFAULT NOW()
);

-- Snapshot current state of both fields for all entries that have data in either
INSERT INTO _memories_backup (entry_id, memories, highlights)
SELECT id, COALESCE(memories, '[]'::jsonb), COALESCE(highlights, '[]'::jsonb)
FROM entries
WHERE (memories IS NOT NULL AND memories != '[]'::jsonb)
   OR (highlights IS NOT NULL AND highlights != '[]'::jsonb)
ON CONFLICT (entry_id) DO NOTHING;

-- Verify backup
SELECT COUNT(*) AS backed_up_entries,
       COUNT(*) FILTER (WHERE memories != '[]'::jsonb) AS had_memories,
       COUNT(*) FILTER (WHERE highlights != '[]'::jsonb) AS had_highlights
FROM _memories_backup;
