---
phase: 02-core-movement-loop
plan: "01"
subsystem: village-foundation
tags: [supabase-schema, native-packages, config-plugins, village-ui, state-machine, tdd]
dependency_graph:
  requires: [01-project-foundation]
  provides: [phase2-schema, phase2-packages, village-state-machine, village-ui, wave0-test-scaffolds]
  affects: [02-02-plan-b, 02-03-plan-c, 02-04-plan-d, 02-05-plan-e]
tech_stack:
  added:
    - "@rnmapbox/maps@10.3.1 — Mapbox GL native map (Plan B GPS tracker)"
    - "expo-location@~56.0.15 — foreground GPS, permission flow"
    - "react-native-health@1.19.0 — iOS HealthKit passive reading (Plan C)"
    - "react-native-health-connect@3.5.3 — Android Health Connect (Plan C)"
    - "expo-health-connect@0.1.1 — Android Health Connect Expo config plugin"
    - "@react-native-community/netinfo@12.0.1 — offline/online detection (Plan D)"
    - "expo-build-properties@~56.0.16 — Android SDK version pins (minSdk 26)"
  patterns:
    - "Zustand game store (useGameStore) mirroring useAuthStore pattern"
    - "TanStack Query hooks (useVillage, useGameConfig) for all Supabase server state"
    - "Pure TypeScript state machine (foodToState) — no framework dependencies"
    - "Colorblind-safe UI pattern: color + icon + text label on every resource meter"
    - "useSafeAreaInsets for absolute-positioned overlays (avoids SafeAreaView TS conflict)"
key_files:
  created:
    - supabase/migrations/20260604000000_phase2_game.sql
    - apps/mobile/lib/villageState.ts
    - apps/mobile/store/useGameStore.ts
    - apps/mobile/hooks/useGameConfig.ts
    - apps/mobile/hooks/useVillage.ts
    - apps/mobile/components/village/FoodMeter.tsx
    - apps/mobile/components/village/VillageScene.tsx
    - apps/mobile/__tests__/villageState.test.ts
    - apps/mobile/__tests__/kalman.test.ts
    - apps/mobile/__tests__/activityDetector.test.ts
    - apps/mobile/__tests__/gapFill.test.ts
    - apps/mobile/__tests__/sqliteQueue.test.ts
    - apps/api/__tests__/activity.test.ts
  modified:
    - apps/mobile/app/(tabs)/village/index.tsx
    - apps/mobile/package.json
    - apps/mobile/app.config.js
    - apps/mobile/jest.config.js
    - apps/mobile/tsconfig.json
    - package-lock.json
decisions:
  - "pg_cron for 6-hour food decay (not Vercel Cron) — Vercel Hobby limited to once/day"
  - "foodToState threshold is an argument, not hardcoded — INFRA-02 compliance"
  - "useSafeAreaInsets over SafeAreaView in new screens — avoids pre-existing TS conflict"
  - "jest.config.js react moduleNameMapper — fixes zustand module resolution in npm workspaces"
metrics:
  duration: "~90 minutes"
  completed: "2026-06-04"
  tasks_completed: 3
  tasks_deferred: 1
  files_created: 13
  files_modified: 6
---

# Phase 2 Plan 01: Phase 2 Foundation (Schema + Packages + Village UI) Summary

Phase 2 foundation delivered: Supabase migration with food/state/grace schema + activities + allocations + game_config (18 seed keys), 7 native packages installed with Expo config-plugin chain, 6 Wave-0 test scaffolds, pure foodToState state machine (11 tests green), and real Village screen with colorblind-safe FoodMeter + auto-created Thornhaven default village.

---

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 0 | Package legitimacy gate | — | Pre-approved by user; no commit needed |
| 1 | Migration + packages + plugin chain | 99a8a8a | Done |
| 2 | supabase db push + expo prebuild | — | **DEFERRED** (device/build step) |
| 3 | Wave-0 scaffolds + villageState state machine | c2ffdd7 | Done |
| 4 | useGameStore + hooks + Village screen UI | 0936a4e | Done |

---

## Deferred — Device/Build Punch-List

These steps require physical device access, an Android emulator, or interactive CLI login.
Execute these before running Wave-2 plans (02-02 through 02-05).

