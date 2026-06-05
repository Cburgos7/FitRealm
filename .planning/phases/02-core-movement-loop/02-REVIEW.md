---
phase: 02-core-movement-loop
reviewed: 2026-06-05T00:00:00Z
depth: standard
files_reviewed: 37
files_reviewed_list:
  - supabase/migrations/20260604000000_phase2_game.sql
  - supabase/migrations/20260604010000_phase2_allocate_rpc.sql
  - supabase/migrations/20260604020000_phase2_decay_cron.sql
  - apps/api/src/index.ts
  - apps/api/src/routes/activity.ts
  - apps/mobile/app.config.js
  - apps/mobile/app/_layout.tsx
  - apps/mobile/app/(tabs)/_layout.tsx
  - apps/mobile/app/(tabs)/village/index.tsx
  - apps/mobile/app/(tabs)/move/index.tsx
  - apps/mobile/app/(tabs)/move/tracker.tsx
  - apps/mobile/components/allocate/AllocateSheet.tsx
  - apps/mobile/components/move/PassiveBankPrompt.tsx
  - apps/mobile/components/move/SessionStats.tsx
  - apps/mobile/components/move/SessionSummary.tsx
  - apps/mobile/components/village/AllocateFab.tsx
  - apps/mobile/components/village/FoodMeter.tsx
  - apps/mobile/components/village/GraceBadge.tsx
  - apps/mobile/components/village/PendingBadge.tsx
  - apps/mobile/components/village/RecordingBanner.tsx
  - apps/mobile/components/village/VillageScene.tsx
  - apps/mobile/hooks/useAllocate.ts
  - apps/mobile/hooks/useGameConfig.ts
  - apps/mobile/hooks/useGpsSession.ts
  - apps/mobile/hooks/usePassiveHealth.ts
  - apps/mobile/hooks/useSyncQueue.ts
  - apps/mobile/hooks/useVillage.ts
  - apps/mobile/lib/activityDetector.ts
  - apps/mobile/lib/dayCredits.ts
  - apps/mobile/lib/gapFill.ts
  - apps/mobile/lib/haversine.ts
  - apps/mobile/lib/kalman.ts
  - apps/mobile/lib/routeUpload.ts
  - apps/mobile/lib/sqliteQueue.ts
  - apps/mobile/lib/villageState.ts
  - apps/mobile/store/useGameStore.ts
findings:
  critical: 5
  warning: 9
  info: 6
  total: 20
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-06-05T00:00:00Z
**Depth:** standard
**Files Reviewed:** 37
**Status:** issues_found

## Summary

Phase 2 wires the core Move → Bank → Allocate loop: GPS tracking, manual entry
anti-cheat, passive health gap-fill, the `allocate_food` RPC, and server-only
pg_cron food decay. The server-authoritative design is mostly sound — the
`allocate_food` RPC correctly uses `FOR UPDATE` + idempotency, decay lives only
in `decay_village_food()`, and `game_config` is SELECT-only. The reviewer
confirmed those invariants hold.

However, the build has a **load-bearing missing database function**:
`increment_miles_banked` is called from three mobile paths and the API but is
defined in **no migration**. Every mile-banking path (GPS, passive, manual)
therefore fails silently — the central mechanic of the game does not credit
miles. This is the headline blocker.

Additional blockers: the `allocate_food` RPC's miles deduction and the
activity insert are not in a single transaction with the same row lock as the
read (TOCTOU on the village food add path is fine, but the manual API credits
`miles_banked` via the missing RPC and inserts the activity non-atomically,
allowing partial state), the manual-entry daily-cap check is bypassable, RLS
policies on the two new tables lack `WITH CHECK` so a client can write rows
owned by another user, and the offline allocation queue can double-credit on
the optimistic path.

## Critical Issues

### CR-01: `increment_miles_banked` RPC is never defined — all mile banking silently fails

