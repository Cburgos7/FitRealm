---
phase: 01-project-foundation
plan: B
type: execute
wave: 2
depends_on:
  - 01-A
files_modified:
  - supabase/migrations/20260525000000_init_phase1.sql
  - supabase/config.toml
  - apps/mobile/app/sign-in.tsx
  - apps/mobile/app.json
  - apps/mobile/GoogleService-Info.plist
  - apps/mobile/google-services.json
autonomous: false
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - INFRA-01

must_haves:
  truths:
    - "User can sign in with Google on Android and see the 4-tab shell"
    - "User can sign in with Apple on iOS (EAS build) and see the 4-tab shell"
    - "Session survives app kill and relaunch — user lands on tab shell, not sign-in screen"
    - "A profiles row is created automatically on first sign-in (handle_new_user trigger)"
    - "RLS prevents User A from reading User B's profiles or villages row"
    - "All tables have RLS enabled with policies scoped to auth.uid()"
  artifacts:
    - path: "supabase/migrations/20260525000000_init_phase1.sql"
      provides: "Phase 1 schema: profiles + villages tables + RLS + trigger"
      contains: "enable row level security"
    - path: "apps/mobile/GoogleService-Info.plist"
      provides: "iOS Google Sign-In config"
    - path: "apps/mobile/google-services.json"
      provides: "Android Google Sign-In config"
    - path: "apps/mobile/app/sign-in.tsx"
      provides: "Fully wired sign-in screen with Google + Apple buttons"
      contains: "signInWithIdToken"
  key_links:
    - from: "apps/mobile/app/sign-in.tsx"
      to: "supabase.auth.signInWithIdToken"
      via: "Google: GoogleSignin.signIn() → idToken → signInWithIdToken; Apple: AppleAuthentication.signInAsync() → identityToken → signInWithIdToken"
      pattern: "signInWithIdToken"
    - from: "supabase/migrations/20260525000000_init_phase1.sql"
      to: "auth.users"
      via: "handle_new_user trigger inserts into profiles on auth.users INSERT"
      pattern: "handle_new_user"
    - from: "apps/mobile/store/useAuthStore.ts"
      to: "supabase.auth.onAuthStateChange"
      via: "initialize() subscription updates session in Zustand on every auth state change"
      pattern: "onAuthStateChange"

user_setup:
  - service: supabase
    why: "Hosted Supabase project is required for Auth and database (can't run locally on this Windows machine in Phase 1)"
    env_vars:
      - name: EXPO_PUBLIC_SUPABASE_URL
        source: "Supabase Dashboard → Settings → API → Project URL"
      - name: EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        source: "Supabase Dashboard → Settings → API → anon/public key (NOT the service_role key)"
    dashboard_config:
      - task: "Create a new Supabase project at supabase.com/dashboard → New Project"
        location: "https://supabase.com/dashboard"
      - task: "Enable Google provider: Auth → Providers → Google → enable → enter Web Client ID and Client Secret"
        location: "Supabase Dashboard → Authentication → Providers"
      - task: "Enable Apple provider: Auth → Providers → Apple → enable → enter Bundle ID (com.fitrealm.app)"
        location: "Supabase Dashboard → Authentication → Providers"
      - task: "Install Supabase CLI globally if not already installed: npm install -g supabase"
        location: "Terminal"

  - service: google-cloud-console
    why: "Google OAuth credentials are required for native Google Sign-In on both platforms"
    env_vars: []
    dashboard_config:
      - task: "Create a Google Cloud project at console.cloud.google.com → New Project → name it 'FitRealm'"
        location: "https://console.cloud.google.com"
      - task: "Enable 'Google Sign-In API' (under APIs & Services → Library)"
        location: "Google Cloud Console → APIs & Services → Library"
      - task: "Create Web OAuth client: Credentials → Create Credentials → OAuth 2.0 Client → Web Application → name 'FitRealm Web' → note Client ID and Client Secret"
        location: "Google Cloud Console → APIs & Services → Credentials"
      - task: "Create iOS OAuth client: Credentials → Create → OAuth 2.0 → iOS → Bundle ID: com.fitrealm.app → download GoogleService-Info.plist"
        location: "Google Cloud Console → APIs & Services → Credentials"
      - task: "Create Android OAuth client: Credentials → Create → OAuth 2.0 → Android → Package Name: com.fitrealm.app → SHA-1: run 'cd apps/mobile/android && ./gradlew signingReport' to get debug SHA-1 → download google-services.json"
        location: "Google Cloud Console → APIs & Services → Credentials"
      - task: "In Supabase Dashboard → Auth → Providers → Google: paste the Web Client ID and Client Secret from the Web OAuth client above"
        location: "Supabase Dashboard → Authentication → Providers → Google"
