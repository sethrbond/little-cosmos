# My Cosmos — Platform State, Roadmap & Launch Plan
### v9.1 — March 2026

---

## CURRENT STATE

### What Just Shipped
- **"My Cosmos"** world selector with orbital camera controls
- **Customizable color palette** per world (10 color pickers in Settings, persists to Supabase)
- **12 My World entry types** (Adventure, Road Trip, City Break, Beach, Cruise, Backpacking, Friends, Family, Event, Nature, Work, Home)
- **Blue-slate My World** scene with earthy sandstone globe and green coastlines
- **High-contrast text** throughout (titles, subtitles, stats all boosted)
- **Diamond symbol** bug fixed (Road Trip / Cruise now render correctly)
- **Bucket List labels** in DreamAddForm (My World)
- **Photo persistence** confirmed working in both worlds

### Files Modified This Session (4)
| File | Changes |
|------|---------|
| `src/OurWorld.jsx` | Customizable palette (P/SC merge from config), restructured hook ordering, diamond symbol fix, DreamAddForm labels |
| `src/WorldSelector.jsx` | "My Cosmos" rename, orbital camera, tracking labels |
| `src/supabase.js` | customPalette/customScene in save/load config metadata |
| `src/supabaseMyWorld.js` | customPalette/customScene in save/load config metadata |

### Build Status
- Compilation: ✅ (370kb)
- Brackets: ✅
- All imports aligned: ✅
- Palette keys: ✅ All covered in both world configs

---

## TOP 15 FEATURES FOR A SHARED COSMOS EXPERIENCE

### 1. World Invitations & Link Sharing
Generate a unique invite link from the cosmos screen. Recipient clicks it, signs up (or logs in), and the shared world appears in both users' cosmos views. The social glue that makes everything else possible.

### 2. Shared World Real-Time Sync
When two people are in the same shared world, entries one person adds appear on the other's globe within seconds. Supabase Realtime subscriptions make this feel alive — like building the world together.

### 3. Contributor Avatars on Entries
Each entry in a shared world shows who added it — a small avatar or initial badge on the marker and card. "Rosie added this" or "Seth added this." Makes shared worlds feel collaborative, not anonymous.

### 4. World Activity Feed
A timeline of recent activity across your cosmos: "Rosie added Paris to Our World," "Amy created a new world," "Seth uploaded 3 photos to Mongolia." This is the social heartbeat.

### 5. World Templates
Pre-configured world types when creating a new world: "Couples" (Our World style with love features), "Friends Group Trip" (shared trip diary), "Family" (family travel log), "Solo" (My World). Each comes with appropriate entry types, palette, and features.

### 6. Cosmos View Enhancements
The cosmos screen becomes a living dashboard: see which worlds have new activity (glowing rings), how many entries each world has (orb size scales), and a "last updated" tooltip. Your personal universe at a glance.

### 7. Cross-World Search
Search across ALL your worlds at once from the cosmos screen. "Find every time I was in Tokyo" — pulls results from My World, Our World, any shared worlds. A unified travel history.

### 8. Trip Cards & Social Sharing
Generate beautiful shareable images from any entry — a card with the city name, dates, a photo, and a tiny globe showing the location. Share to Instagram, send in messages, or save for memories.

### 9. Year-in-Review Generator
At the end of each year, generate a visual story: animated globe fly-through of every place visited, stats, photo highlights, distance traveled. Exportable as video or image carousel. Works per-world or across cosmos.

### 10. Photo Stories & Albums
Within an entry, create a photo story with captions, ordering, and a slideshow mode. Full-screen immersive viewing. Multiple albums per entry (Day 1, Day 2, or "Food," "Views," "People").

### 11. Bucket List Collaboration
In shared worlds, the bucket list becomes collaborative. Both users can add destinations, vote on priorities, mark items as "planned," and convert to entries when visited. A shared travel wishlist.

### 12. World Themes & Seasons
Beyond custom colors, worlds can have animated seasonal themes: cherry blossoms in spring, golden leaves in autumn, snow particles in winter. Each world can pick a base aesthetic that reflects its personality.

### 13. Entry Reactions & Comments
In shared worlds, users can react to each other's entries (heart, star, laugh, wow) and leave short comments. Light social interaction without the heaviness of a full social network.

