# Little Cosmos

A 3D interactive travel journal where every trip becomes a glowing marker on your personal globe.

Live at **littlecosmos.app**

## Tech Stack

- **React 18** — UI framework
- **Three.js** — 3D globe rendering (vanilla, not React Three Fiber)
- **Supabase** — PostgreSQL database, auth, file storage, realtime sync
- **Vite 5** — Build tooling

Only 4 runtime dependencies.

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Fill in your Supabase URL and anon key

# Start dev server
npm run dev

# Run tests
npm test

# Production build
npm run build
```

## Architecture

### World Types

| World | Audience | Features |
|---|---|---|
| **Our World** | Couples | Love letters, together/apart tracking, constellation mode |
| **My World** | Solo | Bucket list, dream destinations, 12 entry types |
| **Friends** | Groups | Shared entries, comments, reactions |
| **Family** | Family | Family milestones, shared memories |

### Module Structure

```
src/
├── App.jsx              # Routing, auth, world selection
├── OurWorld.jsx         # Main globe experience (Three.js scene, entries, UI)
├── WorldSelector.jsx    # Cosmos dashboard with orbiting world selection
├── EntryForms.jsx       # Entry creation/editing forms
├── worldConfigs.js      # World type definitions, palettes, entry types
│
├── supabaseClient.js    # Supabase client + utilities (retry, safe arrays)
├── supabase.js          # DB factory for Our World / shared worlds
├── supabaseMyWorld.js   # DB factory for My World / group worlds
├── supabaseWorlds.js    # World CRUD, members, invites, sharing
├── supabaseConnections.js # Friend request system
├── supabaseWelcomeLetters.js # Welcome letters for invitees
│
├── useRealtimeSync.js   # Supabase Realtime subscriptions + presence
├── offlineQueue.js      # IndexedDB offline mutation queue
│
├── AuthContext.jsx       # Auth state context
├── AuthScreen.jsx        # Login/signup UI
├── LandingPage.jsx       # Marketing homepage
├── CinematicOnboarding.jsx # First-time user experience
│
├── ExportHub.jsx         # JSON, CSV, HTML, KML, timeline exports
├── YearInReview.jsx      # Animated yearly recap
├── TravelStats.jsx       # Analytics dashboard
├── Milestones.jsx        # Achievement badges
├── PhotoMap.jsx          # Geographic photo visualization
├── TripJournal.jsx       # Chronological journal view
├── TripCard.jsx          # Entry detail card (4 tabs)
│
├── utils.js              # Haversine, date math, country flags
├── imageUtils.js         # Photo compression and thumbnails
└── geocode.js            # Reverse geocoding
```

### Key Patterns

- **Monolithic globe component**: OurWorld.jsx contains the entire 3D experience by design — Three.js scene setup, markers, entry CRUD, timeline, cinema mode, and all overlays
- **RLS-protected data**: All data isolation enforced at the Supabase database level via Row Level Security policies
- **Offline-first**: IndexedDB queue persists mutations when offline, flushes on reconnect
- **Lazy-loaded overlays**: PhotoMap, Milestones, TravelStats, YearInReview, TripJournal loaded via React.lazy

### Database

11 PostgreSQL tables with RLS. Full idempotent schema in `docs/FULL_REBUILD.sql`.

## Deployment

Hosted on Vercel with auto-deploy from main branch. PWA-installable on mobile.

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key (public) |
