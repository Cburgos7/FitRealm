# ROADMAP: FitRealm

**Project:** FitRealm
**Granularity:** Standard (7 phases)
**Mode:** Vertical MVP — each phase delivers a working end-to-end slice
**All v1 requirements covered:** ✓
**Generated:** 2026-05-24

---

## Overview

| # | Phase | Goal | Mode | Status |
|---|-------|------|------|--------|
| 1 | Project Foundation | Build + auth on both platforms | mvp | ○ Pending |
| 2 | Core Movement Loop | Move → bank → allocate → village decays | mvp | ○ Pending |
| 3 | World Map & Exploration | Fantasy map with fog of war over real geography | mvp | ○ Pending |
| 4 | Onboarding & Avatar | New user completes full loop in first session | mvp | ○ Pending |
| 5 | Engagement Systems | Daily return drivers: streaks, quests, achievements | mvp | ○ Pending |
| 6 | Social, Buildings & Relocation | Factions, building construction, village mobility | mvp | ○ Pending |
| 7 | Economy, Safety & Launch Readiness | Monetization, safety, accessibility, legal, analytics | mvp | ○ Pending |

---

## Phase Details

---

### Phase 1: Project Foundation

**Goal:** React Native project scaffolded, running on iOS + Android, with working auth and Supabase connection
**Mode:** mvp

**Requirements:**
- AUTH-01, AUTH-02, AUTH-03
- INFRA-01, INFRA-05, INFRA-06

**Success Criteria:**
1. App builds and runs on both iOS Simulator and Android Emulator with no errors
2. User can sign in with Google on iOS and Android (Supabase Auth)
3. User can sign in with Apple on iOS (Supabase Auth)
4. User session persists after killing and relaunching the app
5. Vercel Express API deployed and reachable from the mobile app

**Plans (3):**
- [ ] 01-A-PLAN.md — Monorepo scaffold + Expo SDK 52 bare app + 4-tab shell + auth routing skeleton + test infra
- [ ] 01-B-PLAN.md — Supabase schema (profiles, villages, RLS) + Google Sign-In + Apple Sign-In + session persistence
- [ ] 01-C-PLAN.md — Vercel Express API (GET /health) + RevenueCat SDK init + full Walking Skeleton verification

---

### Phase 2: Core Movement Loop

**Goal:** User can track movement, bank miles, allocate them to resources, and watch the village decay when inactive
**Mode:** mvp

**Requirements:**
- VLG-01, VLG-02, VLG-03, VLG-04, VLG-05, VLG-06, VLG-07, VLG-08
- MOV-01, MOV-02, MOV-03, MOV-04, MOV-05, MOV-06, MOV-07, MOV-08, MOV-09, MOV-10, MOV-11
- ALLOC-01, ALLOC-02, ALLOC-03, ALLOC-04, ALLOC-05
- INFRA-02, INFRA-04

> **REDESIGNED 2026-06-03 (food-only survival model + passive health sync in scope).** See `.planning/phases/02-core-movement-loop/02-CONTEXT.md`.

**Success Criteria:**
1. User can start, track, and end an outdoor GPS session (auto-detected activity type, live route); route stored as GeoJSON; multiplied miles added to bank
2. App passively reads HealthKit/Health Connect (steps + workouts), reconciles via gap-fill (no double-count), and banks miles via app-open prompt
3. User can allocate banked miles to **Hunt Food (1 mi → 10 food)**; food updates immediately; offline allocations queue in SQLite and sync
4. Food decays −2.5 per 6-hour tick (≈1 mile/day to maintain) via Vercel Cron; 24-hour grace period respected; village transitions Thriving → Hungry → Starving (locked) with correct visuals
5. Starving village unlocks the moment any food is added; user can manually log treadmill activity (with anti-cheat caps) and it banks miles
6. Full core loop (move → bank → allocate to food → village survives/starves) works end-to-end on physical iPhone + physical Android device