### 14. Travel Statistics Dashboard
A dedicated stats page per world and across the cosmos: countries visited, continents touched, total distance, travel calendar (GitHub-style grid), most-visited cities, travel streaks, and comparisons between worlds.

### 15. Offline Mode & Progressive Web App
Install on your phone's home screen. Works offline — entries saved locally, photos queued for upload, syncs when back online. The app should feel native, not like a website.

---

## PLATFORM LAUNCH PLAN — DETAILED PHASES

### PHASE 1: Authentication & Data Isolation
**Goal:** Multi-user platform. Each person's data is private.
**Estimated:** 3-4 sessions

#### Step 1.1: Supabase Auth Setup (no code)
```
[ ] Enable Email auth in Supabase Dashboard → Authentication → Providers
[ ] Set site URL to https://littlecosmos.app
[ ] Configure email templates (verification, password reset)
[ ] Set redirect URL for email verification callback
```

#### Step 1.2: Database Migration
```sql
-- Add user_id to all tables
ALTER TABLE entries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE config ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE my_entries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE my_config ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create worlds table
CREATE TABLE worlds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'personal',
  mode TEXT DEFAULT 'my',
  owner_id UUID REFERENCES auth.users(id),
  palette JSONB DEFAULT '{}',
  scene JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create world_members table
CREATE TABLE world_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(world_id, user_id)
);

-- Create invites table
CREATE TABLE world_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  used_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMPTZ
);

-- Update RLS policies
DROP POLICY IF EXISTS "entries_select" ON entries;
DROP POLICY IF EXISTS "entries_insert" ON entries;
DROP POLICY IF EXISTS "entries_update" ON entries;
DROP POLICY IF EXISTS "entries_delete" ON entries;

CREATE POLICY "entries_own" ON entries FOR ALL
  USING (user_id = auth.uid());

-- (repeat for config, my_entries, my_config, worlds, world_members)
```

#### Step 1.3: Auth UI — `src/Auth.jsx` (~150 lines)
```
[ ] Login form (email + password)
[ ] Signup form (email + password + confirm)
[ ] Toggle between login/signup
[ ] Email verification pending screen
[ ] Forgot password link → reset flow
[ ] Beautiful design matching cosmos aesthetic
[ ] Loading states and error messages
[ ] Mobile responsive
```

#### Step 1.4: Auth Context — `src/authContext.js` (~50 lines)
```
[ ] React context providing: user, loading, signIn, signUp, signOut
[ ] Supabase auth state listener (onAuthStateChange)
[ ] Auto-refresh session token
[ ] Expose user.id for all data operations
```

#### Step 1.5: App.jsx Auth Gate
```
[ ] Not logged in → Auth.jsx
[ ] Logged in, first time → auto-create "My World" entry in worlds table
[ ] Logged in → WorldSelector (cosmos screen)
[ ] Sign out button in cosmos and in-world toolbar
```

#### Step 1.6: Data Layer — User Scoping
```
[ ] supabase.js: add .eq('user_id', userId) to all selects
[ ] supabase.js: add user_id to all inserts
[ ] supabaseMyWorld.js: same
[ ] Both: get userId from Supabase auth session
[ ] Test: two accounts cannot see each other's data
```

#### Step 1.7: Migrate Seth's Data
```
[ ] Seth signs up → gets UUID
[ ] Run: UPDATE entries SET user_id = 'seth-uuid' WHERE user_id IS NULL
[ ] Same for config, my_entries, my_config
[ ] Verify all existing data accessible after migration
```

---

### PHASE 2: Onboarding & Polish
**Goal:** Beautiful first experience for new users.
**Estimated:** 2 sessions

```
[ ] Welcome screen after first signup
[ ] Guided first entry creation (step-by-step)
[ ] Empty state designs for all panels
[ ] "My World" auto-created with user's name
[ ] First-entry celebration animation
[ ] Form palette fix (My World uses earth tones in all UI)
[ ] Welcome letter screen for Our World (the gift moment)
[ ] Custom favicon per world mode
[ ] OG meta tags for link previews
```

---

### PHASE 3: World Creation & Sharing
**Goal:** Create new worlds, invite others.
**Estimated:** 3 sessions

