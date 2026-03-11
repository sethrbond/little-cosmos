-- Add photo_captions column to entries table
-- Stores a JSON map of photo URL -> caption string
-- Safe to run multiple times (IF NOT EXISTS)

ALTER TABLE entries ADD COLUMN IF NOT EXISTS photo_captions JSONB DEFAULT '{}'::jsonb;
