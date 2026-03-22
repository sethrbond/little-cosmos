# MY COSMOS — Complete Project Handoff for Claude Code
### v15.0 | March 2026

---

## WHAT THIS IS

"My Cosmos" (formerly "Our World") is a 3D interactive globe web app for personal and shared travel diaries. Started as an anniversary gift, now a multi-user platform where anyone can create worlds, share them with partners/friends/family, and build a personal cosmos of travel experiences.

**Live:** https://littlecosmos.app
**Stack:** React 18 (Vite), Three.js r160 (vanilla, NOT React Three Fiber), Supabase (Postgres + Auth + Storage), Vercel hosting
**Repo:** GitHub → auto-deploys to Vercel on push
**Total codebase:** ~25,062 lines across 66 source files
**Tests:** 286 tests across 13 files (Vitest)

---

## FILE ARCHITECTURE

```
my-cosmos/
  CLAUDE.md                    ← this file (project context for Claude Code)
  src/
    OurWorld.jsx               ← 3,690 lines. Main globe component (state container + JSX renderer)
    WorldSelector.jsx          ← 1,886 lines. "My Cosmos" cosmos dashboard + world management
    ExportHub.jsx              ← 1,953 lines. Multi-format export + import (JSON, CSV, HTML, KML, timeline, Google Maps, EXIF)
    LandingPage.jsx            ← 1,156 lines. Pre-login marketing page with story picker, testimonials
    YearInReview.jsx           ← 834 lines. Animated annual travel recap (10 slides, starfield, counters)
    useGlobeScene.js           ← 771 lines. Three.js scene setup, globe, glow, particles, stars, aurora, night shadow, animation loop
    TravelStats.jsx            ← 770 lines. Deep-dive statistics (heatmaps, charts, patterns, records)
    PhotoMap.jsx               ← 744 lines. 2D SVG world map with photo pins, clustering, lightbox
    DetailCard.jsx             ← 725 lines. Entry detail card (4 tabs, Share Card button)
    Milestones.jsx             ← 710 lines. Sentimental milestones & reflections (all world types)
    supabaseWorlds.js          ← 709 lines. World CRUD, members, invites, comments, reactions
    App.jsx                    ← 681 lines. Auth gate, routing, invite handling, lazy loading
    CinematicOnboarding.jsx    ← 612 lines. First-time user experience with star field + city picker
    formComponents.jsx         ← 601 lines. Form components (TBtn, TBtnGroup, Lbl, Fld, QuickAddForm, etc.)
    worldConfigs.js            ← 508 lines. Palettes, types, scene configs per world type
    useGlobeMarkers.js         ← 505 lines. Marker creation, rebuild, symbol textures, breathing animations
    coastlineData.js           ← 501 lines. LAND dots + COAST_DATA polylines (extracted from OurWorld)
    TripJournal.jsx            ← 485 lines. Trip journal overlay
    SettingsPanel.jsx          ← 465 lines. Settings panel, project CRUD, data management
    TripCard.jsx               ← 450 lines. Shareable Instagram-style trip cards with Canvas download
    importTimeline.js          ← 390 lines. Google Maps Timeline import (3 Takeout formats)
    supabase.js                ← 355 lines. Our World + shared world DB factories
    useRealtimeSync.js         ← 330 lines. Supabase Realtime subscriptions + presence hook
    RecapOverlay.jsx           ← 316 lines. Recap overlay
    useGlobeInteraction.js     ← 303 lines. Drag, click, wheel, touch, keyboard event handlers
    supabaseMyWorld.js         ← 265 lines. My World + friend world (read-only) DB factories
    KeyboardShortcuts.jsx      ← 251 lines. Keyboard shortcut reference overlay (? key)
    NotificationCenter.jsx     ← 237 lines. In-app notification panel
    offlineQueue.js            ← 232 lines. Offline action queue
    TimeCapsuleOverlay.jsx     ← Time capsules (notes that unlock on future dates)
    WorldToolbar.jsx           ← Redesigned toolbar (44px buttons, glass effect)
    ShareCard.js               ← Canvas-based shareable globe screenshot with stats
    NotificationPrompt.jsx     ← Push notification permission prompt (shows after 5+ entries)
    ReunionToast.jsx           ← Reunion detection toast (partner comes online)
    LoveLetterOverlay.jsx      ← Love letters (extended to all world types)
    OnboardingOverlay.jsx      ← Onboarding overlay
    SearchPanel.jsx            ← Search panel
    StatsOverlay.jsx           ← Stats overlay
    CinemaOverlay.jsx          ← Cinema/play overlay UI (extracted from OurWorld)
    GalleryPanel.jsx           ← Gallery panel
    DreamPanel.jsx             ← Dream destinations panel
    TimelineSlider.jsx         ← Timeline slider
    EntryForms.jsx             ← Entry forms (legacy, shares with formComponents)
    EntryTemplates.jsx         ← Entry templates
    SyncIndicator.jsx          ← Real-time connection status dot
    AuthScreen.jsx             ← Login / signup / forgot password
    WelcomeLetterScreen.jsx    ← Welcome letter display when invited
    AuthContext.jsx            ← React context for Supabase Auth session
    formUtils.jsx              ← Form utility components
    uiPrimitives.jsx           ← UI primitive components
    useToasts.js               ← Modal state reducer (consolidates 24 modal useState into one)
    usePlayStory.js            ← Cinema state machine (Play Our Story with photo crossfade)
    useCelebrations.js         ← Celebration detection hooks
    useNotifications.js        ← Notification hooks
    entryReducer.js            ← Entry CRUD reducer (LOAD, ADD, UPDATE, DELETE, ADD_PHOTOS, REMOVE_PHOTO)
    cosmosGetP.js              ← Palette getter utility
    pushSubscription.js        ← Web Push subscription management (PushManager API, Supabase storage)
    supabaseClient.js          ← Shared Supabase client + withRetry, safeArray, cleanArray
    supabaseWelcomeLetters.js  ← Welcome letter DB operations
    supabaseConnections.js     ← Friend connection requests
    utils.js                   ← Shared utilities (haversine, daysBetween, country flags)
    imageUtils.js              ← Photo thumbnail generation + preloading
    exifParser.js              ← EXIF metadata extraction from photos
    geocode.js                 ← Nominatim geocoding with debounce
    debug.js                   ← Debug utilities
    main.jsx                   ← Vite entry point + SW registration
  public/
    manifest.json              ← PWA manifest (installable on mobile/desktop)
    sw.js                      ← Service worker (cache-first assets, network-first API, push events)
    icons/icon.svg             ← App icon (globe SVG)
    icons/apple-touch-icon.png ← iOS app icon (180x180 dark globe PNG)
  supabase/
    functions/send-push/       ← Edge function: deliver Web Push notifications
    functions/daily-digest/    ← Cron job: "On This Day" push at 9am daily
    functions/monthly-recap/   ← Monthly email digest via Resend
  docs/
    FULL_REBUILD.sql           ← Complete DB setup (idempotent, one-push deploy)
    push_subscriptions.sql     ← Push subscription endpoint table schema
    COSMOS_ROADMAP_v91.md      ← Full roadmap document
    email_templates.html       ← Email templates for invites/connections
  index.html                   ← Vite HTML entry (title: "Little Cosmos") + PWA meta tags
  package.json                 ← react 18, three 0.160, @supabase/supabase-js 2.39
  vite.config.js               ← Vite + React plugin + terser (mangle:false)
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
10. Back button returns to cosmos screen (full unmount/remount)

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

## OurWorld.jsx STRUCTURE (after extraction)

OurWorld is now primarily a **state container + JSX renderer**. Heavy lifting lives in extracted hooks:

1. **Imports** — React, THREE, auth, DB factories, worldConfigs, extracted hooks
2. **Module-level constants** — DEFAULT_CONFIGs (4 world types), `P = window.__cosmosP`
3. **OurWorldErrorBoundary** — class component error boundary
4. **OurWorldInner** (~3,500 lines) — main function component:
   - Mode-aware setup (P, SC, TYPES, FIELD_LABELS, db, dispatch wrapper)
   - ~190 hook calls (down from ~208 after useToasts consolidation)
   - Auth + data loading effects
   - Realtime subscriptions (entries, comments, reactions)
   - Derived data (useMemo: sorted, togetherList, stats, locationGroups, etc.)
   - Anniversary detection + milestone badge celebration system
   - JSX: globe, title, right panel, toolbar, search, filter, stats, detail card, forms, overlays, timeline, onboarding, celebrations

### Extracted Hooks (the heavy lifting)
- **useGlobeScene** (771 lines) — Three.js scene lifecycle: globe geometry, glow, particles, stars, aurora, night shadow shader, animation loop
- **useGlobeMarkers** (505 lines) — Marker creation/rebuild, 15 canvas-texture symbol shapes, breathing animations
- **useGlobeInteraction** (303 lines) — Drag, click, wheel, touch, keyboard event handlers
- **usePlayStory** — Cinema state machine (Play Our Story/My Story with photo crossfade)
- **useToasts** — Single reducer managing 24 modal states (replaces 24 separate useState calls, removed 48 hooks)
- **entryReducer** — Entry CRUD reducer (LOAD, ADD, UPDATE, DELETE, ADD_PHOTOS, REMOVE_PHOTO)

All hooks use the **factory/DI pattern** — they receive deps as objects, making them testable and decoupled.

---

## SUPABASE DETAILS

**URL:** `https://neduoxnmlotrygulngrv.supabase.co`
**Client:** Shared instance in `supabaseClient.js`

