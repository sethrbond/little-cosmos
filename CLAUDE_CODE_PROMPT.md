Read CLAUDE.md first — it contains the complete project context, architecture, technical rules, current state, and build plan. Then read docs/COSMOS_ROADMAP_v91.md for the full feature roadmap and phased launch plan.

After that, read every source file in the project:
- src/OurWorld.jsx (3,379 lines — the main app)
- src/supabase.js (Our World DB operations)
- src/supabaseMyWorld.js (My World DB operations)
- src/worldConfigs.js (palettes, types, scene configs, theme helpers)
- src/WorldSelector.jsx (cosmos world chooser)
- src/App.jsx (routing)
- src/main.jsx (entry point)
- src/geocode.js (geocoding)
- docs/supabase_setup.sql (Our World database schema)
- docs/my_world_setup.sql (My World database schema)
- package.json
- vite.config.js
- index.html

Once you have read and understood everything — the full codebase, the development history, the architecture decisions, the technical rules, the known issues, the vision, and the phased build plan — do the following:

1. Confirm you understand the complete picture: what the app does today, how it works technically, what's been built across 15 sessions, what the known issues are, and where it's headed.

2. Conduct a complete code audit of all source files. Check for:
   - Import/export alignment across all files
   - Any references to functions, variables, or types that don't exist
   - Hook ordering violations (keyboard useEffect must come after stopPlay/playStory)
   - Bracket balance in OurWorld.jsx
   - Palette key coverage (all keys in module-level P must exist in both world palettes)
   - Dead code that should be cleaned up
   - Any potential runtime errors (accessing properties on undefined, type mismatches)
   - Conditional rendering completeness (all Our World relationship features wrapped in !isMyWorld)
   - Database field alignment (supabase.js fields match SQL schema, supabaseMyWorld.js fields match my_world SQL schema)

3. Report any bugs, issues, or inconsistencies found.

4. Then present the complete path forward: a tiered deployment plan with specific tasks for each phase, starting from where we are now and ending with the app being ready for beta testing. The phases are:
   - Phase 1: Authentication & Data Isolation (Supabase Auth, user_id on all tables, RLS, auth UI, data migration)
   - Phase 2: Onboarding & Polish (guided first experience, form palette fix, empty states, welcome screen)
   - Phase 3: World Creation & Sharing (create worlds, invite links, shared world entries, contributor attribution)
   - Phase 4: Social & Engagement (activity feed, real-time sync, trip cards, cross-world search)
   - Phase 5: Scale & Sustainability (PWA, offline, pro tier)

For each phase, list the exact files to create or modify, the exact database changes needed, and the verification steps to confirm it works.

The immediate goal is Phase 1 — getting auth working so the app can be shared with other people. Everything else follows from that. Let's build this.