---

<objective>
This plan wires real authentication and the Supabase database for Phase 1. It creates the Supabase migration (profiles + villages tables with RLS), pushes the schema to the hosted project, and replaces the sign-in screen stubs with working Google Sign-In (both platforms) and Apple Sign-In (iOS only).

After this plan, a user can open the app, tap Sign in with Google, complete OAuth, land on the 4-tab shell, kill the app, relaunch, and remain signed in. A profiles row is auto-created on first sign-in by a database trigger.

Purpose: Satisfy AUTH-01 (Google), AUTH-02 (Apple), AUTH-03 (session persistence), INFRA-01 (RLS).
Output: Working auth, Supabase schema live in hosted project, session persistence confirmed.
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
@.planning/phases/01-project-foundation/01-A-SUMMARY.md

<interfaces>
<!-- Contracts from Plan A that this plan builds on -->

Zustand auth store (from apps/mobile/store/useAuthStore.ts created in Plan A):
```typescript
// useAuthStore.getState() shape — DO NOT change these fields, Plan B only reads them
interface AuthState {
  session: Session | null;
  isLoading: boolean;
  initialize: () => () => void;
}
```

Supabase client singleton (from apps/mobile/lib/supabase.ts created in Plan A):
```typescript
import { supabase } from '@/lib/supabase';
// supabase.auth.signInWithIdToken({ provider: 'google' | 'apple', token: string })
// supabase.auth.signOut()
```

