-- enable_realtime.sql — Enable Supabase Realtime on shared world tables
-- Run this in Supabase SQL Editor to enable live updates
--
-- This allows the app to subscribe to changes on entries, comments, and reactions
-- so that shared world users see each other's changes in real-time.

-- Enable realtime for the entries table (shared world entries have world_id set)
ALTER PUBLICATION supabase_realtime ADD TABLE entries;

-- Enable realtime for comments and reactions
ALTER PUBLICATION supabase_realtime ADD TABLE entry_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE entry_reactions;

-- NOTE: If you get "relation already exists in publication", that's fine — it means
-- the table was already added. You can safely ignore that error.
--
-- IMPORTANT: In Supabase Dashboard, go to Database > Replication and ensure
-- "supabase_realtime" publication is enabled. The tables above should appear
-- in the publication list.
--
-- The app filters subscriptions by world_id, so each user only receives
-- changes for the world they're currently viewing.
