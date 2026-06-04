# Phase 2: Core Movement Loop - Research

**Researched:** 2026-06-04
**Domain:** React Native / Expo SDK 52 — GPS tracking, HealthKit/Health Connect, Mapbox maps, SQLite offline queue, Supabase cron decay, mile allocation
**Confidence:** MEDIUM-HIGH (native integrations carry inherent uncertainty; see Assumptions Log)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Core Survival Model (D2-01..D2-04):**
- Food is the ONLY survival/decaying resource. Medicine, Wood, Stone, and Morale are non-decaying inputs reserved for later systems.
- Village states: Thriving (Food >20) → Hungry (Food ≤20) → Starving (Food = 0, locked).
- Recovery = adding any food. No premium cost.
- Raiders are a separate future threat; "Defend" is conceptually locked but NOT built in Phase 2.

**Movement Capture (D2-05..D2-15):**
- Both active GPS tracker AND passive HealthKit/Health Connect ship in Phase 2.
- Gap-fill reconciliation: daily passive miles = total day movement − session/workout distance credited. Floored at zero.
- Passive reading uses the health platform's own distance value, not steps × stride.
- Daily passive reconciliation resets at local midnight.
- Passive miles bank only; they do NOT auto-feed food.
- Full-screen Mapbox map + pinned bottom stats sheet; persistent "● Recording — X mi" banner across all tabs.
- Poor GPS (>20m accuracy) silently Kalman-filtered; green/yellow/red accuracy indicator.
- End session → summary screen → Bank.
- Orphaned session auto-saves partial silently on next launch with a toast.
- Passive miles banked via app-open prompt after reconciliation.

**Activity Type & Multipliers (D2-16..D2-19):**
- Auto-detect from pace + elevation/GPS; no manual override. Walking 1.0×, running 1.25×, cycling 1.25×, hiking 1.5×.
- Multiplier applied once at banking time; food conversion stays flat (1 mi → 10 food).
- Manual entry: pace derived from distance ÷ duration; daily cap + pace sanity check, server-validated, in game_config.

**Allocate Miles Screen (D2-20..D2-23):**
- Bottom sheet (~70%) over the village, dismissible by swipe.
- Phase 2 live set: Hunt Food as the only fully-wired survival allocation. Other gather actions (Medicine/Wood/Stone) and Defend are present but their downstream effects are deferred.
- Tap-once + quantity stepper for bulk allocation.

**Decay, Grace Period & Tuning (D2-24..D2-26):**
- Food decay: −2.5 per 6-hour tick (10/day) = 1 mile/day to maintain.
- 24-hour grace period shown as "Protected — Xh left" countdown badge.
- ALL tunable values in game_config. Nothing hardcoded.

**Resource Meter Feedback (D2-27..D2-28):**
- Food meter: green → amber → red at ≤20, pulse when Hungry, empty/red at Starving.
- Colorblind-safe: always pair color with icon + text label, never color alone.
- Animated bar + narrative toast on change.

**Village View (D2-29..D2-34):**
- Illustrated village scene (static placeholder per state: thriving/hungry/starving).
- Top overlay bar: Food meter + Mile Bank + non-decaying resource counts.
- Allocate via floating action button (bottom-right).
- State transitions via visual change + narrative toast.
- Starving = dark/desaturated illustration + centered "Your village awaits your return" card.

**Village Bootstrapping & Map Tab (D2-35..D2-36):**
- Auto-create default village on first authenticated launch (default name "Thornhaven", full food).
- Map tab stays placeholder this phase. Mapbox used ONLY inside GPS tracker.

**Mile Bank Rules (D2-37):**
- Banked miles never expire, no cap.

**Offline Allocation (D2-38..D2-40):**
- Optimistic update + SQLite queue.
- Server-authoritative on sync; failed allocations toast + re-sync to server truth.
- expo-sqlite introduced this phase.

**Narrative Voice (D2-41):** Warm high-fantasy, lightly playful.

**Starving Reminders (D2-42):** No out-of-app push notifications in Phase 2.

### Claude's Discretion
- Exact SQLite schema for the offline allocation queue and sync bookkeeping.
- Kalman filter implementation/tuning details and GPS sampling cadence.
- Mapbox style/config inside the tracker (full fantasy style is Phase 3).
- Reconciliation bookkeeping mechanics (how per-day credited distance is tracked).
- Pace/elevation thresholds starting numbers (seed sensible defaults into game_config).
- Toast/animation library choices and timing.

### Deferred Ideas (OUT OF SCOPE)
- Raider attack + Defend combat system.
- Medicine / Wood / Stone / Morale active uses.
- Scout / Explore allocations.
- Faction / Outpost / Move Camp allocations.
- Push notifications (incl. starvation alerts).
- Real onboarding (name + map placement + avatar).
- Full Mapbox fantasy world map (Phase 3).
- Background location tracking.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VLG-01 | Village has Food meter (0–100, decaying), plus non-decaying Medicine/Wood/Morale/Stone counters | Supabase schema section — new columns on villages table |
| VLG-02 | Mile Bank displays unspent miles | Supabase schema + Zustand game store |
| VLG-03 | Village transitions: Thriving >20, Hungry ≤20, Starving = 0 | Server-computed state; client reads and renders |
| VLG-04 | Starving shows somber illustration + "Your village awaits" card | Frontend-only rendering based on food_state column |
| VLG-05 | Recovery instant: any food added unlocks | Handled by atomic RPC + re-fetch |
| VLG-06 | Food decays −2.5/6h server-side Vercel Cron; rate in game_config | **CRITICAL FINDING:** Vercel Hobby cron only daily; use Supabase pg_cron instead — see Pitfalls |
| VLG-07 | Watchtower reduces decay rate (Phase 6) | game_config architecture supports it; not implemented Phase 2 |
| VLG-08 | Max village still loses food each tick; movement always required | Balance invariant enforced in cron function |
| VLG-09 | Raiders distinct future threat; Defend concept locked, not built | Deferred — no code |
| MOV-01 | Foreground GPS session with live Mapbox map, real-time distance/pace/elapsed | expo-location + @rnmapbox/maps section |
| MOV-02 | GPS Kalman filter; >20m accuracy discarded | Pure TypeScript implementation — no external lib needed |
| MOV-03 | Completed route saved as GeoJSON to Supabase Storage | Storage upload section (ArrayBuffer/base64 pattern) |
| MOV-04 | Auto-detect activity type from pace + elevation; multipliers applied at banking | Pace/elevation algorithm section |
| MOV-05 | Completed session miles added to Mile Bank with narrative toast | Atomic Supabase RPC; TanStack Query mutation |
| MOV-06 | GPS lost mid-session: partial route preserved; user prompted on end | Session state in Zustand; partial save logic |
| MOV-07 | Orphaned session auto-saved on next launch | expo-secure-store or AsyncStorage session checkpoint |
| MOV-08 | Manual treadmill entry: distance+duration, pace derived, anti-cheat server-validated | Vercel API endpoint; game_config cap |
| MOV-09 | Passive HealthKit/Health Connect; gap-fill reconciliation; app-open prompt | react-native-health + react-native-health-connect sections |
| MOV-10 | Location "When In Use" requested on first session; Health permissions on first Move tab visit | expo-location + health permission flow |
| MOV-11 | Android 12+ approximate vs precise location detection + prompt | PermissionDetailsLocationAndroid.accuracy field |
| MOV-12 | Passive movement banks miles only; does not auto-feed food | Architecture pattern — separation of banking from allocation |
| ALLOC-01 | Allocate screen accessible from home at any time | Floating action button; expo-router bottom sheet modal |
| ALLOC-02 | Hunt Food = 1 mi → +10 food; quantity stepper; server rate in game_config | Atomic RPC + optimistic update |
| ALLOC-03 | Options > bank balance greyed out; server rejects over-spend | Client-side guard + RPC validation |
| ALLOC-04 | Offline allocations queued in SQLite; sync on reconnect | expo-sqlite outbox pattern + NetInfo |
| ALLOC-05 | Atomic Supabase transactions prevent race conditions | PostgreSQL RPC with FOR UPDATE |
| INFRA-02 | All balance values in game_config table | game_config schema seed |
| INFRA-04 | App operates offline; SQLite cache for village state + allocations | expo-sqlite + NetInfo + optimistic state |
</phase_requirements>