Sign-in screen stubs (from apps/mobile/app/sign-in.tsx created in Plan A):
```typescript
// Replace stub signInWithGoogle() and stub Apple button with real implementations
// Google: @react-native-google-signin/google-signin pattern from RESEARCH.md Pattern 6
// Apple: expo-apple-authentication pattern from RESEARCH.md Pattern 5
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Supabase migration and push schema to hosted project [BLOCKING — must complete before verification]</name>
  <files>
    supabase/config.toml,
    supabase/migrations/20260525000000_init_phase1.sql
  </files>

  <read_first>
    - `.planning/phases/01-project-foundation/01-RESEARCH.md` — Pattern 11 (Supabase CLI Migration Workflow), Pattern 12 (Phase 1 Supabase Schema), "user_setup" Supabase section above (project must exist before running supabase link)
    - `.planning/phases/01-project-foundation/01-CONTEXT.md` — the developer must have a hosted Supabase project created before this task runs
  </read_first>

  <action>
    PREREQUISITE: Before running any supabase commands, confirm the developer has completed the Supabase user_setup steps above (created project, has project ref from supabase.com/dashboard).

    Step 1 — Initialize Supabase CLI at repo root (F:/CODING/FitRealm/):
    `npx supabase init`
    This creates `supabase/config.toml`.

    Step 2 — Link to the hosted Supabase project:
    `npx supabase link --project-ref YOUR_PROJECT_REF`
    (The project ref is the string in the URL: supabase.com/dashboard/project/YOUR_PROJECT_REF)

    Step 3 — Create the Phase 1 migration file. The migration file name uses the exact timestamp `20260525000000`:
    `npx supabase migration new init_phase1`
    This creates `supabase/migrations/<timestamp>_init_phase1.sql`. Rename if needed to match `20260525000000_init_phase1.sql`.

    Step 4 — Write the full Phase 1 schema into the migration file. Copy verbatim from RESEARCH.md Pattern 12 (the entire SQL block from "-- Enable PostGIS" to the end of the trigger). The schema includes:
    - `create extension if not exists postgis with schema extensions`
    - `public.profiles` table (id, display_name, avatar_url, created_at, updated_at)
    - `public.villages` table (id, owner_id, name, created_at, updated_at) — no PostGIS column yet per RESEARCH.md note
    - `alter table public.profiles enable row level security`
    - `alter table public.villages enable row level security`
    - 3 policies for profiles (select_own, insert_own, update_own) — all scoped to `auth.uid()`
    - 3 policies for villages (select_own, insert_own, update_own) — all scoped to `auth.uid()`
    - `handle_new_user()` function (security definer) — inserts profile on new auth.users row
    - `on_auth_user_created` trigger

    Step 5 — [BLOCKING] Push migration to hosted Supabase:
    `npx supabase db push`
    This applies the migration to the hosted project. The phase CANNOT proceed to verification until this step exits successfully.

    Step 6 — Verify via Supabase Dashboard: Table Editor should show `profiles` and `villages` tables. Authentication → Policies should show 6 policies (3 per table). Verify RLS is toggled ON for both tables.
  </action>

  <acceptance_criteria>
    - `supabase/config.toml` exists (created by `supabase init`)
    - `supabase/migrations/20260525000000_init_phase1.sql` exists and contains `enable row level security` (appears twice — once per table)
    - `supabase/migrations/20260525000000_init_phase1.sql` contains `handle_new_user` function
    - `supabase/migrations/20260525000000_init_phase1.sql` contains `on_auth_user_created` trigger
    - `supabase/migrations/20260525000000_init_phase1.sql` contains all 6 RLS policies (`profiles_select_own`, `profiles_insert_own`, `profiles_update_own`, `villages_select_own`, `villages_insert_own`, `villages_update_own`)
    - `npx supabase db push` exits 0 (migration applied to hosted project)
    - Supabase Dashboard → Table Editor shows `profiles` table with columns: id, display_name, avatar_url, created_at, updated_at
    - Supabase Dashboard → Table Editor shows `villages` table with columns: id, owner_id, name, created_at, updated_at
    - Supabase Dashboard → Authentication → Policies shows RLS enabled on both tables
  </acceptance_criteria>

  <verify>
    <automated>npx supabase db push 2>&1 | tail -10</automated>
    <human-check>Open Supabase Dashboard → Table Editor → confirm profiles and villages tables exist with correct columns and RLS ON indicators</human-check>
  </verify>

  <done>Supabase schema live in hosted project. Both tables created, RLS enabled, all 6 policies applied, handle_new_user trigger active. `npx supabase db push` exits 0.</done>
</task>

<task type="auto">
  <name>Task 2: Wire Google Sign-In and Apple Sign-In on sign-in screen</name>
  <files>
    apps/mobile/app/sign-in.tsx,
    apps/mobile/app.json,
    apps/mobile/GoogleService-Info.plist,
    apps/mobile/google-services.json
  </files>

  <read_first>
    - `.planning/phases/01-project-foundation/01-RESEARCH.md` — Pattern 5 (Apple Sign-In), Pattern 6 (Google Sign-In), Pattern 13 (app.json plugins), Pitfall 3 (Web Client ID confusion), Pitfall 4 (Google service config files missing from EAS), Anti-Patterns ("Using Expo Go instead of expo-dev-client")
    - `.planning/phases/01-project-foundation/01-CONTEXT.md` — Decisions D-07, D-08 (auth outside tabs, redirect to Village)
    - The `user_setup` section of this plan's frontmatter — all credentials must be in place before Task 2 runs
  </read_first>

  <action>
    PREREQUISITE: Developer must have completed all user_setup steps in this plan's frontmatter before this task. Specifically:
    - `GoogleService-Info.plist` downloaded and placed at `apps/mobile/GoogleService-Info.plist`
    - `google-services.json` downloaded and placed at `apps/mobile/google-services.json`
    - `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` filled in `apps/mobile/.env`
    - Google Web Client ID obtained and configured in Supabase Dashboard → Auth → Providers → Google
    - Apple provider enabled in Supabase Dashboard → Auth → Providers → Apple with Bundle ID `com.fitrealm.app`

    Step 1 — Update apps/mobile/app.json plugins array to include the Google Sign-In config plugin:
    Replace the existing `"plugins"` array entry for `@react-native-google-signin/google-signin` (if already present as placeholder) or add it:
    ```json
    ["@react-native-google-signin/google-signin", {
      "iosUrlScheme": "com.googleusercontent.apps.YOUR_REVERSED_IOS_CLIENT_ID"
    }]
    ```
    The `iosUrlScheme` is the reversed iOS Client ID from GoogleService-Info.plist — look for the `REVERSED_CLIENT_ID` key in that file.
    Final plugins order: `["expo-router", "expo-secure-store", ["@react-native-google-signin/google-signin", {...}], "expo-apple-authentication"]`

    Step 2 — Add `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to `apps/mobile/.env.example` as a new env var template entry. Developer must add the actual value to their local `apps/mobile/.env`.

    Step 3 — Rewrite apps/mobile/app/sign-in.tsx replacing the stubs with full implementations:

    Google Sign-In implementation (per RESEARCH.md Pattern 6):
    - Import `{ GoogleSignin }` from `@react-native-google-signin/google-signin`
    - In a top-level `useEffect` (or in root _layout.tsx's useEffect alongside RevenueCat — either works), call `GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID! })`
    - Preferred: call `GoogleSignin.configure()` in `apps/mobile/app/_layout.tsx` useEffect alongside the auth initialize() call
    - `signInWithGoogle` function: `await GoogleSignin.hasPlayServices()` → `const response = await GoogleSignin.signIn()` → if `response.data?.idToken`: `await supabase.auth.signInWithIdToken({ provider: 'google', token: response.data.idToken })`
    - Errors: catch and log; `ERR_SIGN_IN_CANCELLED` is normal (user dismissed)

    Apple Sign-In implementation (per RESEARCH.md Pattern 5):
    - Import `* as AppleAuthentication` from `expo-apple-authentication`
    - Import `{ Platform }` from `react-native`
    - Render `<AppleAuthentication.AppleAuthenticationButton>` only if `Platform.OS === 'ios'`
    - On press: `await AppleAuthentication.signInAsync({ requestedScopes: [FULL_NAME, EMAIL] })` → if `credential.identityToken`: `await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken })`
    - Use `AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN` and `AppleAuthentication.AppleAuthenticationButtonStyle.BLACK`
    - Catch and ignore `ERR_REQUEST_CANCELED`

    Auth redirect: after successful sign-in, the Zustand store's `onAuthStateChange` fires automatically and sets `session`. The `(tabs)/_layout.tsx` then renders the tabs. No manual navigation needed — Expo Router handles it.

    Step 4 — Run `npx expo prebuild --clean` from apps/mobile/ to apply the updated app.json config plugins (generates native Android/iOS project files including google-services.json integration). This regenerates the android/ and ios/ directories with Google Sign-In native configuration applied.

    Step 5 — Update `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `apps/mobile/.env` with the actual Web Client ID value.
  </action>

  <acceptance_criteria>
    - `apps/mobile/app.json` plugins array contains `@react-native-google-signin/google-signin` with `iosUrlScheme` set (not placeholder "YOUR_REVERSED_IOS_CLIENT_ID")
    - `apps/mobile/GoogleService-Info.plist` exists (file committed to git)
    - `apps/mobile/google-services.json` exists (file committed to git)
    - `apps/mobile/app/sign-in.tsx` contains `signInWithIdToken` (appears at least twice — once for Google, once for Apple)
    - `apps/mobile/app/sign-in.tsx` contains `Platform.OS !== 'ios'` check for Apple button (Apple Sign-In is iOS only)
    - `apps/mobile/app/sign-in.tsx` contains `ERR_REQUEST_CANCELED` handling for Apple
    - `apps/mobile/app.json` contains `"expo-apple-authentication"` in plugins
    - `apps/mobile/.env.example` contains `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=`
    - `GoogleSignin.configure` is called exactly once (in root _layout.tsx useEffect) with `webClientId` from env var (not hardcoded)
  </acceptance_criteria>

  <verify>
    <automated>npm test --workspace=apps/mobile 2>&1 | tail -10</automated>
  </verify>

  <done>sign-in.tsx has real Google Sign-In and Apple Sign-In (iOS only) implementations. app.json has Google config plugin with correct iosUrlScheme. Google service config files committed. npx expo prebuild --clean has been run.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Smoke test auth end-to-end on Android (Google Sign-In + session persistence)</name>
  <what-built>
    Tasks 1 and 2 have created the Supabase schema (live in hosted project) and wired the real Google/Apple Sign-In flows into the sign-in screen.
  </what-built>
  <how-to-verify>
    Build and install on Android Emulator. Since native code changed (expo prebuild ran), a fresh build is required:

    Option A (faster — EAS cloud Android preview build):
    ```
    cd apps/mobile
    eas build --platform android --profile preview
    ```
    Download the APK from EAS dashboard and install on emulator.

    Option B (local Android build if Android SDK available):
    ```
    cd apps/mobile
    npx expo run:android
    ```

    Test sequence:
    1. Launch app → expect sign-in screen (Google button + no Apple button on Android)
    2. Tap "Sign in with Google" → Google account picker appears → select account → complete flow
    3. **Expected:** App transitions to 4-tab shell (Village, Map, Move, Profile placeholders)
    4. Open Supabase Dashboard → Table Editor → profiles → confirm a row exists for your Google account
    5. Force-kill the app on the emulator (swipe away from recent apps)
    6. Relaunch the app
    7. **Expected:** App goes directly to Village tab (no sign-in screen) — session persisted across restart
    8. Village tab shows API health status (may show "API: unreachable" — that is expected until Plan C deploys the Vercel API)

    If Google Sign-In fails with "audience mismatch" → Pitfall 3: wrong client ID type used as webClientId
    If app crashes on launch → check Metro/logcat for error; likely missing env var or plist issue
    If redirect loop occurs → Pitfall 6: isLoading state not handled correctly
  </how-to-verify>
  <resume-signal>Type "verified" if Google Sign-In works and session persists on Android. Describe any errors to debug.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Mobile → Google OAuth | Google's servers validate credentials; mobile receives ID token only |
| Mobile → Apple OAuth | Apple's servers validate credentials; mobile receives identity token only |
| ID token → Supabase | Supabase validates nonce, `iat`/`exp`, audience claim on `signInWithIdToken()` |
| Mobile → Supabase DB | Anon key + JWT; RLS enforces row-level isolation at DB layer |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-1B-01 | Repudiation | OAuth token replay (stale ID token reused) | mitigate | `supabase.auth.signInWithIdToken()` validates `iat`/`exp` and nonce server-side; tokens are short-lived (1 hour) |
| T-1B-02 | Information Disclosure | Wrong Google Client ID type (iOS/Android ID used as webClientId) | mitigate | Acceptance criteria verify `webClientId` is from env var (not hardcoded); Pitfall 3 documented; Web Client ID must be the "Web" type from Google Cloud Console |
| T-1B-03 | Elevation of Privilege | RLS policy missing or misconfigured | mitigate | Migration creates SELECT/INSERT/UPDATE policies scoped to `auth.uid()` for both tables; `supabase db push` applied; visual verification in dashboard required |
| T-1B-04 | Elevation of Privilege | handle_new_user trigger runs as SECURITY DEFINER | accept | Trigger only inserts own profile row (matching `new.id`); no cross-user writes possible; standard Supabase pattern |
| T-1B-05 | Information Disclosure | GoogleService-Info.plist and google-services.json committed to git | accept | These files contain client IDs only (not secrets); per RESEARCH.md Pitfall 4, committing is correct and required for EAS cloud builds; the OAuth Client Secret is in Supabase Dashboard only, never in the mobile bundle |
| T-1B-SC | Tampering | npm package install (react-native-url-polyfill, @react-native-google-signin/google-signin) | mitigate | Already gated by Plan A Task 0 legitimacy checkpoint; packages listed as "Approved" in audit |
</threat_model>

<verification>
After all tasks and checkpoints pass:

1. `supabase/migrations/20260525000000_init_phase1.sql` exists and contains all 6 RLS policies
2. `npx supabase db push` exits 0 (already run in Task 1)
3. Supabase Dashboard shows `profiles` and `villages` tables with RLS ON
4. `apps/mobile/app/sign-in.tsx` contains `signInWithIdToken` for both Google and Apple
5. `apps/mobile/GoogleService-Info.plist` and `google-services.json` committed to git
6. Android: Google Sign-In completes → tab shell visible → session persists after app kill (checkpoint Task 3)
7. `npm test --workspace=apps/mobile` still exits 0 (existing tests not broken)
</verification>

<success_criteria>
- Supabase schema live: profiles table, villages table, 6 RLS policies, handle_new_user trigger
- RLS enabled on both tables (alter table ... enable row level security)
- Google Sign-In works on Android via native @react-native-google-signin/google-signin → Supabase signInWithIdToken (AUTH-01)
- Apple Sign-In code present and platform-gated (Platform.OS === 'ios') — verified on iOS via EAS build (AUTH-02)
- Session persists after app kill and relaunch (expo-sqlite localStorage adapter, AUTH-03)
- profiles row auto-created on first sign-in (handle_new_user trigger, INFRA-01)
- All tables have RLS with policies scoped to auth.uid() (INFRA-01)
</success_criteria>

<output>
Create `.planning/phases/01-project-foundation/01-B-SUMMARY.md` when done.
</output>
