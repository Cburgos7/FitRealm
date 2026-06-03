---
phase: 1
slug: project-foundation
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest + React Native Testing Library (Expo bare workflow default) |
| **Config file** | `apps/mobile/jest.config.js` — Wave 0 gap (must be created) |
| **Quick run command** | `npm test --workspace=apps/mobile` |
| **Full suite command** | `npm test --workspace=apps/mobile -- --coverage` |
| **API tests** | `npm test --workspace=apps/api` |
| **Estimated runtime** | ~30 seconds (Phase 1 unit tests are minimal) |

---

## Sampling Rate

- **After every task commit:** Run `npm test --workspace=apps/mobile`
- **After every plan wave:** Run `npm test --workspace=apps/mobile -- --coverage` + EAS Android preview build smoke test
- **Before `/gsd:verify-work`:** All 5 ROADMAP success criteria verified manually (builds on both platforms, auth flows, API health check)
- **Max feedback latency:** ~30 seconds (unit tests)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| scaffold-monorepo | A | 1 | INFRA-05 | T-1-01 | No secrets in git; `.env` in `.gitignore` | static | `git log --all -- "*.env"` | ❌ W0 | ⬜ pending |
| expo-bare-init | A | 1 | — | — | N/A | manual | `npx expo-doctor` | N/A | ⬜ pending |
| tab-shell | A | 1 | — | — | N/A | manual | `eas build --platform android --profile development` | N/A | ⬜ pending |
| supabase-client | B | 1 | INFRA-01 | T-1-02 | Publishable key only; service role key never in bundle | unit | `npm test --workspace=apps/mobile -- --testPathPattern supabase` | ❌ W0 | ⬜ pending |
| auth-store | B | 1 | AUTH-03 | T-1-03 | Session stored via expo-sqlite localStorage (not AsyncStorage) | unit | `npm test --workspace=apps/mobile -- --testPathPattern useAuthStore` | ❌ W0 | ⬜ pending |
| google-signin | B | 2 | AUTH-01 | T-1-04 | Web Client ID used (not iOS/Android client ID) | manual | Manual smoke on iOS + Android device | N/A | ⬜ pending |
| apple-signin | B | 2 | AUTH-02 | — | Apple Sign-In iOS only; button uses Apple branded component | manual | Manual smoke on iOS device | N/A | ⬜ pending |
| supabase-schema | B | 1 | INFRA-01 | T-1-05 | RLS enabled; policies scoped to auth.uid() | manual | `supabase db test` | ❌ W0 | ⬜ pending |
| session-persist | B | 2 | AUTH-03 | — | N/A | manual | Kill + relaunch app; verify session restored | N/A | ⬜ pending |
| vercel-api | C | 1 | INFRA-05 | T-1-01 | API secrets in Vercel env vars; not in repo | unit | `npm test --workspace=apps/api -- --testPathPattern health` | ❌ W0 | ⬜ pending |
| revenuecat-init | C | 2 | — | — | N/A | manual | `npx expo-doctor`; launch app; no crash | N/A | ⬜ pending |
| eas-build | C | 2 | INFRA-06 | — | N/A | manual | `eas build --platform android --profile preview` succeeds | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/mobile/jest.config.js` — Jest configuration for Expo bare workflow (preset: `jest-expo`)
- [ ] `apps/mobile/__tests__/supabase.test.ts` — Verifies client initializes without throwing; env var keys present
- [ ] `apps/mobile/__tests__/useAuthStore.test.ts` — Verifies store shape (session: null, isLoading: true, initialize fn exists)
- [ ] `apps/api/__tests__/health.test.ts` — `GET /health` returns 200 + `{ status: 'ok', version: '1.0.0' }`
- [ ] `apps/api/jest.config.js` — Jest config for API workspace
- [ ] Root `.gitignore` entries: `*.env`, `.env`, `.env.local`, `GoogleService-Info.plist` (if treating as secret)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google Sign-In on iOS + Android | AUTH-01 | Requires physical device + Google Cloud credentials | Launch dev build → tap Google Sign-In → verify Supabase session created → check profiles table in Supabase dashboard |
| Apple Sign-In on iOS | AUTH-02 | Requires iOS device + Apple developer account | Launch dev build on iPhone → tap Apple Sign-In → verify Supabase session created |
| Session persists after app kill | AUTH-03 | Device restart required | Sign in → force-kill app → relaunch → verify still signed in (no redirect to sign-in screen) |
| iOS build runs without crash | INFRA-06 | iOS requires EAS cloud build (Windows dev machine) | `eas build --platform ios --profile development` → install on iOS Simulator via Expo dashboard |
| Android build runs without crash | INFRA-06 | EAS cloud or local Android Emulator | `eas build --platform android --profile preview` → install APK on emulator → verify 4 tabs load |
| Vercel API reachable from app | INFRA-05 | Live deployed API required | Open app post-auth → check Village tab network request to `/health` returns 200 |
| RLS blocks cross-user data access | INFRA-01 | Requires 2 test accounts | Sign in as User A → manually attempt to query User B's village via Supabase client → verify RLS rejects |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (5 test files + jest configs)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (unit tests)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-25