### Tables (11 total)

**Core data:** entries, config (all world types share these via world_id)
**Multi-user:** worlds, world_members, world_invites
**Social:** entry_comments, entry_reactions
**Sharing:** welcome_letters, cosmos_connections
**Notifications:** push_subscriptions (schema ready, not yet deployed)

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

1. **TDZ is SOLVED via terser with mangle:false.** The vite.config.js uses `minify: 'terser'` with `terserOptions: { mangle: false }`. This prevents variable renaming that caused 14+ production TDZ crashes. **DO NOT revert to esbuild minification.** If this config is changed, all the old TDZ rules (no new hooks, no new imports, no lazy declarations) become critical again.

2. **Hook ordering.** Forward references in OurWorldInner have been reordered so declarations appear before usage. Keep this pattern — declare before use.

3. **Bracket balance.** ~3,690 lines of inline JSX. ONE misplaced bracket = white screen of death. Verify after every edit.

4. **Three.js setup is in useGlobeScene.** The `[loading]` dep is intentional — don't add deps or it creates duplicate scenes.

5. **Marker rebuild is in useGlobeMarkers.** Removes old markers and creates new ones when sliderDate/data/selected/view toggles change.

6. **Reducer is fire-and-forget.** `saveEntry()` called without await. For photos, use `savePhotos()`/`readPhotos()` — explicit and awaited.

