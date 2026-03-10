# MY COSMOS — Complete Project Handoff for Claude Code
### v12.0 | March 2026

---

## WHAT THIS IS

"My Cosmos" (formerly "Our World") is a 3D interactive globe web app for personal and shared travel diaries. Started as an anniversary gift, now a multi-user platform where anyone can create worlds, share them with partners/friends/family, and build a personal cosmos of travel experiences.

**Live:** https://littlecosmos.app
**Stack:** React 18 (Vite), Three.js r160 (vanilla, NOT React Three Fiber), Supabase (Postgres + Auth + Storage), Vercel hosting
**Repo:** GitHub → auto-deploys to Vercel on push
**Total codebase:** ~16,200 lines across 29 source files

---

## FILE ARCHITECTURE

```
my-cosmos/
  CLAUDE.md                    ← this file (project context for Claude Code)
  src/
    OurWorld.jsx               ← 5,371 lines. THE app. Single component, everything inline.
    WorldSelector.jsx          ← 1,663 lines. "My Cosmos" cosmos dashboard + world management
    ExportHub.jsx              ← 907 lines. Multi-format export (JSON, CSV, HTML, KML, timeline)
    YearInReview.jsx           ← 833 lines. Animated annual travel recap (10 slides, starfield, counters)
    TravelStats.jsx            ← 764 lines. Deep-dive statistics (heatmaps, charts, patterns, records)
    PhotoMap.jsx               ← 737 lines. 2D SVG world map with photo pins, clustering, lightbox
    supabaseWorlds.js          ← 674 lines. World CRUD, members, invites, comments, reactions
    Achievements.jsx           ← 642 lines. 31 badges across 6 categories, gamification layer
    CinematicOnboarding.jsx    ← 603 lines. First-time user experience with star field + city picker
    EntryForms.jsx             ← 582 lines. Shared UI primitives (TBtn, TBtnGroup, Lbl, Fld) + entry forms + OverlayBoundary
    App.jsx                    ← 494 lines. Auth gate, routing, invite handling, cinematic onboarding
    TripCard.jsx               ← 470 lines. Shareable Instagram-style trip cards with Canvas download
    worldConfigs.js            ← 350 lines. Palettes, types, scene configs per world type
    useRealtimeSync.js         ← 314 lines. Supabase Realtime subscriptions + presence hook
    supabase.js                ← 296 lines. Our World + shared world DB factories
    LandingPage.jsx            ← 281 lines. Pre-login marketing page with feature showcase
    KeyboardShortcuts.jsx      ← 241 lines. Keyboard shortcut reference overlay
    supabaseMyWorld.js         ← 208 lines. My World + friend world (read-only) DB factories
    AuthScreen.jsx             ← 174 lines. Login / signup / forgot password
    WelcomeLetterScreen.jsx    ← 135 lines. Welcome letter display when invited
    SyncIndicator.jsx          ← 86 lines. Real-time connection status dot
    supabaseWelcomeLetters.js  ← 76 lines. Welcome letter DB operations
    supabaseConnections.js     ← 67 lines. Friend connection requests
    AuthContext.jsx            ← 51 lines. React context for Supabase Auth session
    utils.js                   ← 48 lines. Shared utilities (haversine, daysBetween, country flags)
    imageUtils.js              ← 41 lines. Photo thumbnail generation + preloading
    supabaseClient.js          ← 35 lines. Shared Supabase client + withRetry, safeArray, cleanArray
    geocode.js                 ← 34 lines. Nominatim geocoding with debounce
    main.jsx                   ← 16 lines. Vite entry point + SW registration
  public/
    manifest.json              ← PWA manifest (installable on mobile/desktop)
    sw.js                      ← Service worker (cache-first assets, network-first API)
    icons/icon.svg             ← App icon (globe SVG, Android/desktop)
    icons/apple-touch-icon.png ← iOS app icon (180x180 dark globe PNG)
  docs/
    FULL_REBUILD.sql           ← 984 lines. Complete DB setup (idempotent, one-push deploy)
    COSMOS_ROADMAP_v91.md      ← Full roadmap document
    email_templates.html       ← Email templates for invites/connections
  index.html                   ← Vite HTML entry (title: "Little Cosmos") + PWA meta tags
  package.json                 ← react 18, three 0.160, @supabase/supabase-js 2.39
  vite.config.js               ← Vite + React plugin
```

