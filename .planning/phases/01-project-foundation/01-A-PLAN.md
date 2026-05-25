---
phase: 01-project-foundation
plan: A
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - .gitignore
  - apps/mobile/package.json
  - apps/mobile/app.json
  - apps/mobile/metro.config.js
  - apps/mobile/tsconfig.json
  - apps/mobile/jest.config.js
  - apps/mobile/eas.json
  - apps/mobile/.env.example
  - apps/mobile/app/_layout.tsx
  - apps/mobile/app/sign-in.tsx
  - apps/mobile/app/(tabs)/_layout.tsx
  - apps/mobile/app/(tabs)/village/index.tsx
  - apps/mobile/app/(tabs)/map/index.tsx
  - apps/mobile/app/(tabs)/move/index.tsx
  - apps/mobile/app/(tabs)/profile/index.tsx
  - apps/mobile/lib/supabase.ts
  - apps/mobile/store/useAuthStore.ts
  - apps/mobile/__tests__/supabase.test.ts
  - apps/mobile/__tests__/useAuthStore.test.ts
autonomous: false
requirements:
  - INFRA-05
  - INFRA-06

must_haves:
  truths:
    - "Android app builds and launches on the emulator with no crash"
    - "4-tab shell is visible post-auth (Village, Map, Move, Profile — all placeholder)"
    - "Auth guard redirects unauthenticated users to sign-in screen before session loads"
    - "Auth guard shows loading state while session is resolving (no redirect loop)"
    - "No secrets (.env files) are tracked in git"
    - "EAS build profiles exist (development, preview, production)"
    - "Unit tests pass for supabase client init and auth store shape"
  artifacts:
    - path: "package.json"
      provides: "Monorepo root with npm workspaces [apps/*]"
      contains: "\"workspaces\": [\"apps/*\"]"
    - path: "apps/mobile/package.json"
      provides: "Expo SDK 52 mobile app"
      contains: "\"expo\": \"~52.0"
    - path: "apps/mobile/app/_layout.tsx"
      provides: "Root layout with SessionProvider and Slot"
      exports: ["default Root"]
    - path: "apps/mobile/app/(tabs)/_layout.tsx"
      provides: "Auth guard and 4-tab bar"
      contains: "<Redirect href=\"/sign-in\" />"
    - path: "apps/mobile/lib/supabase.ts"
      provides: "Supabase client singleton"
      contains: "expo-sqlite/localStorage/install"
    - path: "apps/mobile/store/useAuthStore.ts"
      provides: "Zustand auth slice"
      exports: ["useAuthStore"]
    - path: "apps/mobile/eas.json"
      provides: "EAS build profiles"
      contains: "development"
    - path: "apps/mobile/__tests__/supabase.test.ts"
      provides: "Supabase client unit test"
    - path: "apps/mobile/__tests__/useAuthStore.test.ts"
      provides: "Auth store shape unit test"
  key_links:
    - from: "apps/mobile/app/_layout.tsx"
      to: "apps/mobile/store/useAuthStore.ts"
      via: "SessionProvider component that calls initialize()"
      pattern: "initialize"
    - from: "apps/mobile/app/(tabs)/_layout.tsx"
      to: "apps/mobile/store/useAuthStore.ts"
      via: "useAuthStore() hook reading session + isLoading"
      pattern: "useAuthStore"
    - from: "apps/mobile/lib/supabase.ts"
      to: "expo-sqlite/localStorage"
      via: "import 'expo-sqlite/localStorage/install' before createClient"
      pattern: "expo-sqlite/localStorage/install"

user_setup:
  - service: expo-eas
    why: "EAS Build is required for iOS cloud builds (Windows machine cannot build iOS locally)"
    env_vars: []
    dashboard_config:
      - task: "Create an Expo account at expo.dev if you don't have one"
        location: "https://expo.dev/signup"
      - task: "Run 'eas login' and 'eas build:configure' inside apps/mobile/"
        location: "Terminal"
---

## Phase Goal

**As a** developer, **I want to** have a running React Native monorepo with a 4-tab shell and auth routing skeleton, **so that** all subsequent phases have a working codebase to build game features into.

