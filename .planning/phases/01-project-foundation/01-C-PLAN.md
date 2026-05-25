---
phase: 01-project-foundation
plan: C
type: execute
wave: 3
depends_on:
  - 01-A
  - 01-B
files_modified:
  - apps/api/package.json
  - apps/api/tsconfig.json
  - apps/api/vercel.json
  - apps/api/.env.example
  - apps/api/src/index.ts
  - apps/api/__tests__/health.test.ts
  - apps/api/jest.config.js
  - apps/mobile/app/_layout.tsx
  - apps/mobile/package.json
autonomous: false
requirements:
  - INFRA-05
  - INFRA-06

must_haves:
  truths:
    - "GET /health returns { status: 'ok', version: '1.0.0' } with HTTP 200 from deployed Vercel URL"
    - "Village tab in the mobile app displays the API health check response (not 'unreachable')"
    - "Vercel deployment is publicly reachable (no auth required for /health)"
    - "RevenueCat SDK initializes on app launch without crash (no crash on Android Emulator)"
    - "No API secrets are committed to git (EXPO_PUBLIC_API_URL is not a secret; SUPABASE_SERVICE_KEY is in Vercel env vars only)"
    - "EAS build succeeds for Android (confirming react-native-purchases@10.x works with New Architecture)"
  artifacts:
    - path: "apps/api/src/index.ts"
      provides: "Express app with GET /health"
      contains: "status: 'ok'"
    - path: "apps/api/vercel.json"
      provides: "Vercel routing config"
      contains: "src/index.ts"
    - path: "apps/api/__tests__/health.test.ts"
      provides: "Unit test for GET /health"
    - path: "apps/api/jest.config.js"
      provides: "Jest config for API workspace"
  key_links:
    - from: "apps/mobile/app/(tabs)/village/index.tsx"
      to: "apps/api/src/index.ts (deployed Vercel URL)"
      via: "TanStack Query useQuery → fetch EXPO_PUBLIC_API_URL/health"
      pattern: "EXPO_PUBLIC_API_URL"
    - from: "apps/mobile/app/_layout.tsx"
      to: "react-native-purchases"
      via: "Purchases.configure({ apiKey }) in useEffect on mount"
      pattern: "Purchases.configure"

user_setup:
  - service: vercel
    why: "Vercel deployment required so the mobile app can call GET /health from a real URL"
    env_vars:
      - name: EXPO_PUBLIC_API_URL
        source: "After 'vercel --prod' completes, copy the deployment URL (e.g. https://fitrealm-api.vercel.app) into apps/mobile/.env"
    dashboard_config:
      - task: "Create a Vercel account at vercel.com if you don't have one"
        location: "https://vercel.com/signup"
      - task: "Install Vercel CLI globally: npm install -g vercel"
        location: "Terminal"
      - task: "Run 'vercel login' to authenticate"
        location: "Terminal — inside apps/api/"
      - task: "Run 'vercel link' to bind apps/api/ to a new Vercel project named 'fitrealm-api'"
        location: "Terminal — inside apps/api/"
      - task: "After first deploy, add SUPABASE_SERVICE_KEY to Vercel env vars: vercel env add SUPABASE_SERVICE_KEY"
        location: "Terminal or Vercel Dashboard → Project → Settings → Environment Variables"

  - service: revenuecat
    why: "RevenueCat SDK requires API keys to initialize (even before products are set up)"
    env_vars:
      - name: EXPO_PUBLIC_RC_IOS_KEY
        source: "RevenueCat Dashboard → Project → API Keys → Public SDK key (iOS)"
      - name: EXPO_PUBLIC_RC_ANDROID_KEY
        source: "RevenueCat Dashboard → Project → API Keys → Public SDK key (Android)"
    dashboard_config:
      - task: "Create a RevenueCat account at app.revenuecat.com if you don't have one"
        location: "https://app.revenuecat.com"
      - task: "Create a new project named 'FitRealm' → add iOS App → add Android App → copy the Public SDK Keys to apps/mobile/.env"
        location: "RevenueCat Dashboard → Projects → New Project"
---