**File:** `apps/mobile/hooks/useGpsSession.ts:316`, `apps/mobile/hooks/usePassiveHealth.ts:291`, `apps/mobile/hooks/useGpsSession.ts:389`, `apps/api/src/routes/activity.ts:129`
**Issue:** Four call sites invoke `supabase.rpc('increment_miles_banked', …)`,
but a repo-wide search finds the function defined in **no migration** (only in
code call sites and `02-03-SUMMARY.md`). At runtime PostgREST returns a
`PGRST202 / function not found` error. Worse, none of the mobile callers check
the returned `error`:

- `useGpsSession.stopSession` (line 316) ignores the result entirely.
- `usePassiveHealth.confirmBank` (line 291) logs a warning but still calls
  `addCredit`, so the miles are marked "credited" in `day_credits` and will
  **never be re-offered** — they are permanently lost.
- The API (line 134) only `console.error`s and still returns `200 success`.

Net effect: the GPS session shows "Miles Banked!", `day_credits` is updated,
but `profiles.miles_banked` is never incremented. The user can never allocate
food. This breaks the core Move → Bank → Allocate loop.
**Fix:** Add the missing migration before shipping:
```sql
CREATE OR REPLACE FUNCTION public.increment_miles_banked(
  p_user_id uuid, p_miles numeric
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles
  SET miles_banked = miles_banked + p_miles, updated_at = NOW()
  WHERE id = p_user_id;
$$;
GRANT EXECUTE ON FUNCTION public.increment_miles_banked(uuid, numeric) TO authenticated;
```
Additionally, make mobile callers treat an RPC error as fatal — do NOT call
`addCredit` when the increment failed, or the miles are silently dropped.

### CR-02: New-table RLS policies use `FOR ALL USING` with no `WITH CHECK` — cross-user write/spoof

**File:** `supabase/migrations/20260604000000_phase2_game.sql:59-60`, `:79-80`
**Issue:** Both `activities_own` and `allocations_own` are declared as:
```sql
CREATE POLICY activities_own ON public.activities FOR ALL USING (auth.uid() = user_id);
```
For `FOR ALL`, the `USING` clause filters SELECT/UPDATE/DELETE rows, but
**INSERT is governed by `WITH CHECK`, not `USING`**. With no `WITH CHECK`,
Postgres applies the `USING` expression as the check for UPDATE but applies
**no check at all for INSERT**. A malicious authenticated client can therefore
`INSERT INTO activities (user_id, miles_earned, …) VALUES ('<any-other-uuid>', 9999, …)`
or insert `allocations` rows for another user. Combined with the fact that the
mobile client inserts activity rows directly (not via a SECURITY DEFINER RPC),
this is a direct anti-cheat bypass: a user can self-insert arbitrary
`miles_earned`/`raw_distance_mi` activity rows. The manual-entry API's
server-side mileage derivation is moot because the table is writable directly.
**Fix:** Add `WITH CHECK` to both policies (and ideally split insert):
```sql
CREATE POLICY activities_own ON public.activities
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY allocations_own ON public.allocations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```
Note this still lets a client insert `miles_earned` of any value for their *own*
user_id; mile-earning should move behind a SECURITY DEFINER RPC that derives
miles server-side, mirroring the manual-entry endpoint.

### CR-03: Manual-entry daily cap is trivially bypassable (per-request cap, not cumulative)

