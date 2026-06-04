# Phase 2: Core Movement Loop - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the playable core loop: **move → bank miles → allocate to food → village survives or starves.** This phase turns the Phase 1 placeholder screens into the real game on the Village and Move tabs.

Movement is captured two ways: an **active GPS tracker** (live Mapbox map, route recording) and **passive phone-health reading** (HealthKit / Health Connect steps + workouts), reconciled to prevent double-counting. Miles are banked, then allocated — primarily to **Food**, the single survival resource. Food decays on a server-only Vercel Cron; when it hits zero the village **starves** and locks until fed.

**⚠ This phase REDESIGNS the core mechanic from what REQUIREMENTS.md/ROADMAP.md originally described.** The four-decaying-resource model (Food/Medicine/Wood/Morale all draining) is replaced by a **food-only survival model**. REQUIREMENTS.md and ROADMAP.md are being updated to match (see canonical_refs).

</domain>

<decisions>
## Implementation Decisions

### Core Survival Model (REDESIGN — overrides VLG-01, VLG-03, VLG-06, ALLOC-02)
- **D2-01:** **Food is the ONLY survival/decaying resource.** The village decays only by losing food over time. Medicine, Wood, Stone, and Morale are **non-decaying** inputs reserved for later systems (Wood/Stone → buildings in Phase 6, Medicine → raider-damage recovery, Morale → social/faction). They do not drain with time.
- **D2-02:** **Village states are Thriving → Hungry → Starving.** Food >20 = Thriving (full actions). Food ≤20 = Hungry (warning visuals, still functional). Food = 0 = **Starving**: a locked state where scouting and other allocations are disabled until food is restored. "Starving" replaces the old "Ruined" concept.
- **D2-03:** **Recovery is just hunting food.** The moment any food is added (via allocation, or banked miles spent on food), the village unlocks. No premium recovery cost, no gem gate — movement is the cure. Stays true to "every step keeps it alive."
- **D2-04:** **Raiders are a separate threat axis, defined now but built later.** "Defend Village" is NOT a decay-blocking action — it's protection against a future raider attack system. The raider/defense mechanic is locked conceptually in this CONTEXT but **not built in Phase 2**. (Removes the old "Defend blocks next decay tick" meaning.)

### Movement Capture (active + passive)
- **D2-05:** **Two capture methods, both shipping in Phase 2:** active GPS tracker AND passive HealthKit/Health Connect reading (steps + workouts). This pulls passive health sync forward from where PROJECT.md tentatively parked it.
- **D2-06:** **Gap-fill reconciliation prevents double-counting.** Daily passive miles = total real movement for the day MINUS distance already credited by active sessions/workouts that day, floored at zero. The player always gets credit for total real movement, never twice.
- **D2-07:** **Passive reading uses the health platform's own distance value** (HealthKit/Health Connect distance-walked/running), not raw steps × estimated stride. More accurate, avoids stride guessing.
- **D2-08:** **Daily passive reconciliation resets at local midnight** (device timezone) — matches the "steps today" mental model and the platforms' daily buckets.
- **D2-09:** **Passive movement banks miles; it does NOT auto-feed food.** Passive miles bank like active sessions; the player still chooses to allocate them. Preserves "Move → Bank → Allocate" as the game. (The app-open prompt + hungry visuals mitigate the starvation risk for passive-only players.)

### GPS Tracker Screen
- **D2-10:** **Full-screen Mapbox map + pinned bottom stats sheet** (distance, pace, elapsed, large End button). Route polyline draws in real time.
- **D2-11:** **Session continues when leaving the Move tab**, with a persistent "● Recording — X mi" banner on every screen that taps back to the tracker. (Foreground-only; background location stays out of scope.)
- **D2-12:** **Poor GPS (>20m accuracy) is silently Kalman-filtered out**, with a small green/yellow/red accuracy indicator on the map. No session interruptions.
- **D2-13:** **End session → summary screen → Bank.** Summary shows route map, distance, multiplied miles, and the **auto-detected** activity type (display only). User confirms to bank.
- **D2-14:** **Orphaned session (app killed mid-session, MOV-07) auto-saves the partial silently** on next launch with a toast — no prompt.
- **D2-15:** **Passive miles are banked via an app-open prompt** ("You moved 0.8 mi today — add to bank?") after reconciliation, not silently.

### Activity Type & Multipliers
- **D2-16:** **Auto-detect activity type from pace + elevation/GPS signals; no manual override.** Pace bands plus elevation gain (hiking) and sustained high speed (cycling). Walking 1.0×, running 1.25×, cycling 1.25×, hiking 1.5×.
- **D2-17:** **Multiplier boosts banked miles; food conversion stays flat at 1 mi = 10 food.** Raw distance × multiplier = miles banked (applied once, at banking time). Faster activities indirectly buy more food. No compounding.
- **D2-18:** **Manual entry (MOV-08) derives pace from distance ÷ duration** and applies the same walking/running bands (no cycling/hiking indoors — no elevation data).
- **D2-19:** **Manual-entry anti-cheat: daily mile cap + pace sanity check** (reject impossible pace), server-validated. Cap lives in game_config.