7. **FlyTo formula.** Three.js Euler 'XYZ': `rx = atan2(p.y, sqrt(px^2+pz^2))`, `ry = atan2(-p.x, p.z)`. Plus shortest-path.

8. **World switch = full remount.** Three.js scene destroyed and recreated fresh. WebGL context is force-released. Intentional.

9. **Module-level P uses `window.__cosmosP`.** Mutated in-place by `_paletteBase` useMemo so external form components get current world colors.

10. **Custom palette merges over defaults.** UI colors take effect immediately. Scene colors take effect on reload only.

11. **GitHub filenames are case-sensitive on Vercel (Linux).** `worldConfigs.js` ≠ `worldconfig.js`.

12. **Onboarding version key.** Currently `v3`. Bump to reset all users' first-visit experience.

13. **DB functions use factory pattern.** `createOurWorldDB(userId)`, `createMyWorldDB(userId)`, `createSharedWorldDB(worldId, userId)`, `createFriendWorldDB(friendUserId)`. All inject `user_id`/`world_id` into queries.

14. **useToasts reducer.** Modal state is managed by a single reducer in `useToasts.js`. To add a new modal, add a case to the reducer — do NOT add a new useState to OurWorldInner.

15. **ShareCard.js** is a canvas-based utility (not a React component). It generates a PNG screenshot of the globe with stats overlay.

