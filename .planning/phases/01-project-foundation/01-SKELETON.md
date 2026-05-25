# Walking Skeleton — Phase 1: Project Foundation

## What This Proves

The thinnest possible end-to-end slice of FitRealm that exercises every critical layer without implementing any game mechanics:

1. **Monorepo builds on Android** — `apps/mobile/` compiles, boots on Android Emulator, shows 4-tab shell
2. **Monorepo builds on iOS** — EAS cloud build succeeds; dev build installs and runs on iOS Simulator
3. **Auth works end-to-end** — User taps Google Sign-In → Supabase issues session → app transitions to tab shell → session survives app kill + relaunch
4. **Supabase DB connected** — After sign-in, a real DB read is made (profile row fetched); confirms RLS + network path works
5. **Vercel API reachable** — Village tab calls `GET /health`; response `{ status: 'ok', version: '1.0.0' }` is displayed on screen

---

## Skeleton Boundary

### In Scope

| Capability | Implementation |
|------------|---------------|
| Monorepo structure | Root `package.json` with npm workspaces `apps/*` |
| Expo bare SDK 52 app | `apps/mobile/` with Expo Router v3, 4-tab shell |
| Google Sign-In | `@react-native-google-signin/google-signin` → Supabase `signInWithIdToken` |
| Apple Sign-In | `expo-apple-authentication` → Supabase `signInWithIdToken` (iOS only) |
| Session persistence | `expo-sqlite/localStorage/install` as supabase-js auth storage |
| Supabase DB | `profiles` and `villages` tables with RLS; `handle_new_user` trigger |
| Vercel API | `GET /health` → `{ status: 'ok', version: '1.0.0' }` deployed to Vercel |
| RevenueCat SDK | `Purchases.configure()` called on root mount; no products defined |
| Test infrastructure | Jest + RNTL; unit tests for supabase client, auth store, health endpoint |

### Explicitly Out of Scope

| Capability | Deferred To |
|------------|-------------|
| Apple Sign-In dashboard setup (Apple Developer Portal) | Manual step during Plan B execution |
| RevenueCat products / offerings / purchase flows | Phase 7 |
| SQLite offline queue | Phase 2 |
| Village resource meters, decay, game state | Phase 2 |
| Mapbox integration | Phase 3 |
| Avatar creation | Phase 4 |
| Push notifications | Phase 7 |
| PostGIS `geography(POINT)` column on villages | Phase 2/3 migration |
| Game logic of any kind | Phase 2+ |

---

## Smoke Test Protocol

Execute these steps in order after all three plans complete:

### Step 1: Android local verification

1. Start Android Emulator (`emulator -avd <your-avd-name>`)
2. Run `npm run android --workspace=apps/mobile` (or `npx expo run:android` from `apps/mobile/`)
3. **Expected:** App launches, shows Google Sign-In button screen
4. Tap **Sign in with Google** → complete Google OAuth flow
5. **Expected:** App transitions to 4-tab shell (Village, Map, Move, Profile); each tab shows "Coming soon" placeholder
6. Force-kill the app; relaunch
7. **Expected:** App goes directly to tab shell (no sign-in screen) — session persisted
8. On Village tab, verify health check display shows `API: ok v1.0.0` (or equivalent from `/health` call)

### Step 2: iOS EAS build verification

1. Run `eas build --platform ios --profile development` from `apps/mobile/`
2. **Expected:** Build completes without error on EAS cloud
3. Install build on iOS Simulator via EAS dashboard link
4. Repeat steps 3–8 from Step 1 (Google Sign-In + Apple Sign-In on iOS)
5. **Expected:** Apple Sign-In button visible and functional on iOS (not visible on Android)

### Step 3: Supabase DB read verification

1. After signing in with any method, open Supabase Dashboard → Table Editor → profiles
2. **Expected:** A row exists for the test account with `id` matching the Supabase Auth user
3. Confirms: `handle_new_user` trigger fired, RLS allows read of own row

### Step 4: Vercel API verification

1. Open browser: `https://<your-vercel-url>/health`
2. **Expected response:** `{ "status": "ok", "version": "1.0.0" }` with HTTP 200
3. In Village tab of running app, verify same response is displayed (TanStack Query health fetch)

### Step 5: RLS cross-user isolation check (manual)

1. Sign in as User A; note Supabase Auth UID
2. Sign out; sign in as User B
3. In Supabase Dashboard → SQL Editor, run: `SELECT * FROM profiles WHERE id = '<user-a-uid>'`
4. **Expected:** 0 rows returned (RLS blocks cross-user read when running as authenticated User B via anon key)

---

## Platform Gates

| Platform | Local Dev | Build Method | Verification |
|----------|-----------|--------------|-------------|
| Android | Android Emulator (local) | `npx expo run:android` or EAS preview APK | Full smoke test locally |
| iOS | NOT available on Windows | EAS cloud build (`eas build --platform ios --profile development`) | Install from EAS dashboard; test on iOS Simulator |
| API (Vercel) | `vercel dev` from `apps/api/` | `vercel --prod` or Git push to Vercel | `curl https://<vercel-url>/health` |

**Critical constraint:** iOS native builds (`pod install`, local Xcode) are not possible on Windows 10. All iOS testing happens via EAS cloud builds. Android Emulator is the primary local iteration target.
