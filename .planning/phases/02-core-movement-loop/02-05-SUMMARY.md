---
phase: 02-core-movement-loop
plan: "05"
subsystem: food-decay-engine
tags: [pg-cron, decay, grace-period, drain-framing, server-only, vlg-06, vlg-08, colorblind-safe]
dependency_graph:
  requires: [02-01, 02-04]
  provides: [decay-migration, grace-badge, app-open-drain-framing]
  affects: [02-06-future, phase6-buildings]
tech_stack:
  added: []
  patterns:
    - "pg_cron over Vercel Cron for 6h tick (Vercel Hobby = once/day cap)"
    - "SECURITY DEFINER decay function: game_config-driven rates, no hardcoded balance values (INFRA-02)"
    - "GREATEST(0, food - rate) floor pattern — VLG-08 balance invariant"
    - "AppState foreground listener → queryClient.invalidateQueries (D2-28 server-read-on-resume)"
    - "lastSeenFoodRef diff detection — display-only delta, never client mutation (VLG-06)"
    - "Animated fade-in drain toast (non-modal, non-interrupting) — D2-28/D2-33"
    - "GraceBadge setInterval 60s countdown refresh — display only, no food mutation"
key_files:
  created:
    - supabase/migrations/20260604020000_phase2_decay_cron.sql
    - apps/mobile/components/village/GraceBadge.tsx
    - apps/mobile/__tests__/graceBadge.test.ts
  modified:
    - apps/mobile/hooks/useVillage.ts
    - apps/mobile/app/(tabs)/village/index.tsx
decisions:
  - "pg_cron over Vercel Cron: Vercel Hobby caps cron at once/day; pg_cron is free, internal to Postgres, zero network hop"
  - "COALESCE fallback in decay function: game_config rows are authoritative but function has hardcoded fallbacks as safety net"
  - "lastSeenFoodRef not useState: avoids re-render loops while preserving the previous-value comparison"
  - "Drain toast uses Animated (not Alert): non-blocking, auto-dismissing, respects D2-28 'not an interruption'"
  - "GraceBadge setInterval for minute-level display refresh: display-only, not a decay timer (VLG-06)"
  - "computeRemaining exported pure function pattern for testability without React Native render harness"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-04"
  tasks_completed: 2
  tasks_deferred: 1
  files_created: 3
  files_modified: 2
---

# Phase 2 Plan 05: Food Decay Engine + Grace Badge + Drain Framing Summary

Server-only 6h food decay via Supabase pg_cron (`decay_village_food()` reading game_config-driven rates, GREATEST(0) floor, grace skip, food_state recompute) + `GraceBadge` "Protected — Xh left" countdown component + app-open narrative drain animation on foreground refetch — no client food mutation anywhere.

---

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | decay_village_food() + pg_cron schedule migration | 0d5a5d9 | Done (push DEFERRED) |
| 2 | GraceBadge + app-open drain framing | a787986 | Done |
| 3 | Verify decay tick + grace + state transitions (manual SQL + device) | — | **DEFERRED** |

---

## Deferred — Device/Build Punch-List

These steps require a physical device, Supabase SQL editor access, or interactive CLI auth. All code is complete.