<objective>
This plan scaffolds the entire FitRealm monorepo and Expo bare app. It produces the structural foundation that all subsequent phases build into: root workspace, Expo SDK 52, Expo Router v3 with the correct SDK 52 auth guard pattern, 4-tab shell with placeholder screens, Supabase client singleton, Zustand auth store, test infrastructure, and EAS build profiles.

No game mechanics. No auth credentials yet (that is Plan B). This plan proves the scaffold compiles and the routing structure is correct.

Purpose: Establish the codebase skeleton that is the permanent home for all FitRealm features.
Output: Buildable monorepo with Android-runnable Expo app and passing unit tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-project-foundation/01-CONTEXT.md
@.planning/phases/01-project-foundation/01-RESEARCH.md
@.planning/phases/01-project-foundation/01-SKELETON.md

<interfaces>
<!-- All interfaces created fresh in this plan — no existing codebase to import from. -->
<!-- The executor must implement all of the following from scratch. -->

Zustand auth store interface (from RESEARCH.md Pattern 3):
```typescript
interface AuthState {
  session: Session | null;   // null while loading or unauthenticated
  isLoading: boolean;        // true until first getSession() resolves
  initialize: () => () => void;  // returns unsubscribe cleanup fn
}
```

Supabase client (from RESEARCH.md Pattern 4):
```typescript
// lib/supabase.ts
// Import order is mandatory:
import 'react-native-url-polyfill/auto'
import 'expo-sqlite/localStorage/install'
// Then createClient with storage: localStorage
export const supabase: SupabaseClient
```

Root layout contract (from RESEARCH.md Pattern 2):
```typescript
// app/_layout.tsx
// Must render <Slot /> unconditionally — no conditionals here
// SessionProvider calls useAuthStore.getState().initialize() in useEffect
export default function Root(): JSX.Element

// app/(tabs)/_layout.tsx
// Reads { session, isLoading } from useAuthStore()
// If isLoading → return <Text>Loading...</Text>
// If !session → return <Redirect href="/sign-in" />
// Otherwise → return <Tabs> with 4 screens
export default function TabsLayout(): JSX.Element
```
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 0: Confirm package legitimacy before installing</name>
  <what-built>The RESEARCH.md Package Legitimacy Audit lists 11 packages all tagged [ASSUMED] (slopcheck was unavailable). All have been reviewed informally and marked "Approved" based on established repos, high download counts, and official maintainers. This checkpoint confirms you agree to proceed with installation.</what-built>
  <how-to-verify>
    Review the Package Legitimacy Audit table in `.planning/phases/01-project-foundation/01-RESEARCH.md` (the "Package Legitimacy Audit" section). All 11 packages should show "Approved" in the Disposition column. If any look unfamiliar or suspicious, visit their npm page before approving.

    Packages being installed in this plan:
    - expo (~52.0.49), expo-router (~3.5.x), expo-dev-client (~4.0.x)
    - expo-secure-store, expo-apple-authentication, expo-splash-screen
    - expo-status-bar, expo-constants, expo-linking
    - react-native-safe-area-context, react-native-screens
    - @supabase/supabase-js (^2.x), react-native-url-polyfill (^3.0.0)
    - @react-native-google-signin/google-signin (^14.x)
    - zustand (^5.0), @tanstack/react-query (^5.x)
  </how-to-verify>
  <resume-signal>Type "approved" to continue with installation, or list any packages you want to skip</resume-signal>
</task>

