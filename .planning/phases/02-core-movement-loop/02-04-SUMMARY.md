---
phase: 02-core-movement-loop
plan: "04"
subsystem: allocate-miles-slice
tags: [supabase-rpc, sqlite-outbox, optimistic-ui, offline-sync, allocate-sheet, fab, pending-badge, netinfo, tdd]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [allocate-food-rpc, sqlite-queue, allocate-sheet-ui, offline-sync-on-reconnect]
  affects: [02-05-plan-e, future-phases-allocations]
tech_stack:
  added: []
  patterns:
    - "atomic allocate_food PostgreSQL RPC: SELECT ... FOR UPDATE + idempotency_key early-return + food_state recompute"
    - "expo-sqlite outbox pattern: INSERT OR IGNORE + status machine (pending/synced/rejected) + retry_count"
    - "useAllocate hook: optimistic Zustand update + supabase.rpc OR enqueueAllocation depending on NetInfo"
    - "useSyncQueue: NetInfo addEventListener for offline->online transition -> syncQueue + TanStack Query invalidate"
    - "AllocateSheet: swipe-dismissible Modal + PanResponder + quantity stepper"
    - "UUID idempotency key generated per confirm (not per session) — prevents rapid-tap double-spend"
key_files:
  created:
    - supabase/migrations/20260604010000_phase2_allocate_rpc.sql
    - apps/mobile/lib/sqliteQueue.ts
    - apps/mobile/hooks/useAllocate.ts
    - apps/mobile/hooks/useSyncQueue.ts
    - apps/mobile/components/allocate/AllocateSheet.tsx
    - apps/mobile/components/village/AllocateFab.tsx
    - apps/mobile/components/village/PendingBadge.tsx
  modified:
    - apps/mobile/__tests__/sqliteQueue.test.ts
    - apps/mobile/app/(tabs)/village/index.tsx
decisions:
  - "initQueue opens 'fitrealm_queue.db' (same SQLite file as dayCredits uses 'fitrealm_queue.db' — aligned to avoid two open handles)"
  - "NetInfo.fetch() used at allocate time rather than caching network state — avoids stale isConnected flag from rapid transitions"
  - "AllocateSheet uses React Native Modal (animationType=slide) over expo-router modal — avoids router dependency for a pure UI overlay"
  - "PanResponder swipe-dismiss: dy>80 threshold triggers close — matches Material Design bottom sheet UX"
  - "Alert.alert used for toasts (D2-41 warm copy) — inline; a toast library (react-native-toast-message) can replace this in a later polish pass without changing hook signatures"
  - "generateUUID uses Math.random() not crypto.randomUUID() — RN 0.76 does not expose crypto.randomUUID() globally in Hermes"
  - "food_cap capped at a high sentinel in optimistic update (server corrects on next fetch) — avoids needing game_config in the allocate hook"
metrics:
  duration: "~90 minutes"
  completed: "2026-06-04"
  tasks_completed: 3
  tasks_deferred: 1
  files_created: 9
  files_modified: 2
---

# Phase 2 Plan 04: Allocate-Miles Vertical Slice Summary

Atomic `allocate_food` PostgreSQL RPC (FOR UPDATE + idempotency key) + expo-sqlite offline outbox with status machine + AllocateSheet bottom sheet (Hunt Food wired, other actions disabled) + FAB wired into village screen + optimistic updates rolling back on server rejection + NetInfo-triggered sync-on-reconnect.

---

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | allocate_food RPC migration | 8bdd498 | Done (push DEFERRED) |
| 2 | SQLite outbox queue — sqliteQueue.test.ts green | 4fa9bc3 | Done |
| 3 | AllocateSheet + FAB + useAllocate + useSyncQueue + PendingBadge | 91c80b6 | Done |
| 4 | Device verification | — | **DEFERRED** |

---

## Deferred — Device/Build Punch-List

These steps require a physical device, emulator, or interactive CLI auth. All code is complete.