### Allocate Miles Screen
- **D2-20:** **Bottom sheet over the village** (~70%, village visible behind), dismissible by swipe. Reinforces the "feed this village" connection.
- **D2-21:** **Options grouped by resource, basic survival actions first.** Phase 2 ships **Hunt Food, Gather Medicine, Chop Wood, Quarry Stone, and Defend** as the live set — wait, see D2-22 for the precise live scope.
- **D2-22:** **Phase 2 live allocations: Survival + Defend only.** Concretely the build set is **Hunt Food** (the survival action) plus the non-decaying gather actions where they make sense; Scout/Explore (need Phase 3 map) and Faction/Outpost/Move Camp (Phase 6) are NOT live this phase. Defend is shown conceptually but its raider effect is built later (D2-04). *Planner: treat Hunt Food as the only fully-wired survival allocation; confirm whether Gather/Chop/Quarry are wired now given their target resources don't decay — they may be deferred with Scout/Explore.*
- **D2-23:** **Tap-to-allocate-once + a quantity stepper for bulk** (e.g., Hunt ×3 = 3 mi → +30 food) before confirming. Efficient after long runs.

### Decay, Grace Period & Tuning
- **D2-24:** **Food decay: −4 per 6-hour tick (16/day)** → ~1.6 miles/day to maintain a full village. Forgiving/casual-friendly. Server-only Vercel Cron (VLG-06 invariant holds).
- **D2-25:** **24-hour grace period shown as a "Protected — Xh left" countdown badge** with reassuring first-time copy. Decay starts only after the window.
- **D2-26:** **game_config holds ALL tunable values:** food decay rate & cadence, food-per-mile rate & Hunt cost, grace-period hours + hungry threshold (20) + food cap (100), activity multipliers + their pace/elevation detection bands, manual-entry daily cap. Nothing hardcoded.

### Resource Meter Feedback
- **D2-27:** **Food meter: green → amber → red at ≤20** with a subtle pulse when Hungry, empty/red "Starving" at 0. **Colorblind-safe — always pair color with icon + text label** (per accessibility constraint), never color alone.
- **D2-28:** **Animated bar + narrative toast** on change: fills on hunt with a toast ("Your hunters return — +20 Food!"), drains on decay (shown on app-open, not as an interruption).

### Village View (home / Village tab)
- **D2-29:** **Illustrated village scene** as the background (static per state), with a **top overlay bar** for the Food meter + Mile Bank + (non-decaying) resource counts.
- **D2-30:** **Single placeholder illustration per state** (thriving / hungry / starving). Real art refined later — Phase 2 proves the mechanic.
- **D2-31:** **Mile Bank shown in the top resource bar** alongside food, so budget is visible while assessing need.
- **D2-32:** **Allocate via a floating action button** (bottom-right) → opens the allocation bottom sheet.
- **D2-33:** **State transitions communicated via visual change + narrative toast** ("Thornhaven grows hungry"). Not modal, not silent.
- **D2-34:** **Starving state = dark/desaturated illustration + a centered "Your village awaits your return" card** guiding the player to hunt food. Somber but hopeful, non-punishing.

### Village Bootstrapping & Map Tab
- **D2-35:** **Auto-create a default village on first authenticated launch** (default name e.g. "Thornhaven", full food). No placement/avatar yet — Phase 4 onboarding replaces this. Makes Phase 2 fully testable.
- **D2-36:** **Map tab stays a placeholder** this phase. Mapbox is integrated ONLY inside the Move/GPS tracker. The world map (fog, markers, landmarks) is Phase 3.

### Mile Bank Rules
- **D2-37:** **Banked miles never expire and have no cap** — matches PROJECT.md v1. Stockpiling is allowed; treadmill runners and weekend warriors can spend strategically.

### Offline Allocation
- **D2-38:** **Optimistic update + SQLite queue** (ALLOC-04). Resources update instantly; allocation queues offline and syncs on reconnect. A small "pending" badge near the Mile Bank shows unsynced count.
- **D2-39:** **Server is authoritative on sync** (ALLOC-05 atomic transactions). A queued allocation that fails validation (insufficient miles after reconciliation) is rejected with a clear toast; local state re-syncs to server truth.
- **D2-40:** **SQLite (expo-sqlite) is introduced this phase** for the offline queue (deferred from Phase 1 per D-12).

### Narrative Voice
- **D2-41:** **Warm high-fantasy, lightly playful** for all copy — immersive RPG flavor with a friendly tone, never grim or guilt-trippy. ("Your hunters return with a bountiful catch — +20 Food!" / "Thornhaven grows hungry.")

### Starving Reminders
- **D2-42:** **No out-of-app reminders in Phase 2.** In-app hungry/starving visuals + app-open prompt carry it; push notifications (incl. starvation alerts) are built in Phase 7.