<objective>
This plan scaffolds the Vercel Express API workspace and integrates the RevenueCat SDK into the mobile app. The API delivers `GET /health` to prove the Vercel serverless layer is reachable from the mobile app. RevenueCat is configured so its SDK is initialized at app launch — no purchase flows yet (deferred to Phase 7).

After this plan, the full Phase 1 Walking Skeleton is complete: the Village tab displays live API connectivity, and RevenueCat is initialized without crash.

Purpose: Satisfy INFRA-05 (API secrets in Vercel env vars) and INFRA-06 (EAS Build + CI config).
Output: Deployed Vercel API with /health; RevenueCat SDK initialized on app launch.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-project-foundation/01-CONTEXT.md
@.planning/phases/01-project-foundation/01-RESEARCH.md
@.planning/phases/01-project-foundation/01-SKELETON.md
@.planning/phases/01-project-foundation/01-A-SUMMARY.md
@.planning/phases/01-project-foundation/01-B-SUMMARY.md

<interfaces>
<!-- Contracts from Plans A and B that Plan C builds on -->

Village tab (from apps/mobile/app/(tabs)/village/index.tsx, created in Plan A):
```typescript
// Already contains useQuery for health check; EXPO_PUBLIC_API_URL/health
// Plan C deploys the real API; the Village tab already calls it
// No changes to village/index.tsx needed — just fill in EXPO_PUBLIC_API_URL in .env
```

Root layout (from apps/mobile/app/_layout.tsx, created in Plan A):
```typescript
// useEffect already calls useAuthStore.getState().initialize()
// Plan C adds Purchases.configure() call to the same useEffect
// Add BEFORE auth initialize() to ensure RevenueCat is ready first
```