| # | Action / Command | Why Deferred | Blocking For |
|---|-----------------|-------------|--------------|
| D-1 | `npx supabase db push` (from repo root with `SUPABASE_ACCESS_TOKEN` set) to apply `20260604010000_phase2_allocate_rpc.sql` | Requires Supabase CLI auth; non-interactive on Windows requires env var set | All plans that call `allocate_food` RPC live |
| D-2 | Verify in Supabase SQL editor: `SELECT proname FROM pg_proc WHERE proname='allocate_food'` returns a row | Confirms RPC migration applied | Live allocation flow |
| D-3 | Device: tap FAB → AllocateSheet → Hunt Food ×3 → confirm. Verify food +30, Mile Bank −3, warm toast | Requires device + live Supabase | ALLOC-01/02 device acceptance |
| D-4 | Device: confirm options are greyed out when milesBanked < cost | Requires live data | ALLOC-03 device acceptance |
| D-5 | Device: turn on airplane mode, allocate → food updates optimistically + pending badge appears. Re-enable network → queue syncs, badge clears, food matches server | Requires device + network toggling | ALLOC-04 device acceptance |
| D-6 | Device: offline allocation exceeding bank balance, then reconnect → verify rejection toast + state re-syncs to server truth | Requires device | D2-39 |
| D-7 | Supabase SQL editor: call `allocate_food` with same `p_idempotency_key` twice concurrently → confirm only one allocation recorded and miles not double-deducted | Requires live Supabase | ALLOC-05 / T-02D-RACE atomicity |
| D-8 | Drive village food=0 (or set via SQL), then Hunt Food → confirm starving lock clears instantly on any food added | Requires live Supabase + device | VLG-05 |

---

## What Was Built

### Task 1 — allocate_food RPC migration (commit 8bdd498)

**`supabase/migrations/20260604010000_phase2_allocate_rpc.sql`**:

Security hardening (all four STRIDE mitigations):
- **T-02D-RACE (FOR UPDATE):** `SELECT miles_banked FROM profiles WHERE id=p_user_id FOR UPDATE` — serialises concurrent calls for the same user; rapid double-taps are serialised, not raced.
- **T-02D-RPY (idempotency early-return):** checks `EXISTS (SELECT 1 FROM allocations WHERE idempotency_key = p_idempotency_key)` before any writes; returns `{success:true, idempotent:true}` immediately.
- **T-02D-OVS (server backstop):** rejects with `{success:false, error:'insufficient_miles'}` when `miles_banked < p_miles_cost`. Client grey-out is UX only.
- **T-02D-CFG (config-driven rates):** reads `food_cap` and `food_hungry_threshold` from `game_config` inside the function; falls back to seeded defaults (`COALESCE`). Nothing hardcoded.

Food state recompute: `CASE WHEN v_new_food <= 0 THEN 'starving' WHEN v_new_food <= v_food_hungry_threshold THEN 'hungry' ELSE 'thriving' END` — instantly unlocks a starving village when any food is added (VLG-05 / D2-03).

`GRANT EXECUTE ON FUNCTION public.allocate_food(...) TO authenticated` — PostgREST can call it via `.rpc()`.

### Task 2 — SQLite offline outbox (commit 4fa9bc3)

**`apps/mobile/lib/sqliteQueue.ts`**:
- `initQueue()`: opens `fitrealm_queue.db`, WAL mode, creates `allocation_queue` with `idempotency_key TEXT UNIQUE NOT NULL` + `status` + `retry_count`; `idx_queue_status` index.
- `enqueueAllocation()`: `INSERT OR IGNORE` — duplicate keys silently dropped.
- `syncQueue()`: iterates pending rows → `supabase.rpc('allocate_food', {p_user_id, p_miles_cost, p_food_gain, p_idempotency_key})` → marks `synced`/`rejected`/increments `retry_count`. Returns `{synced, rejected, retried}` summary.
- `getPendingCount()`: `SELECT COUNT(*) WHERE status='pending'` — drives `PendingBadge`.

**`apps/mobile/__tests__/sqliteQueue.test.ts`**: 11 unit tests covering all behaviours (initQueue, enqueue, duplicate-ignore, synced/rejected/retry transitions, getPendingCount zero/nonzero/null).

### Task 3 — AllocateSheet + FAB + hooks + PendingBadge (commit 91c80b6)

**`apps/mobile/hooks/useAllocate.ts`**:
- Generates UUID idempotency key per confirm (not per session).
- Applies optimistic Zustand update (food += gain, milesBanked -= cost).
- If online: `supabase.rpc('allocate_food', {..., p_idempotency_key})` → on `insufficient_miles` rolls back + returns `{insufficientMiles:true}`.
- If offline: `enqueueAllocation(db, ...)` + updates `pendingAllocations` in store.
- In-flight key guard prevents double-fire at the JS level.

**`apps/mobile/hooks/useSyncQueue.ts`**:
- `NetInfo.addEventListener` — tracks `wasOnlineRef` to detect only the offline→online transition.
- On reconnect: `syncQueue()` → `queryClient.invalidateQueries(['village', userId])` → `getPendingCount()` → `setPendingAllocations()`.
- Calls `onRejected(count)` callback for any server-rejected rows (caller shows toast).