**Plans (5):**
- Plan A: Village view UI (Food meter + state visuals Thriving/Hungry/Starving, Mile Bank, non-decaying resource counts, static illustration, auto-created default village) connected to Supabase
- Plan B: Active GPS tracker (Mapbox live map, Kalman filter, auto activity detection, GeoJSON to Storage) + manual entry with anti-cheat
- Plan C: Passive movement (HealthKit/Health Connect steps+workouts, gap-fill reconciliation, app-open banking prompt, permissions)
- Plan D: Allocate Miles screen (Hunt Food + bottom sheet + quantity stepper, atomic Supabase transactions, offline SQLite queue + sync)
- Plan E: Food decay Vercel Cron (grace period, −2.5/tick from game_config, state transitions, starving lock/unlock) + game_config seed

**Note:** Raiders/Defend combat, Scout/Explore, and Medicine/Wood/Stone/Morale active uses are deferred to later phases (raiders defined but not built here).

---

### Phase 3: World Map & Exploration

**Goal:** Village exists on a real-world Mapbox map with a fantasy overlay; player can explore fog of war and discover landmarks
**Mode:** mvp

**Requirements:**
- MAP-01, MAP-02, MAP-03, MAP-04, MAP-05
- MAP-06, MAP-07, MAP-08

**Success Criteria:**
1. World map renders with custom Mapbox fantasy style overlay on both iOS and Android (muted terrain, illustrated biomes, hidden roads)
2. Village origin marker (avatar portrait) appears at player-chosen coordinate on the map
3. Unexplored hex tiles show fog of war; Scout allocation triggers reveal animation (golden shimmer, camera pan, toast)
4. Revealed tiles containing Mapbox POIs display named in-game landmark icons; discovering one earns +5 Gems + Chronicle entry
5. Weekly tile content refresh (Vercel Cron) spawns resource caches and encounters on explored tiles; player can tap to trigger mini-quests
6. Map works offline with cached Mapbox tiles for recently viewed areas

**Plans (3):**
- Plan A: Mapbox integration with custom fantasy style + village marker + fog-of-war hex grid + Scout reveal animation
- Plan B: Mapbox POI → landmark conversion system + landmark icons + discovery rewards + Chronicle integration
- Plan C: Living World — weekly Vercel Cron for tile content (caches, encounters, rare spawns) + mini-quest tap flow + faction member map markers (opt-in)

---

### Phase 4: Onboarding & Avatar

**Goal:** New user completes the full core loop within 5 minutes of first launch, with an avatar they created
**Mode:** mvp

**Requirements:**
- ONBD-01, ONBD-02, ONBD-03, ONBD-04, ONBD-05, ONBD-06, ONBD-07

**Success Criteria:**
1. New user sees animated splash screen and proceeds to Google/Apple sign-in with no friction
2. User names their village, builds an avatar from composable SVG layers, and taps to place their village anywhere on the Mapbox world map
3. First crisis event triggers immediately after placement (Food at 30/100) and user is guided to walk any distance to feed the village
4. Core loop completes in under 5 minutes: movement → bank → auto-resolve crisis → village celebrates
5. 24-hour grace period is active (no decay) after village placement
6. Avatar renders correctly from composable layers on village scene, map marker, and profile

**Plans (3):**
- Plan A: Avatar creation system — composable SVG layer renderer (skin, hair, face, eyes, outfit) on-device
- Plan B: Onboarding screens (splash → sign-in → name village → avatar → map placement) with navigation flow
- Plan C: First crisis event system + guided first movement session + tutorial wrap + 24hr grace period

---

### Phase 5: Engagement Systems

**Goal:** Player has compelling daily reasons to return: streaks, quests, achievements, chronicle, and a comeback path
**Mode:** mvp