---

## HOW THE APP WORKS

### Flow
1. User opens app → `App.jsx` checks auth state via `AuthContext`
2. If not logged in → renders `AuthScreen.jsx`
3. If brand-new user → shows `CinematicOnboarding.jsx` (star field, city picker, first entry)
4. If has pending welcome letter → shows `WelcomeLetterScreen.jsx`
5. Otherwise → renders `WorldSelector.jsx` ("My Cosmos" screen)
6. User clicks a world orb → zoom transition → renders `OurWorld.jsx` with props
7. `OurWorld.jsx` selects palette, types, DB functions, scene colors based on `worldMode` + `worldType`
8. Three.js globe renders with mode-specific theming
9. All CRUD routes through user-scoped factory DB functions (RLS-protected)
10. 🔄 button returns to cosmos screen (full unmount/remount)

### Four World Types
- **My World** (`worldMode="my"`) — personal solo diary. Earth-tone palette. 12 entry types.
- **Partner World** (`worldType="partner"`) — couples diary. Rose/lavender palette. 6 entry types. Love letters, love notes, love thread, constellation, together/apart tracking, anniversary detection.
- **Friends World** (`worldType="friends"`) — group adventures. Sapphire palette. 8 entry types.
- **Family World** (`worldType="family"`) — family adventures. Terracotta palette. 8 entry types.

### Custom Palette System
Each world has 10 color pickers in Settings → "Theme & Colors":
- 6 UI colors (take effect immediately): primary accent, secondary, special/gold, heart, text, background
- 4 scene colors (take effect on reload): space background, globe surface, glow tint, coastlines, particles, stars
- Stored in `config.metadata.customPalette` and `config.metadata.customScene`
- Module-level `P` is mutated via `window.__cosmosP` so external form components get current world colors

---

## OurWorld.jsx STRUCTURE (top to bottom)

1. **Imports** (lines 1-19) — React, THREE, auth, DB factories, worldConfigs, supabaseWorlds
2. **Module-level constants** (20-49) — DEFAULT_CONFIGs (4 world types), `P = window.__cosmosP`
3. **Utility functions** (50-275) — `makeSymbolTexture()` (15 marker shapes), `ll2v`, `lerp`, `haversine`, `daysBetween`, `todayStr`, `fmtDate`
4. **Data constants** (276-775) — LAND (random dots), COAST_DATA (coastline polylines)
5. **Reducer** (777-815) — handles LOAD, ADD, UPDATE, DELETE, ADD_PHOTOS, REMOVE_PHOTO
6. **Helper functions** (817-843) — `seasonalHue()`, `getFirstBadges()`
7. **OurWorldErrorBoundary** (844-863) — class component error boundary
8. **OurWorldInner** (869-4685) — THE main function component:
   - Mode-aware setup (P, SC, TYPES, FIELD_LABELS, db, dispatch wrapper)
   - 60+ useState hooks, 30+ useRef
   - Auth + data loading effects
   - Realtime subscriptions (entries, comments, reactions)
   - Derived data (useMemo: sorted, togetherList, stats, locationGroups, etc.)
   - Anniversary detection + milestone badge celebration system
   - Three.js scene setup (runs once on `[loading]` change)
   - Animation loop (markers, glow, particles, seasonal tinting, easter egg)
   - Marker rebuild effect
   - Cinema state machine (Play Our Story with photo crossfade)
   - Year-in-Review (4-phase: title → stats → journey → summary with PNG export)
   - Photo Journey (auto-play, crossfade, notes overlay)
   - Event handlers (drag, click, wheel, touch, keyboard)
   - JSX: globe, title, right panel, toolbar, search, filter, stats, detail card, forms, overlays, timeline, onboarding, celebrations
9. **External components** — moved to `EntryForms.jsx`: `inpSt`, `navSt`, `TBtn`, `TBtnGroup`, `Lbl`, `Fld`, `QuickAddForm`, `DreamAddForm`, `AddForm`, `EditForm`, `OverlayBoundary`
10. **Export** — wraps OurWorldInner in ErrorBoundary, passes all world props

