# FitRealm

## What This Is

FitRealm is a cross-platform mobile RPG (iOS + Android) where real-world physical movement — walking, running, cycling, hiking, or any indoor workout — directly powers in-game village survival and progression. Players own a village anywhere on Earth (freely chosen, never tied to real location), bank miles from any activity, and strategically allocate those miles as the universal in-game currency to keep their village alive and growing. This is not a fitness tracker with rewards bolted on — the movement is the core mechanic.

## Core Value

**Move → Bank → Allocate**: the strategic decision of how to spend earned miles (feed the village now or invest in a building that pays off next week?) is what makes FitRealm a game, not a tracker. No movement = village decays. Every step is a meaningful choice.

## Requirements

### Validated

(None yet — ship to validate)

### Active

#### Phase 0 — Core Playable Loop
- [ ] React Native (TypeScript, bare workflow) project scaffolded and running on both iOS + Android
- [ ] Supabase project with core tables: profiles, villages, activities, allocations
- [ ] Google Sign-In + Apple Sign-In via Supabase Auth
- [ ] Vercel Express API deployed as serverless functions
- [ ] Village view with 4 resource meters (Food, Medicine, Wood, Morale) + Stone counter + Mile Bank display
- [ ] Foreground GPS movement tracker with live Mapbox map, Kalman filter, and 20m accuracy threshold
- [ ] Route recording as GeoJSON to Supabase Storage
- [ ] Manual activity entry (distance + duration) with HealthKit/Google Health Connect sync prompt
- [ ] Allocate Miles screen with all core allocation options (Hunt, Gather, Chop, Quarry, Scout, Defend)
- [ ] Village decay cron (Vercel) at -8 per resource per 6-hour tick, respecting 24hr grace period
- [ ] Village state transitions: thriving → struggling → ruined
- [ ] Mapbox world map with custom fantasy style overlay + fog-of-war hex tiles + Scout reveal animation
- [ ] Onboarding flow: splash → sign in → name village → avatar creation → place village on map → first crisis event → first movement session

#### Phase 1 — Engagement + Social
- [ ] Movement streak system with village visual milestones (sprouts → garden → fountain → walls → advanced)
- [ ] Streak Shield mechanic (earned by banking 3+ mi/day, max 2 stored)
- [ ] Rest Day toggle (1 per week, no decay, streak preserved, +10 Morale)
- [ ] Random quest events (1–3/day, narrative-flavored, variable rewards, time-limited)
- [ ] Achievement badge system (Movement, Streak, Village, Exploration, Relocation, Building, Social categories)
- [ ] Village Chronicle (auto-generated RPG-narrated timeline, player notes, share as image card)
- [ ] Comeback mechanic: "Return of the Wanderer" 3-quest chain after 3+ days inactivity
- [ ] Faction system (up to 20 members, roles, weekly collective mile quest, activity feed via Supabase Realtime)
- [ ] Rally system (faction feed with RPG-narrated events + Rally button → +2 Morale)
- [ ] Building system: 6 buildings (Farm, Herbalist Hut, Lumber Mill, Watchtower, Tavern, Storehouse) × 3 upgrade tiers
- [ ] Stone resource: Quarry allocation + Lumber Mill passive generation
- [ ] Living World: dynamic tile content refresh every Monday (resource caches, encounters, rare spawns)
- [ ] Village Relocation: Move Camp with distance-scaled costs and Faction Caravan Discount (10–40%)
- [ ] Gem economy: earning, spending, Streak multiplier, transaction log
- [ ] IAP via RevenueCat: gem packs (4 tiers) + Supporter Pack ($4.99 one-time)
- [ ] 7-day guided onboarding quest chain teaching one mechanic per day
- [ ] Push notifications via Expo (max 3/day, priority system, request after first movement)
- [ ] Analytics event logging, accessibility (dark mode, colorblind meters, VoiceOver, reduced motion), block/report

#### Phase 2 — Social Depth, Events & Widgets
- [ ] World Events: monthly themed events (5–7 days, 5 event types, limited cosmetic rewards)
- [ ] Home screen widget (iOS + Android): streak, resource bars, active quest, deep links
- [ ] Enhanced evening faction digest + Today's Highlights section
- [ ] Apple HealthKit + Google Health Connect passive sync
- [ ] Full Expedition system: vehicle-speed detection → fog reveal / rare landmarks / outposts / legendary sites
- [ ] Avatar expansion: new cosmetics, movement-earned outfits, building-specific unlocks
- [ ] Friend Challenges (1v1): Distance Duel, Streak Standoff, Quest Race
- [ ] Realm Pass subscription ($3.99/mo or $29.99/yr)
- [ ] Anti-cheat: manual entry rate limiting, GPS route anomaly detection

#### Phase 3 — Expansion (post-real-user feedback)
- [ ] Apple Watch native companion
- [ ] Lifting / calorie burn tracking (beyond distance)
- [ ] Advanced village cosmetics marketplace (earn-only)
- [ ] Inter-faction trading
- [ ] Seasonal world event storylines
- [ ] Rewarded video ads (optional, 5/day max, never forced)