| # | Command | Why Deferred | Blocking For |
|---|---------|-------------|--------------|
| D-1 | `npx supabase db push` (from repo root with `SUPABASE_ACCESS_TOKEN` set) | Requires Supabase CLI auth token + live DB connection; non-interactive on Windows requires env var | All plans that query the live DB (useVillage, useGameConfig, activities) |
| D-2 | Verify in Supabase SQL editor: `SELECT count(*) FROM public.game_config;` returns ≥ 18 | Confirms migration applied + seed ran | useGameConfig hook correctness |
| D-3 | Verify in Supabase SQL editor: `SELECT food, food_state, grace_expires_at FROM public.villages LIMIT 1;` succeeds | Confirms ALTER TABLE columns exist | useVillage hook schema compatibility |
| D-4 | Verify Storage tab: 'routes' bucket exists with `routes_upload_own` + `routes_read_own` RLS policies | Confirms storage migration applied | Plan B (02-02) GeoJSON route upload |
| D-5 | Add `EXPO_PUBLIC_MAPBOX_TOKEN=pk.*` to `apps/mobile/.env` (from console.mapbox.com → Access tokens → Default public token) | Mapbox token must exist before prebuild | @rnmapbox/maps initialisation in Plan B |
| D-6 | `cd apps/mobile && npx expo prebuild --clean` | Regenerates native Android/iOS projects with new plugins (Mapbox, Health, minSdk 26). Requires Windows environment with Android SDK tools or use EAS cloud | Any native feature in Plans B/C/D |
| D-7 | EAS cloud iOS build: `cd apps/mobile && npx eas build -p ios --profile development` | iOS prebuild on Windows requires EAS cloud; Apple Developer account + HealthKit capability needed for Plan C | Plan C (02-03) HealthKit smoke test |

---

## What Was Built

### Task 1 — Phase 2 Migration + Packages + Config Plugin Chain (commit 99a8a8a)

**Migration** `supabase/migrations/20260604000000_phase2_game.sql`:
- `ALTER TABLE public.villages ADD` food, food_state (CHECK thriving/hungry/starving), medicine, wood, stone, morale, grace_expires_at, last_decay_at
- `ALTER TABLE public.profiles ADD` miles_banked (canonical Mile Bank per VLG-02)
- `CREATE TABLE public.activities` with RLS owner-scoped policy (T-02-ID)
- `CREATE TABLE public.allocations` with RLS + UNIQUE idempotency_key (ALLOC-05)
- `CREATE TABLE public.game_config` with SELECT-only RLS (T-02-04, no client writes)
- 18 seeded game_config rows (food decay, multipliers, thresholds, Kalman params)
- Supabase Storage `routes` bucket + own-folder upload/read RLS policies (MOV-03)
- Forward-compatible comments on VLG-07 Watchtower modifier and VLG-08 balance invariant

**Packages installed** (7 new, `--legacy-peer-deps`):
`@rnmapbox/maps@10.3.1`, `expo-location@~56`, `react-native-health@1.19.0`, `react-native-health-connect@3.5.3`, `expo-health-connect@0.1.1`, `@react-native-community/netinfo@12.0.1`, `expo-build-properties@~56`

**app.config.js plugin chain** (9 plugins total): added `@rnmapbox/maps`, `expo-location` (locationWhenInUsePermission), `react-native-health` (share/update), `expo-health-connect`, `expo-build-properties` (minSdk 26, targetSdk 35, compileSdk 35). No Mapbox download token (deprecated per v10.3.1).

### Task 3 — villageState State Machine + Wave-0 Scaffolds (commit c2ffdd7)

**`apps/mobile/lib/villageState.ts`** — pure `foodToState(food, hungryThreshold): VillageState`:
- food <= 0 → 'starving'; food <= hungryThreshold → 'hungry'; else 'thriving'
- Threshold is a parameter — no hardcoded balance numbers (INFRA-02)

**`apps/mobile/__tests__/villageState.test.ts`** — 11 passing assertions (VLG-03):
- Covers all boundaries: food=100, 21, 20, 10, 1, 0, -1; custom thresholds

**5 Wave-0 scaffolds** (it.todo placeholders, all suites passing with 0 failures):
- `kalman.test.ts` (MOV-02) → Plan B
- `activityDetector.test.ts` (MOV-04) → Plan B
- `gapFill.test.ts` (MOV-06/07/12) → Plan C
- `sqliteQueue.test.ts` (ALLOC-04) → Plan D
- `apps/api/__tests__/activity.test.ts` (MOV-08 supertest) → Plan B

### Task 4 — Village UI Layer (commit 0936a4e)

**`useGameStore.ts`** — Zustand store mirroring useAuthStore: holds VillageSnapshot, isSessionActive (false until Plan B), pendingAllocations. Setters: setVillage, setSessionActive, setPendingAllocations.

**`useGameConfig.ts`** — TanStack Query hook, selects all game_config rows, returns key→value map, staleTime 30 minutes (INFRA-02 compliance).

**`useVillage.ts`** — TanStack Query hook:
- Fetches owner's village; auto-inserts Thornhaven if none found (D2-35)
- Joins profiles.miles_banked for Mile Bank
- Syncs VillageSnapshot into useGameStore after every successful fetch

**`FoodMeter.tsx`** — Colorblind-safe animated food bar (VLG-04/D2-27):
- State-specific: `thriving`=green/🌾/"Thriving", `hungry`=amber/⚠️/"Hungry"+pulse, `starving`=red/💀/"Starving"
- Color + icon + text label — never color alone
- Animated pulse (Animated.loop) when hungry (D2-28)