---

## Summary

Phase 2 delivers the complete playable core loop on top of the Phase 1 foundation. The five technical domains are: (1) the Village view with food state machine, (2) the active GPS tracker screen, (3) passive HealthKit/Health Connect reading, (4) the offline-capable Allocate Miles bottom sheet, and (5) the server-side food decay job.

The single most important infrastructure finding is that **Vercel Hobby plan restricts cron jobs to once per day**, making it incompatible with the 6-hour decay tick. The resolution is to use **Supabase pg_cron** (available on the free tier, schedules down to per-minute). The decay logic moves from a Vercel endpoint to a PostgreSQL function called by pg_cron every 6 hours. The Vercel API still handles the manual-entry anti-cheat validation endpoint.

For native integrations: `@rnmapbox/maps` v10.3.1 has its own config plugin and works with Expo bare workflow via EAS cloud builds. Download tokens are no longer required (deprecated); only the runtime public access token (pk.*) is needed. `react-native-health` (iOS HealthKit) and `react-native-health-connect` (Android Health Connect) each need their own config plugin added to `app.config.js`; both are available on all Expo SDK 52 bare workflow builds. Neither can run in Expo Go — the existing `expo-dev-client` setup is correct.

**Primary recommendation:** Use Supabase pg_cron (not Vercel Cron) for the 6-hour decay tick. Implement a Kalman filter as a pure TypeScript class with no external dependency. Use `@rnmapbox/maps` v10.3.1 with the EAS cloud build pipeline already in place. Store the active session checkpoint in expo-secure-store for orphan recovery.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| GPS location tracking (foreground) | Mobile client | — | expo-location runs in-process; location updates are client-side events |
| Kalman filter / accuracy gate | Mobile client | — | Pure computation on incoming location stream; zero network needed |
| Route polyline rendering | Mobile client | — | @rnmapbox/maps renders GeoJSON FeatureCollection locally |
| GeoJSON route persistence | Mobile client → Supabase Storage | — | Client encodes + uploads; Storage holds the file |
| Activity type auto-detection | Mobile client | — | Pace/elevation computation on buffered GPS points; applied at banking time |
| Mile banking (session end) | Supabase (RPC) | Mobile client (optimistic) | Server is authoritative; client shows immediate feedback via TanStack Query |
| Passive health reading (steps/distance/workouts) | Mobile client | — | Platform health APIs called in-process on app foreground |
| Gap-fill reconciliation | Mobile client | — | Local computation: today's total distance − credited sessions; result banked server-side |
| Passive banking prompt | Mobile client | Supabase (RPC) | Client detects delta on app open; user confirms; RPC credits miles |
| Allocate Miles (Hunt Food) | Supabase (atomic RPC) | Mobile client (optimistic) | Race conditions prevented server-side; client applies optimistic update instantly |
| Offline allocation queue | Mobile client (SQLite) | Supabase (sync on reconnect) | expo-sqlite outbox; NetInfo triggers sync |
| Food decay tick | Supabase (pg_cron → Postgres function) | — | Server-only invariant; never trust client clock |
| Grace period tracking | Supabase (villages.grace_expires_at) | — | Server computes; client reads for display |
| Village state machine (Thriving/Hungry/Starving) | Supabase (villages.food_state column) | Mobile client (display) | Server writes state transitions; client renders |
| game_config read | Supabase → Mobile client cache (TanStack Query) | — | Config fetched once on launch; stale time 30 min |
| Manual entry anti-cheat | Vercel API endpoint | Supabase (final write) | Server validates pace + daily cap before crediting miles |
| Persistent recording banner | Mobile client (Zustand + root layout overlay) | — | Global Zustand flag read in (tabs)/_layout.tsx |
| Orphan session recovery | Mobile client (expo-secure-store checkpoint) | — | Session JSON persisted before first GPS point; read on app launch |

---

## Standard Stack

### Core (new packages for this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@rnmapbox/maps` | 10.3.1 | Mapbox GL native map, route polyline, LocationPuck | [VERIFIED: npm registry] Project-mandated; only Mapbox-native library for RN; has config plugin for Expo bare |
| `expo-location` | 56.0.15 | Foreground GPS watchPositionAsync, permission flow | [VERIFIED: npm registry] Official Expo module; integrates with @rnmapbox/maps LocationPuck |
| `react-native-health` | 1.19.0 | iOS HealthKit: distance, workouts, steps | [VERIFIED: npm registry] Most widely used HealthKit bridge for React Native; has Expo config plugin |
| `react-native-health-connect` | 3.5.3 | Android Health Connect: Steps, Distance, ExerciseSession | [VERIFIED: npm registry] Official Android Health Connect wrapper; actively maintained (v3.5.3, May 2026) |
| `expo-health-connect` | 0.1.1 | Expo config plugin wrapper for react-native-health-connect | [VERIFIED: npm registry] Required for Expo prebuild auto-configuration of health-connect |
| `expo-sqlite` | 15.1.4 (already installed) | Offline allocation queue (SQLite outbox) | [VERIFIED: npm registry] Already in package.json; deferred from Phase 1 per D-12 |
| `@react-native-community/netinfo` | 12.0.1 | Network connectivity detection for sync trigger | [VERIFIED: npm registry] Standard Expo-community package; used for offline/online transitions |
| `expo-build-properties` | 56.0.16 | Set Android compileSdkVersion/targetSdkVersion to 35 for Health Connect | [VERIFIED: npm registry] Official Expo tool; required for health-connect Android SDK requirements |

### Supporting (no-install, use what's there)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-secure-store` | 14.0.1 | Orphan session checkpoint persistence | Already installed; use for session JSON checkpoint on first GPS point |
| `zustand` | 5.0.14 | useGameStore (village/food/mile-bank/session state) | Already installed; mirror useAuthStore pattern |
| `@tanstack/react-query` | 5.101.0 | Server state: village data, game_config, activity sync | Already installed; all Supabase reads go through TQ |
| `@supabase/supabase-js` | 2.107.0 | Supabase client (RPC, Storage, DB reads) | Already installed |

### Utility (hand-roll — no external library needed)

| Utility | Implementation | Why Hand-Roll |
|---------|---------------|---------------|
| Kalman filter (1D lat/lon) | Pure TypeScript class | No deps; ~40 lines; slopcheck [SUS] risk for obscure geo libs |
| Haversine distance | Pure TypeScript function | Trivial formula; avoids unnecessary dependency for simple coordinate math |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-native-health` | `@kingstinct/react-native-healthkit` | Kingstinct is TS-first and more actively maintained but has fewer community examples; react-native-health has larger install base and proven Expo plugin |
| Supabase pg_cron | Vercel Cron Pro plan | Vercel Pro costs $20/mo; pg_cron is free, runs inside Postgres, zero network hop for the decay UPDATE |
| Hand-rolled Kalman | `kalman-filter` npm pkg | npm pkg adds ~15KB dependency for code that's 40 lines; hand-roll preferred |

**Installation (new packages only):**
```bash
# From apps/mobile directory
npx expo install @rnmapbox/maps expo-location react-native-health react-native-health-connect expo-health-connect @react-native-community/netinfo expo-build-properties
# expo-sqlite is already installed
```

---

## Package Legitimacy Audit

All packages verified via slopcheck (python -m slopcheck install ...) and npm view on 2026-06-04.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@rnmapbox/maps` | npm | 6+ yrs | high | github.com/rnmapbox/maps | [OK] | Approved |
| `expo-location` | npm | 6+ yrs | very high | github.com/expo/expo | [OK] | Approved |
| `react-native-health` | npm | ~6 yrs (2020) | moderate | github.com/agencyenterprise/react-native-health | [OK] | Approved |
| `react-native-health-connect` | npm | ~4 yrs (2022) | moderate | github.com/matinzd/react-native-health-connect | [OK] | Approved |
| `expo-health-connect` | npm | ~2 yrs (2024) | lower | github.com/matinzd/expo-health-connect | [OK] | Approved — config plugin only, low risk |
| `expo-sqlite` | npm | 6+ yrs | very high | github.com/expo/expo | [OK] | Approved (already installed) |
| `@react-native-community/netinfo` | npm | 6+ yrs | very high | github.com/react-native-netinfo/react-native-netinfo | [OK] | Approved |
| `expo-build-properties` | npm | 3+ yrs | very high | github.com/expo/expo | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