**File:** `apps/api/src/routes/activity.ts:249-261`
**Issue:** The cap logic rejects only when `todayTotal >= dailyCap`, then clamps
the *current* request to `remainingCap = dailyCap - todayTotal`. But
`creditableDistance` is clamped to remaining **raw distance**, while
`milesEarned = creditableDistance * multiplier` can exceed `remainingCap` when
the multiplier > 1 (running = 1.25). Example with cap 10, todayTotal 0: submit
10 mi at running pace → `creditableDistance = min(10, 10) = 10`,
`milesEarned = 10 * 1.25 = 12.5`. The user banks 12.5 miles against a 10-mile
cap. More importantly, the cap is read from the `activities` table via
`getTodayManualMiles`, which sums `miles_earned`, but because of CR-02 a client
can also self-insert manual rows directly and bypass the endpoint entirely.
Even via the endpoint, two near-simultaneous requests both read `todayTotal = 0`
(no row lock / no transaction) and both pass the cap check — classic TOCTOU
double-spend of the daily allowance.
**Fix:** Clamp on *credited miles*, not raw distance:
`const creditableMiles = Math.min(milesEarnedRaw, remainingCap);` and derive the
stored row from that. Enforce the cap inside a SECURITY DEFINER RPC that does the
sum + insert under a single transaction (and lock), so concurrent requests
serialize.

### CR-04: `allocate_food` deducts miles and adds food in one function but not one atomic unit with the village lock — and never re-checks idempotency under the lock

**File:** `supabase/migrations/20260604010000_phase2_allocate_rpc.sql:42-137`
**Issue:** The idempotency pre-check (lines 42-47) runs **before** the `FOR
UPDATE` lock on `profiles` (line 55). Two concurrent calls with the **same**
idempotency key (e.g., the optimistic online call in `useAllocate` racing the
offline-queue replay in `syncQueue` after a flaky reconnect) can both pass the
`NOT EXISTS` check before either INSERTs. They then both acquire the profile
lock sequentially, both pass the balance check (if funds suffice), both deduct
miles, and both add food. The final `INSERT … idempotency_key` UNIQUE will fail
on the **second** insert and raise an unhandled exception — but the miles were
already deducted twice and food added twice within that transaction. Because the
exception aborts only the *second* transaction, the net result depends on commit
ordering; at minimum the duplicate key raises an unhandled error returned to the
client instead of the intended graceful `idempotent: true`.
**Fix:** Move the idempotency check to rely on the UNIQUE constraint with an
`ON CONFLICT DO NOTHING` insert performed **first** (or do the `EXISTS` check
*after* acquiring the profile `FOR UPDATE` lock, serializing same-user calls).
Wrap the duplicate-key case in a `BEGIN … EXCEPTION WHEN unique_violation THEN
RETURN json_build_object('success', true, 'idempotent', true); END;` block so a
replay returns success instead of a 500.

### CR-05: Optimistic allocate + offline queue can double-spend miles on the same tap

**File:** `apps/mobile/hooks/useAllocate.ts:80-151`
**Issue:** `generateUUID()` is called fresh on **every** `allocate` invocation
(line 81), so the `inFlightKeys` guard at line 84 is dead — the key is always new
and never already present. The real double-fire protection is gone. More
critically: on the online path, after a successful RPC the optimistic state is
left in place and the query is invalidated; but if the RPC call throws a
*transport* error after the server actually committed (network drop on the
response), the catch block (line 152) rolls back the optimistic update **and**
the same logical intent may later be re-attempted by the user — with a *new*
idempotency key — producing a second real spend server-side. The idempotency key
is generated per-call, not per-intent, so retries are not idempotent. The queue
path (line 144) uses yet another fresh key, so an online failure followed by an
offline retry are two distinct keys = two real allocations.
**Fix:** Generate the idempotency key once per user intent (e.g., when the
confirm button is pressed in `AllocateSheet`) and thread the **same** key through
the online RPC, the rollback/retry, and the SQLite enqueue. Then the server's
idempotency_key UNIQUE actually prevents the double-spend. Also fix the dead
`inFlightKeys` guard to key on the stable intent id.

## Warnings

### WR-01: RecordingBanner always shows "0.00 mi" — hardcoded `sessionDistanceMi = 0`