**`VillageScene.tsx`** — Per-state placeholder illustration:
- Thriving: earthy green background + 🏡
- Hungry: muted amber + 🏚️
- Starving: near-black + 💀 + dark overlay + "Your village awaits your return" card (D2-34)

**`app/(tabs)/village/index.tsx`** (replaced placeholder):
- Full-bleed VillageScene background
- Top overlay bar with FoodMeter + villageName + grace badge + ResourceChip row (Miles/Medicine/Wood/Stone/Morale)
- All balance values from useGameConfig (INFRA-02 — no hardcoded numbers)
- Bottom-right FAB placeholder (Plan D wires the allocation sheet)
- Uses `useSafeAreaInsets` (avoids pre-existing SafeAreaView TS conflict)

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing `@types/react` version conflict causing `SafeAreaView` TS error**
- **Found during:** Task 4 `tsc --noEmit` check
- **Issue:** `@types/react@18.3.x` added `bigint` to `ReactNode`, conflicting with `react-native-safe-area-context`'s component types. Pre-existing on map/move/profile screens.
- **Fix:** Added `"skipLibCheck": true` to `apps/mobile/tsconfig.json`; replaced `SafeAreaView` usage in the new village screen with `useSafeAreaInsets` (better pattern for position:absolute overlays)
- **Files modified:** `apps/mobile/tsconfig.json`, `apps/mobile/app/(tabs)/village/index.tsx`
- **Commit:** 0936a4e

**2. [Rule 3 - Blocking] npm workspace hoisting broke Jest `react` module resolution for zustand**
- **Found during:** Task 4 `npm test` after running root `npm install` during the `@types/react` fix attempt
- **Issue:** After running `npm install` at repo root, `zustand` remained hoisted to root `node_modules/` but `react` was only in `apps/mobile/node_modules/`. Jest (running from `apps/mobile/`) resolved `zustand` from root but couldn't follow the `react` require from there.
- **Fix:** Added explicit `react` and `react/*` entries to `jest.config.js` `moduleNameMapper` to force resolution to `apps/mobile/node_modules/react`
- **Files modified:** `apps/mobile/jest.config.js`
- **Commit:** 0936a4e

**3. [Rule 2 - Missing Critical] `@types/react` downgrade attempt via npm override removed root react**
- **Found during:** Debugging the SafeAreaView TS error
- **Issue:** Adding `overrides: { "@types/react": "~18.2.79" }` to root `package.json` caused npm to de-hoist `react` itself from root, breaking zustand in jest. Reverted the override immediately.
- **Fix:** Reverted the override; relied on `skipLibCheck` + `moduleNameMapper` instead
- **Files reverted:** `package.json` (override reverted)

---

## Threat Surface Scan

All new surfaces match the plan's `<threat_model>`. No unexpected surfaces introduced:

| Boundary | Surface | Status |
|----------|---------|--------|
| client → Supabase | game_config SELECT-only (T-02-04) | Mitigated — no client writes |
| client → Supabase | activities/allocations owner-scoped RLS (T-02-ID) | Mitigated |
| client → Supabase | villages food read-only in client (T-02-DEC) | Mitigated — no client decay |
| Supply chain | 7 native packages | Mitigated — package legitimacy pre-approved (Task 0) |

---

## Test Results

```
npm test --workspace=apps/mobile

Test Suites: 7 passed, 7 total
Tests:       22 todo (Wave-0 scaffolds), 16 passed, 38 total
Time:        ~2s

tsc --noEmit: Exit 0 (clean)
```

Wave-0 villageState suite: **11 assertions covering all VLG-03 boundaries** (thriving >20, hungry ≤20 and >0, starving =0, custom thresholds).

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| supabase/migrations/20260604000000_phase2_game.sql | FOUND |
| apps/mobile/lib/villageState.ts | FOUND |
| apps/mobile/store/useGameStore.ts | FOUND |
| apps/mobile/hooks/useGameConfig.ts | FOUND |
| apps/mobile/hooks/useVillage.ts | FOUND |
| apps/mobile/components/village/FoodMeter.tsx | FOUND |
| apps/mobile/components/village/VillageScene.tsx | FOUND |
| apps/mobile/app/(tabs)/village/index.tsx | FOUND |
| apps/mobile/__tests__/villageState.test.ts | FOUND |
| apps/mobile/__tests__/kalman.test.ts | FOUND |
| apps/mobile/__tests__/activityDetector.test.ts | FOUND |
| apps/mobile/__tests__/gapFill.test.ts | FOUND |
| apps/mobile/__tests__/sqliteQueue.test.ts | FOUND |
| apps/api/__tests__/activity.test.ts | FOUND |
| .planning/phases/02-core-movement-loop/02-01-SUMMARY.md | FOUND |
| Commit 99a8a8a (Task 1) | FOUND |
| Commit c2ffdd7 (Task 3) | FOUND |
| Commit 0936a4e (Task 4) | FOUND |