### Claude's Discretion
- Exact SQLite schema for the offline allocation queue and sync bookkeeping.
- Kalman filter implementation/tuning details and the GPS sampling cadence.
- Mapbox style/config inside the tracker (the full fantasy style is a Phase 3 concern).
- Reconciliation bookkeeping mechanics (how per-day credited distance is tracked).
- The pace/elevation thresholds' starting numbers (seed sensible defaults into game_config; product tunes later).
- Toast/animation library choices and timing.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements & Roadmap (BEING UPDATED for this redesign)
- `.planning/REQUIREMENTS.md` — v1 requirements. **Phase 2 covers VLG-*, MOV-*, ALLOC-*, INFRA-02/04. The VLG-* and ALLOC-02 entries are being revised to the food-only survival model (D2-01..D2-04, D2-22). Planner: read the updated VILLAGE + ALLOCATION sections, not the originals.**
- `.planning/ROADMAP.md` — Phase 2 goal/success criteria. **Success criteria #2 (multi-resource allocation) and #4 (struggling/ruined transitions) are being reworded to the food-only model. Passive health-sync is now in Phase 2 scope.**

### Project Vision & Constraints
- `.planning/PROJECT.md` — Core Value (Move → Bank → Allocate), monetization ethics, decay-is-server-only invariant, balance invariant, North Star (WAM). Note: "Apple HealthKit + Google Health Connect passive sync" is pulled forward from product-Phase-2 into this GSD phase (D2-05).

### Phase 1 Foundation (code to build into)
- `.planning/phases/01-project-foundation/01-CONTEXT.md` — locked stack decisions (Zustand, TanStack Query, Supabase client singleton, Expo Router auth guard). D-12 (SQLite deferred) is now resolved here (D2-40).

No external ADRs/specs exist yet — requirements are captured in the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/mobile/lib/supabase.ts` — Supabase client singleton; all data access goes through it.
- `apps/mobile/store/useAuthStore.ts` — Zustand pattern to mirror for a new `useGameStore` (village/food/mile-bank state).
- `apps/mobile/app/(tabs)/village/index.tsx`, `move/index.tsx`, `map/index.tsx` — placeholder screens to build into (village + move become real; map stays placeholder).
- TanStack Query provider already wired in `apps/mobile/app/_layout.tsx` — use `useQuery`/`useMutation` for all Supabase server state.
- `supabase/migrations/` — existing migration pattern; Phase 2 adds `activities`, `allocations`, `game_config`, and food/state columns on `villages`.

### Established Patterns
- Auth guard / session via Zustand subscribed to `onAuthStateChange` — game data fetches gate on `session`.
- `EXPO_PUBLIC_*` env for client config; server secrets only in Vercel env (decay cron will run server-side).
- expo-secure-store as the auth storage adapter (SQLite localStorage subpath unavailable on SDK52).

### Integration Points
- New Vercel Cron endpoint (food decay) in `apps/api/` — server-only, every 6h, respects grace period + game_config.
- Mapbox SDK (`@rnmapbox/maps`) newly added — used only in the GPS tracker this phase.
- HealthKit (iOS) / Health Connect (Android) native modules newly added for passive reading.
- expo-sqlite newly added for the offline allocation queue.
- Supabase Storage for GeoJSON route upload (MOV-03).

</code_context>

<specifics>
## Specific Ideas

- **Core economy anchors (user-specified):** 1 mile → 10 food (so 0.1 mi = 1 food ≈ 0.161 km). Food range 0–100. Food decay −4/6h. These seed game_config.
- The user explicitly reframed the game around **food as the single heartbeat resource** and **raiders as a distinct future threat** — this is the defining decision of the phase and should anchor planning.
- Default village name reference: "Thornhaven" (placeholder, used in copy examples).
- Copy voice exemplar: "Your hunters return with a bountiful catch — +20 Food!" / "Thornhaven grows hungry."

</specifics>

<deferred>
## Deferred Ideas

- **Raider attack + Defend combat system** — concept locked (D2-04), built in a dedicated later phase. Medicine becomes the raider-damage recovery resource there.
- **Medicine / Wood / Stone / Morale active uses** — Wood/Stone → building construction (Phase 6), Morale → social/faction, Medicine → raiders. Non-decaying inputs until then.
- **Scout / Explore allocations** — need the Phase 3 world map (fog of war) to function.
- **Faction / Outpost / Move Camp allocations** — Phase 6.
- **Push notifications (incl. starvation alerts)** — Phase 7.
- **Real onboarding** (name + map placement + avatar) — Phase 4; Phase 2 uses an auto-created default village.
- **Full Mapbox fantasy world map** (fog, markers, landmark conversion) — Phase 3.
- **Background location tracking** — explicitly out of scope (foreground-only) until proven later.

</deferred>

---

*Phase: 2-Core Movement Loop*
*Context gathered: 2026-06-03*
