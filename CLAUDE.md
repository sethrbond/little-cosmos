# MY COSMOS — Complete Project Handoff for Claude Code
### v9.1 | March 2026

---

## WHAT THIS IS

"My Cosmos" is a 3D interactive globe web app for personal and shared travel diaries. Started as an anniversary gift ("Our World" — Seth & Rosie's relationship visualized on a spinning globe), now expanding into a multi-user platform where anyone can create their own world, share worlds with others, and build a personal cosmos of interconnected travel experiences.

**Live:** https://our-world-kohl.vercel.app  
**Stack:** React 18 (Vite), Three.js r160 (vanilla, NOT React Three Fiber), Supabase (Postgres + Auth + Storage), Vercel hosting  
**Repo:** GitHub → auto-deploys to Vercel on push

---

## FILE ARCHITECTURE

```
my-cosmos/
  CLAUDE.md              ← this file (project context for Claude Code)
  src/
    OurWorld.jsx          ← 3,379 lines. THE app. Single component, everything inline.
    supabase.js           ← 228 lines. Our World DB (entries + config tables)
    supabaseMyWorld.js    ← 190 lines. My World DB (my_entries + my_config tables)
    worldConfigs.js       ← 264 lines. Palettes, types, scene configs, theme helpers
    WorldSelector.jsx     ← 250 lines. "My Cosmos" globe-orbit world chooser
    App.jsx               ← 27 lines. World mode routing via localStorage
    main.jsx              ← 9 lines. Vite entry point
    geocode.js            ← 32 lines. Nominatim geocoding with debounce
  docs/
    supabase_setup.sql    ← 227 lines. Our World tables + triggers + RLS + storage
    my_world_setup.sql    ← 102 lines. My World tables + triggers + RLS
    COSMOS_ROADMAP_v91.md ← 325 lines. Full roadmap, features, launch plan
  index.html              ← Vite HTML entry
  package.json            ← react 18, three 0.160, @supabase/supabase-js 2.39
  vite.config.js          ← Vite + React plugin
```

---

## HOW THE APP WORKS

### Flow
1. User opens app → `App.jsx` checks `localStorage('worldMode')`
2. If null → renders `WorldSelector.jsx` ("My Cosmos" screen)
3. User clicks a world orb → `localStorage` saves choice → renders `OurWorld.jsx` with `worldMode` prop
4. `OurWorld.jsx` selects palette, types, DB functions, scene colors based on `worldMode`
5. Three.js globe renders with mode-specific theming
6. All CRUD operations route through mode-specific supabase module
7. 🔄 button returns to cosmos screen (unmounts OurWorld, remounts fresh)

### Two Worlds Currently
- **My World** (`worldMode="my"`) — personal solo travel diary. Earth-tone palette (sandstone globe, blue-slate space, green coasts). 12 entry types. No relationship features.
- **Our World** (`worldMode="our"`) — couples travel diary for Seth & Rosie. Rose/lavender palette. 6 entry types. Love thread, love letters, love notes, together/apart tracking, distance line, heart mesh, anniversary detection.

### Custom Palette System
Each world can have custom colors set in Settings → "Theme & Colors". 10 color pickers:
- 6 UI colors (take effect immediately): primary accent, secondary, special/gold, heart, text, background
- 4 scene colors (take effect on reload): space background, globe surface, glow tint, coastlines
- Stored in `config.metadata.customPalette` and `config.metadata.customScene`
- Merged over defaults: `P = { ...baseWorldPalette, ...config.customPalette }`

---

## OurWorld.jsx STRUCTURE (top to bottom)

1. **Imports** (lines 1-13) — React, THREE, aliased DB functions from both supabase modules, worldConfigs imports
2. **Module-level constants** (14-55) — DEFAULT_CONFIG, P (Our World palette fallback), TYPES_DEFAULT (dead code)
3. **Utility functions** (56-200) — `makeSymbolTexture()` (canvas texture generator for 15 marker shapes), `ll2v`, `lerp`, `haversine`, `daysBetween`
4. **Data constants** (200-700) — LAND (1,200 random dots), GEO_LINES (coastline polylines), CITIES (1,067 cities)
5. **Reducer** (707-745) — handles LOAD, ADD, UPDATE, DELETE, ADD_PHOTOS, REMOVE_PHOTO. DB functions injected via `a.db` from dispatch wrapper.
6. **Helper functions** (745-798) — `seasonalHue()`, `getFirstBadges()`
7. **OurWorldErrorBoundary** (class component)
8. **OurWorldInner** (799-2905) — THE main function component:
   - Mode-aware setup (P, SC, TYPES, FIELD_LABELS, db, dispatch wrapper)
   - 50+ useState hooks, 25+ useRef
   - Data loading effect (uses db.loadEntries/loadConfig)
   - Derived data (useMemo: sorted, togetherList, stats, locationGroups, etc.)
   - Three.js scene setup (runs once on [loading] change)
   - Animation loop (markers, glow, particles, seasonal tinting)
   - Marker rebuild effect (creates/destroys Three.js objects per entry)
   - Event handlers (drag, click, wheel, touch, keyboard)
   - JSX: mount div, title, right panel, toolbar, search, filter, stats, detail card, forms, overlays, timeline slider
9. **External components** (2905-3200) — `inpSt`, `navSt`, `renderList`, `TBtn`, `Lbl`, `Fld`, `QuickAddForm`, `DreamAddForm`, `AddForm`, `EditForm`
10. **Export** (3379) — wraps OurWorldInner in ErrorBoundary, passes worldMode/onSwitchWorld props

---

## SUPABASE DETAILS

**URL:** `https://neduoxnmlotrygulngrv.supabase.co`
**Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lZHVveG5tbG90cnlndWxuZ3J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjI3NjgsImV4cCI6MjA4ODUzODc2OH0.KrJtuXbBj-5rmcpByA1leTAjuuD13dw4S-QYtWirpcA`

### Tables (4 current)

**entries** (22 columns) — Our World travel entries  
**config** (9 columns) — Our World settings + metadata JSONB  
**my_entries** (20 columns) — My World entries (no `who`, `love_note`)  
**my_config** (7 columns) — My World settings + metadata JSONB  

### Tables (future, for multi-user)

**worlds** — each world a user creates or joins  
**world_members** — who has access to which world (role: owner/member/viewer)  
**world_invites** — invite tokens for sharing worlds  

### Storage
- Bucket: `photos` (public)
- Our World paths: `{entryId}/{timestamp}-{random}.{ext}`
- My World paths: `my/{entryId}/{timestamp}-{random}.{ext}`

### Critical: updated_at Trigger
Both entry tables have a BEFORE UPDATE trigger that sets `updated_at = NOW()`. If this trigger or the `updated_at` column is missing, ALL updates silently fail. This was the root cause of a 10-prompt photo persistence debugging saga.

---

## CRITICAL TECHNICAL RULES

1. **Hook ordering.** The keyboard `useEffect` MUST come AFTER `stopPlay` and `playStory` `useCallback` declarations. Previous TDZ crash from wrong ordering.

2. **Bracket balance.** 3,379 lines of inline JSX. ONE misplaced bracket = white screen of death. Verify after every edit.

3. **Three.js setup `useEffect` has `[loading]` dep intentionally.** Don't add deps — would create duplicate scenes. New visual objects go in the marker rebuild effect.

4. **Marker rebuild cleans up.** Removes old markers and creates new ones when sliderDate/data/selected/view toggles change. New globe objects must follow this pattern.

5. **Reducer is fire-and-forget.** `saveEntry()` is called without await. For photos, use `savePhotos()`/`readPhotos()` instead — explicit and awaited.

6. **FlyTo formula.** Three.js Euler 'XYZ' applies Rx first then Ry. Correct formulas:
   ```
   rx = atan2(p.y, √(px² + pz²))
   ry = atan2(-p.x, p.z)
   ```
   Plus shortest-path: `ry -= Math.round((ry - rot.current.y) / 2π) * 2π`

7. **World switch = full remount.** Going through cosmos selector unmounts/remounts OurWorld entirely. Three.js scene destroyed and recreated fresh. This is intentional.

8. **Module-level P vs component P.** Module-level P (line 34) is always Our World colors — used by external form components (inpSt, navSt, TBtn, Fld, etc). Component-level P (inside OurWorldInner) switches per world mode and merges custom palette.

9. **Custom palette merges over defaults.** `P = { ...baseP, ...config.customPalette }`. UI colors take effect immediately. Scene colors take effect on reload only.

10. **GitHub filenames are case-sensitive on Vercel (Linux).** `worldConfigs.js` ≠ `worldconfig.js`. This caused multiple deploy failures.

---

## WHAT WORKS (confirmed passing)

- 3D globe with all visual effects (glow, particles, stars, aurora, night shadow)
- Entry CRUD with Supabase persistence
- Photo upload + persistence (both worlds)
- Fly-to navigation (correct formula, proven across 12 cities)
- Unique canvas-texture marker symbols (15 shapes)
- Breathing markers, zoom scaling, depth testing
- Timeline slider with milestones, chapters, day stepping
- Play Our Story / Play My Story
- Detail card (4 tabs, adapted labels per world)
- Love Thread, Constellation, Dream Destinations / Bucket List
- Love Letters, Love Notes (Our World only)
- Stats dashboard (adapted per world)
- Search, favorites, filter, keyboard shortcuts
- Dark mode (persists)
- Custom color palette (10 pickers, persists)
- World selector ("My Cosmos") with orbital camera
- Import/export JSON backup
- Error boundary
- Mobile responsive

---

## KNOWN ISSUES (cosmetic, not blocking)

1. **Forms always use Our World colors** — inpSt, navSt, renderList, TBtn, Fld defined outside component scope. Cards/forms show rose tones in My World. Fix: move inside component.
2. **TYPES_DEFAULT is dead code** (1 line, never referenced)
3. **swipeRef declared but no handlers** (1 line)
4. **firstBadges runs in My World** (returns empty, harmless)

---

## THE VISION: MY COSMOS PLATFORM

The app is evolving from a personal gift into a shareable multi-user platform:

- Each user signs up → gets their own "My World" at the center of their cosmos
- They can create shared worlds ("Our World" with a partner, "Friends Trip 2024", "Family Adventures")
- Shared worlds orbit their center world in the cosmos view
- Users can invite others to shared worlds via invite links
- Each person's data is private (Row Level Security at the database level)
- The cosmos screen becomes a living dashboard of all your worlds

---

## NEXT STEPS — PHASED BUILD PLAN

### Phase 1: Auth & Data Isolation (THE priority)
- Supabase Auth (email + password, email verification)
- user_id column on all tables
- RLS policies: users only see their own data
- Auth.jsx (login/signup/verify screen)
- authContext.js (React context)
- App.jsx auth gate
- Migrate Seth's existing data
- Sign out button

### Phase 2: Onboarding & Polish
- Guided first experience for new users
- Empty state designs
- Form palette fix (My World earth tones)
- Welcome letter screen (Our World gift moment)

### Phase 3: World Creation & Sharing
- "Add a World" → create world modal
- worlds + world_members tables
- Invite link generation + accept flow
- Shared world entries with contributor attribution

### Phase 4: Social Features
- Activity feed, real-time sync
- Trip cards, year-in-review
- Cross-world search

### Phase 5: Scale
- PWA, offline mode
- Pro tier features
- Custom domains

**Full details in `docs/COSMOS_ROADMAP_v91.md`**

---

## DEVELOPMENT HISTORY (abbreviated)

- **Sessions 1-8:** Core globe, entries, photos, timeline, deployment, cities, filters
- **Session 9:** Toasts, stats, recap, stars, mobile, milestones
- **Session 10:** Search, favorites, parallax, error boundary
- **Session 11:** 11 bug fixes from comprehensive code review
- **Session 12:** Love thread, constellation, aurora, dream destinations, tabbed card, love notes
- **Session 13 (this chat, part 2):** FlyTo rotation formula fix (mathematical proof), photo persistence debugging (updated_at trigger root cause), symbol markers, breathing animations, SQL reset
- **Session 14 (Claude Code):** My World mode, world selector, worldConfigs, supabaseMyWorld, ~40 mode-aware edits to OurWorld.jsx
- **Session 15 (this chat, continued):** Fixed WorldSelector crash (Object.assign on readonly), fixed file naming (case sensitivity), expanded entry types to 12, redesigned My World palette (blue-slate scene, earthy globe), custom palette system, "My Cosmos" rename, contrast fixes, comprehensive audit

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
  type: "together",            // Our World: together|special|home-seth|home-rosie|seth-solo|rosie-solo
                               // My World: adventure|road-trip|city|beach|cruise|backpacking|friends|family|event|nature|work|home
  who: "both",                 // Our World: both|seth|rosie. My World: always "solo"
  notes: "Our first trip abroad",
  memories: ["Eiffel Tower at sunset"],
  highlights: ["Best croissants ever"],
  museums: ["Louvre"],
  restaurants: ["Le Comptoir"],
  photos: ["https://supabase-url/photo1.jpg"],
  stops: [{ sid: "s123", city: "Lyon", country: "France", lat: 45.76, lng: 4.83, dateStart: "2023-06-18", dateEnd: "2023-06-19", notes: "Day trip" }],
  musicUrl: "",
  favorite: false,
  loveNote: "",                // Our World only
}
```
