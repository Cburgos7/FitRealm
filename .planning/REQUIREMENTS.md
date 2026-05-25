# Requirements: FitRealm

**Defined:** 2026-05-24
**Core Value:** Move → Bank → Allocate: every mile earned is a strategic decision that keeps the village alive.

---

## v1 Requirements

Requirements for the initial launch (Phase 0 + Phase 1). Each maps to roadmap phases.

### Authentication & Onboarding (AUTH)

- [ ] **AUTH-01**: User can sign in with Google on iOS and Android via Supabase Auth
- [ ] **AUTH-02**: User can sign in with Apple ID on iOS via Supabase Auth (required for App Store if Google is offered)
- [ ] **AUTH-03**: User session persists across app restarts

- [ ] **ONBD-01**: New user sees animated splash screen with core concept hook ("Your village needs you. Every step keeps it alive.")
- [ ] **ONBD-02**: User can name their village (or accept a generated name suggestion)
- [ ] **ONBD-03**: User can tap anywhere on Earth on a full Mapbox world map to place their village origin
- [ ] **ONBD-04**: User can optionally use their current device location as village origin (never required)
- [ ] **ONBD-05**: User can create an avatar during onboarding by selecting from composable layers: skin tone (6), hair style (8), hair color (8), face shape (4), eyes (6), outfit (4)
- [ ] **ONBD-06**: New user experiences the first crisis event immediately after village placement (Food at 30/100 → prompted to walk any distance → +50 Food, core loop complete in <2 min)
- [ ] **ONBD-07**: New user receives a 24-hour grace period before village decay begins
- [ ] **ONBD-08**: 7-day guided onboarding quest chain (one mechanic per day) auto-generates each morning after the prior quest is completed
- [ ] **ONBD-09**: Post-onboarding milestone quests trigger contextually at key moments (first building, expedition, gem economy, etc.)

### Village & Resources (VILLAGE)

- [ ] **VLG-01**: User's village has 4 decaying resource meters (Food, Medicine, Wood, Morale — each 0–100) plus a non-decaying Stone counter
- [ ] **VLG-02**: User's Mile Bank displays unspent miles available for allocation
- [ ] **VLG-03**: Village transitions between states: thriving (all resources >20), struggling (any resource ≤20), ruined (all resources at 0 for 48+ hours)
- [ ] **VLG-04**: Ruined village shows a somber but non-punishing visual ("sleeping kingdom") with "Your village awaits your return" banner
- [ ] **VLG-05**: User can recover from Ruined state by spending 5 banked miles (instant, all resources to 50/100) or completing the Comeback Quest Chain
- [ ] **VLG-06**: Village resources decay by −8 per resource per 6-hour tick (server-side Vercel Cron only — never client-side)
- [ ] **VLG-07**: Watchtower reduces decay rate (Lv 1 = −10%, Lv 2 = −15%, Lv 3 = −20%)
- [ ] **VLG-08**: Even a fully maxed village (all 6 buildings at Lv 3) still decays at ~−3/tick; movement is always required

### Movement & Activity Tracking (MOVEMENT)

- [ ] **MOV-01**: User can start a foreground GPS outdoor session with live Mapbox map, real-time distance, pace, and elapsed time
- [ ] **MOV-02**: GPS points are filtered via Kalman filter; points with >20m accuracy are discarded
- [ ] **MOV-03**: Completed outdoor route is saved as GeoJSON to Supabase Storage
- [ ] **MOV-04**: Movement type multipliers apply on session end: walking 1.0×, running 1.25×, cycling 1.25×, hiking 1.5×
- [ ] **MOV-05**: Completed session miles are added to the Mile Bank with narrative toast ("You hunted 1.2 miles!")
- [ ] **MOV-06**: If GPS is lost mid-session, partial route is preserved; session continues; user is prompted to save partial miles on end
- [ ] **MOV-07**: Incomplete session (app killed with session open) is detected on next launch with prompt to save partial miles or discard
- [ ] **MOV-08**: User can manually log treadmill/indoor activity (distance + duration inputs)
- [ ] **MOV-09**: App detects synced workouts from Apple HealthKit (iOS) / Google Health Connect (Android) and prompts to add miles to bank
- [ ] **MOV-10**: Location "When In Use" permission requested on first session start, NOT during onboarding (Apple rejection risk)
- [ ] **MOV-11**: Android 12+ approximate location grant detected; user is prompted to grant precise location with explanation