**File:** `apps/mobile/app/(tabs)/_layout.tsx:38`
**Issue:** `const sessionDistanceMi = 0;` is passed to `RecordingBanner`, so the
persistent banner always reads "Recording — 0.00 mi" regardless of actual
session distance. The store (`useGameStore`) holds no live session distance, and
`useGpsSession` owns it locally per-hook-instance, so the banner cannot read it.
This is a known loose end but it ships a visibly broken UI element.
**Fix:** Add `sessionDistanceMi` to `useGameStore`, have `useGpsSession` push the
running distance into the store on each accepted GPS point, and read it here:
`const sessionDistanceMi = useGameStore((s) => s.sessionDistanceMi);`

### WR-02: `useVillage` food-drop detection is computed during render against a ref mutated in an effect — race produces missed/duplicate drain toasts

**File:** `apps/mobile/hooks/useVillage.ts:146-184`
**Issue:** `lastSeenFoodRef.current` is updated inside the sync effect (line 165)
*after* the render-time comparison (lines 175-184) already read it. On the render
where new `query.data` first arrives, the comparison uses the previous value
(correct), but on every subsequent re-render with the *same* data, the ref now
equals `curr`, so `foodDropDetected` flips back to `false`. Whether the Village
screen's drain effect fires depends on render timing relative to the effect — it
is a race. The `drainShownRef` guard in the screen partially masks this, but the
delta shown can be stale or the toast can be missed entirely if a re-render lands
between data arrival and the effect.
**Fix:** Compute the drop inside the same effect that updates the ref, store
`foodDropDetected`/`foodDelta` in `useState`, and return that state — do not
derive cross-render state during render against a ref you also mutate in an
effect.

### WR-03: GPS first-point distance seeding is wrong — first segment after seed is dropped

**File:** `apps/mobile/hooks/useGpsSession.ts:219-228`
**Issue:** On the first accepted point, `lastAcceptedRef` is null so the code
takes the `else` branch and calls `latFilterRef.reset(smoothLat)` — but
`smoothLat` was already produced by `filter(latitude)` on a filter initialized to
`x = 0`, so the very first `filter()` output is a heavily-biased value (pulled
from 0 toward the real latitude by the Kalman gain), and only *then* is the filter
reset to that biased value. The first stored `point` is therefore a corrupted
coordinate near the equator/prime-meridian-ish blend, and `lastAcceptedRef` is set
to it. The next point's haversine delta is computed against this bad seed,
injecting a large spurious distance on segment 2. Over a session this inflates
distance (and thus miles) or corrupts the route polyline.
**Fix:** Seed the filters *before* filtering the first measurement:
```js
if (!lastAcceptedRef.current) {
  latFilterRef.current.reset(latitude);
  lonFilterRef.current.reset(longitude);
}
const smoothLat = latFilterRef.current.filter(latitude);
const smoothLon = lonFilterRef.current.filter(longitude);
```
and only accumulate distance when a previous point existed.

### WR-04: `incrementMilesBanked` failure in API is non-fatal but still returns success — miles silently lost

**File:** `apps/api/src/routes/activity.ts:289-300`
**Issue:** After inserting the activity row, `await d.incrementMilesBanked(...)`
is fire-and-forget (its impl only `console.error`s on failure, CR-01). The
endpoint then returns `200 { success: true, milesEarned }`. If the increment
fails (which it currently *always* does per CR-01), the activity row exists but
the bank is not credited, and the client shows "Miles Banked!". The activity row
also now counts against the daily cap, so the user is penalized for miles they
never received.
**Fix:** Make the increment part of the same transaction as the insert (a single
RPC), and return an error status if crediting fails so the client can retry.

### WR-05: `confirmBank` marks miles credited even when the bank RPC failed — permanent miles loss

**File:** `apps/mobile/hooks/usePassiveHealth.ts:291-303`
**Issue:** When `increment_miles_banked` returns an error, the code logs a warning
and then *still* calls `addCredit(today, promptDelta)` (line 303) with the comment
"so we don't re-prompt the same miles." This is backwards: if the bank failed, the
miles were NOT credited, so suppressing the re-prompt permanently discards them.
**Fix:** Only call `addCredit` when the increment succeeded. On failure, leave the
prompt eligible so the next app-open retries, or enqueue a retry.