| # | Action / Command | Why Deferred | Blocking For |
|---|-----------------|-------------|--------------|
| D-1 | `npx supabase db push` (from repo root with `SUPABASE_ACCESS_TOKEN` set) to apply `20260604020000_phase2_decay_cron.sql` | Requires Supabase CLI auth; non-interactive on Windows requires env var set | Live decay loop; pg_cron job 'food-decay-6h' |
| D-2 | Verify in Supabase SQL editor: `SELECT jobname, schedule FROM cron.job WHERE jobname='food-decay-6h'` returns `'0 */6 * * *'` | Confirms pg_cron enabled (Assumption A3) and schedule applied | Task 3 manual verification |
| D-3 | Assumption A3 check: if `CREATE EXTENSION IF NOT EXISTS pg_cron` fails (platform restriction), implement the client-side fallback: call `supabase.rpc('decay_village_food')` on app foreground in `useVillage`. This preserves server-authoritativeness — only the schedule trigger changes. | pg_cron enablement depends on Supabase plan/region | Decay running at all |
| D-4 | Supabase SQL editor: `SELECT public.decay_village_food();` on a village past grace → confirm food dropped by exactly 2.5 and food_state recomputed (VLG-06 manual test) | Requires live Supabase DB with migration applied | VLG-06 verification |
| D-5 | Supabase SQL editor: run decay on a village inside grace (grace_expires_at > now()) → confirm food unchanged | Requires live DB | D2-25 grace skip verification |
| D-6 | Invoke decay 40× on a village with food=100 → confirm food floors at 0 and food_state='starving' (GREATEST(0,...) floor, T-02E-BAL) | Requires live DB | Balance invariant VLG-08 |
| D-7 | Device: on app resume after manual decay, confirm animated drain toast appears with correct narrative copy (D2-28/D2-33) | Requires device + live Supabase | Drain framing UX acceptance |
| D-8 | Device: confirm GraceBadge shows "Protected — Xh left" on new village and disappears after grace expires | Requires device + time (or manual grace_expires_at update) | D2-25 visual acceptance |
| D-9 | Device: full loop — set food=0 (starving), Hunt Food (Plan D), verify village unlocks; then wait for (or manually trigger) next decay tick → confirm drain toast fires (VLG-05 + D2-28 loop) | Requires device + live DB | Full move→bank→allocate→decay loop (VLG-06 E2E) |
| D-10 | Balance invariant device check: set village food=100 via SQL, trigger one decay → confirm food=97.5 (not 0, not unchanged) (VLG-08) | Requires live DB | VLG-08 final sign-off |

---

## What Was Built

### Task 1 — `decay_village_food()` + pg_cron schedule (commit 0d5a5d9)

**`supabase/migrations/20260604020000_phase2_decay_cron.sql`**:

- `CREATE EXTENSION IF NOT EXISTS pg_cron` — enables pg_cron once (idempotent)

- `public.decay_village_food()` RETURNS void, LANGUAGE plpgsql, SECURITY DEFINER:
  - Reads `food_decay_per_tick` and `food_hungry_threshold` from `game_config` — nothing hardcoded (INFRA-02 / T-02E-CFG)
  - `COALESCE` fallback to 2.5 / 20 if config rows missing (safety net)
  - Forward-compat comment for VLG-07 Watchtower building modifier (Phase 6): exact integration point marked in function body
  - VLG-09 raiders explicitly called out as a distinct future system — NOT implemented here
  - `WHERE grace_expires_at < NOW()` — villages inside their 24h window are skipped entirely (VLG-06/D2-25)
  - `food = GREATEST(0, food - v_decay_rate)` — floors at 0, never negative (T-02E-BAL / VLG-08)
  - `food_state = CASE WHEN ... = 0 THEN 'starving' WHEN ... <= v_hungry_threshold THEN 'hungry' ELSE 'thriving' END` — consistent with `allocate_food()` CASE pattern (Plan D)
  - `last_decay_at = NOW(), updated_at = NOW()` — timestamp bookkeeping

- `SELECT cron.schedule('food-decay-6h', '0 */6 * * *', 'SELECT public.decay_village_food()')` — every 6 hours at :00 UTC; replaces existing job on re-run (idempotent)

- `GRANT EXECUTE ... TO authenticated` — allows PostgREST + pg_cron to call the function

- No Vercel cron endpoint added (Pitfall 1 / T-02E-DOS — no HTTP surface for decay)

Security mitigations (all four STRIDE threats):
- T-02E-CLI: decay runs only in `decay_village_food()` via pg_cron — client never mutates food on timer
- T-02E-DOS: pg_cron is internal to Postgres; no HTTP endpoint exposed
- T-02E-CFG: rate read from `game_config` inside function; client cannot alter (SELECT-only RLS from Plan A)
- T-02E-BAL: `GREATEST(0, ...)` floors at 0 only; no zero-decay path — balance invariant holds

### Task 2 — GraceBadge + app-open drain framing (commit a787986)

**`apps/mobile/components/village/GraceBadge.tsx`** (new):
- `computeRemaining(graceExpiresAt)` pure function: ISO → "Xh left" / "Xm left" / "expiring soon" / null
- `GraceBadge` component: renders if remaining > 0; hides when expired
- 60s `setInterval` ticker updates the display string (NOT a decay timer — VLG-06)
- Shield icon (🛡️) + label + time: colorblind-safe (D2-27, icon + text, never color alone)
- `compact` prop for tight top-bar inline rendering
- Accessibility label: "Your village is protected — Xh left"