**`apps/mobile/components/allocate/AllocateSheet.tsx`**:
- Swipe-dismissible Modal with `PanResponder` (dy>80 = dismiss).
- Hunt Food: fully wired tap-once + quantity stepper (±1); cost = `qty × hunt_food_miles_cost`, gain = `qty × food_per_mile` from `useGameConfig` (INFRA-02).
- Options costing more than `milesBanked` → confirm button disabled + `accessibilityState.disabled=true` (ALLOC-03).
- Gather Medicine / Chop Wood / Quarry Stone / Defend Village: visible, disabled, "coming soon" (D2-22).

**`apps/mobile/components/village/AllocateFab.tsx`**:
- Bottom-right FAB opening `AllocateSheet` via local `sheetVisible` state.
- Props: `db`, `onAllocationSuccess`, `onInsufficientMiles` (passed from village screen for warm toasts).

**`apps/mobile/components/village/PendingBadge.tsx`**:
- Reads `pendingAllocations` from `useGameStore` — hidden when 0, amber circle with count when >0.
- Positioned absolute over the Miles chip in the top bar.

**`apps/mobile/app/(tabs)/village/index.tsx`** (wired):
- `initQueue()` on mount + `getPendingCount()` restore for badge after app restart.
- `useSyncQueue` mounted at screen level.
- `AllocateFab` replaces the old placeholder FAB `TouchableOpacity`.
- `PendingBadge` overlaid on the Miles `ResourceChip`.
- Warm high-fantasy `Alert` toasts on success/rejection (D2-41).

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Pre-existing Known Flaky Test (out of scope)

**`apps/mobile/__tests__/kalman.test.ts` — "smooths a noisy constant signal toward the true value"**
- **Issue:** This test uses `Math.random()` with a `toBeLessThan(0.005)` threshold. On rare runs the random noise can push the estimate just over 0.005. This is a pre-existing intermittent failure from Plan B (02-02, commit c77bbd8).
- **Action:** Documented only — not in scope for Plan D (deviation rule: only fix issues directly caused by current task changes). Will be addressed in a Plan B follow-up.
- **Workaround:** Re-running the suite resolves it (passes consistently when re-run).

---

## Threat Surface Scan

All new surfaces match the plan's `<threat_model>`. No unexpected surfaces:

| Boundary | Surface | Status |
|----------|---------|--------|
| mobile → allocate_food RPC | FOR UPDATE + idempotency + balance check (T-02D-RACE/RPY/OVS) | Mitigated |
| SQLite outbox → Supabase sync | INSERT OR IGNORE + p_idempotency_key passed to RPC (T-02D-RPY) | Mitigated |
| game_config rates in RPC | food_cap + food_hungry_threshold read server-side (T-02D-CFG) | Mitigated |

---

## Test Results

```
apps/mobile: npm test (jest-expo, node)
Test Suites: 8 passed, 8 total
Tests:       5 todo (Wave-0 scaffolds for Plan C), 51 passed, 56 total
Time:        ~1.3s

tsc --noEmit (apps/mobile): Exit 0 — clean
```

sqliteQueue suite breakdown (11 tests):
- initQueue: creates table + WAL + idempotency_key UNIQUE
- enqueueAllocation: inserts row; duplicate key silently ignored (INSERT OR IGNORE)
- syncQueue: synced/rejected/retry transitions; p_idempotency_key passed to RPC; empty queue no-op
- getPendingCount: returns count / 0 when empty / 0 on null result

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| supabase/migrations/20260604010000_phase2_allocate_rpc.sql | FOUND |
| apps/mobile/lib/sqliteQueue.ts | FOUND |
| apps/mobile/hooks/useAllocate.ts | FOUND |
| apps/mobile/hooks/useSyncQueue.ts | FOUND |
| apps/mobile/components/allocate/AllocateSheet.tsx | FOUND |
| apps/mobile/components/village/AllocateFab.tsx | FOUND |
| apps/mobile/components/village/PendingBadge.tsx | FOUND |
| apps/mobile/app/(tabs)/village/index.tsx | FOUND |
| apps/mobile/__tests__/sqliteQueue.test.ts | FOUND |
| Commit 8bdd498 (Task 1 — RPC migration) | FOUND |
| Commit 4fa9bc3 (Task 2 — SQLite queue) | FOUND |
| Commit 91c80b6 (Task 3 — AllocateSheet + FAB + hooks) | FOUND |
| allocate_food grep — FOR UPDATE, idempotency_key, food_cap, food_state | 22 matches |
| sqliteQueue grep — INSERT OR IGNORE, allocation_queue | FOUND |
| useSyncQueue grep — NetInfo, addEventListener | FOUND |
| AllocateFab grep — AllocateSheet | FOUND |
| npm test — 51 passed, 8 suites | PASSED |
| tsc --noEmit | PASSED (exit 0) |