<task type="auto" tdd="true">
  <name>Task 1: Scaffold monorepo root and Expo bare app (SDK 52)</name>
  <files>
    package.json,
    .gitignore,
    apps/mobile/package.json,
    apps/mobile/app.json,
    apps/mobile/metro.config.js,
    apps/mobile/tsconfig.json,
    apps/mobile/eas.json,
    apps/mobile/.env.example,
    apps/mobile/jest.config.js,
    apps/mobile/__tests__/supabase.test.ts,
    apps/mobile/__tests__/useAuthStore.test.ts
  </files>

  <read_first>
    - `.planning/phases/01-project-foundation/01-RESEARCH.md` — Pattern 1 (Expo Bare Workflow Init), Pattern 9 (npm Workspaces + Metro), Pattern 10 (EAS Build Profiles), Pattern 13 (app.json Required Fields), Pitfall 1 (SDK version mismatch after scaffold), Anti-Patterns section
    - `.planning/phases/01-project-foundation/01-CONTEXT.md` — Decisions D-01 through D-06, D-14, Claude's Discretion section
    - `.planning/phases/01-project-foundation/01-VALIDATION.md` — Wave 0 Requirements section
  </read_first>

  <behavior>
    - supabase.test.ts: import supabase from lib/supabase → expect supabase to not be null → expect supabase.auth to not be null
    - supabase.test.ts: import does not throw (mocked env vars EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY set in test setup)
    - useAuthStore.test.ts: create store → expect session to be null → expect isLoading to be true → expect initialize to be a function
  </behavior>

  <action>
    Step 1 — Create monorepo root package.json at repo root (F:/CODING/FitRealm/package.json):
    - Set `"name": "fitrealm"`, `"private": true`, `"workspaces": ["apps/*"]`
    - No dependencies at root level

    Step 2 — Create root .gitignore. Must include: `node_modules/`, `.env`, `*.env`, `.env.local`, `*.env.local`, `apps/mobile/.expo/`, `apps/mobile/android/`, `apps/mobile/ios/`, `apps/api/.vercel/`, `*.keystore`, `*.p8`, `*.p12`, `*.mobileprovision`
    - Do NOT add GoogleService-Info.plist or google-services.json to .gitignore — per RESEARCH.md Pitfall 4, these contain only client IDs (not secrets) and must be committed for EAS cloud builds

    Step 3 — Scaffold the bare Expo app. Run from repo root:
    `npx create-expo-app@latest apps/mobile --template bare-minimum`
    This generates apps/mobile/ with android/ and ios/ native directories.

    Step 4 — Pin SDK 52. In apps/mobile/package.json, change `"expo"` to `"~52.0.49"`. Then run from apps/mobile/:
    `npx expo install --fix`
    This aligns all expo-* packages to their SDK 52-compatible versions.
    Verify expo-router resolves to ~3.5.x (NOT 4.x or 5.x — that would be SDK 53+).
    Verify react-native resolves to 0.76.x.

    Step 5 — Install Expo Router and supporting packages. From apps/mobile/:
    `npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar expo-splash-screen expo-secure-store expo-apple-authentication expo-dev-client`

    Step 6 — Configure apps/mobile/app.json with all required fields from RESEARCH.md Pattern 13:
    - `"name": "FitRealm"`, `"slug": "fitrealm"`, `"version": "1.0.0"`, `"scheme": "fitrealm"`, `"orientation": "portrait"`
    - `"ios.bundleIdentifier": "com.fitrealm.app"`, `"ios.googleServicesFile": "./GoogleService-Info.plist"`, `"ios.supportsTablet": false`
    - `"android.package": "com.fitrealm.app"`, `"android.googleServicesFile": "./google-services.json"`, `"android.adaptiveIcon.foregroundImage": "./assets/adaptive-icon.png"`
    - `"main": "expo-router/entry"`
    - `"plugins"`: `["expo-router", "expo-secure-store", "expo-apple-authentication"]`
    - Note: `@react-native-google-signin/google-signin` plugin entry with `iosUrlScheme` placeholder is added in Plan B when Google credentials exist

    Step 7 — Configure apps/mobile/metro.config.js per RESEARCH.md Pattern 9 (SDK 52 auto-monorepo — no manual watchFolders):
    ```
    const { getDefaultConfig } = require('expo/metro-config');
    const config = getDefaultConfig(__dirname);
    module.exports = config;
    ```

    Step 8 — Configure apps/mobile/tsconfig.json to extend `expo/tsconfig.base` with strict mode. Add path alias `"@/*": ["./*"]` so imports like `@/lib/supabase` resolve correctly.

    Step 9 — Create apps/mobile/eas.json per RESEARCH.md Pattern 10 with three profiles: `development` (developmentClient: true, distribution: internal, ios.simulator: true), `preview` (distribution: internal, android.buildType: apk), `production` (empty — for store submission).
    - Set `"cli": { "version": ">= 16.0.0" }` at the top level.

    Step 10 — Create apps/mobile/.env.example with placeholder keys (these are never filled in this file — it is the template):
    ```
    EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
    EXPO_PUBLIC_API_URL=https://your-vercel-project.vercel.app
    EXPO_PUBLIC_RC_IOS_KEY=your-revenuecat-ios-key
    EXPO_PUBLIC_RC_ANDROID_KEY=your-revenuecat-android-key
    ```

    Step 11 — Create apps/mobile/jest.config.js per RESEARCH.md Validation Architecture section:
    - preset: `jest-expo`
    - transformIgnorePatterns: include standard Expo bare patterns for native modules
    - setupFilesAfterFramework: add `@testing-library/jest-native/extend-expect` if installed
    - moduleNameMapper for `@/` alias resolution

    Step 12 — Create unit test stubs (tests must be written BEFORE implementation files):
    - `apps/mobile/__tests__/supabase.test.ts`: mock `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` via `process.env`; import `supabase` from `../lib/supabase`; assert `supabase !== null` and `supabase.auth !== null`
    - `apps/mobile/__tests__/useAuthStore.test.ts`: import `useAuthStore` from `../store/useAuthStore`; get initial state via `useAuthStore.getState()`; assert `session === null`, `isLoading === true`, `typeof initialize === 'function'`
  </action>

  <acceptance_criteria>
    - `package.json` at repo root contains `"workspaces": ["apps/*"]` and `"private": true`
    - `apps/mobile/package.json` contains `"expo": "~52.0` (version starts with 52)
    - `apps/mobile/package.json` contains `"expo-router": "~3.5` (NOT ~4.x or ~5.x)
    - `apps/mobile/app.json` contains `"main": "expo-router/entry"`
    - `apps/mobile/app.json` contains `"bundleIdentifier": "com.fitrealm.app"` (under ios)
    - `apps/mobile/app.json` contains `"package": "com.fitrealm.app"` (under android)
    - `apps/mobile/app.json` contains `"scheme": "fitrealm"`
    - `apps/mobile/metro.config.js` does NOT contain `watchFolders` (would indicate old monorepo pattern)
    - `apps/mobile/eas.json` contains `"development"`, `"preview"`, and `"production"` build profiles
    - `apps/mobile/eas.json` contains `"developmentClient": true` under development profile
    - `apps/mobile/.env.example` contains `EXPO_PUBLIC_SUPABASE_URL=`
    - `.gitignore` contains `*.env` and `.env`
    - `apps/mobile/jest.config.js` contains `jest-expo` as preset
    - `apps/mobile/__tests__/supabase.test.ts` exists and contains `supabase.auth`
    - `apps/mobile/__tests__/useAuthStore.test.ts` exists and contains `isLoading`
  </acceptance_criteria>

  <verify>
    <automated>cd apps/mobile && npx expo-doctor 2>&1 | head -30</automated>
    <automated>npm test --workspace=apps/mobile 2>&1 | tail -20</automated>
  </verify>

  <done>Monorepo root + SDK 52 Expo bare app scaffolded; expo-doctor exits cleanly (or only shows expected known warnings about native config not yet prebuild); unit test stubs exist and jest config resolves.</done>