*No postinstall scripts found on any of the above packages.*

---

## Architecture Patterns

### System Architecture Diagram

```
[Device Sensors]
    |
    +--[expo-location watchPositionAsync]---> [Kalman Filter] ---> [Session State (Zustand)]
    |                                                                     |
    +--[react-native-health / health-connect]                            |
         getDistanceWalkingRunning / readRecords('Distance')             |
         getAnchoredWorkouts / readRecords('ExerciseSession')            |
         --> [Gap-fill Reconciliation Logic]                             |
                |                                                        |
                v                                                        v
    [App-Open Prompt: "You moved X mi"]             [Session End: Summary Screen]
                |                                           |
                v                                           v
    [Passive Banking (user confirms)]           [Banking: RPC allocate_miles()]
                |                                           |
                +------------------+------------------------+
                                   |
                                   v
                    [Supabase: profiles.miles_banked += X]
                                   |
                    (TanStack Query invalidates village cache)
                                   |
                                   v
                    [Village Screen: Mile Bank display updated]
                                   |
                    [User taps FAB --> Allocation Bottom Sheet]
                                   |
                    [Hunt Food: RPC allocate_food(miles, quantity)]
                    -- optimistic update: Zustand food += miles×10 --
                    -- SQLite outbox if offline --
                                   |
                    [Supabase: villages.food += qty, miles_banked -= qty]
                                   |
                    ============= Server-only =============
                    [pg_cron: every 6h]
                    --> [decay_village_food() Postgres function]
                    --> UPDATE villages SET food = GREATEST(0, food - 2.5)
                         WHERE grace_expires_at < NOW()
                    --> UPDATE food_state based on new food value
                    --> (client re-fetches on next app open / poll)
```

### Recommended Project Structure

```
apps/mobile/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Add persistent recording banner overlay here
│   │   ├── village/
│   │   │   └── index.tsx        # Real Village screen (replaces placeholder)
│   │   ├── move/
│   │   │   ├── index.tsx        # Move hub: GPS start + manual entry + passive prompt
│   │   │   └── tracker.tsx      # Full-screen GPS tracker (Mapbox map)
│   │   ├── map/
│   │   │   └── index.tsx        # Still placeholder
│   │   └── profile/
│   │       └── index.tsx        # Unchanged
│   └── _layout.tsx              # Root layout (unchanged)
├── components/
│   ├── village/
│   │   ├── FoodMeter.tsx        # Colorblind-safe animated bar
│   │   ├── VillageScene.tsx     # Static illustration + state overlay
│   │   └── RecordingBanner.tsx  # Persistent top/bottom banner (session active)
│   ├── allocate/
│   │   └── AllocateSheet.tsx    # Bottom sheet, Hunt Food + stepper
│   └── move/
│       ├── SessionStats.tsx     # Distance / pace / elapsed sheet
│       └── SessionSummary.tsx   # Post-session route + bank confirmation
├── lib/
│   ├── supabase.ts              # Existing (unchanged)
│   ├── kalman.ts                # KalmanFilter class (pure TS)
│   ├── haversine.ts             # distance(a, b) → meters
│   ├── activityDetector.ts      # detectActivityType(speedMs, elevGain) → type + multiplier
│   ├── gapFill.ts               # reconcilePassiveMiles(totalDist, creditedDist) → delta
│   └── sqliteQueue.ts           # openDB(), enqueue(), dequeueAndSync()
├── store/
│   ├── useAuthStore.ts          # Existing (unchanged)
│   └── useGameStore.ts          # Village state, food, miles, session active flag
├── hooks/
│   ├── useVillage.ts            # TanStack Query: fetchVillage, mutations
│   ├── useGameConfig.ts         # TanStack Query: fetchGameConfig (staleTime 30m)
│   ├── useGpsSession.ts         # Start/stop/pause session, Kalman chain, haversine accumulation
│   └── usePassiveHealth.ts      # HealthKit/Health Connect + gap-fill + prompt logic
└── __tests__/
    ├── kalman.test.ts
    ├── activityDetector.test.ts
    ├── gapFill.test.ts
    └── sqliteQueue.test.ts

apps/api/
└── src/
    ├── index.ts                 # Existing Express app
    └── routes/
        └── activity.ts          # POST /activity/manual — anti-cheat validation

supabase/
└── migrations/
    ├── 20260525000000_init_phase1.sql    # Existing
    └── 20260604000000_phase2_game.sql    # New: activities, allocations, game_config, villages columns
```

### Pattern 1: Kalman Filter for GPS Smoothing

**What:** A 1D position+velocity Kalman filter applied independently to latitude and longitude to smooth GPS noise. Points with `coords.accuracy > 20` are discarded before the filter.

**When to use:** Every incoming `watchPositionAsync` update during an active session.

```typescript
// Source: [ASSUMED] — standard Kalman filter formulation; no external library needed
// apps/mobile/lib/kalman.ts

export class KalmanFilter {
  private Q = 0.00001; // process noise (tunable via game_config)
  private R = 0.0001;  // measurement noise
  private P = 1;
  private x = 0;
  private k = 0;

  reset(initialValue: number) {
    this.x = initialValue;
    this.P = 1;
  }

  filter(measurement: number): number {
    // Predict
    this.P += this.Q;
    // Update (Kalman gain)
    this.k = this.P / (this.P + this.R);
    this.x = this.x + this.k * (measurement - this.x);
    this.P = (1 - this.k) * this.P;
    return this.x;
  }
}

// Usage in useGpsSession.ts:
// const latFilter = new KalmanFilter();
// const lonFilter = new KalmanFilter();
// if (update.coords.accuracy > 20) return; // discard poor GPS
// const smoothLat = latFilter.filter(update.coords.latitude);
// const smoothLon = lonFilter.filter(update.coords.longitude);
```

**Tuning:** Q controls how quickly the filter adapts to direction changes; increase for faster movement (cycling). Seed defaults into game_config for remote tuning.

### Pattern 2: @rnmapbox/maps Real-Time Route Polyline

**What:** A live GeoJSON FeatureCollection updated as filtered GPS points arrive; ShapeSource + LineLayer renders it.

```typescript
// Source: [CITED: rnmapbox.github.io/docs/examples/LineLayer/DrawPolyline]
import MapboxGL from '@rnmapbox/maps';
import { useState } from 'react';

// State: array of [lon, lat] pairs
const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);

// On each filtered GPS update:
setRouteCoords(prev => [...prev, [smoothLon, smoothLat]]);

// GeoJSON shape computed from routeCoords:
const routeShape: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: routeCoords,
    }
  }]
};

// In JSX:
<MapboxGL.ShapeSource id="route" shape={routeShape}>
  <MapboxGL.LineLayer
    id="routeLine"
    style={{ lineColor: '#4CAF50', lineWidth: 4, lineCap: 'round', lineJoin: 'round' }}
  />
</MapboxGL.ShapeSource>
```

**Mapbox token:** Call `MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN!)` once in root `_layout.tsx`. No download token needed (deprecated as of v10.3.1).

### Pattern 3: app.config.js Plugin Chain