Express API (created fresh in this plan):
```typescript
// apps/api/src/index.ts — export Express app (NO app.listen() — Vercel manages lifecycle)
import express from 'express'
const app = express()
app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }))
export default app  // export, not listen
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Scaffold Vercel Express API workspace with GET /health</name>
  <files>
    apps/api/package.json,
    apps/api/tsconfig.json,
    apps/api/vercel.json,
    apps/api/.env.example,
    apps/api/src/index.ts,
    apps/api/__tests__/health.test.ts,
    apps/api/jest.config.js
  </files>

  <read_first>
    - `.planning/phases/01-project-foundation/01-RESEARCH.md` — Pattern 8 (Vercel Express API), Anti-Patterns ("Calling app.listen() in Vercel Express")
    - `.planning/phases/01-project-foundation/01-CONTEXT.md` — Decisions D-13, D-14, D-15
    - `.planning/phases/01-project-foundation/01-VALIDATION.md` — Wave 0 Requirements (apps/api jest.config.js + health.test.ts)
  </read_first>

  <behavior>
    - health.test.ts: import supertest; GET /health → expect status 200
    - health.test.ts: GET /health → expect body to deep-equal `{ status: 'ok', version: '1.0.0' }`
    - health.test.ts: GET /health → expect Content-Type header to match `application/json`
  </behavior>

  <action>
    Step 1 — Create apps/api/package.json with:
    - `"name": "@fitrealm/api"`, `"private": true`, `"version": "1.0.0"`
    - `"scripts": { "dev": "vercel dev", "test": "jest" }`
    - `"dependencies": { "express": "^4.21.0" }`
    - `"devDependencies": { "@types/express": "^4.17.21", "@types/node": "^22.x", "typescript": "^5.x", "jest": "^29.x", "@types/jest": "^29.x", "ts-jest": "^29.x", "supertest": "^7.x", "@types/supertest": "^6.x" }`
    - Run `npm install --workspace=apps/api` from repo root to install

    Step 2 — Create apps/api/tsconfig.json:
    - `"target": "ES2020"`, `"module": "commonjs"`, `"moduleResolution": "node"`, `"esModuleInterop": true`, `"strict": true`, `"outDir": "dist"`, `"rootDir": "src"`

    Step 3 — Create apps/api/jest.config.js:
    - preset: `ts-jest`
    - testEnvironment: `node`
    - testMatch: `['**/__tests__/**/*.test.ts']`

    Step 4 — Write the unit test FIRST (TDD — RED phase):
    Create apps/api/__tests__/health.test.ts:
    - Import `supertest` and the Express app from `../src/index`
    - Test 1: `GET /health` → status 200
    - Test 2: `GET /health` → body equals `{ status: 'ok', version: '1.0.0' }`
    - Test 3: `GET /health` → Content-Type matches `application/json`
    Run `npm test --workspace=apps/api` — this MUST fail (RED) before implementation exists.

    Step 5 — Create apps/api/src/index.ts per RESEARCH.md Pattern 8:
    - `import express from 'express'`
    - `const app = express()`
    - `app.use(express.json())`
    - `app.get('/health', (_req, res) => { res.json({ status: 'ok', version: '1.0.0' }) })`
    - `export default app` — CRITICAL: do NOT call `app.listen()` — Vercel manages the server lifecycle
    Run `npm test --workspace=apps/api` — this MUST pass (GREEN).

    Step 6 — Create apps/api/vercel.json per RESEARCH.md Pattern 8:
    ```json
    {
      "version": 2,
      "builds": [
        { "src": "src/index.ts", "use": "@vercel/node" }
      ],
      "routes": [
        { "src": "/(.*)", "dest": "src/index.ts" }
      ]
    }
    ```

    Step 7 — Create apps/api/.env.example (template only — never fill in real values):
    ```
    SUPABASE_SERVICE_KEY=your-supabase-service-role-key
    SUPABASE_URL=https://your-project.supabase.co
    ```
    Note: These are server-only secrets (no EXPO_PUBLIC_ prefix). They live in Vercel env vars only.

    Step 8 — Add apps/api/.vercel/ to root .gitignore if not already present (Vercel CLI creates this directory locally).
  </action>

  <acceptance_criteria>
    - `apps/api/package.json` contains `"express": "^4.21.0"` in dependencies
    - `apps/api/package.json` does NOT contain `"main"` pointing to a file that calls `app.listen()`
    - `apps/api/src/index.ts` contains `export default app` (NOT `app.listen`)
    - `apps/api/src/index.ts` contains `res.json({ status: 'ok', version: '1.0.0' })`
    - `apps/api/vercel.json` contains `"use": "@vercel/node"`
    - `apps/api/__tests__/health.test.ts` exists and contains `supertest`
    - `apps/api/.env.example` contains `SUPABASE_SERVICE_KEY=` (no EXPO_PUBLIC_ prefix — server-only)
    - `apps/api/.env.example` does NOT contain any actual secret values
    - `npm test --workspace=apps/api` exits 0 (all 3 health tests pass)
  </acceptance_criteria>

  <verify>
    <automated>npm test --workspace=apps/api 2>&1 | tail -15</automated>
  </verify>

  <done>Vercel Express API workspace scaffolded. GET /health implemented. All 3 unit tests pass. vercel.json configured for @vercel/node. No app.listen() call.</done>
</task>

<task type="auto">
  <name>Task 2: Install RevenueCat SDK and wire Purchases.configure() on app launch</name>
  <files>
    apps/mobile/package.json,
    apps/mobile/app/_layout.tsx
  </files>

  <read_first>
    - `.planning/phases/01-project-foundation/01-RESEARCH.md` — Pattern 7 (RevenueCat SDK Init), Pitfall 5 (react-native-purchases build failure with New Architecture), Anti-Patterns section
    - `.planning/phases/01-project-foundation/01-CONTEXT.md` — Decision D-16
    - `apps/mobile/app/_layout.tsx` — already written in Plan A; add Purchases.configure() to existing useEffect
  </read_first>

  <action>
    Step 1 — Install react-native-purchases. From apps/mobile/:
    `npx expo install react-native-purchases`
    This resolves to `react-native-purchases@^10.x` which fixes the New Architecture crash (per RESEARCH.md Pitfall 5 and Standard Stack table).

    Step 2 — Run expo-doctor to verify New Architecture compatibility:
    `npx expo-doctor`
    If expo-doctor flags react-native-purchases as incompatible, manually set `"react-native-purchases": "^10.1.2"` in apps/mobile/package.json and run `npm install --workspace=apps/mobile`.

    Step 3 — Update apps/mobile/app/_layout.tsx to add RevenueCat initialization. In the existing useEffect (the one that already calls `useAuthStore.getState().initialize()`), add BEFORE the auth call:
    ```
    import Purchases from 'react-native-purchases'
    import { Platform } from 'react-native'

    // Inside useEffect, before auth initialize():
    const rcKey = Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_RC_IOS_KEY!
      : process.env.EXPO_PUBLIC_RC_ANDROID_KEY!
    Purchases.configure({ apiKey: rcKey })
    ```
    Per D-16: `Purchases.configure()` is called once on mount. No products, offerings, or purchase flows. This is the Phase 1 minimal setup only.

    Step 4 — Add EXPO_PUBLIC_RC_IOS_KEY and EXPO_PUBLIC_RC_ANDROID_KEY to apps/mobile/.env.example if not already present (they were added in Plan A Task 1 Step 10). Confirm they are present.

    Step 5 — Run `npx expo prebuild --clean` from apps/mobile/ to apply native config for react-native-purchases (adds BILLING permission to AndroidManifest.xml per RESEARCH.md Pattern 7).

    Step 6 — Run unit tests to confirm no regression:
    `npm test --workspace=apps/mobile`
  </action>

  <acceptance_criteria>
    - `apps/mobile/package.json` contains `"react-native-purchases"` at version `^10.x` or `10.x.x`
    - `apps/mobile/app/_layout.tsx` contains `Purchases.configure({ apiKey: rcKey })`
    - `apps/mobile/app/_layout.tsx` contains `Platform.OS === 'ios'` check for selecting RC API key
    - `apps/mobile/app/_layout.tsx` contains `EXPO_PUBLIC_RC_IOS_KEY` and `EXPO_PUBLIC_RC_ANDROID_KEY`
    - `apps/mobile/app/_layout.tsx` does NOT contain any `Purchases.getOfferings()` or `Purchases.purchasePackage()` calls (Phase 7 only)
    - `apps/mobile/.env.example` contains `EXPO_PUBLIC_RC_IOS_KEY=` and `EXPO_PUBLIC_RC_ANDROID_KEY=`
    - `npm test --workspace=apps/mobile` exits 0 (no regression from RevenueCat addition)
    - `npx expo-doctor` from apps/mobile/ exits 0 or shows only non-blocking warnings
  </acceptance_criteria>

  <verify>
    <automated>npm test --workspace=apps/mobile 2>&1 | tail -10</automated>
    <automated>npm test --workspace=apps/api 2>&1 | tail -10</automated>
    <automated>cd apps/mobile && npx expo-doctor 2>&1 | head -20</automated>
  </verify>

  <done>react-native-purchases@^10.x installed. Purchases.configure() called once in root layout useEffect. No purchase flows defined. expo prebuild --clean run. Both workspace test suites pass.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Deploy Vercel API and verify full Walking Skeleton end-to-end</name>
  <what-built>
    Tasks 1 and 2 created the Express API with GET /health and wired RevenueCat SDK. Now deploy the API to Vercel and verify the complete Phase 1 Walking Skeleton is working end-to-end.
  </what-built>
  <how-to-verify>
    Step 1 — Deploy API to Vercel:
    ```
    cd apps/api
    vercel --prod
    ```
    Copy the deployment URL (e.g. `https://fitrealm-api.vercel.app`).
    Add Vercel env vars (if not done yet):
    ```
    vercel env add SUPABASE_SERVICE_KEY
    vercel env add SUPABASE_URL
    ```

    Step 2 — Verify API is live:
    Open browser: `https://YOUR_VERCEL_URL/health`
    Expected: `{"status":"ok","version":"1.0.0"}` with HTTP 200.

    Step 3 — Update mobile .env with real API URL:
    In `apps/mobile/.env`, set `EXPO_PUBLIC_API_URL=https://YOUR_VERCEL_URL`

    Step 4 — Build and run updated mobile app (API URL changed → rebuild required):
    ```
    cd apps/mobile
    eas build --platform android --profile preview
    ```
    Install APK on Android Emulator.

    Step 5 — Full Walking Skeleton smoke test:
    1. Launch app → sign in with Google → land on 4-tab shell
    2. Village tab shows "API: ok v1.0.0" (from the real Vercel /health call)
    3. Force-kill app → relaunch → still on Village tab (session persisted)
    4. Check console/logcat — confirm "RevenueCat configured" or no RevenueCat crash

    Step 6 — iOS EAS build verification (optional but recommended):
    ```
    eas build --platform ios --profile development
    ```
    Install from EAS dashboard on iOS Simulator. Verify:
    - App launches without crash
    - Sign-in screen shows both Google and Apple buttons
    - Apple Sign-In button tappable (actual Apple auth requires real Apple credentials in Supabase)
    - RevenueCat no crash on iOS

    Full Walking Skeleton checklist:
    - [ ] Android app builds on EAS
    - [ ] iOS app builds on EAS (cloud build)
    - [ ] Google Sign-In works (Android confirmed in Plan B; iOS confirmed here)
    - [ ] Session persists across app kill
    - [ ] Village tab shows "API: ok v1.0.0" from real Vercel URL
    - [ ] No RevenueCat crash on launch
  </how-to-verify>
  <resume-signal>Type "verified" with which checklist items passed. Describe any failures.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Mobile → Vercel API | Public HTTP call to GET /health (no auth in Phase 1); future game endpoints will require JWT validation |