```
[ ] "Add a World" button → create world modal
[ ] World types: Personal, Couples, Friends, Family
[ ] New world appears as orbiting body in cosmos
[ ] Generate invite link (unique token with expiry)
[ ] Accept invite page (/invite?token=xxx)
[ ] Invite flow: click link → sign up/log in → world appears in cosmos
[ ] World member list management
[ ] Shared world entries show contributor attribution
[ ] Each world gets its own entries (world_id column)
[ ] Worlds table stores custom palette/scene per world
```

---

### PHASE 4: Social & Engagement
**Goal:** Interaction between users.
**Estimated:** 3-4 sessions

```
[ ] Activity feed on cosmos screen
[ ] Real-time entry sync in shared worlds (Supabase Realtime)
[ ] Entry reactions (heart, star) in shared worlds
[ ] Short comments on entries
[ ] Push notification preferences
[ ] Shareable trip cards (OG image generation)
[ ] Year-in-review generator
[ ] Cross-world search from cosmos screen
```

---

### PHASE 5: Scale & Monetization
**Goal:** Sustainable platform.
**Estimated:** ongoing

```
[ ] PWA manifest + service worker
[ ] Offline photo queue
[ ] Client-side photo compression
[ ] Supabase Pro plan when needed ($25/month)
[ ] Custom domain
[ ] Terms of service + privacy policy
[ ] Anonymous usage analytics
[ ] Pro tier features (unlimited photos, video, custom themes)
[ ] Rate limiting awareness
```

---

## UPDATED PROJECT STATE & ROADMAP

### Version History
| Version | What Shipped |
|---------|-------------|
| v1-v5 | Core globe, entries, timeline, photos |
| v6 | Cities database, geocoding, deployment |
| v7 | Safari fixes, gallery, photo deletion |
| v8 | Filter panel, cities expansion, 1,067 cities |
| v8.1 | Correct flyTo formula, photo persistence architecture |
| v8.2 | Symbol markers, breathing animations, SQL trigger fix |
| v9.0 | Dual-world mode (My World + Our World), world selector |
| **v9.1** | **Cosmos rename, custom palette, expanded entry types, contrast fixes** |

### What's Next (in order)
| Priority | Item | Effort |
|----------|------|--------|
| **NOW** | Deploy v9.1 (4 files) | 5 min |
| **NOW** | Test custom palette in both worlds | 10 min |
| 1 | Phase 1: Auth & Data Isolation | 3-4 sessions |
| 2 | Phase 2: Onboarding & Polish | 2 sessions |
| 3 | Phase 3: World Creation & Sharing | 3 sessions |
| 4 | Phase 4: Social & Engagement | 3-4 sessions |
| 5 | Phase 5: Scale & Monetization | ongoing |

### Technical Debt to Address
| Item | When |
|------|------|
| Move inpSt/navSt/renderList/TBtn/Fld inside component | Phase 2 |
| Remove dead code (TYPES_DEFAULT, swipeRef) | Phase 2 |
| Extract globe engine into shared module | Phase 5 |
| Add proper TypeScript types | Phase 5 |
| Unit tests for reducer and data layer | Phase 5 |

### Key Decisions Made
- **My Cosmos** (not My Constellation) — the universe metaphor
- **My World at center**, shared worlds orbit — you are the center of your universe
- **12 entry types** for My World (expanded from 6)
- **Customizable palette** stored in config metadata, merges over defaults
- **Supabase Auth** for authentication (not Firebase, not Auth0)
- **RLS for data isolation** (database-level security, not just code-level)
- **Worlds + Members tables** for the multi-world architecture
- **Invite links with tokens** for sharing (not email-based invites)

---

## CRITICAL ARCHITECTURE NOTES

1. **Custom palette merges over defaults** — `P = { ...baseP, ...config.customPalette }`. UI colors take effect immediately on render. Scene colors take effect on page reload (Three.js setup only runs once).

2. **P and SC are now useMemo** — they depend on config state, so they recalculate when config changes. This is a hook ordering change from v9.0.

3. **The worlds table is the future center of gravity.** Every entry will eventually have a `world_id`. The current `entries`/`my_entries` split is a v1 shortcut. In Phase 3, we'll move to a single entries table with world_id.

4. **Auth changes the entire data flow.** Currently: component mounts → loads all entries. After auth: component mounts → checks auth → gets user_id → loads only user's entries. Every query gets a WHERE clause.

5. **The cosmos screen will evolve.** Right now it's a selector. After Phase 3, it becomes a dashboard showing all your worlds, their activity, stats, and management. The orbital view scales to many worlds.