</task>

<task type="auto">
  <name>Task 2: Implement Supabase client, auth store, Expo Router v3 4-tab shell</name>
  <files>
    apps/mobile/lib/supabase.ts,
    apps/mobile/store/useAuthStore.ts,
    apps/mobile/app/_layout.tsx,
    apps/mobile/app/sign-in.tsx,
    apps/mobile/app/(tabs)/_layout.tsx,
    apps/mobile/app/(tabs)/village/index.tsx,
    apps/mobile/app/(tabs)/map/index.tsx,
    apps/mobile/app/(tabs)/move/index.tsx,
    apps/mobile/app/(tabs)/profile/index.tsx
  </files>

  <read_first>
    - `.planning/phases/01-project-foundation/01-RESEARCH.md` — Pattern 2 (Expo Router v3 Auth Guard), Pattern 3 (Zustand Auth Store), Pattern 4 (Supabase Client Singleton), Pitfall 2 (Wrong auth storage), Pitfall 6 (Redirect loop), Anti-Patterns section ("Using Stack.Protected in SDK 52" — FORBIDDEN)
    - `.planning/phases/01-project-foundation/01-CONTEXT.md` — Decisions D-05, D-06, D-07, D-08, D-09, D-10, D-11
    - `apps/mobile/__tests__/supabase.test.ts` — the test this implementation must satisfy
    - `apps/mobile/__tests__/useAuthStore.test.ts` — the test this implementation must satisfy
  </read_first>

  <action>
    Step 1 — Install auth and state packages from apps/mobile/:
    `npm install @supabase/supabase-js react-native-url-polyfill @react-native-google-signin/google-signin zustand @tanstack/react-query`

    Step 2 — Create apps/mobile/lib/supabase.ts per RESEARCH.md Pattern 4. Critical import order:
    1. `import 'react-native-url-polyfill/auto'` — FIRST line
    2. `import 'expo-sqlite/localStorage/install'` — SECOND (provides localStorage for auth storage)
    3. `import { createClient } from '@supabase/supabase-js'`
    - Use `process.env.EXPO_PUBLIC_SUPABASE_URL!` and `process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!` (NOT service role key)
    - Pass `storage: localStorage` in auth options, `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`
    - Export as `export const supabase`

    Step 3 — Create apps/mobile/store/useAuthStore.ts per RESEARCH.md Pattern 3:
    - `import { create } from 'zustand'`; `import { Session } from '@supabase/supabase-js'`; `import { supabase } from '@/lib/supabase'`
    - State shape: `session: Session | null` (initially null), `isLoading: boolean` (initially true)
    - `initialize()` method: calls `supabase.auth.getSession()` → sets session + isLoading: false; subscribes to `supabase.auth.onAuthStateChange` → updates session on each change; returns cleanup `() => subscription.unsubscribe()`
    - Export as `export const useAuthStore`

    Step 4 — Create apps/mobile/app/_layout.tsx (root layout — per D-11 and Pattern 2):
    - Import `{ Slot, SplashScreen }` from `expo-router`; import `{ QueryClient, QueryClientProvider }` from `@tanstack/react-query`; import `useAuthStore`
    - Create QueryClient with `defaultOptions.queries.staleTime: 1000 * 60 * 5` and `retry: 2`
    - `SplashScreen.preventAutoHideAsync()` before default export
    - In `useEffect`: call `const cleanup = useAuthStore.getState().initialize()`; call `SplashScreen.hideAsync()` after isLoading resolves; return cleanup
    - Wrap `<Slot />` in `<QueryClientProvider client={queryClient}>` — no auth conditionals here, per Pattern 2 critical note
    - Do NOT use Stack.Protected (SDK 52 does not have it)

    Step 5 — Create apps/mobile/app/sign-in.tsx (public, unauthenticated screen):
    - Show a centered `<Text>FitRealm</Text>` heading and placeholder sign-in buttons
    - Google Sign-In button: `<TouchableOpacity onPress={signInWithGoogle}>` — `signInWithGoogle` is a stub that logs "Google sign-in not yet configured" (credentials added in Plan B)
    - Apple Sign-In button: render only if `Platform.OS === 'ios'` — stub that logs "Apple sign-in not yet configured" (wired in Plan B)
    - Import `useAuthStore`; if session is already set, use `<Redirect href="/(tabs)/village" />` to prevent showing sign-in to authenticated users

    Step 6 — Create apps/mobile/app/(tabs)/_layout.tsx per RESEARCH.md Pattern 2:
    - Import `{ Redirect, Tabs }` from `expo-router`; import `useAuthStore`
    - Read `{ session, isLoading }` from `useAuthStore()`
    - If `isLoading === true`: return `<View><ActivityIndicator /></View>` (loading state — prevents redirect loop per Pitfall 6)
    - If `!session`: return `<Redirect href="/sign-in" />`
    - Otherwise: return `<Tabs>` with 4 screens: village/index (title: 'Village'), map/index (title: 'Map'), move/index (title: 'Move'), profile/index (title: 'Profile')
    - Per D-06 and D-08, Village tab is first and is the default landing tab

    Step 7 — Create 4 placeholder tab screens, each at `apps/mobile/app/(tabs)/{tab}/index.tsx`:
    - `village/index.tsx`: Show `<Text>Village — Coming Soon</Text>` and a health check status. Import `{ useQuery }` from `@tanstack/react-query`; fetch `${process.env.EXPO_PUBLIC_API_URL}/health` and display the response status (this is the skeleton's end-to-end API connectivity check — display "API: connecting..." while loading, "API: ok v1.0.0" on success, "API: unreachable" on error)
    - `map/index.tsx`: `<Text>Map — Coming Soon</Text>`
    - `move/index.tsx`: `<Text>Move — Coming Soon</Text>`
    - `profile/index.tsx`: `<Text>Profile — Coming Soon</Text>`
    - All screens must be wrapped in `<SafeAreaView>` from `react-native-safe-area-context`

    Step 8 — Run tests to confirm both unit tests pass (RED→GREEN):
    `npm test --workspace=apps/mobile`
    Both tests must pass. If they fail, fix the implementation before proceeding.

    Step 9 — Run `npx expo-doctor` from apps/mobile/ and resolve any errors (warnings about Google Sign-In and Apple config can be left for Plan B).
  </action>

  <acceptance_criteria>
    - `apps/mobile/lib/supabase.ts` first non-comment line is `import 'react-native-url-polyfill/auto'`
    - `apps/mobile/lib/supabase.ts` contains `import 'expo-sqlite/localStorage/install'` before `createClient`
    - `apps/mobile/lib/supabase.ts` contains `detectSessionInUrl: false`
    - `apps/mobile/lib/supabase.ts` does NOT contain `service_role` or `SUPABASE_SERVICE` (no service role key in mobile)
    - `apps/mobile/store/useAuthStore.ts` contains `isLoading: true` as initial state
    - `apps/mobile/store/useAuthStore.ts` contains `onAuthStateChange` subscription
    - `apps/mobile/app/_layout.tsx` does NOT contain `Stack.Protected` (forbidden in SDK 52)
    - `apps/mobile/app/_layout.tsx` renders `<Slot />` without session conditionals
    - `apps/mobile/app/(tabs)/_layout.tsx` contains `<Redirect href="/sign-in" />`
    - `apps/mobile/app/(tabs)/_layout.tsx` contains `isLoading` check before redirect
    - `apps/mobile/app/(tabs)/village/index.tsx` contains `useQuery` and `EXPO_PUBLIC_API_URL`
    - `npm test --workspace=apps/mobile` exits 0 (both supabase.test.ts and useAuthStore.test.ts pass)
    - `npx expo-doctor` from apps/mobile/ exits 0 or shows only expected config warnings (no SDK version mismatch errors)
  </acceptance_criteria>

  <verify>
    <automated>npm test --workspace=apps/mobile 2>&1 | tail -20</automated>
    <automated>cd apps/mobile && npx expo-doctor 2>&1 | head -40</automated>
  </verify>

  <done>Supabase client singleton, Zustand auth store, and Expo Router v3 4-tab shell are implemented. Both unit tests pass. The app routing logic is correct: unauthenticated → sign-in; loading → spinner; authenticated → 4 tabs. Village tab shows API health check status.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify Android build boots and tab shell renders</name>
  <what-built>
    Task 1 and Task 2 created the full monorepo scaffold, SDK 52 Expo app, and 4-tab routing shell with auth guard. Now verify the Android build runs correctly before Plan B adds real credentials.
  </what-built>
  <how-to-verify>
    You need a local .env file first. Create `apps/mobile/.env` (gitignored) with placeholder values:
    ```
    EXPO_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=placeholder-anon-key
    EXPO_PUBLIC_API_URL=https://placeholder.vercel.app
    EXPO_PUBLIC_RC_IOS_KEY=placeholder
    EXPO_PUBLIC_RC_ANDROID_KEY=placeholder
    ```

    Then start the Android Emulator and run:
    ```
    cd apps/mobile
    npx expo run:android
    ```

    Expected behavior:
    1. App compiles and installs on Android Emulator without errors
    2. App launches to the sign-in screen (since no session exists)
    3. Sign-in screen shows "FitRealm" heading and placeholder buttons
    4. Tapping Google or Apple buttons logs to console (no crash)
    5. No red error screen on launch
    6. No "localStorage is not defined" error in logs (would indicate Pitfall 2)
    7. No "Stack.Protected" error in logs (would indicate wrong SDK pattern)

    Check the Metro bundler output for errors. Accept if you see the sign-in screen without crash.
  </how-to-verify>
  <resume-signal>Type "verified" if the Android app shows the sign-in screen without crash. Describe any errors to investigate.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client bundle → Supabase | All mobile app calls go directly to Supabase; Supabase anon key is public by design; RLS enforces data isolation |
| client bundle → Vercel API | Mobile app calls Express API; no auth yet (GET /health is public); API secrets live server-side only |
| git repo → world | Any committed .env or secret key is permanently exposed |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-1-01 | Information Disclosure | `.env` files / Supabase service role key | mitigate | `.gitignore` blocks `*.env` and `.env`; only `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon key) in mobile bundle; service role key is Vercel-only (Plan C) |
| T-1-02 | Information Disclosure | Expo bundle exposes `EXPO_PUBLIC_*` vars | accept | `EXPO_PUBLIC_` vars are intended to be in the client bundle; anon key is safe (RLS enforces access); never use `EXPO_PUBLIC_` prefix on service role key |
| T-1-03 | Tampering | Session token storage | mitigate | `expo-sqlite/localStorage/install` provides encrypted-at-rest storage (SQLite on device); avoids unencrypted AsyncStorage |
| T-1-04 | Elevation of Privilege | SDK version mismatch (SDK 53 APIs in SDK 52 app) | mitigate | Verify `expo-router` resolves to `~3.5.x` (not 4.x+) in acceptance criteria; `npx expo install --fix` enforced in Task 1 |
| T-1-05 | Elevation of Privilege | Over-broad RLS (not yet live — schema is Plan B) | mitigate | RLS policies created in Plan B migration; this plan creates the test stubs that verify RLS behavior |
| T-1-SC | Tampering | npm package installs (11 packages, all [ASSUMED]) | mitigate | Legitimacy checkpoint (Task 0) gates all installs; all packages verified as official with established repos; blocking human checkpoint before install |
</threat_model>

<verification>
After all tasks complete and the Android checkpoint passes:

1. `npm test --workspace=apps/mobile` exits 0 (supabase.test.ts + useAuthStore.test.ts)
2. `apps/mobile/package.json` shows `"expo": "~52.0` (SDK 52 pinned)
3. `apps/mobile/app.json` shows `"main": "expo-router/entry"`
4. `apps/mobile/eas.json` shows development/preview/production profiles
5. `.gitignore` contains `*.env` (no secrets tracked)
6. Android Emulator shows sign-in screen without crash (checkpoint Task 3)
</verification>

<success_criteria>
- Monorepo root workspace is configured (`package.json` with `"workspaces": ["apps/*"]`)
- Expo SDK 52 bare app in `apps/mobile/` with Expo Router v3 (~3.5.x)
- `apps/mobile/lib/supabase.ts` uses `expo-sqlite/localStorage/install` (not AsyncStorage)
- `apps/mobile/store/useAuthStore.ts` implements the Zustand auth slice with `initialize()` returning cleanup
- `apps/mobile/app/(tabs)/_layout.tsx` uses `<Redirect href="/sign-in" />` pattern (not `Stack.Protected`)
- Auth guard handles `isLoading === true` without redirecting (prevents redirect loop)
- 4 placeholder tab screens exist: village, map, move, profile
- Village tab makes a TanStack Query health check call to `EXPO_PUBLIC_API_URL/health`
- `apps/mobile/eas.json` has development, preview, and production build profiles
- Both unit tests pass (`npm test --workspace=apps/mobile`)
- No secrets in git (`.gitignore` covers `*.env`)
- Android Emulator boots to sign-in screen without crash
</success_criteria>

<output>
Create `.planning/phases/01-project-foundation/01-A-SUMMARY.md` when done.
</output>
