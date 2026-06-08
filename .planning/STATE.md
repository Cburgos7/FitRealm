# GSD State: FitRealm

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-24)

**Core value:** Move → Bank → Allocate — every mile earned is a strategic decision that keeps the village alive
**Current focus:** Phase 1 — Project Foundation

## Current Status

**Phase:** 1 of 7
**Phase name:** Project Foundation
**Phase status:** Code complete — awaiting device verification
**Overall progress:** 14%

## Roadmap Snapshot

| Phase | Name | Status |
|-------|------|--------|
| 1 | Project Foundation | ⚡ In Progress |
| 2 | Core Movement Loop | ○ Pending |
| 3 | World Map & Exploration | ○ Pending |
| 4 | Onboarding & Avatar | ○ Pending |
| 5 | Engagement Systems | ○ Pending |
| 6 | Social, Buildings & Relocation | ○ Pending |
| 7 | Economy, Safety & Launch Readiness | ○ Pending |

## Phase 1 Plan Status

| Plan | Description | Status |
|------|-------------|--------|
| 01-A-PLAN.md | Monorepo scaffold + Expo SDK 52 + 4-tab shell + auth routing + test infra | ✅ Code complete |
| 01-B-PLAN.md | Supabase schema + Google Sign-In + Apple Sign-In + session persistence | ✅ Code complete (credentials needed) |
| 01-C-PLAN.md | Vercel Express API + RevenueCat SDK init | ✅ Code complete |

## Deferred Device Verification

The following require a desktop + connected credentials before marking Phase 1 complete:

1. **Android smoke test** — `npx expo run:android` → sign-in screen renders without crash
2. **Supabase project setup** — create project → fill `.env` → `npx supabase db push`
3. **Google Cloud Console** — create OAuth credentials → replace placeholder plist/json files → update `iosUrlScheme` in app.json
4. **Google Sign-In E2E** — Android: Google button → account picker → tab shell → session persists after kill
5. **Vercel deploy** — `cd apps/api && vercel --prod` → update `EXPO_PUBLIC_API_URL` in `.env` → Village tab shows "API: ok v1.0.0"
6. **RevenueCat** — create project → fill RC keys in `.env` → confirm no crash on launch

## Session Log

- 2026-05-24: Project initialized. PROJECT.md, config.json, REQUIREMENTS.md, ROADMAP.md created.
- 2026-06-02: Phase 1 Plans A/B/C executed. All code written, 8/8 tests pass. Device verification deferred.
- 2026-06-03: Phase 1 credentials wired (Supabase/Google/Vercel/RevenueCat live). Phase 2 context gathered — **core mechanic redesigned to food-only survival model** (REQUIREMENTS.md + ROADMAP.md updated).
- 2026-06-03: Phase 2 PLANNED — research + 5 plans (3 waves) + validation strategy. Verified PASSED (plan-checker caught + fixed a day_credits double-counting contract). Key finding: food decay runs on Supabase pg_cron, not Vercel Cron (Hobby plan caps cron at once/day).
- 2026-06-05: Phase 2 EXECUTED (code-complete, device verify deferred) + CODE REVIEW. Review found 20 findings (5 blockers / 9 warnings / 6 info); headline: increment_miles_banked RPC defined in no migration (core bank loop was dead). **ALL 20 findings now resolved** across 21 atomic fix commits + 6 new fix migrations (push deferred). Tests: mobile 92/92, API 20/20, tsc clean.
- 2026-06-07: **EAS dev-client builds GREEN on both platforms.** Resolved 9 distinct build blockers: prebuildCommand for monorepo, SDK 52 version pinning (vs hoisted SDK 56), @expo/config-plugins override, react-native-health autolinking exclude (A1), New Architecture enabled, babel-preset-expo wired, app.json removed, google-services.json api_key added, EAS GOOGLE_SERVICES_JSON secret refreshed. APK + iOS .app artifacts ready for device install.

## Phase 2 Plan Status

**All 5 plans CODE-COMPLETE** (unit tests green: mobile 76/76, API 14/14, tsc clean). Device/build verification deferred to desktop — see punch-list below.

| Plan | Wave | Description | Code | Device verify |
|------|------|-------------|------|---------------|
| 02-01 | 1 | Schema + native packages + Village view + Wave-0 tests | ✅ | ⏳ deferred |
| 02-02 | 2 | Active GPS tracker + manual anti-cheat API | ✅ | ⏳ deferred |
| 02-03 | 3 | Passive HealthKit/Health Connect + gap-fill | ✅ | ⏳ deferred (A1 gate) |
| 02-04 | 2 | Allocate Miles + offline SQLite queue | ✅ | ⏳ deferred |
| 02-05 | 3 | Food decay via Supabase pg_cron | ✅ | ⏳ deferred |