**Requirements:**
- STRK-01, STRK-02, STRK-03, STRK-04, STRK-05, STRK-06
- REST-01, REST-02, REST-03, REST-04
- QUEST-01, QUEST-02, QUEST-03, QUEST-04, QUEST-05
- ACHI-01, ACHI-02, ACHI-03
- CHRN-01, CHRN-02, CHRN-03, CHRN-04
- CMBK-01, CMBK-02, CMBK-03
- INFRA-03, INFRA-07

**Success Criteria:**
1. Streak tracked correctly; village grows visually at milestones (Day 7 = garden blooms, Day 14 = fountain, Day 30 = walls)
2. Streak Shield earned by banking 3+ miles in a day; auto-applied when a day is missed
3. 1–3 random quest cards generated daily with narrative text, timer, and variable rewards; expiry doesn't punish
4. Achievements auto-awarded on all trigger conditions across all categories; visible on profile with gem reward
5. Chronicle auto-generates RPG entries on major events; player can add notes; share card exports correctly
6. Comeback quest chain triggers after 3+ days inactivity with welcoming narrative (not guilt)

**Plans (5):**
- Plan A: Streak system — daily tracking, Vercel Cron (check-streaks), visual milestone triggers, gem multiplier, Streak Shield earn/use
- Plan B: Rest Day system — weekly toggle, no-decay day, streak preservation, Vercel Cron (reset-rest-days), celebration visuals
- Plan C: Random quest engine — Vercel Cron generation (1–3/day), quest card UI with countdown, completion detection, faction-wide quest variant
- Plan D: Achievement system — badge definitions (all categories), trigger detection, profile grid view, gem awards, unlock notifications
- Plan E: Village Chronicle + Comeback — auto-generated narrative entries, player notes, share card, comeback detection + 3-quest chain + lapsed-user push notifications

---

### Phase 6: Social, Buildings & Relocation

**Goal:** Players can form factions, interact socially, construct buildings to strengthen their village, and relocate strategically
**Mode:** mvp

**Requirements:**
- SOCL-01, SOCL-02, SOCL-03, SOCL-04, SOCL-05, SOCL-06, SOCL-07, SOCL-08, SOCL-09
- BUILD-01, BUILD-02, BUILD-03, BUILD-04, BUILD-05, BUILD-06, BUILD-07
- RELOC-01, RELOC-02, RELOC-03, RELOC-04, RELOC-05
- ONBD-08, ONBD-09

**Success Criteria:**
1. User can create or join a faction; activity feed shows RPG-narrated events in real time (Supabase Realtime)
2. Rally button works: tapping Rally on a faction event grants the author +2 Morale; rally count visible
3. Faction weekly quest accepts mile contributions from members; completes with faction event and rewards
4. User can construct and upgrade all 6 building types; passive effects apply correctly during decay cron ticks
5. Even at max buildings (all Lv 3), village still loses ~3 resources/tick; movement remains essential
6. User can relocate village with correct distance-scaled costs, Faction Caravan Discount applied, fog of war reset at new origin

**Plans (5):**
- Plan A: Faction core — create/join/leave/kick/disband flows, roles, governance (leader inactivity succession), join request mode
- Plan B: Faction social — real-time activity feed (Supabase Realtime), Rally button + morale boost, weekly "Most Rallied" highlight
- Plan C: Faction quests — weekly collective mile quest, member contribution flow, completion event + rewards, faction-wide random quest variant
- Plan D: Building system — village view with 6 pre-set slots, construction + upgrade flows for all 6 buildings, visual tier changes, passive effect integration in decay cron
- Plan E: Village relocation — Move Camp flow (map browse → preview cost → confirm), distance-scaled costs, Caravan Discount, fog reset, Chronicle + faction event post; post-onboarding milestone quests

---

### Phase 7: Economy, Safety & Launch Readiness

**Goal:** App is monetized, safe, accessible, legally compliant, and ready for TestFlight/Play beta distribution
**Mode:** mvp

