# Little Cosmos 🌍

A private 3D globe where couples, friends, and families collect their memories in space. Every trip becomes a glowing marker. Hide love letters at coordinates. Watch your story play back as a cinematic journey. Discover time capsules that unlock on future dates.

**Live at [littlecosmos.app](https://littlecosmos.app)**

## Features

- **3D Interactive Globe** — WebGL globe with aurora, shooting stars, 12-layer parallax glow, night/day shadow, and comet animations
- **4 World Types** — Partner (romantic), Friends (the crew), Family (generations), Personal (solo)
- **Play Story** — Cinematic auto-fly through entries with photos, notes, and ambient music
- **Hidden Letters** — Leave notes at coordinates for others to discover by exploring the globe
- **Time Capsules** — Write messages locked until a future date with golden sealed markers
- **Anniversary Replay** — "1 year ago today, you were in Barcelona" with instant replay
- **Milestones** — Auto-detected achievements personalized per world type and partner names
- **Google Maps Import** — Upload Takeout data and watch years of travel light up instantly
- **Photo EXIF Import** — Drop vacation photos, entries created from GPS metadata
- **Real-time Collaboration** — Presence tracking, reunion toasts, comments, reactions
- **Year in Review** — Animated cinematic recap of your travel year
- **Offline-First** — IndexedDB queue persists mutations, flushes on reconnect
- **PWA** — Installable on mobile with push notification support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 (vanilla, no framework) |
| 3D | Three.js (custom globe, markers, particles, aurora, comets) |
| Backend | Supabase (Postgres + RLS, Auth, Realtime, Storage, Edge Functions) |
| Build | Vite 5 + Terser |
| Hosting | Vercel (auto-deploy from main) |
| PWA | Service Worker, push notifications, offline queue |

Only 4 runtime dependencies: React, React-DOM, Three.js, Supabase.

## Getting Started

```bash
git clone https://github.com/sethrbond/our-world.git
cd our-world
cp .env.example .env    # add your Supabase credentials
npm install
npm run dev             # local dev server
npm test                # 286 tests across 13 files
npm run build           # production build
```

## Architecture

~25,000 lines across 64 modules.

### World Types

| World | Audience | Unique Features |
|---|---|---|
| **Partner** | Couples | Love letters, together/apart tracking, constellation mode, reunion toasts |
| **Personal** | Solo | Bucket list, dream destinations, "dear future me" letters |
| **Friends** | Groups | Crew notes, group milestones, shared reactions |
| **Family** | Family | Generational memories, tradition tracking, family milestones |

### Key Patterns

- **Custom React hooks** — Globe scene, markers, interaction, play story, toasts, celebrations, realtime sync all composed as hooks
- **Modal state consolidation** — 24 modal booleans managed by a single `useReducer` inside the toast system
- **Lazy-loaded overlays** — 16 components code-split via `React.lazy()`
- **RLS-protected data** — All data isolation enforced at the Postgres level
- **Offline-first** — IndexedDB mutation queue with exponential backoff retry
- **Factory functions with DI** — Enables testing without mocks

### Module Map

```
src/
├── App.jsx                 # Routing, auth, world selection
├── OurWorld.jsx            # Main globe experience (3,500 lines)
├── WorldSelector.jsx       # Cosmos dashboard with orbiting worlds
├── LandingPage.jsx         # Marketing homepage with demo globe
├── CinematicOnboarding.jsx # First-time starfield experience
│
├── useGlobeScene.js        # Three.js scene setup, atmosphere, stars
├── useGlobeMarkers.js      # Entry markers, love thread, constellation
├── useGlobeInteraction.js  # Pointer, touch, zoom, flyTo, screenshot
├── usePlayStory.js         # Cinematic story playback
├── useToasts.js            # Toast system + consolidated modal state
├── useRealtimeSync.js      # Supabase Realtime subscriptions + presence
├── useCelebrations.js      # Anniversary, milestones, On This Day
│
├── supabaseClient.js       # Client + retry, safe arrays
├── supabase.js             # DB factory (Our World / shared)
├── supabaseMyWorld.js      # DB factory (My World / groups)
├── supabaseWorlds.js       # World CRUD, members, invites (31 exports)
├── offlineQueue.js         # IndexedDB offline mutation queue
│
├── ExportHub.jsx           # Import/export (JSON, CSV, HTML, KML, EXIF, Google Timeline)
├── importTimeline.js       # Google Maps Takeout parser (3 format versions)
├── exifParser.js           # JPEG EXIF GPS extractor
│
├── worldConfigs.js         # Types, palettes, milestones per world type
├── formComponents.jsx      # Entry forms with world-type-aware prompts
├── TimeCapsuleOverlay.jsx  # Time capsule creation and reveal
├── LoveLetterOverlay.jsx   # Universal letter system (all world types)
│
├── DetailCard.jsx          # Entry viewer with photos, comments, reactions
├── WorldToolbar.jsx        # Glassmorphism toolbar with category flyouts
├── SearchPanel.jsx         # Full-text search with date/type filters
├── SettingsPanel.jsx       # World config, palette, account management
│
├── YearInReview.jsx        # Animated yearly recap
├── TravelStats.jsx         # Analytics dashboard
├── Milestones.jsx          # Achievement badges
├── RecapOverlay.jsx        # Cinematic recap overlay
└── 30+ more modules...
```

### Database

11 PostgreSQL tables with Row Level Security. Schema in `docs/FULL_REBUILD.sql`.

### Server-Side

Supabase Edge Functions (Deno) for:
- `send-push` — Web Push notification delivery
- `daily-digest` — "On This Day" daily push at 9am
- `monthly-recap` — Monthly email digest via Resend

## Deployment

Hosted on Vercel with auto-deploy from main. PWA-installable on iOS and Android.

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `VITE_VAPID_PUBLIC_KEY` | Web Push VAPID public key (optional) |