### Out of Scope

- **Selling resources (Food/Medicine/Wood/Stone) for real money** — would undermine the movement loop entirely
- **Selling miles or movement credit** — miles are proof-of-work; selling them destroys the core mechanic
- **Gating content behind paywalls** — the game must be fully playable for free
- **Email/password auth in Phase 0/1** — Google + Apple Sign-In reduces friction; email adds complexity without retention benefit
- **Free-placement building grid** — pre-set village layout slots reduce art/engineering complexity while maintaining personality
- **Build timers on buildings** — movement earned the building; instant gratification is intentional (not Clash of Clans)
- **Background location in Phase 0** — foreground-only tracking avoids the hardest permission rejection risks
- **Localization beyond English in Phase 0/1** — English-first, but i18n-ready architecture from day one
- **AWS infrastructure** — Vercel + Supabase handles thousands of users; AWS only if those limits are actually hit

## Context

FitRealm is a greenfield React Native project. No existing codebase. Key context:

- **Tech stack is decided**: React Native (bare, TypeScript), Mapbox (`@rnmapbox/maps`), Supabase (PostgreSQL + PostGIS + Auth + Realtime + Storage), Vercel (Express API + Cron), RevenueCat (IAP), Expo Notifications, SQLite (offline buffer)
- **Both platforms simultaneously**: Every feature must be tested on iOS + Android. Platform-specific areas: HealthKit vs Health Connect, APNs vs FCM, StoreKit vs Google Play Billing (abstracted by RevenueCat), Android OEM battery optimization
- **Privacy by design**: Village location is freely chosen (never real GPS home address). Location fuzzing ±0.5 miles on shared map views. No direct messaging in Phase 1.
- **Offline-first**: GPS tracking, village view, allocations all work offline via SQLite. Syncs on reconnect.
- **Game balance is sacred**: All tunable values (decay rate, gem costs, building outputs) stored in Supabase `game_config` table — never hardcoded. Buildings slow decay but never replace movement (maxed village still loses ~3/tick vs base 8/tick).
- **Full data model defined**: See FitRealm.md for complete PostgreSQL schema (profiles, villages, activities, expeditions, outposts, allocations, map_tiles, factions, buildings, achievements, chronicle_entries, gem_balances, etc.)
- **Screen map defined**: Auth → Home (Village View) → Allocate → Gem Shop → Activity Log → Movement Tracker → World Map → Faction → Chronicle → Achievements → Profile

## Constraints

- **Platform**: iOS + Android simultaneous — every feature must target both
- **Infrastructure**: Vercel (serverless, free tier) + Supabase (PostgreSQL + PostGIS + Auth + Realtime, free/Pro tiers) — no self-managed infra until scale demands it
- **App Store compliance**: Location permissions requested on first movement (not onboarding), "Restore Purchases" button required, subscription easy-cancel link required, HealthKit usage description mandatory
- **Monetization ethics**: Never sell resources, miles, or movement credit. Free game, no content paywalls. Gems earn/spend ratio target 40–60%.
- **Decay is server-only**: Vercel Cron only — never trust client-side decay calculations
- **Balance invariant**: Even a fully maxed village must still lose resources without movement. Buildings buy time, not freedom.
- **North Star metric**: Weekly Active Movers (WAM) — users who logged ≥1 movement session in the last 7 days

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React Native bare workflow (not Expo managed) | Need custom native modules (Mapbox, background GPS, HealthKit, RevenueCat) that Expo managed workflow doesn't support cleanly | — Pending |
| Supabase over custom Postgres + Auth + Socket | Replaces 3 separate services; generous free tier; PostGIS built-in for geospatial; Realtime for faction feed | — Pending |
| Vercel for Express API + Cron | Already in use; zero-config deploys; free tier covers early users; cron via vercel.json eliminates Lambda setup | — Pending |
| RevenueCat over raw react-native-iap | Abstracts StoreKit + Google Play Billing; server-side receipt validation; handles subscription lifecycle; free up to $2,500/mo | — Pending |
| Mapbox over Google Maps | Custom fantasy style overlay support; `@rnmapbox/maps` handles both platforms; PostGIS in Supabase aligns with Mapbox geospatial model | — Pending |
| Village location freely chosen (not real GPS) | Core privacy feature — sharing village location reveals nothing about real address; privacy-by-design, not a workaround | — Pending |
| Miles never expire (Phase 1) | Flexibility for casual players; treadmill runners can accumulate and spend strategically | — Pending |
| No build timers | Movement earned the building — instant gratification reinforces the core loop; avoiding Clash of Clans "pay to skip timer" dynamic | — Pending |
| Foreground-only location in Phase 0 | Avoids #1 App Store rejection risk; teaches the mechanic first; background added in Phase 2 when app is proven | — Pending |
| 6 pre-set building slots (not free placement) | Reduces art/engineering scope; maintains visual coherence; strategic slot choice is itself a decision | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-24 after initialization*