### WR-06: Storage `routes` RLS allows read/insert but no UPDATE/DELETE policy — and bucket creation depends on dashboard step

**File:** `supabase/migrations/20260604000000_phase2_game.sql:141-179`
**Issue:** Two issues. (1) `routeUpload` uses `upsert: false`, but orphan recovery
(`useGpsSession.recoverOrphanSession`) and a re-banked session both upload to
`${userId}/${activityId}.geojson`. Activity IDs differ so collisions are unlikely,
but there is no DELETE policy, so failed/abandoned routes accumulate with no
cleanup path and the user cannot delete their own data (a GDPR/data-rights gap).
(2) The header comment admits the bucket "must be created via the Supabase
dashboard or API" — yet the migration *also* attempts
`INSERT INTO storage.buckets` (line 141). On hosted Supabase this INSERT often
lacks privileges, so the migration's success is environment-dependent and the
policies may attach to a non-existent bucket.
**Fix:** Add an own-folder DELETE policy. Verify the `storage.buckets` INSERT
actually succeeds in the target environment, or document the manual step as a
required deploy gate.

### WR-07: `getTodayManualMiles` uses server local time for "today" while the client uses device-local time — cap window mismatch

**File:** `apps/api/src/routes/activity.ts:92-98` vs `apps/mobile/lib/dayCredits.ts:32-37`
**Issue:** The API computes "start of day" with `new Date(year, month, date)` in
the **server's** timezone (Vercel = UTC). The mobile `getTodayKey` uses the
**device** timezone. A user in UTC-8 logging at 11pm local is at 7am UTC "next
day" on the server — their manual cap resets at a different wall-clock moment than
their `day_credits` gap-fill bookkeeping, allowing cap evasion around the timezone
boundary and producing confusing double-count windows between manual entries and
passive gap-fill.
**Fix:** Pass the client's local day key (or timezone offset) to the API and
compute the cap window consistently, or store/compare on a single canonical day
definition shared by both the cap and `day_credits`.

### WR-08: `stopSession` discards a completed session when `config` is not yet loaded — but the watcher already stopped

**File:** `apps/mobile/hooks/useGpsSession.ts:270-275`
**Issue:** If `useGameConfig` has not resolved when the user taps "End Session",
the function returns `null` after stopping the watcher and clearing the timer —
but it does **not** clear the SecureStore checkpoint and does **not** bank the
miles. The session's distance is stranded: the UI navigates back (tracker.tsx
line 81-83 treats `null` as "no distance or bank failed"), the user sees nothing
banked, yet a checkpoint remains for orphan recovery to re-bank later as a
`walking` activity — silently changing the activity kind and multiplier. Real
distance with a config hiccup gets mis-credited.
**Fix:** Either await config before allowing the session to start, or fall back to
hardcoded-default multipliers (noted as acceptable UI fallback) and bank normally
instead of returning null and dropping the result.

### WR-09: `routeShape`/`cameraCenter` recomputed every render; Camera renders without `centerCoordinate`; multiple `@ts-ignore` mask real type breaks

**File:** `apps/mobile/app/(tabs)/move/tracker.tsx:101-164`
**Issue:** `<MapboxGL.Camera followUserLocation .../>` is rendered with no
`centerCoordinate` and only when `cameraCenter` is truthy, but `cameraCenter` is
never passed to it, so the conditional is pointless and `followUserLocation`
fights with the absence of a center on first fix. More concerning: seven
`@ts-ignore` directives suppress "@rnmapbox/maps types not compatible with React
18" — these blanket-suppress *all* type errors on those elements, so a genuine
prop typo (e.g., wrong `LineLayer` style key) would compile silently. The
`@ts-ignore` on the MapView closing tag (line 163) is meaningless and indicates
copy-paste.
**Fix:** Remove the dead `cameraCenter &&` guard, pass an explicit
`centerCoordinate` or rely solely on `followUserLocation`, and replace blanket
`@ts-ignore` with `@ts-expect-error` (which errors if the suppression becomes
unnecessary) or a typed wrapper.

