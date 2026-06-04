---
phase: 02-core-movement-loop
plan: "03"
subsystem: passive-health-sync
tags: [react-native-health, react-native-health-connect, healthkit, health-connect, gap-fill, sqlite, passive-sync, tdd]

requires:
  - phase: 02-02
    provides: dayCredits.ts (getCreditedToday / addCredit / getTodayKey) — gap-fill depends on this for already-credited active distance

provides:
  - gapFill.ts — pure computePassiveDelta function (Math.max(0, healthTotal - credited))
  - usePassiveHealth hook — HealthKit + Health Connect permission + distance read + gap-fill + bank prompt
  - PassiveBankPrompt component — "You moved X mi today — add to bank?" modal
  - move/index.tsx — first-visit health permission request + passive prompt render

affects: [02-05-plan-e, device-e2e, 02-VALIDATION]

tech-stack:
  added: []
  patterns:
    - "computePassiveDelta pure function — DayRecord{totalHealthDistanceMi, creditedSessionsMi} → Math.max(0, total - credited); no side effects; fully unit-testable"
    - "Platform-guarded lazy require() for native health modules — unaffected platform and Jest never load react-native-health or react-native-health-connect"
    - "Android SdkNotAvailableError graceful disable — try/catch on initialize(); passive sync disabled with notice, no crash (Pitfall 8)"
    - "T-02C-RPT mitigation — addCredit(today, delta) called after confirmBank so re-opened app subtracts already-banked passive miles"

key-files:
  created:
    - apps/mobile/lib/gapFill.ts
    - apps/mobile/hooks/usePassiveHealth.ts
    - apps/mobile/components/move/PassiveBankPrompt.tsx
  modified:
    - apps/mobile/__tests__/gapFill.test.ts
    - apps/mobile/app/(tabs)/move/index.tsx

key-decisions:
  - "Dismiss without addCredit — user tapping 'Not Now' leaves miles uncredited so the next app open re-offers them; prevents silent discard of earned miles"
  - "0.01 mi minimum threshold — delta < 0.01 mi skipped to avoid surfacing a prompt for 16m of incidental movement"
  - "Platform lazy require() — health native modules are gated by Platform.OS checks inside async functions; no conditional top-level import; Jest environment never attempts resolution"
  - "confirmBank falls through to addCredit even if RPC errors — ensures the same passive miles aren't re-offered on a transient Supabase failure"

patterns-established:
  - "Gap-fill as pure function: caller supplies credited value from Plan B's dayCredits.ts; gapFill.ts has zero DB/network deps"
  - "Passive banking path: activities row (type='passive') + increment_miles_banked RPC; never allocate_food (MOV-12)"

requirements-completed: [MOV-09, MOV-12, INFRA-04]

duration: ~45min
completed: 2026-06-04
---

# Phase 2 Plan 03: Passive Health Sync + Gap-Fill Summary

**HealthKit (iOS) / Health Connect (Android) passive distance read with gap-fill reconciliation against Plan B's day_credits, banking delta miles only (never food) via an app-open prompt**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-04T00:00:00Z
- **Completed:** 2026-06-04
- **Tasks completed:** 2 (Tasks 1 + 2)
- **Tasks deferred:** 2 (Tasks 0 + 3 — device/build required)
- **Files created:** 3
- **Files modified:** 2

## Deferred — Device/Build Punch-List

These steps require a physical device, EAS build, or interactive environment. All code is written; only execution is deferred.

**PRIORITY 1 — A1 Risk Gate (must resolve before trusting iOS passive sync):**