16. **Testing production builds.** Always `npm run build` + `npx vite preview` in a real browser before pushing.

---

## WHAT WORKS (confirmed)

- Auth (email/password, email verification moved to post-onboarding as non-blocking banner)
- Cinematic first-time onboarding with star field + city picker
- 4 world types (My, Partner, Friends, Family) with distinct palettes and features
- World creation, invite links, member management
- Welcome letters for new invitees (all world types with appropriate framing)
- Love letters (extended to all world types)
- Friend connections with pending request flow
- 3D globe with glow, particles, stars, aurora, night shadow, shooting stars, comet arrival animation, pulse rings
- Entry CRUD with Supabase RLS-protected persistence
- Photo upload + persistence + reorder (both worlds)
- Fly-to navigation (correct formula)
- 15 unique canvas-texture marker symbols, breathing animations
- Timeline slider with milestones, chapters, day stepping
- Play Our Story / Play My Story (cinema state machine with photo crossfade)
- Year-in-Review (10-slide animated recap with starfield, counters, charts, photo grid)
- Photo Journey (auto-play, crossfade, notes overlay, progress bar)
- Detail card (4 tabs, adapted labels per world) with Share Card button
- Share Card (canvas-based globe screenshot with stats overlay PNG)
- Trip Cards (Instagram-style shareable cards with Canvas API PNG download)
- Love Thread, Constellation, Dream Destinations / Bucket List
- Love Letters, Love Notes (partner worlds; letters extended to all types)
- Travel Stats deep-dive (heatmaps, bar charts, trip duration, distance records, year comparison)
- Stats dashboard (adapted per world, expandable with farthest-apart, longest trip)
- Photo Map (2D SVG world map with photo pins, clustering, pan/zoom, lightbox)
- Milestones (sentimental moments — all world types, not just partner)
- Search with marker glow/dimming, favorites, filter, keyboard shortcuts overlay (? key)
- Hover tooltips on markers (city, date, photo peek thumbnail)
- Surprise Me random entry fly-to with cinematic zoom
- Milestone badges (5/10/25/50/100 entries, 5/10/25 countries, 1K/10K/25K miles)
- Anniversary auto-celebration with confetti (all world types)
- Anniversary Replay / "On This Day" cards with type-aware messaging
- Time Capsules (write notes that unlock on a future date with countdown)
- "Missing you" / "across the world" distance messages (partner worlds)
- Trip countdown (days until next together)
- Personalized labels with actual partner/group names from config
- Emotionally resonant entry prompts for all world types
- Browser notifications when partner adds entry to shared world
- Notification Center (in-app notification panel)
- Push notification prompt (after 5+ entries)
- Dark mode (auto/light/dark cycling, system preference detection)
- Custom color palette (10+ pickers, persists)
- Cosmos dashboard with activity feed, cross-world search
- Real-time sync (Supabase Realtime subscriptions, auto-reconnect, presence tracking)
- Reunion toast (partner comes online detection)
- Sync indicator (green/red connection dot)
- Comments & reactions on shared world entries
- Export Hub (JSON backup, CSV, standalone HTML report, KML/Google Earth, timeline text)
- Import: Google Maps Timeline (3 Takeout formats), CSV, EXIF photo import
- Error boundaries (OurWorldErrorBoundary, ScreenErrorBoundary, OverlayBoundary on all lazy overlays)
- Mobile responsive with touch targets, safe areas, haptics, landscape support
- PWA (installable, service worker, offline shell, push event handling, iOS/Android icons)
- Friend world viewing (read-only orbs in cosmos, click to explore)
- Cosmos connections (send/accept/decline friend requests, view friend's personal world)
- Landing page (story picker, testimonials, world type showcase, conversion-optimized)
- Escape key closes ALL overlays (22+ modals/panels handled)
- Touch tooltips on globe (long-press shows city/date/photo peek, auto-dismisses)
- Pinch-to-zoom on WorldSelector cosmos view
- Save error toasts (withRetry throws, reducer catches, toast displays)
- Redesigned toolbar (44px uniform buttons, glass backdrop-blur, hover states)
- Auth loading timeout (8s safety net prevents infinite spinner)
- Easter egg ("you are my world" visible when zoomed all the way out on partner worlds)

---

## KNOWN ISSUES (cosmetic, not blocking)

1. **Accessibility is basic** — aria labels on toolbar/buttons/modals, focus trapping in settings/forms, but no keyboard nav for globe.
2. **No log aggregation** — console.error calls with no external monitoring (Sentry/LogRocket).
3. **No entry pagination** — fetches all entries at once. OK at current scale (<200), needs work at 1000+.
4. **Push notifications not deployed** — client-side is wired, server-side edge functions need VAPID keys + deployment.

### Previously Fixed
- ~~TDZ crashes~~ — FIXED: terser with mangle:false, forward references reordered (2026-03-22)
- ~~OurWorld too large (5,400 lines)~~ — FIXED: extracted to 3,690 lines via hooks (2026-03-22)
- ~~208 hooks in OurWorldInner~~ — FIXED: consolidated modal state via useToasts reducer, now ~190 (2026-03-22)
- ~~White screen on world switch~~ — FIXED: force WebGL context release + reset error boundaries (2026-03-22)
- ~~Legacy entries world_id NULL~~ — FIXED: backfill_world_id.sql run March 2026
- ~~Security patch needed~~ — FIXED: security_patch.sql run March 2026
- ~~ambientMusicUrl incomplete~~ — FIXED: settings has URL input + Test button
- ~~No error boundary on overlays~~ — FIXED: OverlayBoundary wraps all lazy-loaded components
- ~~Duplicate heartPulse keyframe~~ — FIXED: single definition
- ~~Forms use Our World colors in My World~~ — FIXED: module-level P mutated via window.__cosmosP
- ~~Night shadow wrong direction~~ — FIXED: sunAngle formula corrected

---

## ENTRY DATA MODEL

```javascript
{
  id: "e-1709312345678",       // "e-" + timestamp
  city: "Paris",
  country: "France",
  lat: 48.8566, lng: 2.3522,
  dateStart: "2023-06-15",     // YYYY-MM-DD strings
  dateEnd: "2023-06-22",
  type: "together",            // Partner: together|special|home-seth|home-rosie|seth-solo|rosie-solo
                               // My World: adventure|road-trip|city|beach|cruise|backpacking|friends|family|event|nature|work|home
                               // Friends: group-trip|weekend|night-out|hangout|concert|sports|food|reunion|adventure|milestone
                               // Family: family-trip|holiday|gathering|celebration|road-trip|outdoors|beach|tradition|milestone|home
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
- **Session 18 (Claude Code):** Full audit — 7 bug fixes, milestone badges, enhanced onboarding per world type, 300+ lines dead code removed
- **Session 19 (Claude Code):** 11 new components — Year-in-Review, TripCard, TravelStats, PhotoMap, Achievements, ExportHub, dark mode, KeyboardShortcuts, useRealtimeSync, SyncIndicator. +5,284 lines.
- **Session 20 (Claude Code):** Visual effects sprint — shooting stars, aurora mood shift, search glow, comet arrival, night shadow shader, hover tooltips, Surprise Me button
- **Session 21 (Claude Code):** Production polish — night shadow fix, PWA setup, accessibility pass, comprehensive audit (16,200 lines, 29 files), OverlayBoundary, ambient music
- **Session 22 (Claude Code):** UX polish + mobile — security patch SQL, backfill SQL, toast animations, mobile touch targets, auth transitions, route-level code splitting, landing page rewrite
- **Session 23 (Claude Code):** Major extraction + features — OurWorld 5,793→3,690 lines (extracted useGlobeScene, useGlobeMarkers, useGlobeInteraction, usePlayStory, useToasts, entryReducer, CinemaOverlay, coastlineData). TDZ permanently fixed with terser mangle:false. New features: Time Capsules, ShareCard, WorldToolbar redesign, NotificationCenter, Anniversary Replay, personalized labels, emotionally resonant prompts, browser notifications, push subscription, love letters for all world types, milestones/celebrations for all world types. Landing page conversion improvements. Mobile polish. Globe visual tweaks. White screen fix on world switch.