---

## SUPABASE DETAILS

**URL:** `https://neduoxnmlotrygulngrv.supabase.co`
**Client:** Shared instance in `supabaseClient.js`

### Tables (11 total)

**Core data:** entries, config (all world types share these via world_id)
**Multi-user:** worlds, world_members, world_invites
**Social:** entry_comments, entry_reactions
**Sharing:** welcome_letters, cosmos_connections

### Storage
- Bucket: `photos` (public read, authenticated write)
- Our World paths: `{entryId}/{timestamp}-{random}.{ext}`
- My World paths: `my/{entryId}/{timestamp}-{random}.{ext}`

### Critical: updated_at Trigger
Entry tables have BEFORE UPDATE triggers that set `updated_at = NOW()`. If missing, ALL updates silently fail.

### DB Setup
Run `docs/FULL_REBUILD.sql` in Supabase SQL Editor — idempotent, creates all tables, triggers, indexes, RLS policies, functions, and storage. Hardened with exception handlers for vault/pg_net extensions.

---

## CRITICAL TECHNICAL RULES

1. **Hook ordering.** The keyboard `useEffect` MUST come AFTER `stopPlay` and `playStory` `useCallback` declarations. Previous TDZ crash from wrong ordering.

2. **Bracket balance.** 5,098 lines of inline JSX. ONE misplaced bracket = white screen of death. Verify after every edit.

3. **Three.js setup `useEffect` has `[loading]` dep intentionally.** Don't add deps — would create duplicate scenes.

4. **Marker rebuild cleans up.** Removes old markers and creates new ones when sliderDate/data/selected/view toggles change. New globe objects must follow this pattern.

5. **Reducer is fire-and-forget.** `saveEntry()` called without await. For photos, use `savePhotos()`/`readPhotos()` — explicit and awaited.

6. **FlyTo formula.** Three.js Euler 'XYZ': `rx = atan2(p.y, √(px²+pz²))`, `ry = atan2(-p.x, p.z)`. Plus shortest-path.

7. **World switch = full remount.** Three.js scene destroyed and recreated fresh. Intentional.

8. **Module-level P uses `window.__cosmosP`.** Mutated in-place by `_paletteBase` useMemo so external form components (`inpSt`, `TBtn`, `Fld`, etc.) get current world colors without being inside the component tree.

9. **Custom palette merges over defaults.** UI colors take effect immediately. Scene colors take effect on reload only.

10. **GitHub filenames are case-sensitive on Vercel (Linux).** `worldConfigs.js` ≠ `worldconfig.js`.

11. **Onboarding version key.** Currently `v3`. Bump to reset all users' first-visit experience.

12. **DB functions use factory pattern.** `createOurWorldDB(userId)`, `createMyWorldDB(userId)`, `createSharedWorldDB(worldId, userId)`, `createFriendWorldDB(friendUserId)`. All inject `user_id`/`world_id` into queries. No standalone DB functions exist.

---

## WHAT WORKS (confirmed)