### Mile Allocation (ALLOC)

- [ ] **ALLOC-01**: User can open the Allocate Miles screen from the home screen at any time (not only after movement)
- [ ] **ALLOC-02**: Allocate screen lists all options with mile costs: Hunt Food (0.5 mi → +20 Food), Gather Medicine (0.5 mi → +20 Medicine), Chop Wood (0.5 mi → +20 Wood), Quarry Stone (1.0 mi → +10 Stone), Scout Region (1.0 mi → fog-of-war reveal), Explore New Land (1.0 mi → new tile), Defend Village (2.0 mi → next decay tick blocked), Contribute to Faction (any amount), Establish Outpost (5.0 mi), Move Camp (5–75 mi, distance-scaled)
- [ ] **ALLOC-03**: Options that cost more than the current bank balance are greyed out in UI; server-side validation rejects over-spend as backup
- [ ] **ALLOC-04**: Allocations made while offline are queued in SQLite and synced to Supabase on reconnect
- [ ] **ALLOC-05**: Supabase transactions atomically deduct miles and add resources (prevents race conditions from rapid taps)

### World Map & Exploration (MAP)

- [ ] **MAP-01**: World map uses Mapbox SDK with a custom fantasy art style overlay (muted terrain, illustrated biomes, hidden road clutter)
- [ ] **MAP-02**: Player's village marker (composable avatar portrait) appears at their chosen origin coordinate
- [ ] **MAP-03**: Fog-of-war covers unexplored 1-mile hex tiles; Scout/Explore allocations reveal tiles with golden shimmer animation and camera pan
- [ ] **MAP-04**: Revealed Mapbox POIs are converted to named in-game landmarks (park → Forest, hospital → Healer's Hut, etc.) with unique icons
- [ ] **MAP-05**: Discovering a landmark earns +5 Gems and auto-generates a Chronicle entry
- [ ] **MAP-06**: Weekly Vercel Cron (Monday midnight UTC) generates dynamic tile content on explored tiles: resource caches, encounters, rare spawns
- [ ] **MAP-07**: Dynamic tile content expires after 7 days; player can tap content icons to trigger mini-quests (movement → resource reward)
- [ ] **MAP-08**: Faction members' village markers visible on a shared map view (opt-in per user)

### Building System (BUILD)

- [ ] **BUILD-01**: Village view shows 6 pre-set building slots around a central village square; each slot starts empty with a "Build" prompt
- [ ] **BUILD-02**: User can construct any of 6 buildings in an empty slot if they have sufficient resources + miles: Farm, Herbalist Hut, Lumber Mill, Watchtower, Tavern, Storehouse
- [ ] **BUILD-03**: Buildings are immediately functional after construction — no timers
- [ ] **BUILD-04**: User can upgrade any building from Lv 1 → 2 → 3 with increasing resource + mile costs; visual tier changes on each upgrade
- [ ] **BUILD-05**: Building passive effects apply during every decay cron tick (passive generation + decay reduction)
- [ ] **BUILD-06**: Lumber Mill Lv 2+ passively generates Stone every tick; Stone is the only other way to earn Stone besides Quarry allocation
- [ ] **BUILD-07**: Construction and upgrade generate Chronicle entries ("A Farm was erected on the eastern fields of Thornhaven.")

### Engagement: Streaks (STREAK)

- [ ] **STRK-01**: Consecutive days with any movement session ≥0.25 miles are tracked as a streak
- [ ] **STRK-02**: Village visual milestones driven by streak: Day 7 = garden blooms, Day 14 = fountain, Day 30 = walls, Day 60+ = advanced structures
- [ ] **STRK-03**: Breaking a streak does not reset village visual milestones; growth pauses and gardens wilt after 48 hours of inactivity
- [ ] **STRK-04**: User earns a Streak Shield by banking ≥3 miles in a single day (max 2 stored); a Shield auto-protects one missed day
- [ ] **STRK-05**: Missing a day without a Rest Day or Shield causes streak to pause for 24 hours; after 48 hours inactivity, streak breaks
- [ ] **STRK-06**: Active streak grants passive +5 Morale per day and a gem earn multiplier (7+ days = +5%, scaling to +20% at 100+ days)

### Engagement: Rest Day (REST)

- [ ] **REST-01**: User can declare 1 Rest Day per week via toggle on home screen
- [ ] **REST-02**: On a Rest Day: no resource decay, streak is preserved, village shows festival celebration visuals, Morale +10
- [ ] **REST-03**: Herbalist Hut Lv 3 grants Rest Days +3 to all resources
- [ ] **REST-04**: Rest Day usage resets every Monday midnight via Vercel Cron

### Engagement: Random Quests (QUEST)

- [ ] **QUEST-01**: Vercel Cron generates 1–3 random narrative quest events per day per active user from template pool
- [ ] **QUEST-02**: Active quest cards appear on home screen with RPG flavor text, reward preview, and countdown timer
- [ ] **QUEST-03**: Completing the quest movement requirement before expiry grants variable resource rewards + bonus gems
- [ ] **QUEST-04**: Faction-wide quests require collective miles from faction members; on completion, all members receive rewards and a faction event is posted
- [ ] **QUEST-05**: Expired quests disappear silently — no punishment, only lost opportunity

### Engagement: Achievements (ACHIEVE)

- [ ] **ACHI-01**: Achievements auto-award on trigger conditions across categories: Movement, Streak, Village, Exploration, Relocation, Building, Social
- [ ] **ACHI-02**: All achievements are permanent, never lost, and visible to faction members on the player's profile
- [ ] **ACHI-03**: Achievement unlock awards gems (10–100 based on difficulty) and a notification

### Engagement: Village Chronicle (CHRONICLE)

- [ ] **CHRN-01**: Major game events auto-generate RPG-narrated chronicle entries (village founded, streak milestones, building constructed, expeditions, faction joined, comeback, etc.)
- [ ] **CHRN-02**: User can add optional personal notes to any chronicle entry
- [ ] **CHRN-03**: Chronicle is accessible as a scrollable timeline in the Profile/Chronicle tab
- [ ] **CHRN-04**: User can share a chronicle entry as a styled image card (for social media)

### Engagement: Comeback Mechanic (COMEBACK)

- [ ] **CMBK-01**: App detects 3+ days of inactivity on open and displays the "Return of the Wanderer" welcome narrative (welcoming, not guilt-inducing)
- [ ] **CMBK-02**: Comeback Quest Chain (3 quests over 3 days) restores village to 40/100 resources and rewards return with +25 Gems
- [ ] **CMBK-03**: Push notification after 3 days inactivity (once), another at 7 days (once), then permanent silence — never spam a lapsed user

### Social: Factions (SOCIAL)

- [ ] **SOCL-01**: User can create a faction (unique name, Open or Request join mode) or join an existing one; max 20 members per faction; 1 faction per user at a time
- [ ] **SOCL-02**: Faction has roles: Leader (full control), Co-Leader (can kick members), Member (participate)
- [ ] **SOCL-03**: Leader inactive 14 days → warning notification; 21 days → leadership auto-transfers to most active Co-Leader or Member
- [ ] **SOCL-04**: User can leave at any time (contributed miles not refunded); kicked users cannot rejoin same faction for 7 days; 24hr cooldown before joining any new faction
- [ ] **SOCL-05**: Leader can disband faction with 48-hour warning sent to all members
- [ ] **SOCL-06**: Faction has a weekly collective mile quest; members contribute miles from their bank; on completion all members receive rewards
- [ ] **SOCL-07**: Faction activity feed shows RPG-narrated events in real-time (Supabase Realtime subscription to faction_events table)
- [ ] **SOCL-08**: User can tap Rally on a faction event to give the author +2 Morale (max 10/day received from Rallies); Rally count visible on event card
- [ ] **SOCL-09**: Weekly "Most Rallied" highlight surfaced in faction feed

### Village Relocation (RELOC)

- [ ] **RELOC-01**: User can open a Move Camp flow from the Allocate screen; browse map to tap a new destination; preview costs before confirming
- [ ] **RELOC-02**: Relocation cost scales with distance (5 tiers from 5 mi/10 Wood to 75 mi/80 Wood+40 Stone+40 Food+20 Medicine)
- [ ] **RELOC-03**: Faction Caravan Discount (10–40%) applied automatically when relocating near faction members
- [ ] **RELOC-04**: Relocation resets fog of war at new origin; old explored tiles remain revealed; buildings travel with the village
- [ ] **RELOC-05**: Relocation generates a Chronicle entry and a faction event post

### Economy: Gems (GEM)

- [ ] **GEM-01**: User earns gems from: movement sessions (≥0.25 mi → +3 Gems), quests (+5–15), streak milestones (+25/+50/+150), Rallies given (+1), faction quests (+20), onboarding chain (+100 total), landmark discovery (+5), achievement unlocks (+10–100)
- [ ] **GEM-02**: Streak gem multiplier active while streak maintained (7+ days +5% → 100+ days +20% cap)
- [ ] **GEM-03**: User can spend gems on: Streak Shield (30), Extra Rest Day (40), Village Recovery (50), Extra Quest Slot (25), Village Rename (15), Outpost Rename (10)
- [ ] **GEM-04**: Gem balance stored server-side in Supabase (never on-device)
- [ ] **GEM-05**: Full gem transaction log maintained for audit and balance monitoring

### Economy: In-App Purchases (IAP)

- [ ] **IAP-01**: User can purchase gem packs via RevenueCat IAP: Handful $0.99/50 Gems, Pouch $2.99/175 Gems, Chest $4.99/325 Gems, Treasury $9.99/750 Gems
- [ ] **IAP-02**: User can purchase the Supporter Pack ($4.99 one-time): Founder badge, Founder's Banner cosmetic, +1 extra Rest Day/week, +10% permanent gem bonus, early access flag
- [ ] **IAP-03**: "Restore Purchases" button available in Settings (required by Apple)
- [ ] **IAP-04**: All purchases validated server-side via RevenueCat (never trust client-side receipt)
- [ ] **IAP-05**: Subscription cancellation management link available in Settings
- [ ] **IAP-06**: Gem balance never sold for resources or miles; monetization ethics enforced in product design

### Push Notifications (NOTIF)

- [ ] **NOTIF-01**: Push notifications sent via Expo Notifications; max 3/day per user enforced server-side
- [ ] **NOTIF-02**: Priority system: P1 Resource Critical (<15) > P2 Streak Risk > P3 Quest Event > P4 Evening Faction Digest > P5 World Event/Achievement
- [ ] **NOTIF-03**: Notification permission requested after first movement session (not during onboarding)
- [ ] **NOTIF-04**: Android 13+ `POST_NOTIFICATIONS` permission requested at runtime; Android notification channels created (Village Alerts, Faction Activity, Events & Quests, Reminders)

### Content Pipeline (CONTENT)

- [ ] **CONT-01**: Quest templates (40+), Chronicle templates (25+), Faction narrations (20+), Achievement descriptions (25), Building descriptions (18) seeded in Supabase or JSON before launch
- [ ] **CONT-02**: All narrative content uses template strings with variable interpolation (localizable by design, not string concatenation)

### Safety, Accessibility & Legal (SAFE)

- [ ] **SAFE-01**: User can block another player (silent); blocked users cannot see village, send challenges, or appear on map
- [ ] **SAFE-02**: User can report inappropriate usernames, village names, or faction names; reports go to moderation queue
- [ ] **SAFE-03**: User can request account deletion from Settings; all personal data removed within 30 days (GDPR/CCPA)
- [ ] **SAFE-04**: Village visibility setting: Faction only (default), Everyone, or Hidden
- [ ] **SAFE-05**: Village coordinates fuzzed ±0.5 miles before showing to other players
- [ ] **SAFE-06**: App supports dark mode (system setting + in-app toggle)
- [ ] **SAFE-07**: Resource meters use icon + label alongside color (never color-only); Food = apple, Medicine = cross, Wood = tree, Morale = heart, Stone = gem
- [ ] **SAFE-08**: VoiceOver/TalkBack accessibility labels on all interactive elements (buttons, meters, map markers)
- [ ] **SAFE-09**: Reduced motion option disables particle and animation effects (state changes still occur without animation)
- [ ] **SAFE-10**: Minimum 44×44pt touch targets on all interactive elements; Dynamic Type (iOS) and font scaling (Android) supported up to 200%
- [ ] **SAFE-11**: Privacy Policy and Terms of Service published before App Store submission
- [ ] **SAFE-12**: Health disclaimer ("FitRealm is not a medical device") shown during onboarding and in Settings → About
- [ ] **SAFE-13**: Minimum age 13 set in Terms of Service and App Store age rating (12+ iOS, Everyone 10+ Android)

### Infrastructure & Analytics (INFRA)

- [ ] **INFRA-01**: Supabase Row Level Security enabled on all tables (users read/write own data only; faction data readable by members)
- [ ] **INFRA-02**: All game balance values stored in Supabase game_config table (decay rate, building outputs, gem costs, allocation costs) — never hardcoded
- [ ] **INFRA-03**: Analytics events logged: app open, movement, allocation, quest, building, streak, rally, gem, purchase, onboarding, comeback, achievement
- [ ] **INFRA-04**: App operates offline (SQLite cache for village state, movement tracking, allocations); "Offline mode" indicator in header when disconnected
- [ ] **INFRA-05**: All API secrets stored in Vercel environment variables (never committed to repo)
- [ ] **INFRA-06**: CI/CD via EAS Build (or GitHub Actions + Fastlane); separate dev, staging, production build configs
- [ ] **INFRA-07**: North Star Metric tracked from day 1: Weekly Active Movers (WAM) = users who logged ≥1 movement session in the last 7 days

---

## v2 Requirements

Deferred to Phase 2. Not in the current roadmap.

### World Events (WORLD)
- **WORLD-01**: Monthly themed world events (5–7 days): Faction Race, Winter Siege, Harvest Festival, Fog Recedes, Faction Forge
- **WORLD-02**: Limited-time cosmetic rewards (village skins, decorations, banners) earn-only during events
- **WORLD-03**: Event announcement push notifications 3 days before start; post-event faction recap

### Home Screen Widget (WIDGET)
- **WIDGET-01**: iOS + Android home screen widget: streak flame, resource bars, active quest, miles in bank
- **WIDGET-02**: Widget deep-links into relevant app screens; auto-refreshes every 30 minutes

### Full Health Sync (HEALTH)
- **HEALTH-01**: Apple HealthKit passive sync auto-detects walks, runs, cycling, treadmill and prompts to add to mile bank
- **HEALTH-02**: Google Health Connect (Android) equivalent passive sync

### Full Expedition System (EXPED)
- **EXPED-01**: Vehicle-speed travel (>25 mph sustained >10 min) during active GPS session triggers Expedition event
- **EXPED-02**: Expedition rewards scale with distance: fog reveal (25–99 mi), rare landmark (100–299 mi), outpost (300–999 mi), legendary site (1000+ mi)
- **EXPED-03**: Outposts generate bonus quests for 3 days; can be upgraded to permanent Waypoints

### Avatar Expansion (AVTR2)
- **AVTR2-01**: Additional customization options: facial hair, accessories, hats, cloaks, armor
- **AVTR2-02**: Movement-milestone unlocked outfits (100-mile cloak, 365-day streak crown); building-specific outfits (Watchtower Lv 3 → Guard Captain)
- **AVTR2-03**: World Event exclusive character cosmetics (limited-time, earn-only)
- **AVTR2-04**: Realm Pass premium wardrobe options

### Friend Challenges (CHAL)
- **CHAL-01**: User can challenge a faction member to 1v1: Distance Duel, Streak Standoff, or Quest Race (3, 5, or 7 days)
- **CHAL-02**: Live comparison card on home screen during active challenge
- **CHAL-03**: Winner +30 Gems + 7-day trophy icon; loser gets 24hr lighthearted cosmetic; both get +10 participation gems

### Realm Pass Subscription (REALM)
- **REALM-01**: Realm Pass subscription ($3.99/mo or $29.99/yr) via RevenueCat
- **REALM-02**: Features: Streak Insurance (daily auto-protection), Advanced Stats, 5 quests/day, Faction Leader Tools, 1.25× World Event boost, enhanced comeback (resources at 60/100)

### Evening Digest & Social Depth (DIGEST)
- **DIGEST-01**: Daily faction digest push at ~7:30 PM local time with top mover, faction quest progress, and rally prompt
- **DIGEST-02**: "Today's Highlights" section in faction feed (biggest session, longest streak, most rallied event)

### Anti-Cheat (AC)
- **AC-01**: Manual activity entry rate-limited to max 10 miles/day
- **AC-02**: GPS route anomaly detection (teleportation, impossible speeds flagged for review)
- **AC-03**: Background GPS location tracking (requires "Always" permission — Phase 2 when app is proven)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Selling Food/Medicine/Wood/Stone/miles directly for money | Destroys the movement loop — the entire game is built on movement = currency |
| Content paywalls | Game must be fully playable for free; paying is convenience/support, never power |
| Email/password authentication | Google + Apple Sign-In covers 99% of users with less friction; email auth adds maintenance overhead |
| Free-placement building grid | Pre-set slots reduce art/engineering scope while preserving strategic slot choice |
| Build timers on buildings | Movement earned the building; instant gratification reinforces the core loop — not Clash of Clans |
| Background location in Phase 0 | Avoids #1 App Store rejection risk; foreground-only teaching the mechanic first, background in Phase 2 |
| AWS infrastructure before scale | Vercel + Supabase handles thousands of users; AWS only when actual limits are hit |
| Localization beyond English (Phase 0/1) | English-first with i18n-ready architecture; expand in Phase 2+ |
| Free-text player messaging | Structured social interaction (Rallies, feed, challenges) prevents harassment; no DMs in Phase 0/1 |
| Faction chat rooms | Same as above; faction feed + rally covers social needs without moderation burden |
| Selling World Event cosmetics | Earn-only; purchasable cosmetics would undermine the prestige of earned items |
| Forced/interruptive ads | Rewarded ads only (Phase 3), always optional, player-initiated; Supporter + Realm Pass holders see none |

---

## Traceability

*Populated during roadmap creation. Each requirement maps to exactly one phase.*

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 – AUTH-03 | Phase 1 | Pending |
| ONBD-01 – ONBD-07 | Phase 1 | Pending |
| VLG-01 – VLG-06 | Phase 1 | Pending |
| MOV-01 – MOV-11 | Phase 1 | Pending |
| ALLOC-01 – ALLOC-05 | Phase 1 | Pending |
| MAP-01 – MAP-05 | Phase 1 | Pending |
| DECAY (VLG-06–08) | Phase 1 | Pending |
| AVTR-01 – AVTR-03 (ONBD-05) | Phase 1 | Pending |
| INFRA-04 – INFRA-07 | Phase 1 | Pending |
| SAFE-06 – SAFE-13 | Phase 2 | Pending |
| SAFE-01 – SAFE-05 | Phase 2 | Pending |
| BUILD-01 – BUILD-07 | Phase 2 | Pending |
| STRK-01 – STRK-06 | Phase 2 | Pending |
| REST-01 – REST-04 | Phase 2 | Pending |
| QUEST-01 – QUEST-05 | Phase 2 | Pending |
| SOCL-01 – SOCL-09 | Phase 2 | Pending |
| GEM-01 – GEM-05 | Phase 2 | Pending |
| IAP-01 – IAP-06 | Phase 2 | Pending |
| ACHI-01 – ACHI-03 | Phase 2 | Pending |
| CHRN-01 – CHRN-04 | Phase 2 | Pending |
| CMBK-01 – CMBK-03 | Phase 2 | Pending |
| RELOC-01 – RELOC-05 | Phase 3 | Pending |
| MAP-06 – MAP-08 | Phase 3 | Pending |
| NOTIF-01 – NOTIF-04 | Phase 3 | Pending |
| CONT-01 – CONT-02 | Phase 3 | Pending |
| ONBD-08 – ONBD-09 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 97 total
- Mapped to phases: 97
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-24*
*Last updated: 2026-05-24 after initial definition*