**`apps/mobile/__tests__/graceBadge.test.ts`** (new): 13 unit tests:
- Hours remaining (24h, 6h, 1h exact)
- Sub-hour minutes (30m, 1m)
- Sub-minute "expiring soon"
- Expired exactly at now → null
- Expired 1h / 24h ago → null
- Invalid string / empty string → null
- VLG-06 guard: result never contains a negative sign
- Floor test: "1h 59m left" → "1h left" not "2h left"

**`apps/mobile/hooks/useVillage.ts`** (modified):
- Added `AppState.addEventListener('change', ...)` — invalidates `['village', userId]` query on 'active' state (foreground resume)
- Client NEVER applies decay: `queryClient.invalidateQueries` triggers a server read, not a local food subtraction (VLG-06)
- Added `lastSeenFoodRef` (useRef, not useState) to track previous food without re-render loops
- Returns `foodDropDetected: boolean` and `foodDelta: number` (≤ 0) for drain framing
- Added `last_decay_at` to the village SELECT query

**`apps/mobile/app/(tabs)/village/index.tsx`** (modified):
- Replaced inline `graceBadge` styles/JSX with `<GraceBadge graceExpiresAt={village.grace_expires_at} compact />` (D2-25)
- Removed old `formatGraceRemaining` helper (now inside GraceBadge)
- Added animated drain toast:
  - Triggered when `foodDropDetected` is true (server reported lower food)
  - `getDrainCopy(villageName, foodDelta, foodState)` produces warm high-fantasy narrative (D2-41):
    - starving: "Thornhaven is starving — your village awaits your return."
    - hungry: "Thornhaven grows hungry — 2.5 food consumed."
    - thriving: "Thornhaven consumed 2.5 food while you were away."
  - `Animated.sequence(fadeIn 400ms → delay 4s → fadeOut 600ms)` — auto-dismissing
  - `pointerEvents="none"` — never blocks interaction (D2-28: not an interruption)
  - `accessibilityLiveRegion="polite"` — accessible to screen readers
  - `drainShownRef` guard prevents repeated toasts on re-renders of the same data

---

## Deviations from Plan

None — plan executed exactly as written (deferral policy honored).

The push of `20260604020000_phase2_decay_cron.sql` is DEFERRED per the explicit deferral policy in the execution context (no `supabase db push` on device-required steps). Task 3 (manual SQL + device verification) is DEFERRED in full per the same policy.

---

## Threat Surface Scan

All new surfaces match the plan's `<threat_model>`. No unexpected surfaces:

| Boundary | Surface | Status |
|----------|---------|--------|
| pg_cron → villages (internal) | `decay_village_food()` runs inside Postgres; no HTTP surface (T-02E-DOS) | Mitigated |
| client → villages.food | `useVillage` reads server food; `foodDelta` is display-only; no client writes (T-02E-CLI) | Mitigated |
| game_config → decay rate | Rate read inside function; game_config is SELECT-only RLS (T-02E-CFG) | Mitigated |
| balance invariant | GREATEST(0,...) + no zero-decay path (T-02E-BAL / VLG-08) | Mitigated |

---

## Known Stubs

None. GraceBadge reads real `grace_expires_at` from the server. Drain framing reads real `food` delta from server fetches. No placeholder values flow to UI.

---

## Test Results

```
node node_modules/jest/bin/jest.js --no-coverage (from apps/mobile)

Test Suites: 9 passed, 9 total
Tests:       76 passed, 76 total  (13 new from graceBadge.test.ts)
Time:        ~1.9s

tsc --noEmit (apps/mobile): Exit 0 — clean
```

---

## Self-Check

| Check | Result |
|-------|--------|
| supabase/migrations/20260604020000_phase2_decay_cron.sql | FOUND |
| apps/mobile/components/village/GraceBadge.tsx | FOUND |
| apps/mobile/__tests__/graceBadge.test.ts | FOUND |
| apps/mobile/hooks/useVillage.ts (AppState + foodDropDetected) | FOUND |
| apps/mobile/app/(tabs)/village/index.tsx (GraceBadge + drain toast) | FOUND |
| Commit 0d5a5d9 (Task 1 — decay migration) | FOUND |
| Commit a787986 (Task 2 — GraceBadge + drain) | FOUND |
| grep decay_village_food — cron.schedule, food_decay_per_tick, GREATEST(0 | 19 matches |
| No client food mutations (grep: food -= / food = food -) | CLEAN |
| npm test — 9 suites, 76 tests | PASSED |
| tsc --noEmit | PASSED (exit 0) |

## Self-Check: PASSED