**Requirements:**
- GEM-01, GEM-02, GEM-03, GEM-04, GEM-05
- IAP-01, IAP-02, IAP-03, IAP-04, IAP-05, IAP-06
- NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04
- SAFE-01 – SAFE-13
- CONT-01, CONT-02
- INFRA-01, INFRA-06

**Success Criteria:**
1. Gem economy functional: earning (movement, quests, streaks, rallies, achievements), spending (shields, rest days, recovery, rename), transaction log complete
2. RevenueCat IAP working on both platforms with sandbox accounts: gem packs + Supporter Pack purchasable; "Restore Purchases" works
3. Push notifications delivering correctly (max 3/day, priority system enforced, Android 13+ runtime permission requested after first movement)
4. Block/report system functional; account deletion removes all personal data with 30-day confirmation
5. App passes accessibility review: dark mode, colorblind meters (icons + labels), VoiceOver/TalkBack labels, 44pt touch targets, Dynamic Type support
6. Content seeded: 40+ quest templates, 25+ chronicle templates, 20+ faction narrations, 25 achievement descriptions, 18 building descriptions
7. Privacy Policy, Terms of Service, and health disclaimer published and linked in app

**Plans (5):**
- Plan A: Gem economy — earn events (movement, quests, streak milestones, rallies, achievements), spend shop UI, streak multiplier, server-side balance + transaction log
- Plan B: RevenueCat IAP — product setup (App Store Connect + Google Play), gem packs + Supporter Pack, receipt validation, Restore Purchases, subscription management link
- Plan C: Push notifications — Expo setup, priority engine (max 3/day server-side), Android 13+ runtime permission flow, Android notification channels, comeback + digest notifications
- Plan D: Safety + accessibility — block/report flows, village visibility settings, coordinate fuzzing, GDPR account deletion, dark mode, colorblind meters, VoiceOver labels, reduced motion, touch targets, Dynamic Type
- Plan E: Content seeding + launch checklist — AI-assisted batch generation of all template types, seed to Supabase, privacy/TOS/health disclaimer publication, CI/CD production config, TestFlight + Play internal testing setup

---

## Requirement Coverage

### v1 Requirements → Phase Mapping

| Category | Requirements | Phase |
|----------|-------------|-------|
| AUTH-01–03 | Auth + session | 1 |
| INFRA-05, INFRA-06 | Secrets, CI/CD | 1, 7 |
| VLG-01–08 | Village state + decay | 2 |
| MOV-01–11 | Movement tracking | 2 |
| ALLOC-01–05 | Mile allocation | 2 |
| INFRA-02, INFRA-04 | game_config, offline | 2 |
| MAP-01–08 | Map, fog, landmarks, living world | 3 |
| ONBD-01–07 | Onboarding + avatar | 4 |
| STRK-01–06 | Streaks | 5 |
| REST-01–04 | Rest Day | 5 |
| QUEST-01–05 | Random quests | 5 |
| ACHI-01–03 | Achievements | 5 |
| CHRN-01–04 | Chronicle | 5 |
| CMBK-01–03 | Comeback | 5 |
| INFRA-03, INFRA-07 | Analytics, WAM | 5 |
| SOCL-01–09 | Factions + rally | 6 |
| BUILD-01–07 | Buildings | 6 |
| RELOC-01–05 | Village relocation | 6 |
| ONBD-08–09 | Post-onboarding quests | 6 |
| GEM-01–05 | Gem economy | 7 |
| IAP-01–06 | IAP + RevenueCat | 7 |
| NOTIF-01–04 | Push notifications | 7 |
| SAFE-01–13 | Safety + accessibility | 7 |
| CONT-01–02 | Content pipeline | 7 |
| INFRA-01 | Supabase RLS | 1 |

**Total v1 requirements: 97**
**Mapped: 97 ✓**
**Unmapped: 0 ✓**

---
*Roadmap created: 2026-05-24*
*Last updated: 2026-05-24 after initial creation*