| Vercel → Supabase | Server-to-server with service role key (bypasses RLS); must never be in mobile bundle |
| RevenueCat SDK → RevenueCat cloud | Public SDK key used (intended to be in bundle); purchase validation is server-side (Phase 7) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-1C-01 | Information Disclosure | SUPABASE_SERVICE_KEY in Vercel | mitigate | Key added via `vercel env add` (never in .env file committed to git); `.env.example` has placeholder only; acceptance criteria verify no actual secret values in .env.example |
| T-1C-02 | Information Disclosure | EXPO_PUBLIC_API_URL is in mobile bundle | accept | This is the public Vercel deployment URL, not a secret; intentionally public |
| T-1C-03 | Denial of Service | GET /health endpoint public (no auth, no rate limiting) | accept | Phase 1 only; health endpoint is industry standard; rate limiting added in Phase 7 if needed; Vercel free tier has DDoS protection |
| T-1C-04 | Information Disclosure | RevenueCat public SDK key in mobile bundle | accept | RevenueCat public keys are designed to be in mobile bundles; purchase validation is server-side; key cannot be used to make purchases without device verification |
| T-1C-05 | Tampering | react-native-purchases version < 8.9.2 (New Architecture crash) | mitigate | Acceptance criteria verify version is ^10.x; expo-doctor run after install; Pitfall 5 documented and enforced |
| T-1C-SC | Tampering | npm package install (react-native-purchases, express, supertest, ts-jest, supertest) | mitigate | All packages in RESEARCH.md audit table marked "Approved"; gated by Plan A Task 0 legitimacy checkpoint |
</threat_model>