```javascript
// Source: [CITED: rnmapbox.github.io/docs/install] + [CITED: github.com/agencyenterprise/react-native-health/docs/Expo.md]
// apps/mobile/app.config.js — additions to existing plugins array:
plugins: [
  'expo-router',
  'expo-secure-store',
  ['@react-native-google-signin/google-signin', { iosUrlScheme: '...' }],
  'expo-apple-authentication',
  // Phase 2 additions:
  '@rnmapbox/maps',                        // defaults to Mapbox SDK v11
  ['expo-location', {
    locationWhenInUsePermission: 'FitRealm uses your location to track your movement and earn miles for your village.'
  }],
  ['react-native-health', {
    healthSharePermission: 'FitRealm reads your movement data to credit miles to your village.',
    healthUpdatePermission: 'FitRealm logs your movement sessions to Apple Health.'
  }],
  'expo-health-connect',                   // Android Health Connect
  ['expo-build-properties', {
    android: {
      compileSdkVersion: 35,
      targetSdkVersion: 35,
      minSdkVersion: 26
    }
  }]
]
```

**Note on minSdkVersion 26:** Health Connect requires Android 8.0+. This raises the minimum from whatever Phase 1 set. Verify the Phase 1 android.minSdkVersion — if it was 21 or 23, this is a breaking change for very old devices (acceptable per project scope).

### Pattern 4: Atomic Supabase RPC — Allocation

```sql
-- Source: [CITED: supabase.com/docs/guides/database/functions]
-- Prevents race conditions; PostgREST auto-wraps in a transaction

CREATE OR REPLACE FUNCTION public.allocate_food(
  p_user_id uuid,
  p_miles_cost numeric,
  p_food_gain numeric
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_miles numeric;
  v_village_id uuid;
BEGIN
  -- Lock the profile row to prevent concurrent over-spend
  SELECT miles_banked INTO v_current_miles
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_miles < p_miles_cost THEN
    RETURN json_build_object('success', false, 'error', 'insufficient_miles');
  END IF;

  -- Deduct miles
  UPDATE public.profiles
  SET miles_banked = miles_banked - p_miles_cost, updated_at = NOW()
  WHERE id = p_user_id;

  -- Add food (capped at 100)
  UPDATE public.villages
  SET food = LEAST(100, food + p_food_gain),
      food_state = CASE
        WHEN LEAST(100, food + p_food_gain) = 0 THEN 'starving'
        WHEN LEAST(100, food + p_food_gain) <= 20 THEN 'hungry'
        ELSE 'thriving'
      END,
      updated_at = NOW()
  WHERE owner_id = p_user_id
  RETURNING id INTO v_village_id;

  -- Record allocation
  INSERT INTO public.allocations (user_id, village_id, action, miles_cost, resource_gain)
  VALUES (p_user_id, v_village_id, 'hunt_food', p_miles_cost, p_food_gain);

  RETURN json_build_object('success', true);
END;
$$;
```

### Pattern 5: expo-sqlite Offline Outbox

```typescript
// Source: [ASSUMED] — standard outbox/queue pattern
// apps/mobile/lib/sqliteQueue.ts

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'fitrealm_queue.db';

export async function initQueue() {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS allocation_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT UNIQUE NOT NULL,
      action TEXT NOT NULL,
      miles_cost REAL NOT NULL,
      food_gain REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_queue_status ON allocation_queue (status);
  `);
  return db;
}

// Enqueue (called on optimistic update):
export async function enqueueAllocation(
  db: SQLite.SQLiteDatabase,
  idempotencyKey: string,
  action: string,
  milesCost: number,
  foodGain: number
) {
  await db.runAsync(
    `INSERT OR IGNORE INTO allocation_queue (idempotency_key, action, miles_cost, food_gain)
     VALUES (?, ?, ?, ?)`,
    [idempotencyKey, action, milesCost, foodGain]
  );
}

// Sync (called when NetInfo goes online):
export async function syncQueue(db: SQLite.SQLiteDatabase, supabase: SupabaseClient, userId: string) {
  const pending = await db.getAllAsync<AllocationQueueRow>(
    `SELECT * FROM allocation_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 20`
  );
  for (const row of pending) {
    const { data, error } = await supabase.rpc('allocate_food', {
      p_user_id: userId,
      p_miles_cost: row.miles_cost,
      p_food_gain: row.food_gain,
    });
    if (!error && data?.success) {
      await db.runAsync(`UPDATE allocation_queue SET status = 'synced' WHERE id = ?`, [row.id]);
    } else if (data?.error === 'insufficient_miles') {
      // Server rejected — roll back optimistic state
      await db.runAsync(`UPDATE allocation_queue SET status = 'rejected' WHERE id = ?`, [row.id]);
    } else {
      await db.runAsync(
        `UPDATE allocation_queue SET retry_count = retry_count + 1 WHERE id = ?`,
        [row.id]
      );
    }
  }
}
```

### Pattern 6: Supabase pg_cron Food Decay (replaces Vercel Cron)

```sql
-- Source: [CITED: supabase.com/docs/guides/cron/quickstart]
-- Run in Supabase SQL Editor during Plan E setup

-- 1. Enable extension (once)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. The decay function
CREATE OR REPLACE FUNCTION public.decay_village_food()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_decay_rate numeric;
  v_hungry_threshold numeric;
BEGIN
  -- Read tunable decay rate from game_config
  SELECT value::numeric INTO v_decay_rate
  FROM public.game_config WHERE key = 'food_decay_per_tick';

  SELECT value::numeric INTO v_hungry_threshold
  FROM public.game_config WHERE key = 'food_hungry_threshold';

  -- Apply decay to all villages past grace period
  UPDATE public.villages
  SET
    food = GREATEST(0, food - v_decay_rate),
    food_state = CASE
      WHEN GREATEST(0, food - v_decay_rate) = 0 THEN 'starving'
      WHEN GREATEST(0, food - v_decay_rate) <= v_hungry_threshold THEN 'hungry'
      ELSE 'thriving'
    END,
    last_decay_at = NOW(),
    updated_at = NOW()
  WHERE grace_expires_at < NOW();
END;
$$;

-- 3. Schedule every 6 hours
SELECT cron.schedule(
  'food-decay-6h',
  '0 */6 * * *',
  'SELECT public.decay_village_food()'
);
```

**Why pg_cron not Vercel Cron:** Vercel Hobby plan limits cron jobs to once per day. [VERIFIED: vercel.com/docs/cron-jobs/usage-and-pricing] The 6-hour decay tick requires Vercel Pro ($20/mo) OR Supabase pg_cron (free, zero-network-hop). Use pg_cron.

### Pattern 7: Persistent Recording Banner (expo-router v4)

The persistent banner ("● Recording — X mi") is rendered in `apps/mobile/app/(tabs)/_layout.tsx` above the `<Tabs>` component using absolute positioning. This renders on top of all tab screens without blocking navigation.

```typescript
// Source: [ASSUMED] — expo-router v4 layout composition pattern
// apps/mobile/app/(tabs)/_layout.tsx

import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { useGameStore } from '@/store/useGameStore';
import { RecordingBanner } from '@/components/village/RecordingBanner';

export default function TabLayout() {
  const isSessionActive = useGameStore(s => s.isSessionActive);
  return (
    <View style={{ flex: 1 }}>
      <Tabs>{/* ... screens */}</Tabs>
      {isSessionActive && (
        <RecordingBanner style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
      )}
    </View>
  );
}
```

**Caveat:** The banner sits above the safe area. Use `useSafeAreaInsets().top` to push the banner below the notch. [ASSUMED — verify rendering order with SafeAreaProvider in Phase 2 testing]

### Pattern 8: Gap-Fill Reconciliation

```typescript
// Source: [ASSUMED] — derived from D2-06/D2-07/D2-08 decisions
// apps/mobile/lib/gapFill.ts

interface DayRecord {
  date: string;            // 'YYYY-MM-DD' local timezone
  totalHealthDistanceMi: number;   // from HealthKit/Health Connect
  creditedSessionsMi: number;      // sum of active sessions banked today
}

export function computePassiveDelta(record: DayRecord): number {
  return Math.max(0, record.totalHealthDistanceMi - record.creditedSessionsMi);
}