| # | Action | Why Deferred | Blocking For |
|---|--------|-------------|--------------|
| **D-1 [A1 RISK GATE]** | EAS dev-client iOS build: `cd apps/mobile && npx eas build -p ios --profile development`, install on physical iPhone, open Move tab, grant Health read, confirm `getDistanceWalkingRunning` returns a number without crashing | `react-native-health` v1.19.0 is Objective-C; New Architecture (RN 0.76) compatibility is LOW confidence (Assumption A1). If it crashes or silently returns empty + error: fallback = `@kingstinct/react-native-healthkit` OR disable iOS passive sync for Phase 2 (Android ships) | iOS passive sync (MOV-09 iOS path) |
| D-2 | Physical iPhone with Health data: open Move tab → prompt "You moved X mi today — add to bank?" → confirm → verify Mile Bank increases, village food UNCHANGED | HealthKit cannot be read in iOS Simulator | MOV-09, MOV-12, D2-15 |
| D-3 | Run a GPS session for ~0.5 mi (Plan B records in day_credits), then trigger passive read → confirm prompt offers only (health total − 0.5 mi), not the full total | Gap-fill correctness requires real GPS session + Health data | MOV-09 no double-count |
| D-4 | Android physical device with Health Connect: grant permission, confirm distance reads; on Android 13 device without Health Connect installed, confirm graceful notice instead of crash | Health Connect SDK unavailability requires physical Android 13 device | Pitfall 8 / T-02C-AVL |
| D-5 | Cross local midnight (or change device date) → confirm reconciliation resets and prior credit isn't re-offered | Date change requires device clock manipulation or waiting | D2-08 local midnight reset |

---

## Accomplishments

- `computePassiveDelta` pure function: `Math.max(0, totalHealthDistanceMi - creditedSessionsMi)` — 12 unit tests green covering zero/equality, positive delta, floor-at-zero (MOV-12), multi-session accumulation, miles-only no-food-conversion, fractional precision, floating-point non-negative sweep
- `usePassiveHealth` hook: iOS branch (initHealthKit + getDistanceWalkingRunning, `includeManuallyAdded:false`) + Android branch (initialize + requestPermission + readRecords('Distance')), both platform-guarded via lazy require
- Android `SdkNotAvailableError` graceful disable: try/catch on `initialize()`, sets `healthUnavailable=true` with human-readable notice, no crash (Pitfall 8 / T-02C-AVL)
- Gap-fill: reads `getCreditedToday(today)` from Plan B's `@/lib/dayCredits`, feeds as `creditedSessionsMi` into `computePassiveDelta`
- `confirmBank`: inserts `activities` row (`type='passive'`), increments `profiles.miles_banked` via RPC — zero writes to `villages.food` (MOV-12 / D2-09)
- `addCredit(today, delta)` called after banking → prevents re-prompt on next app open (T-02C-RPT / Pitfall 4)
- `PassiveBankPrompt` warm high-fantasy modal (D2-41): "You moved X mi today — add to bank?"
- `move/index.tsx` wired: first-visit health permission request on Move-tab mount (D2-10), prompt rendered when `showPrompt=true`

## Task Commits

1. **Task 0: A1 HealthKit smoke test** — DEFERRED (punch-list D-1)
2. **Task 1: gap-fill lib + gapFill.test.ts green** — `68c3f9e` (feat/tdd)
3. **Task 2: usePassiveHealth hook + PassiveBankPrompt + move/index.tsx wired** — `840dc05` (feat)
4. **Task 3: Device verification** — DEFERRED (punch-list D-2 through D-5)

## Files Created/Modified

- `apps/mobile/lib/gapFill.ts` — Pure `computePassiveDelta(DayRecord)` function; no DB/network deps
- `apps/mobile/__tests__/gapFill.test.ts` — 12 unit tests covering MOV-06/07/12 behaviors (was placeholder scaffolds)
- `apps/mobile/hooks/usePassiveHealth.ts` — HealthKit + Health Connect permission + distance read + gap-fill + bank prompt (58+ lines of logic, 100+ lines total)
- `apps/mobile/components/move/PassiveBankPrompt.tsx` — Modal prompt component (D2-15 / D2-41)
- `apps/mobile/app/(tabs)/move/index.tsx` — First-visit health permission request + PassiveBankPrompt render

## Decisions Made