- Auth (email/password, email verification, password reset)
- Cinematic first-time onboarding with star field + city picker
- 4 world types (My, Partner, Friends, Family) with distinct palettes and features
- World creation, invite links, member management
- Welcome letters for new invitees
- Friend connections with pending request flow
- 3D globe with glow, particles, stars, aurora, night shadow, seasonal tinting, shooting stars, comet arrival animation, pulse rings
- Entry CRUD with Supabase RLS-protected persistence
- Photo upload + persistence + reorder (both worlds)
- Fly-to navigation (correct formula)
- 15 unique canvas-texture marker symbols, breathing animations
- Timeline slider with milestones, chapters, day stepping
- Play Our Story / Play My Story (cinema state machine with photo crossfade)
- Year-in-Review (10-slide animated recap with starfield, counters, charts, photo grid)
- Photo Journey (auto-play, crossfade, notes overlay, progress bar)
- Detail card (4 tabs, adapted labels per world) with Share Card button
- Trip Cards (Instagram-style shareable cards with Canvas API PNG download)
- Love Thread, Constellation, Dream Destinations / Bucket List
- Love Letters, Love Notes (partner worlds only)
- Travel Stats deep-dive (heatmaps, bar charts, trip duration, distance records, year comparison)
- Stats dashboard (adapted per world, expandable with farthest-apart, longest trip)
- Photo Map (2D SVG world map with photo pins, clustering, pan/zoom, lightbox)
- Achievements (31 badges across 6 categories — explorer, countries, distance, types, memory, special)
- Search with marker glow/dimming, favorites, filter, keyboard shortcuts overlay (? key)
- Hover tooltips on markers (city, date, photo peek thumbnail)
- Surprise Me (🎲) random entry fly-to with cinematic zoom
- Milestone badges (5/10/25/50/100 entries, 5/10/25 countries, 1K/10K/25K miles)
- Anniversary auto-celebration with confetti
- "Missing you" / "across the world" distance messages (partner worlds)
- Trip countdown (days until next together)
- Dark mode (auto/light/dark cycling, system preference detection, ThemeProvider + ThemeToggle)
- Custom color palette (10+ pickers, persists)
- Cosmos dashboard with activity feed, cross-world search
- Real-time sync (Supabase Realtime subscriptions, auto-reconnect, presence tracking)
- Sync indicator (green/red connection dot)
- Comments & reactions on shared world entries
- Export Hub (JSON backup, CSV, standalone HTML report, KML/Google Earth, timeline text)
- Error boundaries (OurWorldErrorBoundary, ScreenErrorBoundary, OverlayBoundary on all lazy overlays)
- Mobile responsive
- PWA (installable, service worker, offline shell, iOS/Android icons)
- Friend world viewing (read-only orbs in cosmos, click to explore)
- Cosmos connections (send/accept/decline friend requests, view friend's personal world)
- Landing page (pre-login marketing with feature showcase)
- Escape key closes ALL overlays (22+ modals/panels handled)
- Easter egg ("you are my world" visible when zoomed all the way out on partner worlds)

---

## KNOWN ISSUES (cosmetic, not blocking)

1. **Accessibility is basic** — aria labels on toolbar/buttons/modals, but no keyboard nav for globe or focus trapping in modals.
2. **No automated tests** — manual QA only. No Jest/RTL/E2E tests.
3. **OurWorld.jsx is 5,371 lines** — works but hard to maintain. Future refactor target.
4. **No log aggregation** — 100+ console.error calls with no external monitoring (Sentry/LogRocket).
5. **No entry pagination** — fetches all entries at once. OK at current scale (<200), needs work at 1000+.

### Previously Fixed
- ~~ambientMusicUrl incomplete~~ — FIXED: settings has URL input + Test button, audio syncs via onPlay/onPause/onError
- ~~No error boundary on overlays~~ — FIXED: OverlayBoundary wraps all 6 lazy-loaded components
- ~~Duplicate heartPulse keyframe~~ — FIXED: single definition at 1.06
- ~~Forms use Our World colors in My World~~ — FIXED: module-level P mutated via window.__cosmosP
- ~~Seasonal tinting bug~~ — FIXED: correct ranges confirmed
- ~~my_entries/my_config separate tables~~ — FIXED: consolidated into entries/config with world_id
- ~~Night shadow wrong direction~~ — FIXED: sunAngle formula corrected for ll2v coordinate system

---

## ENTRY DATA MODEL

```javascript
{
  id: "e1709312345678",        // "e" + timestamp
  city: "Paris",
  country: "France",
  lat: 48.8566, lng: 2.3522,
  dateStart: "2023-06-15",     // YYYY-MM-DD strings
  dateEnd: "2023-06-22",
  type: "together",            // Partner: together|special|home-seth|home-rosie|seth-solo|rosie-solo
                               // My World: adventure|road-trip|city|beach|cruise|backpacking|friends|family|event|nature|work|home
                               // Friends: group-trip|meetup|concert|road-trip|adventure|food-crawl|sports|hangout
                               // Family: vacation|reunion|holiday|road-trip|visit|milestone|adventure|home
  who: "both",                 // Partner: both|seth|rosie. All others: "solo"
  notes: "Our first trip abroad",
  memories: ["Eiffel Tower at sunset"],
  highlights: ["Best croissants ever"],
  museums: ["Louvre"],
  restaurants: ["Le Comptoir"],
  photos: ["https://supabase-url/photo1.jpg"],
  stops: [{ sid: "s123", city: "Lyon", country: "France", lat: 45.76, lng: 4.83, dateStart: "...", dateEnd: "...", notes: "Day trip" }],
  musicUrl: "",
  favorite: false,
  loveNote: "",                // Partner worlds only
}
```

---

## DEVELOPMENT HISTORY (abbreviated)

- **Sessions 1-8:** Core globe, entries, photos, timeline, deployment, cities, filters
- **Session 9:** Toasts, stats, recap, stars, mobile, milestones
- **Session 10:** Search, favorites, parallax, error boundary
- **Session 11:** 11 bug fixes from code review
- **Session 12:** Love thread, constellation, aurora, dream destinations, tabbed card, love notes
- **Session 13:** FlyTo formula fix, photo persistence debugging, symbol markers, breathing animations
- **Session 14:** My World mode, world selector, worldConfigs, supabaseMyWorld
- **Session 15:** WorldSelector fixes, expanded types to 12, My World palette, custom palette system, "My Cosmos" rename
- **Session 16 (Claude Code):** Auth system, cinematic onboarding, world creation/sharing, invite flow, welcome letters, friend connections, 4 world types, RLS, FULL_REBUILD.sql
- **Session 17 (Claude Code):** Year-in-Review cinematic, Play Our Story cinema, anniversary celebrations, realtime sync, photo journey, activity feed, comments/reactions UI
- **Session 18 (Claude Code):** Full audit — 7 bug fixes (photo reorder, pulse animation, starTint, firstTrip/lastTrip, activity feed nav, glow colors, photo slideshow), milestone badges, enhanced onboarding per world type, onboard version reset, 300+ lines dead code removed, User-Agent update
- **Session 19 (Claude Code):** 11 new components built via 10 parallel agents — Year-in-Review (885 lines, 10-slide animated recap), TripCard (470 lines, Instagram-style cards), TravelStats (755 lines, deep-dive with heatmaps/charts), PhotoMap (735 lines, SVG world map with pins), Achievements (626 lines, 31 badges), ExportHub (818 lines, 5 export formats), ThemeProvider/ThemeToggle (241 lines, dark mode system), KeyboardShortcuts (241 lines), useRealtimeSync (326 lines, Supabase Realtime + presence), SyncIndicator (92 lines). Full audit: fixed anniversary deps, setConfig deps, loadWorldEntryCounts N+1, dead code, duplicate title logic. +5,284 lines.
- **Session 20 (Claude Code):** Visual effects sprint — shooting stars (5-pool meteors), aurora mood shift (entry type color blending), search glow (marker pulse/dim), comet arrival (Bezier arc + burst particles + flash), night shadow (GLSL shader, UTC sun position), hover tooltips (photo peek), Surprise Me button (🎲 cinematic zoom), keyboard shortcut R (random). Performance audit: cached THREE.Color in aurora, reused Vector3 in meteors, fixed _baseOpacity race condition, added precision highp float to shader, skip-when-stable aurora optimization.
- **Session 21 (Claude Code):** Production polish sprint — Fixed night shadow sun direction (sunAngle formula corrected for ll2v coords). Restored TBtnGroup toolbar with chevron indicator. PWA setup (manifest.json, service worker, SVG/PNG icons, meta tags, SW registration). Accessibility pass (aria-label on TBtn/TBtnGroup, role=toolbar, role=dialog on confirm modal). Comprehensive audit (16,200 lines, 29 files): fixed heartPulse duplicate, extended Escape handler to close all 22+ modals, OverlayBoundary error boundary on 6 lazy components, ambient music state sync + URL validation + Test button, iOS apple-touch-icon PNG. Stale state audit: all 55 useState, 29 useRef, 22 useCallback, 28 useMemo confirmed active — zero dead code. Confirmed friend world viewing + cosmos connections ARE fully wired (was not a bug). Updated CLAUDE.md to v12.