// Persistence: store creditedSessionsMi per-day in SQLite:
// CREATE TABLE IF NOT EXISTS day_credits (
//   date TEXT PRIMARY KEY,
//   credited_miles REAL NOT NULL DEFAULT 0
// );
// On session bank: UPDATE day_credits SET credited_miles += sessionMiles WHERE date = today
// Reset: rows beyond today are stale; clean up on date change
```

### Anti-Patterns to Avoid

- **Running decay in client code:** CLAUDE.md and D2-24 both mandate server-only decay. The client must NEVER subtract food from local state based on a timer.
- **Using steps × stride for distance:** D2-07 mandates the platform's own distance value. Do not compute distance from steps.
- **Hardcoding any game balance values:** All numbers (decay rate, food-per-mile, hungry threshold, etc.) must come from game_config. Any hardcoded constant is a bug.
- **Calling allocate_food multiple times without idempotency key:** Rapid double-taps can enqueue duplicate allocations. Always generate a UUID idempotency key client-side and use `INSERT OR IGNORE` in SQLite.
- **Uploading GeoJSON to Supabase Storage as text/plain:** Use `contentType: 'application/geo+json'` and the ArrayBuffer/base64 upload path, not raw string. React Native's Blob/File does not work with Supabase Storage. [CITED: supabase.com/blog/react-native-storage]
- **Requesting location permission on app launch/onboarding:** MOV-10 explicitly defers until first session start. Requesting earlier is an App Store rejection risk.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GPS coordinate smoothing complexity | Custom weighted-average smoother | KalmanFilter class (40 lines, no dep) | Kalman is the standard; handles velocity estimation; trivial to implement in TS |
| Distance computation | Euclidean (lat/lon degrees) | Haversine formula (hand-rolled) | Euclidean breaks near poles and at long distances; haversine is correct |
| iOS HealthKit bridge | Custom native module | `react-native-health` | HealthKit requires Objective-C/Swift entitlement bridge; re-implementing risks App Store issues |
| Android Health Connect bridge | Custom native module | `react-native-health-connect` | Health Connect requires Kotlin/Java bridge and manifest permissions |
| Atomic balance update | Client-side double-write | Supabase RPC with `FOR UPDATE` | Client writes cannot be atomic; concurrent taps cause race conditions |
| Network monitoring | `AppState` polling | `@react-native-community/netinfo` | NetInfo handles all Android/iOS network types; polling wastes battery |
| Offline queue persistence | AsyncStorage JSON arrays | `expo-sqlite` WAL mode | SQLite handles concurrent reads, transactions, and partial write recovery; AsyncStorage does not |
| Scheduled decay | `setInterval` on client | Supabase pg_cron | CLAUDE.md invariant: decay is server-only; client intervals are unreliable and can be gamed |

**Key insight:** The hardest bugs in this phase will come from concurrent writes (rapid allocation taps) and double-counting (health + GPS crediting the same miles). Both are solved by the RPC locking pattern and the gap-fill algorithm, not by clever client logic.

---

## Common Pitfalls

### Pitfall 1: Vercel Hobby Cron Only Runs Once Per Day

**What goes wrong:** Developer writes `"schedule": "0 */6 * * *"` in vercel.json. Vercel rejects the deployment with: "Hobby accounts are limited to daily cron jobs."

**Why it happens:** Vercel Hobby plan minimum interval = once per day. [VERIFIED: vercel.com/docs/cron-jobs/usage-and-pricing]

**How to avoid:** Use Supabase pg_cron for the 6-hour food decay tick. Keep Vercel for the manual-entry anti-cheat API endpoint (which is request-driven, not cron-driven). If Vercel Pro is later adopted, the cron can be migrated.

**Warning signs:** Deployment error "Hobby accounts are limited to daily cron jobs."

---

### Pitfall 2: React Native Health Libraries and New Architecture

**What goes wrong:** `react-native-health` v1.19.0 does not explicitly declare New Architecture (Fabric/TurboModules) support. With RN 0.76 New Architecture enabled by default in Expo SDK 52, some methods may silently fail or crash.

**Why it happens:** The library was written in Objective-C. A Swift rewrite is "in progress" per their README (October 2024), but v1.19.0 is the latest stable. Bridge-based modules can still work under RN 0.76 via compatibility shim, but there are no explicit guarantees.

**How to avoid:** Test on a physical iOS device as early as possible in Plan C. If health queries return empty or crash, add `"jsEngine": "hermes"` and check if `newArchEnabled: false` unblocks it (temporary workaround). File as a Wave 0 risk.

**Warning signs:** Empty results from `getDistanceWalkingRunning` without error, or immediate native crash on the first health call.

---

### Pitfall 3: GeoJSON Upload Returns 0 Bytes in Supabase Storage

**What goes wrong:** Route GeoJSON uploads succeed (no error) but the stored file is 0 bytes when downloaded.

**Why it happens:** Supabase Storage does not support Blob/File/FormData from React Native. You must convert the GeoJSON string to a base64 string, decode it to an ArrayBuffer using `base64-arraybuffer`, and pass the ArrayBuffer to `storage.from().upload()`. [CITED: supabase.com/blog/react-native-storage]

**How to avoid:** Always use the ArrayBuffer pattern:
```typescript
import { decode } from 'base64-arraybuffer';
const base64 = btoa(JSON.stringify(geojson));
await supabase.storage.from('routes').upload(
  `${userId}/${activityId}.geojson`,
  decode(base64),
  { contentType: 'application/geo+json' }
);
```

**Warning signs:** `upload()` resolves without error but `download()` returns a 0-byte file.

---

### Pitfall 4: Double-Counting GPS Session Distance with Passive Health

**What goes wrong:** User runs 3 miles using the GPS tracker. App banks 3 miles from the session. On next app open, HealthKit reports 3 miles walked today. App prompts user to add another 3 miles. User ends up with 6 miles banked for 3 miles run.

**Why it happens:** Gap-fill requires tracking the sum of all active-session miles credited today, so passive credit is `max(0, healthTotal - sessionTotal)`. If session total is not persisted correctly (especially after app restart), the subtraction fails.

**How to avoid:** Persist daily credited sessions in SQLite `day_credits` table. Update immediately after each successful session bank RPC. On app open, load today's credited total before computing passive delta.

**Warning signs:** User reports getting double miles for the same workout.

---

### Pitfall 5: Android 12 Approximate Location Breaks Distance Tracking

**What goes wrong:** On Android 12+ devices, user grants "approximate" location instead of "precise." GPS coordinates have ~3km radius uncertainty, making distance tracking useless. User may not know they need to grant precise.

**Why it happens:** Android 12 introduced a two-tier location permission: coarse (approximate) and fine (precise). Some users tap the wrong option. [VERIFIED: expo-location docs, PermissionDetailsLocationAndroid]

**How to avoid:** After `requestForegroundPermissionsAsync()`, check `permissions.android?.accuracy`. If `accuracy === 'coarse'`, show a UI prompt explaining why precise location is required for accurate distance tracking, and deep-link to the OS location settings. MOV-11 requires this prompt.

**Warning signs:** Distance readings jump by 0.1–3km per step instead of ~0.5m.

---

### Pitfall 6: Orphaned Session Not Recoverable After Android Process Kill

**What goes wrong:** User starts GPS session, Android kills the foreground process (low memory). On relaunch, `useGameStore` state is reset to default (no active session). The in-progress route is lost.

**Why it happens:** Zustand state is in-memory; it does not survive process death. Even with AsyncStorage persistence, Android can kill the process before the async write completes.

**How to avoid:** Write a session checkpoint to `expo-secure-store` synchronously on the FIRST GPS point (not in a `useEffect`). The checkpoint contains: session start time, initial coordinates, and accumulated distance so far. On app launch in `useEffect`, check for a `pending_session` key. If found, auto-save the partial miles and show a toast. D2-14 mandates this behavior.

**Warning signs:** Users report losing miles after Android kills the app.

---

### Pitfall 7: Food State Flicker on App Open (Optimistic vs. Server State Mismatch)

**What goes wrong:** User allocates food while offline. Optimistic update shows Thriving. They close the app. Server processes the sync but the timing is off. On re-open, TanStack Query re-fetches the server state, which may differ from the optimistic state, causing a visible "flicker" from Thriving → Hungry → Thriving.

**Why it happens:** Optimistic state in Zustand is overwritten by TanStack Query's fresh server data. The visual transition is jarring.

**How to avoid:** Use TanStack Query `placeholderData` from the Zustand store on initial load. Once the server fetch resolves, Zustand state is updated from server truth. Use a short crossfade animation (150ms) on food meter changes to smooth transitions rather than an instant jump.

---

### Pitfall 8: Health Connect Not Available on Android 13 (No Play Store)

**What goes wrong:** `initialize()` throws on Android 13 devices that don't have Health Connect installed from the Play Store.

**Why it happens:** Health Connect is built-in only for Android 14+. On Android 13, users must install it from the Play Store. On very old Android 12 devices (minSdkVersion=26), it's entirely unsupported.

**How to avoid:** Wrap health initialization in a try-catch. If `SdkNotAvailableError` is thrown, silently disable passive health sync and show a notice ("Passive sync requires Health Connect. Download it from the Play Store."). Do not crash.

---

## Code Examples

### iOS HealthKit: Get Today's Distance

```typescript
// Source: [CITED: github.com/agencyenterprise/react-native-health/blob/master/docs/getDistanceWalkingRunning.md]
import AppleHealthKit, { HealthValue, HealthInputOptions } from 'react-native-health';

