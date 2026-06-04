---
phase: 2
slug: core-movement-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (mobile)** | jest-expo ~52.0.0 (`apps/mobile/jest.config.js`: `preset: 'jest-expo'`) |
| **Framework (API)** | ts-jest + supertest (`apps/api/jest.config.js`: `preset: 'ts-jest', testEnvironment: 'node'`) |
| **Quick run command** | `cd apps/mobile && npm test` (unit only, ~10s) |
| **Full suite command** | `npm test --workspaces` (from repo root) |
| **Estimated runtime** | ~15–30 seconds (unit); native + device E2E are manual-only |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/mobile && npm test` (or `cd apps/api && npm test` for API tasks)
- **After every plan wave:** Run `npm test --workspaces`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds for unit; device E2E deferred to manual checkpoints

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| VLG-03 | Village state transitions (food value → Thriving/Hungry/Starving) | unit | `cd apps/mobile && npm test -- --testPathPattern=villageState` | ❌ W0 |
| VLG-06 | `decay_village_food()` decrements food, respects 24h grace | unit (Postgres fn via SQL) | manual SQL test in Supabase | ❌ W0 |
| MOV-02 | Kalman filter smooths noisy GPS; rejects >20m accuracy points | unit | `cd apps/mobile && npm test -- --testPathPattern=kalman` | ❌ W0 |
| MOV-04 | activityDetector classifies pace/elevation bands | unit | `cd apps/mobile && npm test -- --testPathPattern=activityDetector` | ❌ W0 |
| MOV-06/07/12 | Gap-fill reconciliation returns correct passive delta | unit | `cd apps/mobile && npm test -- --testPathPattern=gapFill` | ❌ W0 |
| MOV-08 | Manual entry anti-cheat: impossible pace rejected; daily cap enforced | unit (API) | `cd apps/api && npm test -- --testPathPattern=activity` | ❌ W0 |
| ALLOC-04 | SQLite queue enqueues, dequeues, handles rejection | unit | `cd apps/mobile && npm test -- --testPathPattern=sqliteQueue` | ❌ W0 |
| ALLOC-05 | `allocate_food` RPC is atomic (concurrent calls don't over-spend) | integration | manual Supabase SQL test | ❌ W0 |
| INFRA-02 | game_config seeded with all required keys | smoke | `cd apps/api && npm test -- --testPathPattern=gameConfig` | ❌ W0 |
| E2E core loop | Move → Bank → Allocate → food increases | manual (device) | n/a — physical device | manual-only |
| E2E decay | 6h pg_cron tick reduces food; starving locks allocation | manual (trigger in Supabase) | n/a | manual-only |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/mobile/__tests__/kalman.test.ts` — covers MOV-02
- [ ] `apps/mobile/__tests__/activityDetector.test.ts` — covers MOV-04
- [ ] `apps/mobile/__tests__/gapFill.test.ts` — covers MOV-06/MOV-07/MOV-12
- [ ] `apps/mobile/__tests__/sqliteQueue.test.ts` — covers ALLOC-04
- [ ] `apps/mobile/__tests__/villageState.test.ts` — covers VLG-03 (pure state machine)
- [ ] `apps/api/__tests__/activity.test.ts` — covers MOV-08 anti-cheat (supertest)

All 6 test files created in Wave 0 before implementation begins.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Active GPS session + live route polyline | MOV-01, MOV-03 | Native GPS unavailable in Jest | Physical device: start session, walk, confirm route draws + GeoJSON uploaded |
| HealthKit passive read (iOS) | MOV-09 | Native module, New Arch compat (A1 risk) | Physical iPhone Wave-0 smoke test before building passive sync |
| Health Connect passive read (Android) | MOV-09 | Native module | Physical Android: grant permission, confirm steps/distance read |
| Full core loop + decay | success criteria #6 | End-to-end on real devices | iPhone + Android: move → bank → allocate → trigger decay → starve → recover |

---

## Notes

- **pg_cron, not Vercel Cron** for decay (Vercel Hobby = once/day max; pg_cron does 6h). Decay logic is a Postgres function — test via SQL, not Jest.
- **A1 risk (react-native-health New Arch):** Plan C must front-load a physical-iPhone HealthKit smoke test before committing to the passive-iOS implementation.