## Phase 2 Deferred — Device/Build Punch-List (do at desktop + phone)

**A. Apply schema (one push covers all 9 Phase 2 migrations, incl. 6 code-review fixes):**
1. `npx supabase db push` — applies phase2_game, allocate_rpc, decay_cron + 6 review-fix migrations (increment_miles_fix, rls_with_check_fix, allocate_food_race_fix, routes_delete_policy, drop_villages_miles_banked, decay_single_greatest)
2. Verify in Supabase: game_config ≥18 keys; villages has food/food_state/grace_expires_at; `increment_miles_banked` + `allocate_food` + `decay_village_food` functions exist; activities/allocations RLS has WITH CHECK; routes storage has insert/select/update/delete own-folder policies; pg_cron job `food-decay-6h` scheduled; `routes` Storage bucket
2b. **Live-DB verification (can't be unit-tested):** CR-04 — concurrency test `allocate_food` replay (duplicate idempotency_key → one spend, returns idempotent:true); CR-03 — confirm manual-entry stored raw_distance semantics when post-multiplier cap clamps a partial entry
2c. **WR-09 device check:** Mapbox `centerCoordinate`/`followUserLocation` interaction + the 3 scoped `@ts-expect-error` suppressions in tracker.tsx need device confirmation

**B. Native build:** ✅ **DONE 2026-06-07**
- Android dev APK: https://expo.dev/artifacts/eas/aNG2dN8vXJ6f34qyXXu5Fg.apk
- iOS Simulator build: https://expo.dev/artifacts/eas/p2LJWAR4dty2U7kQDUbdpg.tar.gz
- Build env: EAS env vars set (Mapbox, Supabase, RC, API URL, GoogleServices)
- Build config: New Architecture enabled, babel-preset-expo wired, SDK 52 versions pinned, autolinking excludes react-native-health (A1 deferred) + react-native-health-connect (iOS codegen)

**C. A1 RISK GATE — iOS HealthKit (still deferred — `react-native-health` excluded from build):**
6. Physical iPhone: confirm `react-native-health` `getDistanceWalkingRunning` works under RN 0.76 New Arch. Currently the package is excluded from iOS autolinking; iOS passive sync will be a no-op until A1 is closed. Fallback if it crashes when re-enabled: `@kingstinct/react-native-healthkit` or disable iOS passive sync for Phase 2.

**D. Device E2E (success criterion #6 — iPhone + Android):** ← **YOU ARE HERE**
7. Install builds: Android (drag APK onto emulator / `adb install`) + iOS (unzip `.tar.gz`, drag `.app` onto Simulator)
8. Sign-in smoke test: Google on Android, Google + Apple on iOS → land on Village tab → session survives kill (Phase 1 + Phase 2 confirmation)
9. GPS session: route polyline + live stats + recording banner persists across tabs + End→Bank toast + GeoJSON in Storage + orphan recovery
10. Allocate: Hunt Food online; offline queue → reconnect sync; over-budget rejection; idempotency (no double-spend); starve→Hunt→unlock
11. Passive (Android Health Connect only — iOS deferred via A1): health permission → app-open prompt → banks miles (food unchanged); gap-fill shows only delta after a GPS session
12. Decay: SQL-trigger `decay_village_food()` → food −2.5, grace skip, floor at 0, state transitions; drain toast + grace badge on app open

**E. Test suite repair (deferred since 2026-06-07):**
- After adding `babel.config.js` for the build fix, Jest test suite breaks: `Cannot find module 'react-native/Libraries/Utilities/PolyfillFunctions'` from the hoisted root expo's winter runtime trying to load against workspace react-native 0.76.
- Tests were last green at commit `08f5f60` (92/92 mobile, 20/20 API). Fix likely involves either scoping babel.config.js to non-test transforms or providing a separate babel config for jest.
- Not blocking device verification — just blocks CI re-greening.

## Next Action

**Phase 2: device E2E remains.** Builds are ready to install (URLs above). Recommended sequence:
1. Apply schema: `npx supabase db push` (covers all 9 Phase 2 migrations)
2. Install APK on Android emulator/device → smoke test sign-in + village + GPS + allocate
3. Install iOS `.app` on Simulator → smoke test sign-in + village
4. Repair Jest test suite (item E above) so CI is green again
5. `/gsd-verify-work 2` to formally validate Phase 2, then begin Phase 3

Also outstanding (low priority): Phase 1 Android sign-in smoke test, originally deferred — implicitly covered by step 2 above.