const permissions = {
  permissions: {
    read: [AppleHealthKit.Constants.Permissions.DistanceWalkingRunning, AppleHealthKit.Constants.Permissions.Workout],
    write: [],
  }
};

// Initialize once (e.g., in usePassiveHealth hook on first Move tab visit)
AppleHealthKit.initHealthKit(permissions, (error) => {
  if (error) console.warn('HealthKit init error:', error);
});

// Get today's walking/running distance (meters, defaults to now = today's total)
const today = new Date();
const startOfDay = new Date(today.setHours(0, 0, 0, 0));

const options: HealthInputOptions = {
  startDate: startOfDay.toISOString(),
  unit: 'meter',
  includeManuallyAdded: false,  // exclude manual entries to avoid double-counting
};
AppleHealthKit.getDistanceWalkingRunning(options, (err: Object, results: HealthValue) => {
  const totalMeters = results.value;  // total for today
  const totalMiles = totalMeters / 1609.344;
});
```

### Android Health Connect: Get Today's Distance

```typescript
// Source: [CITED: github.com/matinzd/react-native-health-connect]
import {
  initialize,
  requestPermission,
  readRecords,
} from 'react-native-health-connect';

const today = new Date();
const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

await initialize();
await requestPermission([
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'Steps' },
]);

// Read total distance for today
const distanceRecords = await readRecords('Distance', {
  timeRangeFilter: {
    operator: 'between',
    startTime: startOfDay.toISOString(),
    endTime: new Date().toISOString(),
  },
});
// Sum all distance records (unit is meters)
const totalMeters = distanceRecords.records.reduce(
  (sum, r) => sum + r.distance.inMeters, 0
);
const totalMiles = totalMeters / 1609.344;
```

### expo-location: watchPositionAsync Setup

```typescript
// Source: [CITED: docs.expo.dev/versions/latest/sdk/location/]
import * as Location from 'expo-location';

const subscription = await Location.watchPositionAsync(
  {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,     // minimum 1s between updates
    distanceInterval: 5,    // only if moved >5m (battery saver + noise reduction)
  },
  (update) => {
    if (!update.coords.accuracy || update.coords.accuracy > 20) return; // discard poor GPS
    // Pass to Kalman filter...
  }
);
// Stop: await subscription.remove()
```

### Android 12 Precise Location Check

```typescript
// Source: [CITED: expo-location types — PermissionDetailsLocationAndroid]
const perms = await Location.requestForegroundPermissionsAsync();
if (perms.android?.accuracy === 'coarse') {
  // Show in-app explanation and prompt to update settings
  await Linking.openSettings();  // deep-links to OS location settings
}
```

---

## Supabase Schema (Phase 2 Migration)

The following schema additions are needed in `supabase/migrations/20260604000000_phase2_game.sql`:

```sql
-- Columns added to villages
ALTER TABLE public.villages
  ADD COLUMN IF NOT EXISTS food numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS food_state text NOT NULL DEFAULT 'thriving'
    CHECK (food_state IN ('thriving', 'hungry', 'starving')),
  ADD COLUMN IF NOT EXISTS miles_banked numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medicine numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wood numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stone numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS morale numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grace_expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  ADD COLUMN IF NOT EXISTS last_decay_at timestamptz;

-- NOTE: miles_banked is on profiles (owned by user, not village)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS miles_banked numeric NOT NULL DEFAULT 0;

-- activities table (GPS sessions + manual entries)
CREATE TABLE public.activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('gps', 'manual', 'passive')),
  activity_kind text CHECK (activity_kind IN ('walking', 'running', 'cycling', 'hiking')),
  raw_distance_mi numeric NOT NULL,
  multiplier  numeric NOT NULL DEFAULT 1.0,
  miles_earned numeric NOT NULL,
  route_url   text,                -- Supabase Storage path for GeoJSON
  started_at  timestamptz,
  ended_at    timestamptz,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY activities_own ON public.activities
  FOR ALL USING (auth.uid() = user_id);

-- allocations table
CREATE TABLE public.allocations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  village_id    uuid NOT NULL REFERENCES public.villages ON DELETE CASCADE,
  action        text NOT NULL,
  miles_cost    numeric NOT NULL,
  resource_gain numeric NOT NULL,
  idempotency_key text UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT NOW()
);
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY allocations_own ON public.allocations
  FOR ALL USING (auth.uid() = user_id);

-- game_config table
CREATE TABLE public.game_config (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);
ALTER TABLE public.game_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY game_config_read ON public.game_config
  FOR SELECT USING (true);   -- public read; no client writes

-- Seed initial values
INSERT INTO public.game_config (key, value, description) VALUES
  ('food_decay_per_tick',    '2.5',    'Food deducted per 6-hour decay tick'),
  ('food_decay_cadence_h',   '6',      'Hours between decay ticks'),
  ('food_per_mile',          '10',     'Food gained per mile allocated to Hunt Food'),
  ('hunt_food_miles_cost',   '1',      'Miles cost per Hunt Food unit'),
  ('food_cap',               '100',    'Maximum food a village can hold'),
  ('food_hungry_threshold',  '20',     'Food level at or below which state = hungry'),
  ('grace_period_hours',     '24',     'Hours before first decay tick after village creation'),
  ('manual_entry_daily_cap', '10',     'Maximum miles credited per day from manual entry'),
  ('manual_max_speed_mph',   '15',     'Above this pace (mph) manual entry is rejected as impossible'),
  ('multiplier_walking',     '1.0',    'Walking activity mile multiplier'),
  ('multiplier_running',     '1.25',   'Running activity mile multiplier'),
  ('multiplier_cycling',     '1.25',   'Cycling activity mile multiplier'),
  ('multiplier_hiking',      '1.5',    'Hiking activity mile multiplier'),
  ('pace_run_threshold_mpm', '12',     'Pace in min/mile at or below which = running'),
  ('pace_cycle_threshold_mph','12',    'Speed in mph at or above which (sustained) = cycling'),
  ('elevation_hike_gain_m',  '50',     'Elevation gain in meters per km to trigger hiking classification'),
  ('kalman_process_noise',   '0.00001','Kalman filter Q parameter'),
  ('kalman_measurement_noise','0.0001','Kalman filter R parameter')
ON CONFLICT (key) DO NOTHING;