<verification>
After all tasks and the final checkpoint pass:

1. `npm test --workspace=apps/api` exits 0 (3 health endpoint tests pass)
2. `npm test --workspace=apps/mobile` exits 0 (supabase + auth store unit tests)
3. `curl https://YOUR_VERCEL_URL/health` returns `{"status":"ok","version":"1.0.0"}` with 200
4. Android EAS build installs and runs; Village tab shows "API: ok v1.0.0"
5. iOS EAS build succeeds (cloud build — Windows constraint)
6. No RevenueCat crash on Android or iOS launch
7. `apps/api/.env.example` contains no actual secret values
8. `apps/api/src/index.ts` contains NO `app.listen()` call
</verification>

<success_criteria>
- Vercel Express API deployed at public URL; GET /health returns { status: 'ok', version: '1.0.0' } with HTTP 200 (INFRA-05 — secrets in Vercel env vars, not in repo)
- All 3 health endpoint unit tests pass (npm test --workspace=apps/api exits 0)
- Mobile app Village tab displays API health check response from real Vercel URL
- react-native-purchases@^10.x installed; Purchases.configure() called once in root layout useEffect (no crash, D-16)
- EAS build profiles exist (development/preview/production in eas.json — already from Plan A) confirming INFRA-06
- Android EAS preview build installs and runs the complete Walking Skeleton end-to-end
- iOS EAS development build succeeds from EAS cloud (Windows constraint — no local iOS build)
- SUPABASE_SERVICE_KEY exists only in Vercel environment variables, never in git (INFRA-05)
</success_criteria>

<output>
Create `.planning/phases/01-project-foundation/01-C-SUMMARY.md` when done.
</output>