## Info

### IN-01: `generateUUID` uses `Math.random()`; `crypto.randomUUID` is available in RN 0.76 / Hermes

**File:** `apps/mobile/hooks/useAllocate.ts:170-176`
**Issue:** The comment claims `crypto.randomUUID()` "is not available in all RN
envs." On Expo SDK 52 / RN 0.76 with Hermes, `crypto.randomUUID` (via
`expo-crypto` or the global) is available and collision-free. For idempotency keys
that gate real currency spend, a CSPRNG-backed UUID is preferable.
**Fix:** Use `expo-crypto`'s `randomUUID()` or `Crypto.randomUUID()`.

### IN-02: `gapFill` does not clamp GPS distance noise — sub-threshold deltas accumulate

**File:** `apps/mobile/hooks/useGpsSession.ts:219-222`
**Issue:** Every accepted point ≤20m accuracy contributes its haversine delta with
no minimum-movement gate. A stationary user with jittery sub-20m fixes accumulates
phantom distance (GPS drift while standing still), inflating miles. The Kalman
filter dampens but does not eliminate this.
**Fix:** Add a minimum per-segment threshold (e.g., ignore deltas < ~3-5m) or a
speed-plausibility gate, consistent with the manual-entry anti-cheat philosophy.

### IN-03: `food_state` recompute in `decay_village_food` evaluates `GREATEST(0, food - rate)` three times

**File:** `supabase/migrations/20260604020000_phase2_decay_cron.sql:131-138`
**Issue:** The same `GREATEST(0, food - v_decay_rate)` expression is written four
times in the UPDATE. Correct, but duplicated; a future rate-formula change must be
edited in four places (and the Watchtower hook will make this worse).
**Fix:** Use a CTE or subselect to compute the new food once, then derive state
from it (mirrors how `allocate_food` computes `v_new_food` first).

### IN-04: `formatMiles` / `formatNum` rounding hides fractional miles near spend thresholds

**File:** `apps/mobile/components/allocate/AllocateSheet.tsx:264-267`, `apps/mobile/app/(tabs)/village/index.tsx:274-278`
**Issue:** The Mile Bank chip rounds to integer (`formatNum`) while the sheet shows
one decimal (`formatMiles`). A user with 1.4 miles sees "1" in the chip but "1.4"
in the sheet, and `canAfford` uses the raw value — mild UX inconsistency that can
confuse "why is the button disabled when I have 1 mile?"
**Fix:** Use a single shared formatter and show enough precision to match the
affordability check.

### IN-05: `villages.miles_banked` column added but documented as unused/reserved — dead schema

**File:** `supabase/migrations/20260604000000_phase2_game.sql:24, 32-37`
**Issue:** `villages.miles_banked` is added (line 24) then the comment says the
canonical bank is `profiles.miles_banked` and the village column is "reserved /
unused." A duplicate authoritative-looking column invites future bugs where code
reads the wrong one.
**Fix:** Drop the `villages.miles_banked` column until it has a defined purpose, or
add a comment/constraint making its non-canonical status enforceable.

### IN-06: `app.config.js` hardcodes Google iOS URL scheme / reversed client id in source

**File:** `apps/mobile/app.config.js:32-34`, `:75`
**Issue:** The Google `iosUrlScheme` (reversed client ID) and EAS `projectId` are
committed in plaintext. These are not secrets (client IDs are public by design and
the EAS project ID is not sensitive), so this is low risk, but the Google *web*
client id and RC keys come from env vars while the iOS URL scheme is hardcoded —
inconsistent config sourcing that makes environment swaps error-prone.
**Fix:** Source the iOS URL scheme from an env var for consistency with the other
credentials, or document that these values are intentionally public.

---

_Reviewed: 2026-06-05T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