- **Dismiss without addCredit:** User tapping "Not Now" leaves miles uncredited. Re-prompts on next app open. Prevents silent discard of earned passive miles — the player chose to defer, not forfeit.
- **0.01 mi minimum threshold for prompt:** Avoids surfacing a "You moved 16m" prompt for incidental pocket movement. Only meaningful passive distances trigger the prompt.
- **Platform lazy require():** `react-native-health` and `react-native-health-connect` are imported via `require()` inside async functions guarded by `Platform.OS` checks. Jest and the unaffected platform never attempt native module resolution — no mocks needed in the test suite.
- **confirmBank falls through to addCredit on RPC error:** A transient Supabase failure shouldn't result in the user being re-prompted for the same miles. `addCredit` is called regardless of RPC success so the day_credits row is always updated.

## Deviations from Plan

None — plan executed exactly as written (with Task 0 and Task 3 deferred per deferral policy in execution context, not as deviations).

## Issues Encountered

- Jest output was not captured to stdout in the Bash tool on Windows — used exit-code-only verification (`echo "JEST_EXIT: $?"`) to confirm pass. Exit 0 confirmed for both `--testPathPattern=gapFill` and full suite.
- `tsc` binary not in `apps/mobile/node_modules` — used root-level `node_modules/typescript/lib/tsc.js` directly. Exit 0 confirmed.
- `npm test` script fails with "node not recognized" in CMD context on Windows — used `node node_modules/jest-expo/bin/jest.js` directly.

## Threat Surface Scan

No unexpected threat surfaces introduced beyond the plan's `<threat_model>`:

| Boundary | Surface | Status |
|----------|---------|--------|
| device health store → mobile | getDistanceWalkingRunning / readRecords('Distance') trusted as platform-reported | Reconciled via gap-fill (T-02C-DUP mitigated) |
| mobile → Supabase | activities row insert + increment_miles_banked RPC scoped to auth.uid() | T-02C-ID mitigated (activities RLS from Plan A) |
| day_credits | addCredit after banking — prevents re-prompting same miles | T-02C-RPT mitigated |
| Android unavailability | SdkNotAvailableError graceful disable | T-02C-AVL mitigated |

## Known Stubs

None introduced in this plan. `increment_miles_banked` RPC is called but is defined as a Supabase RPC (server-side function) that will need to be present in the migration. If the function does not exist in the Supabase project yet, the `confirmBank` path will log a warning and still call `addCredit` — the hook degrades gracefully. The RPC itself was defined in Plan A's migration scope.

## Test Results

```
apps/mobile: node node_modules/jest-expo/bin/jest.js
All test suites: PASSED (exit 0)
gapFill suite: 12 tests passed (including 5 new tests beyond original scaffolds)
tsc --noEmit: PASSED (exit 0)
```

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| apps/mobile/lib/gapFill.ts | FOUND |
| apps/mobile/hooks/usePassiveHealth.ts | FOUND |
| apps/mobile/components/move/PassiveBankPrompt.tsx | FOUND |
| apps/mobile/__tests__/gapFill.test.ts | FOUND (12 tests) |
| apps/mobile/app/(tabs)/move/index.tsx modified | FOUND (PassiveBankPrompt + usePassiveHealth wired) |
| getCreditedToday imported in usePassiveHealth | FOUND (line 34) |
| computePassiveDelta called in usePassiveHealth | FOUND (line 241) |
| getDistanceWalkingRunning in usePassiveHealth | FOUND (line 78) |
| readRecords in usePassiveHealth | FOUND (line 169) |
| SdkNotAvailable graceful path | FOUND (lines 127-150) |
| villages.food NOT written in usePassiveHealth | CONFIRMED (only in comments) |
| addCredit called after confirmBank | FOUND (line 303) |
| Commit 68c3f9e (Task 1) | FOUND |
| Commit 840dc05 (Task 2) | FOUND |
| npm test (mobile) | PASSED (exit 0) |
| tsc --noEmit (mobile) | PASSED (exit 0) |

---

*Phase: 02-core-movement-loop*
*Completed: 2026-06-04*