-- Supabase Storage: routes bucket
-- Run in dashboard or SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('routes', 'routes', false);
-- CREATE POLICY "Users upload own routes" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'routes' AND (storage.foldername(name))[1] = auth.uid()::text);
-- CREATE POLICY "Users read own routes" ON storage.objects
--   FOR SELECT TO authenticated
--   USING (bucket_id = 'routes' AND (storage.foldername(name))[1] = auth.uid()::text);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mapbox download token required for builds | Download token deprecated; runtime public token only | @rnmapbox/maps v10.3.0+ (2024) | Simpler EAS build setup; no secret token in environment |
| Mapbox SDK v10 only | Mapbox SDK v11 is default in @rnmapbox/maps | @rnmapbox/maps v10.0 (2024) | Specify `RNMapboxMapsVersion` only if you need v10; default is fine for Phase 2 |
| expo-sqlite synchronous API | expo-sqlite v15 async API (`runAsync`, `useSQLiteContext`) | Expo SDK 52 | New async API is the standard; sync API still available but async preferred |
| Vercel Cron for server-side jobs | Supabase pg_cron available on free tier | Supabase GA (2023), Vercel Hobby cron limit confirmed 2025 | Decay logic moves to Postgres; eliminates Vercel plan upgrade requirement |
| Google Health Connect: separate app required | Built-in on Android 14+; Play Store download for Android 13 | Android 14 GA | Must handle "not available" gracefully on Android 13 |

**Deprecated/outdated:**
- `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` env var: deprecated, no longer needed [CITED: github.com/rnmapbox/maps/discussions/4121]
- Mapbox SDK v10: supported but v11 is the new default; use v11 unless specific v10 feature needed
- expo-sqlite synchronous `openDatabaseSync` pattern: works but `SQLiteProvider` + `useSQLiteContext` is the modern Expo v15 way

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `react-native-health` v1.19.0 works without issues under RN 0.76 New Architecture via bridge compatibility shim | Common Pitfalls #2, Standard Stack | HealthKit passive sync fails on iOS; need to test early and potentially fall back to `@kingstinct/react-native-healthkit` or disable HealthKit for Phase 2 |
| A2 | Persistent recording banner rendered absolutely above `<Tabs>` in `(tabs)/_layout.tsx` will appear above the safe area inset correctly when using `useSafeAreaInsets` | Architecture Patterns #7 | Banner appears under notch/status bar or obscures content; minor UI fix but needs device testing |
| A3 | Supabase pg_cron is enabled on the existing hosted Supabase project (free tier) | Pattern 6, Don't Hand-Roll | Decay cron cannot be scheduled; fallback is a triggered RPC call from client on app open (acceptable temporary workaround) |
| A4 | expo-health-connect (v0.1.1) correctly auto-configures the Android manifest for `react-native-health-connect` | Standard Stack, app.config.js pattern | Android build fails or health permissions not declared; mitigation: manually add manifest entries per react-native-health-connect README |
| A5 | Raising minSdkVersion to 26 (for Health Connect) does not conflict with Phase 1 android configuration | app.config.js Pattern 3 note | Play Store listing gains a compatibility restriction; need to verify Phase 1 minSdkVersion setting |
| A6 | Activity type detection via pace + elevation gain reliably distinguishes hiking from running using GPS altitude data | activityDetector.ts, game_config thresholds | Misclassification on flat trails (no elevation) or treadmill incline runners; acceptable inaccuracy given "no manual override" (D2-16) |
| A7 | `expo-sqlite` WAL mode performs adequately for the allocation queue use case (low-frequency inserts, ~20 pending rows max) | Pattern 5 (SQLite) | No performance risk at this scale; assumption is safe |
| A8 | Haversine computation for GPS distance is accurate enough for the game (within 1% for typical run distances) | haversine.ts | Acceptable tolerance; Vincenty formula more accurate but unnecessary |

**If this table were empty:** All claims in this research were verified or cited.

---

## Open Questions

1. **react-native-health New Architecture compatibility**
   - What we know: v1.19.0 was released Oct 2024; the library is Objective-C based; SDK 52 enables New Architecture by default; bridge modules usually still work via compatibility layer in RN 0.76
   - What's unclear: Whether any specific HealthKit query method crashes or silently fails under Fabric rendering
   - Recommendation: Make Plan C's Wave 0 include an explicit "HealthKit smoke test" task on physical iPhone before proceeding to implementation

2. **Food decay: Vercel endpoint as fallback vs. pure pg_cron**
   - What we know: pg_cron is the right tool, but the Plan E Vercel endpoint could still expose a `/api/cron/decay` for manual triggering (admin tool) or future migration to Vercel Pro
   - What's unclear: Whether keeping a dormant Vercel decay endpoint is worth the maintenance overhead
   - Recommendation: Build pg_cron only; skip the Vercel decay endpoint in Phase 2; it can be added later if needed

3. **app.config.js plugin ordering — expo-build-properties and minSdkVersion**
   - What we know: expo-build-properties must be listed after other plugins that also modify android build settings to avoid conflicts
   - What's unclear: Phase 1 did not use expo-build-properties; we don't know what the current minSdkVersion is
   - Recommendation: Check `apps/mobile/android/build.gradle` (if it exists post-prebuild) or set minSdkVersion in expo-build-properties explicitly

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm builds | ✓ | v22.14.0 | — |
| npm | Package install | ✓ | 10.9.2 | — |
| EAS CLI (cloud builds) | iOS dev-client build | [ASSUMED] | unknown | `npx eas-cli` |
| Android Emulator | MOV-01 local testing | [ASSUMED] | unknown | EAS cloud Android build |
| Physical Android device | MOV-09, ALLOC-04 | Unknown | — | Android emulator with Health Connect |
| Physical iPhone | MOV-09 (HealthKit), iOS E2E | Unknown | — | EAS iOS Simulator build (limited: no HealthKit) |
| Supabase project (live) | All Supabase calls | ✓ | Hosted | — |
| Vercel deployment (live) | Manual entry anti-cheat endpoint | ✓ | Deployed (Phase 1) | Local `vercel dev` |
| Mapbox account + access token | @rnmapbox/maps | [ASSUMED] | unknown | Must create at console.mapbox.com |
| HealthKit entitlement (Apple Developer) | react-native-health | [ASSUMED] | — | Must enable in Apple Developer portal for production builds; dev-client builds may work without it |

**Missing dependencies with no fallback:**
- Mapbox public access token (pk.*): must create at console.mapbox.com and set as `EXPO_PUBLIC_MAPBOX_TOKEN` in `.env`
- Apple Developer account with HealthKit capability enabled: required for any iOS build that uses react-native-health

**Missing dependencies with fallback:**
- Physical iPhone: EAS iOS Simulator build can test most GPS/UI flows but cannot test HealthKit (simulator has no HealthKit data)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Mobile framework | jest-expo ~52.0.0 (jest.config.js: `preset: 'jest-expo'`) |
| API framework | ts-jest + supertest (jest.config.js: `preset: 'ts-jest', testEnvironment: 'node'`) |
| Mobile config file | `apps/mobile/jest.config.js` |
| API config file | `apps/api/jest.config.js` |
| Mobile quick run | `cd apps/mobile && npm test` |
| API quick run | `cd apps/api && npm test` |
| Full suite | `npm test --workspaces` from repo root |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VLG-03 | Village state transitions (food values → state strings) | unit | `cd apps/mobile && npm test -- --testPathPattern=villageState` | ❌ Wave 0 |
| VLG-06 | decay_village_food() decrements food, respects grace period | unit (Postgres fn via SQL) | manual SQL test in Supabase | ❌ Wave 0 |
| MOV-02 | Kalman filter smooths noisy GPS; rejects >20m accuracy points | unit | `cd apps/mobile && npm test -- --testPathPattern=kalman` | ❌ Wave 0 |
| MOV-04 | activityDetector classifies pace bands correctly | unit | `cd apps/mobile && npm test -- --testPathPattern=activityDetector` | ❌ Wave 0 |
| MOV-06/07 | Gap-fill reconciliation returns correct passive delta | unit | `cd apps/mobile && npm test -- --testPathPattern=gapFill` | ❌ Wave 0 |
| MOV-08 | Manual entry anti-cheat: pace > max rejected; daily cap enforced | unit (API) | `cd apps/api && npm test -- --testPathPattern=activity` | ❌ Wave 0 |
| ALLOC-04 | SQLite queue enqueues, dequeues, handles rejection | unit | `cd apps/mobile && npm test -- --testPathPattern=sqliteQueue` | ❌ Wave 0 |
| ALLOC-05 | allocate_food RPC is atomic (concurrent calls don't over-spend) | integration | manual Supabase SQL test | ❌ Wave 0 |
| INFRA-02 | game_config seeded with all required keys | smoke | `cd apps/api && npm test -- --testPathPattern=gameConfig` | ❌ Wave 0 |
| E2E: core loop | Move → Bank → Allocate → village food increases | manual (physical device) | `n/a — manual test on device` | manual-only |
| E2E: decay | 6h pg_cron tick reduces food; starving state locks alloc | manual (trigger cron manually in Supabase dashboard) | n/a | manual-only |

**Manual-only justification:** Native GPS, HealthKit/Health Connect, and physical device E2E cannot be exercised in Jest. These require physical device testing as called out in Phase 2 success criteria #6.

### Sampling Rate

- **Per task commit:** `cd apps/mobile && npm test` (unit tests only, ~10s)
- **Per wave merge:** `npm test --workspaces` (full mobile + API suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/mobile/__tests__/kalman.test.ts` — covers MOV-02
- [ ] `apps/mobile/__tests__/activityDetector.test.ts` — covers MOV-04
- [ ] `apps/mobile/__tests__/gapFill.test.ts` — covers MOV-06/MOV-07
- [ ] `apps/mobile/__tests__/sqliteQueue.test.ts` — covers ALLOC-04
- [ ] `apps/mobile/__tests__/villageState.test.ts` — covers VLG-03 (pure state machine logic)
- [ ] `apps/api/__tests__/activity.test.ts` — covers MOV-08 anti-cheat (supertest)

All 6 test files must be created in Wave 0 (Plan A setup tasks) before implementation begins.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes — all game endpoints | Supabase Auth JWT; `auth.uid()` in RLS |
| V3 Session Management | yes — GPS session token | expo-secure-store for session checkpoint; Supabase JWT for API calls |
| V4 Access Control | yes — users can only read/write own village, activities, allocations | RLS policies: `auth.uid() = owner_id / user_id` on all tables |
| V5 Input Validation | yes — manual entry anti-cheat, allocation amounts | Vercel API: reject impossible pace; RPC: reject over-spend; never trust client mileage |
| V6 Cryptography | no — no custom crypto | Supabase TLS in transit; expo-secure-store for local sensitive data |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client-side mile inflation (send 100 miles for 0.1mi walk) | Spoofing/Elevation of Privilege | Server validates: max miles per session = raw distance × max_multiplier; daily cap in game_config |
| Race condition: tap Hunt Food 10× rapidly | Tampering | Supabase RPC with `FOR UPDATE` locks profile row; idempotency key in SQLite queue |
| Replay attack: resend old allocation payload | Tampering | `idempotency_key UNIQUE` constraint; SQLite queue uses UUID per intent |
| Accessing other users' village data | Information Disclosure | RLS: `auth.uid() = owner_id` on villages; `auth.uid() = user_id` on activities/allocations |
| Game config manipulation from client | Tampering | game_config has SELECT-only RLS for authenticated users; no client UPDATE policy |
| GeoJSON route spoofing (fabricated routes) | Spoofing | Route URL stored in activities table (user can see their own); distance credited from server-validated activity record, not the GeoJSON file content |
| Cron decay endpoint abuse (if Vercel endpoint exists) | Denial of Service | pg_cron runs internally in Postgres; no HTTP endpoint exposed for decay; manual trigger only via Supabase dashboard |

---

## Project Constraints (from CLAUDE.md)

- **GSD workflow enforcement:** All code changes must go through a GSD command; no direct repo edits outside a workflow.
- **Decay is server-only invariant:** Food decay must NEVER be computed client-side. Only Vercel Cron (or Supabase pg_cron) may trigger decay. This is a hard constraint.
- **Balance invariant:** Even a fully maxed village must still lose resources without movement. The cron decay function must not have any building-based bypass that reduces decay to zero.
- **Platform:** iOS + Android simultaneous. Every feature must target both.
- **Monetization ethics:** Never sell resources, miles, or movement credit. No content paywalls.
- **North Star metric:** Weekly Active Movers (WAM).
- **App Store compliance:** Location permissions NOT requested during onboarding — only on first session start. HealthKit usage descriptions required in Info.plist (handled via react-native-health plugin).
- **Colorblind safety:** Resource meters must always pair color with icon + text label. Never color-alone.

---

## Sources

### Primary (HIGH confidence)
- [CITED: vercel.com/docs/cron-jobs/usage-and-pricing] — Hobby plan: once-per-day minimum; Pro plan: once-per-minute
- [CITED: supabase.com/docs/guides/cron/quickstart] — pg_cron schedule syntax; available on free tier
- [CITED: rnmapbox.github.io/docs/install] — Config plugin setup, EAS build requirements, no download token needed
- [CITED: github.com/agencyenterprise/react-native-health/blob/master/docs/Expo.md] — Config plugin options, HealthKit entitlement, NSHealthShareUsageDescription
- [CITED: github.com/agencyenterprise/react-native-health/blob/master/docs/getDistanceWalkingRunning.md] — API shape for distance query
- [CITED: github.com/agencyenterprise/react-native-health/blob/master/docs/getAnchoredWorkouts.md] — Anchored workout sync pattern
- [CITED: matinzd.github.io/react-native-health-connect/docs/permissions] — Record types: Steps, Distance, ExerciseSession; permission request pattern
- [CITED: docs.expo.dev/versions/latest/sdk/location/] — watchPositionAsync, LocationObject, Accuracy enum, Android 12 coarse/fine
- [CITED: docs.expo.dev/versions/latest/sdk/sqlite/] — expo-sqlite v15 async API: SQLiteProvider, useSQLiteContext, runAsync, WAL
- [CITED: supabase.com/docs/guides/database/functions] — RPC function pattern, FOR UPDATE locking
- [CITED: supabase.com/docs/guides/storage/security/access-control] — storage.objects RLS, foldername() helper
- [CITED: supabase.com/blog/react-native-storage] — ArrayBuffer upload pattern; Blob/File/FormData do not work in RN
- [CITED: rnmapbox.github.io/docs/examples/LineLayer/DrawPolyline] — ShapeSource + LineLayer real-time polyline pattern
- [CITED: github.com/rnmapbox/maps/discussions/4121] — Download token deprecated; runtime public token is all that's needed
- [VERIFIED: npm registry] — All package versions confirmed via `npm view` on 2026-06-04; all packages passed slopcheck [OK]

### Secondary (MEDIUM confidence)
- [WebSearch → verified with official source] — expo-location: Android 12 PermissionDetailsLocationAndroid.accuracy ('fine'/'coarse')
- [WebSearch → verified with GitHub releases] — react-native-health-connect v3.5.3 (May 2026): New Architecture pod install fixed in v3.2.1
- [WebSearch → verified with Supabase docs] — pg_cron available on all Supabase plans including free tier

### Tertiary (LOW confidence / ASSUMED)
- A1–A8 in Assumptions Log above

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages verified on npm registry and passed slopcheck; no hallucinated packages
- Architecture: MEDIUM-HIGH — architecture follows locked decisions; pg_cron vs Vercel Cron is a critical finding that aligns with verified Vercel pricing docs
- GPS / Mapbox patterns: MEDIUM — confirmed via official @rnmapbox/maps docs and expo-location types
- HealthKit/Health Connect: MEDIUM — APIs confirmed via official library docs; New Architecture compatibility for react-native-health is LOW confidence (A1)
- Pitfalls: HIGH — Vercel cron limit, GeoJSON upload, and double-counting pitfalls are all verified or well-documented

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (30 days; watch @rnmapbox/maps releases for New Architecture updates)
