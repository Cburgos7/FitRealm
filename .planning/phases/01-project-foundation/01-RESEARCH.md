# Phase 1: Project Foundation - Research

**Researched:** 2026-05-25
**Domain:** React Native / Expo bare workflow, Supabase Auth, Vercel Express, RevenueCat SDK
**Confidence:** HIGH (core scaffold, Supabase patterns) / MEDIUM (RevenueCat New Architecture, Google Sign-In config details)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Bare Expo workflow (not Managed, not pure RN CLI). Initialized with `npx create-expo-app --template bare-minimum`.
- **D-02:** Expo SDK 52 (React Native 0.76, New Architecture enabled by default).
- **D-03:** `expo-dev-client` from day one. Do not use Expo Go.
- **D-04:** `npm` as package manager.
- **D-05:** Expo Router v3 (file-system routing).
- **D-06:** Full 4-tab shell scaffolded in Phase 1: Village, Map, Move, Profile.
- **D-07:** Auth screens in a separate root-level stack outside the tab navigator.
- **D-08:** Post-auth redirect to Village tab.
- **D-09:** Zustand for synchronous/UI-layer state.
- **D-10:** TanStack Query (React Query v5) for server state.
- **D-11:** Zustand `useAuthStore` slice subscribes to `supabase.auth.onAuthStateChange`.
- **D-12:** SQLite / expo-sqlite deferred to Phase 2.
- **D-13:** Express.js on Vercel (Node runtime, not Edge).
- **D-14:** Monorepo with npm workspaces: `apps/mobile/` and `apps/api/`.
- **D-15:** Phase 1 API: `GET /health` only, returning `{ status: 'ok', version: '1.0.0' }`.
- **D-16:** RevenueCat SDK (`react-native-purchases`) installed + `Purchases.configure()` on app launch.

### Claude's Discretion
- TypeScript `tsconfig.json` strictness settings (use Expo's recommended defaults)
- ESLint and Prettier configuration details
- Supabase client singleton setup and export pattern
- EAS Build profile naming convention (`development`, `preview`, `production`)
- App bundle identifier (`com.fitrealm.app`) and Android package name
- Vercel project name and deployment URL structure

### Deferred Ideas (OUT OF SCOPE)
- SQLite offline queue (Phase 2)
- Next.js / web frontend (out of scope entirely, mobile-only)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign in with Google on iOS and Android via Supabase Auth | @react-native-google-signin/google-signin + signInWithIdToken flow documented |
| AUTH-02 | User can sign in with Apple ID on iOS via Supabase Auth | expo-apple-authentication + signInWithIdToken flow fully documented with code example |
| AUTH-03 | User session persists across app restarts | expo-sqlite/localStorage or AsyncStorage adapter for supabase-js auth storage documented |
| INFRA-01 | Supabase RLS enabled on all tables | RLS policy patterns documented; CREATE POLICY examples provided |
| INFRA-05 | All API secrets stored in Vercel environment variables | `vercel env pull` and EAS env workflow documented |
| INFRA-06 | CI/CD via EAS Build; separate dev, staging, production build configs | eas.json profile structure fully documented |
</phase_requirements>

---

## Summary

Phase 1 is a Walking Skeleton: prove the build runs on both platforms, auth works end-to-end, and the Vercel API is reachable from the app. No game mechanics. The tech stack is well-established and all required packages are confirmed on npm.

The single most significant risk is the **Expo Router v3 / SDK 52 auth pattern**. `Stack.Protected` (declarative guards) was introduced in SDK 53 / Expo Router v4+. SDK 52 uses the redirect-based pattern via `<Redirect href="/sign-in" />` inside a protected group layout. Plans must use the correct older pattern.

The second risk is **RevenueCat + New Architecture**. `react-native-purchases` had TurboModule crashes with SDK 52 (RN 0.76) until version 8.9.2. The current npm latest (10.1.2 as of 2026-05-25) includes the fix. Always install the latest and run `npx expo-doctor` after install.

Google Sign-In is the most complex auth task: it requires `@react-native-google-signin/google-signin`, separate `GoogleService-Info.plist` (iOS) and `google-services.json` (Android) from Google Cloud Console, and a Web Client ID from Google Console (required by Supabase even for native flows).

**Primary recommendation:** Scaffold monorepo root first, then `apps/mobile` with bare Expo, then `apps/api` with Express, then Supabase schema + auth, then EAS + RevenueCat. Test each layer before moving to the next.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auth session management | Mobile client (Zustand) | Supabase Auth (server) | Session persists on device; server validates JWT on every request |
| Google / Apple Sign-In | Mobile client (native SDK) | Supabase Auth (token exchange) | Native SDKs acquire ID token; Supabase validates and issues session |
| Tab shell + routing | Mobile client (Expo Router) | — | File-system routing is entirely client-side in React Native |
| Auth guard / redirects | Mobile client (Expo Router group layout) | — | Layout files control access at render time on-device |
| Database + RLS | Supabase (PostgreSQL) | — | All row-level access control lives in the database, not the API |
| `GET /health` endpoint | Vercel API (Express) | — | Serverless function in `apps/api/` |
| API secrets | Vercel environment variables | EAS environment variables | Secrets never in client bundle; Vercel holds API-side secrets, EAS holds mobile build secrets |
| RevenueCat SDK init | Mobile client (app root layout) | RevenueCat cloud | `Purchases.configure()` runs once on mount; purchase validation is server-side (Phase 7) |

---

## Standard Stack

### Core (npm-verified versions as of 2026-05-25)

| Library | Version (npm latest) | SDK 52 Pin | Purpose | Why Standard |
|---------|---------------------|------------|---------|--------------|
| `expo` | 56.0.4 (latest) | `~52.0.0` | Core SDK | The SDK itself |
| `react-native` | — | `0.76.x` | Underlying RN | Pinned by Expo SDK 52 |
| `expo-router` | 56.2.6 (latest) | `~3.5.x` | File-system routing | Expo's official router; v3.5.x is the SDK 52 line |
| `expo-dev-client` | 16.1.2 | `~4.0.x` | Dev builds (no Expo Go) | Required for native modules |
| `@supabase/supabase-js` | 2.106.2 | `^2.x` | Database + Auth client | Official Supabase JS client |
| `react-native-url-polyfill` | 3.0.0 | `^3.0.0` | URL API polyfill for RN | Required by supabase-js in RN environments |
| `expo-secure-store` | 56.0.4 (latest) | `~14.x` | Secure key-value storage | Used for encrypting session tokens |
| `expo-apple-authentication` | 56.0.4 (latest) | `~7.x` | Native Apple Sign-In | Required for Apple ID auth on iOS |
| `@react-native-google-signin/google-signin` | 16.1.2 | `^14.x` | Native Google Sign-In | Supabase's recommended approach for RN native Google auth |
| `zustand` | 5.0.13 | `^5.0` | UI/local state | Lightweight, no providers required, D-09 |
| `@tanstack/react-query` | 5.100.14 | `^5.x` | Server state + cache | D-10, industry standard |
| `react-native-purchases` | 10.1.2 | `^10.x` | RevenueCat IAP SDK | D-16; v10+ fixes New Architecture crash |

**Note on `expo-apple-authentication` and `expo-secure-store`:** As of SDK 56, these report as `56.0.4` on npm. When working in an SDK 52 project, use `npx expo install` — it resolves the correct SDK 52-compatible version automatically (e.g., `~7.x` for apple-authentication, `~14.x` for secure-store). [ASSUMED] that SDK 52 pins align with these major ranges; confirm with `npx expo install --fix` after scaffold.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-constants` | `~17.x` | App config access | Reading app.json values at runtime |
| `expo-linking` | `~7.x` | Deep link handling | OAuth callback redirect URLs |
| `expo-splash-screen` | `~0.29.x` | Splash screen control | Hold splash while auth state resolves |
| `expo-status-bar` | `~2.x` | Status bar theming | Tab shell setup |
| `react-native-safe-area-context` | `^4.x` | Safe area insets | Required by Expo Router tabs |
| `react-native-screens` | `^4.x` | Native screen containers | Required by React Navigation / Expo Router |
| `@react-native-async-storage/async-storage` | `^2.x` | Fallback storage | Optional; expo-sqlite localStorage is now preferred |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@react-native-google-signin/google-signin` | `expo-auth-session` + WebBrowser OAuth | Native sign-in is smoother UX and Supabase's stated recommendation; expo-auth-session opens a browser tab which is worse on mobile |
| `expo-sqlite/localStorage` (Supabase session) | `@react-native-async-storage/async-storage` | expo-sqlite approach is newer (SDK 52+) and avoids an extra package; both are valid |
| Bare Expo + `npx expo prebuild` | Pure RN CLI | Bare Expo manages native configuration via config plugins, reducing manual Xcode/Gradle edits |

### Installation Commands

```bash
# Step 1: Scaffold — run at repo root before workspace setup
npx create-expo-app apps/mobile --template bare-minimum

# Step 2: Core mobile packages (run inside apps/mobile)
npx expo install expo-router expo-dev-client expo-secure-store \
  expo-apple-authentication expo-splash-screen expo-status-bar \
  expo-constants expo-linking \
  react-native-safe-area-context react-native-screens

# Step 3: Auth + API packages
npm install @supabase/supabase-js react-native-url-polyfill \
  @react-native-google-signin/google-signin

# Step 4: State management
npm install zustand @tanstack/react-query

# Step 5: RevenueCat (run in apps/mobile — requires dev build)
npx expo install react-native-purchases

# Step 6: After all native packages installed
npx expo-doctor  # validates New Architecture compatibility
```

---

## Package Legitimacy Audit

> slopcheck could not be installed (installation succeeded but binary not added to PATH on this Windows machine). All packages are tagged [ASSUMED] per graceful degradation policy. The planner must gate each install behind a checkpoint:human-verify before first use.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `expo` | npm | ~10 yrs | Very high | github.com/expo/expo | [ASSUMED] | Approved — official Expo monorepo |
| `expo-router` | npm | ~3 yrs | High | github.com/expo/expo | [ASSUMED] | Approved — official Expo package |
| `expo-dev-client` | npm | ~4 yrs | High | github.com/expo/expo | [ASSUMED] | Approved — official Expo package |
| `@supabase/supabase-js` | npm | ~5 yrs | Very high | github.com/supabase/supabase-js | [ASSUMED] | Approved — official Supabase client |
| `react-native-url-polyfill` | npm | ~6 yrs | High | github.com/charpeni/react-native-url-polyfill | [ASSUMED] | Approved — established, single-purpose polyfill |
| `expo-secure-store` | npm | ~8 yrs | High | github.com/expo/expo | [ASSUMED] | Approved — official Expo package |
| `expo-apple-authentication` | npm | ~5 yrs | High | github.com/expo/expo | [ASSUMED] | Approved — official Expo package |
| `@react-native-google-signin/google-signin` | npm | ~8 yrs | High | github.com/react-native-google-signin/google-signin | [ASSUMED] | Approved — established, widely used |
| `zustand` | npm | ~6 yrs | Very high | github.com/pmndrs/zustand | [ASSUMED] | Approved — industry standard |
| `@tanstack/react-query` | npm | ~6 yrs | Very high | github.com/TanStack/query | [ASSUMED] | Approved — industry standard |
| `react-native-purchases` | npm | ~6 yrs | High | github.com/RevenueCat/react-native-purchases | [ASSUMED] | Approved — official RevenueCat SDK |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time. All packages above are tagged `[ASSUMED]` and the planner must gate each install behind a `checkpoint:human-verify` task before first use.*

---

## Architecture Patterns

### System Architecture Diagram

```
[ User's Device ]
      |
      | 1. App launches
      v
[ apps/mobile/ - Expo Router ]
      |                    |
      | Root _layout.tsx   | Subscribes to
      | (SessionProvider)  | supabase.auth.onAuthStateChange
      v                    v
[ (auth)/ group ]   [ Zustand useAuthStore ]
  sign-in.tsx              |
  ├── Google Sign-In ──────┤
  └── Apple Sign-In ──────►|
                           |
                           | session present?
                           v
              [ (tabs)/ group _layout.tsx ]
              ├── village/index.tsx (placeholder)
              ├── map/index.tsx (placeholder)
              ├── move/index.tsx (placeholder)
              └── profile/index.tsx (placeholder)
                           |
                           | Data fetch (TanStack Query)
                           v
              [ Supabase (hosted) ]
              ├── Auth (Google/Apple via signInWithIdToken)
              ├── PostgreSQL (profiles, villages tables)
              └── RLS (enforced at DB layer)
                           |
              [ apps/api/ - Vercel Express ]
              └── GET /health → { status: 'ok' }
                           |
              [ RevenueCat ]
              └── Purchases.configure() on mount (no products yet)
```

### Recommended Project Structure

```
FitRealm/                           ← monorepo root
├── package.json                    ← workspaces: ["apps/*"]
├── .npmrc                          ← (optional) workspace hoisting config
├── apps/
│   ├── mobile/                     ← Expo bare workflow app
│   │   ├── app.json                ← bundleIdentifier, package, scheme
│   │   ├── eas.json                ← build profiles
│   │   ├── metro.config.js         ← SDK 52: minimal (auto-monorepo support)
│   │   ├── tsconfig.json           ← extends expo's recommended config
│   │   ├── .env                    ← EXPO_PUBLIC_SUPABASE_URL etc (gitignored)
│   │   ├── app/                    ← Expo Router root
│   │   │   ├── _layout.tsx         ← Root layout: SessionProvider + Purchases.configure
│   │   │   ├── sign-in.tsx         ← Public sign-in screen (outside tabs)
│   │   │   └── (tabs)/
│   │   │       ├── _layout.tsx     ← Auth guard + tab bar config
│   │   │       ├── village/
│   │   │       │   └── index.tsx   ← Placeholder
│   │   │       ├── map/
│   │   │       │   └── index.tsx
│   │   │       ├── move/
│   │   │       │   └── index.tsx
│   │   │       └── profile/
│   │   │           └── index.tsx
│   │   ├── lib/
│   │   │   └── supabase.ts         ← Supabase client singleton
│   │   ├── store/
│   │   │   └── useAuthStore.ts     ← Zustand auth slice
│   │   ├── android/                ← Generated by expo prebuild
│   │   ├── ios/                    ← Generated by expo prebuild
│   │   └── package.json
│   └── api/                        ← Vercel Express API
│       ├── src/
│       │   └── index.ts            ← Express app (exported, not listened)
│       ├── vercel.json             ← Routing config
│       ├── .env                    ← Local secrets (gitignored)
│       ├── .env.example            ← Template for secrets
│       └── package.json
└── supabase/                       ← Supabase CLI artifacts (at repo root)
    ├── config.toml
    └── migrations/
        └── 20260525000000_init.sql ← profiles + villages tables
```

---

### Pattern 1: Expo Bare Workflow Init (SDK 52)

**What:** Scaffold bare Expo project into monorepo workspace slot.

**Command:**
```bash
# At repo root — create monorepo workspace structure
mkdir -p apps/api
echo '{ "name": "fitrealm", "private": true, "workspaces": ["apps/*"] }' > package.json

# Scaffold bare Expo app
npx create-expo-app@latest apps/mobile --template bare-minimum
```

**Critical note on templates:** `--template bare-minimum` generates the `android/` and `ios/` native directories immediately. The default template (no flag) now scaffolds for SDK 56 (the current latest as of 2026-05-25). To pin SDK 52: after scaffold, edit `apps/mobile/package.json` to set `"expo": "~52.0.49"` and run `npx expo install --fix` to align all dependencies. [CITED: docs.expo.dev/more/create-expo/]

**After scaffold, install Expo Router:**
```bash
cd apps/mobile
npx expo install expo-router react-native-safe-area-context \
  react-native-screens expo-linking expo-constants expo-status-bar
```

Then configure `app.json` with `"main": "expo-router/entry"` and add scheme. [CITED: docs.expo.dev/router/installation/]

---

### Pattern 2: Expo Router v3 Auth Guard (SDK 52 — redirect pattern)

**Critical:** `Stack.Protected` is NOT available in Expo Router v3 (SDK 52). It was introduced in SDK 53 / Router v4+. SDK 52 uses the redirect-based pattern. [VERIFIED: docs.expo.dev/router/advanced/authentication-rewrites/]

**File structure:**
```
app/
├── _layout.tsx          ← Root: wraps everything in SessionProvider + <Slot />
├── sign-in.tsx          ← Always accessible; Google + Apple sign-in buttons
└── (tabs)/
    ├── _layout.tsx      ← Auth guard: redirects to /sign-in if no session
    ├── village/index.tsx
    ├── map/index.tsx
    ├── move/index.tsx
    └── profile/index.tsx
```

**Root layout (`app/_layout.tsx`):**
```tsx
// Source: docs.expo.dev/router/advanced/authentication-rewrites/
import { Slot } from 'expo-router';
import { SessionProvider } from '@/store/useAuthStore';

export default function Root() {
  return (
    <SessionProvider>
      <Slot />
    </SessionProvider>
  );
}
```

**Protected tabs layout (`app/(tabs)/_layout.tsx`):**
```tsx
// Source: docs.expo.dev/router/advanced/authentication-rewrites/
import { Redirect, Tabs } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';
import { Text } from 'react-native';

export default function TabsLayout() {
  const { session, isLoading } = useAuthStore();

  if (isLoading) {
    return <Text>Loading...</Text>;  // Hold while session resolves
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs>
      <Tabs.Screen name="village/index" options={{ title: 'Village' }} />
      <Tabs.Screen name="map/index" options={{ title: 'Map' }} />
      <Tabs.Screen name="move/index" options={{ title: 'Move' }} />
      <Tabs.Screen name="profile/index" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
```

**Important:** The root `_layout.tsx` must render `<Slot />` unconditionally — no conditionals at the root level. All routing logic lives in the group layouts. [CITED: docs.expo.dev/router/advanced/authentication-rewrites/]

---

### Pattern 3: Zustand Auth Store + Supabase onAuthStateChange (D-11)

```tsx
// Source: supabase.com/blog/react-native-authentication
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  isLoading: boolean;
  initialize: () => () => void; // returns cleanup fn
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isLoading: true,
  initialize: () => {
    // Restore existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session, isLoading: false });
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        set({ session, isLoading: false });
      }
    );

    return () => subscription.unsubscribe();
  },
}));
```

Call `useAuthStore.getState().initialize()` in the root `_layout.tsx` `useEffect`. [ASSUMED]

---

### Pattern 4: Supabase Client Singleton (with URL polyfill)

```tsx
// Source: supabase.com/docs/guides/getting-started/quickstarts/expo-react-native
// File: apps/mobile/lib/supabase.ts
// IMPORTANT: Import order matters — localStorage polyfill MUST be installed before createClient is called

import 'react-native-url-polyfill/auto'
import 'expo-sqlite/localStorage/install'  // MUST come before createClient import
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,  // provided by expo-sqlite/localStorage/install
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,  // must be false in React Native
  },
})
```

**Two approaches for session storage:** Both are valid as of 2025. The `expo-sqlite/localStorage` approach is newer (requires `expo-sqlite` which is already a project dependency) and avoids an extra package. The `AsyncStorage` approach uses `@react-native-async-storage/async-storage`. Use the expo-sqlite approach — it's the current Supabase recommendation. [CITED: supabase.com/docs/guides/getting-started/quickstarts/expo-react-native]

---

### Pattern 5: Apple Sign-In with Supabase

```tsx
// Source: supabase.com/docs/guides/auth/social-login/auth-apple
import { Platform } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { supabase } from '@/lib/supabase'

export function AppleSignInButton() {
  if (Platform.OS !== 'ios') return null; // Apple Sign-In iOS only

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={5}
      style={{ width: 200, height: 44 }}
      onPress={async () => {
        try {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          })
          if (credential.identityToken) {
            const { error } = await supabase.auth.signInWithIdToken({
              provider: 'apple',
              token: credential.identityToken,
            })
            if (error) console.error('Supabase Apple auth error:', error)
          }
        } catch (e: any) {
          if (e.code !== 'ERR_REQUEST_CANCELED') {
            console.error('Apple sign-in failed:', e)
          }
        }
      }}
    />
  )
}
```

**iOS Setup Requirements:**
1. Add Sign In with Apple capability in Xcode (Project target → Capabilities → Sign In with Apple)
2. Enable Apple provider in Supabase Dashboard → Auth → Providers → Apple
3. Register your bundle ID (`com.fitrealm.app`) as a Client ID in Supabase's Apple provider config
4. For dev builds: also register the dev bundle ID variant [CITED: supabase.com/docs/guides/auth/social-login/auth-apple]

---

### Pattern 6: Google Sign-In with Supabase (Native flow)

**Recommended approach:** `@react-native-google-signin/google-signin` (native sign-in, no browser redirect). This is what Supabase's own docs recommend for React Native. [CITED: supabase.com/docs/guides/auth/social-login/auth-google]

**app.json config plugin (bare workflow):**
```json
{
  "expo": {
    "plugins": [
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.YOUR_IOS_CLIENT_ID"
        }
      ]
    ],
    "android": {
      "googleServicesFile": "./google-services.json"
    },
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist"
    }
  }
}
```

**Configure and sign-in:**
```tsx
// Source: supabase.com/docs/guides/auth/social-login/auth-google
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { supabase } from '@/lib/supabase'

// Call once on app mount (in root _layout.tsx useEffect)
GoogleSignin.configure({
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  // webClientId is required for Supabase even on native platforms
  // It's the "Web" client ID from Google Cloud Console, NOT iOS/Android client ID
})

async function signInWithGoogle() {
  try {
    await GoogleSignin.hasPlayServices()
    const response = await GoogleSignin.signIn()
    if (response.data?.idToken) {
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.data.idToken,
      })
      if (error) throw error
    }
  } catch (error) {
    console.error('Google sign-in error:', error)
  }
}
```

**Required credentials (from Google Cloud Console):**
- Web Client ID + Secret → entered in Supabase Dashboard (Auth → Providers → Google)
- iOS Client ID → provides reversed value as `iosUrlScheme` in app.json
- Android Client ID → embedded in `google-services.json`
- SHA-1 fingerprint of your signing key → registered in Google Cloud Console for Android [CITED: react-native-google-signin.github.io/docs/setting-up/expo]

**Files that must exist before EAS build:**
- `apps/mobile/GoogleService-Info.plist` (iOS) — from Firebase/Google Cloud Console
- `apps/mobile/google-services.json` (Android) — from Firebase/Google Cloud Console
- These can be committed (they contain client IDs only, not secrets) or stored as EAS secrets

---

### Pattern 7: RevenueCat SDK Init (Phase 1 minimal setup)

```tsx
// Source: revenuecat.com/docs/getting-started/installation/expo
import Purchases from 'react-native-purchases'
import { Platform } from 'react-native'

// Call once in root _layout.tsx useEffect (before auth)
function initRevenueCat() {
  const apiKey = Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_RC_IOS_KEY!
    : process.env.EXPO_PUBLIC_RC_ANDROID_KEY!

  Purchases.configure({ apiKey })
}
```

**Android native config (apps/mobile/android/app/src/main/AndroidManifest.xml):**
```xml
<!-- Add inside <manifest> tag -->
<uses-permission android:name="com.android.vending.BILLING" />
```

**iOS:** Enable "In-App Purchase" capability in Xcode → Project Target → Capabilities.

**New Architecture status:** react-native-purchases had a TurboModule crash with SDK 52 (RN 0.76) until v8.9.2. Current latest (10.1.2 as of 2026-05-25) includes the fix. [CITED: community.revenuecat.com] The SDK now works with New Architecture enabled. Always run `npx expo-doctor` after install to verify.

---

### Pattern 8: Vercel Express API (`apps/api/`)

**File structure:**
```
apps/api/
├── src/
│   └── index.ts        ← Export Express app (no app.listen needed for Vercel)
├── vercel.json
├── package.json
└── tsconfig.json
```

**`apps/api/src/index.ts`:**
```typescript
// Source: vercel.com/docs/frameworks/backend/express
import express from 'express'
const app = express()

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' })
})

export default app  // Export, do NOT call app.listen() for Vercel
```

**`apps/api/vercel.json`:** With current Vercel CLI (47+), zero config is supported for Express — Vercel auto-detects the entry point if the file is at `src/index.ts`, `app.ts`, `server.ts`, etc. A minimal vercel.json is still useful for explicit routing: [CITED: vercel.com/docs/frameworks/backend/express]

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

**Local development:** `vercel dev` (requires Vercel CLI installed globally). Pull env vars: `vercel env pull .env`. [CITED: vercel.com/docs/frameworks/backend/express]

---

### Pattern 9: npm Workspaces Monorepo + Metro (SDK 52)

**Root `package.json`:**
```json
{
  "name": "fitrealm",
  "private": true,
  "workspaces": ["apps/*"]
}
```

**`apps/mobile/metro.config.js`:**

As of SDK 52, Expo automatically configures Metro for monorepos. No manual `watchFolders` or `resolver.nodeModulesPaths` needed if using `expo/metro-config`. [VERIFIED: docs.expo.dev/guides/monorepos/]

```js
// apps/mobile/metro.config.js
// Source: docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// No watchFolders or nodeModulesPaths needed in SDK 52+
module.exports = config;
```

**Known pitfall:** If using pre-SDK-52 monorepo documentation, you'll see examples with manual `watchFolders`. Delete these properties if migrating. [CITED: docs.expo.dev/guides/monorepos/]

---

### Pattern 10: EAS Build Profiles (`eas.json`)

```json
{
  "cli": {
    "version": ">= 16.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

**EAS secrets workflow:** [CITED: docs.expo.dev/eas/environment-variables/]
```bash
# Pull environment variables for local development
eas env:pull --environment development

# Store build-time secrets (never committed to git)
eas secret:create --scope project --name SUPABASE_SERVICE_KEY --value "..."
```

---

### Pattern 11: Supabase CLI Migration Workflow

```bash
# 1. Initialize Supabase (at repo root)
npx supabase init

# 2. Link to hosted Supabase project
npx supabase link --project-ref YOUR_PROJECT_REF

# 3. Create Phase 1 migration
npx supabase migration new init_phase1

# 4. Edit supabase/migrations/<timestamp>_init_phase1.sql (see schema below)

# 5. Push to hosted Supabase
npx supabase db push
```

[CITED: supabase.com/docs/guides/deployment/database-migrations]

---

### Pattern 12: Phase 1 Supabase Schema

```sql
-- Enable PostGIS (required for villages.location)
-- Source: supabase.com/docs/guides/database/extensions/postgis
create extension if not exists postgis with schema extensions;

-- Profiles table (linked 1:1 to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Villages table (deferred: most columns added in Phase 2; lat/lng stored now for Phase 3)
-- Only owner relationship needed in Phase 1
create table if not exists public.villages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'My Village',
  -- location deferred: PostGIS column added in Phase 2/3 when map is built
  -- geography(POINT) stored here as placeholder only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS on all tables (INFRA-01)
alter table public.profiles enable row level security;
alter table public.villages enable row level security;

-- RLS: profiles — users can read/write own profile only
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- RLS: villages — users can read/write own village only
create policy "villages_select_own"
  on public.villages for select
  to authenticated
  using (owner_id = auth.uid());

create policy "villages_insert_own"
  on public.villages for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "villages_update_own"
  on public.villages for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Auto-create profile on new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

**PostGIS note for Phase 1:** The `extensions.geography(POINT)` column is deferred to Phase 2/3 when the Map tab is built. The villages table is created now with only the columns Phase 1 needs (owner_id, name). Adding the geography column in a later migration is straightforward. [ASSUMED]

[CITED: supabase.com/docs/guides/database/extensions/postgis] [CITED: supabase.com/docs/guides/database/postgres/row-level-security]

---

### Pattern 13: `app.json` Required Fields

```json
{
  "expo": {
    "name": "FitRealm",
    "slug": "fitrealm",
    "version": "1.0.0",
    "scheme": "fitrealm",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.fitrealm.app",
      "googleServicesFile": "./GoogleService-Info.plist"
    },
    "android": {
      "package": "com.fitrealm.app",
      "googleServicesFile": "./google-services.json",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      }
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.YOUR_REVERSED_IOS_CLIENT_ID"
        }
      ],
      "expo-apple-authentication"
    ],
    "main": "expo-router/entry"
  }
}
```

**Mandatory fields explained:**
- `scheme`: Required for deep linking and OAuth callbacks (custom URL scheme). Expo uses this to build `fitrealm://` redirect URLs.
- `ios.bundleIdentifier`: Required for EAS build and App Store.
- `android.package`: Required for EAS build and Google Play.
- `main`: Must be `"expo-router/entry"` for Expo Router to work.
- `plugins`: Config plugins auto-configure native code during `npx expo prebuild`. [ASSUMED]

---

### Anti-Patterns to Avoid

- **Using Expo Go instead of expo-dev-client:** `react-native-purchases`, `@react-native-google-signin/google-signin`, and `expo-apple-authentication` all require native modules that cannot run in Expo Go. [CITED: react-native-google-signin.github.io/docs/setting-up/expo]
- **Using `Stack.Protected` in SDK 52:** This API does not exist in Expo Router v3. Use `<Redirect href="/sign-in" />` pattern instead. [CITED: expo.dev/blog/simplifying-auth-flows-with-protected-routes]
- **Calling `app.listen()` in Vercel Express:** Vercel manages the server lifecycle. Export the app instead. [CITED: vercel.com/docs/frameworks/backend/express]
- **Manually configuring `watchFolders` in SDK 52:** SDK 52 handles monorepo Metro config automatically. Manual config is not only unnecessary but can cause conflicts. [CITED: docs.expo.dev/guides/monorepos/]
- **Storing Supabase service role key in mobile app:** The mobile app must only use the `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (formerly anon key). The service role key must only exist in Vercel environment variables. [CITED: CLAUDE.md / INFRA-05]
- **Client-side session validation only:** Always use RLS. The mobile app calls Supabase directly; without RLS, any user can read any row. [CITED: INFRA-01]
- **Using old `react-native-purchases` version (< 8.9.2) with New Architecture:** Causes TurboModule build crash. Use 10.x. [CITED: community.revenuecat.com]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session persistence across app restarts | Custom AsyncStorage JSON serializer | expo-sqlite/localStorage via supabase-js auth options | supabase-js handles token refresh, storage, and expiry |
| OAuth token validation | Custom JWT decoder | supabase.auth.signInWithIdToken() | Supabase verifies the nonce, expiry, and provider claim |
| Google Sign-In UI | WebView with google.com | @react-native-google-signin/google-signin | Native credential manager; no phishing risk; App Store requirement |
| Apple Sign-In UI | Custom button | expo-apple-authentication + Apple's button component | Apple requires using their branded button; App Store rejection if custom |
| Row-level access control | API-layer filtering | Supabase RLS (PostgreSQL policies) | Client talks to Supabase directly; API filter is bypassed by direct calls |
| Purchase receipt validation | Custom Apple/Google receipt parser | RevenueCat server-side validation (Phase 7) | Receipts are cryptographic; hand-rolled parsers have critical security bugs |
| File-system routing | Manual React Navigation setup | Expo Router | Screen registration, deep links, auth redirects are handled automatically |

---

## Common Pitfalls

### Pitfall 1: SDK Version Mismatch After Scaffold

**What goes wrong:** `npx create-expo-app --template bare-minimum` scaffolds with the current latest SDK (SDK 56 as of 2026-05-25), not SDK 52.

**Why it happens:** The template tracks the current SDK; no `--sdk-version` flag exists.

**How to avoid:** After scaffold, explicitly downgrade: set `"expo": "~52.0.49"` in package.json, then run `npx expo install --fix` to align all Expo SDK packages.

**Warning signs:** `expo-router` version resolves to `~5.x` or higher instead of `~3.5.x`; `react-native` version is `0.78+` instead of `0.76.x`.

---

### Pitfall 2: Wrong Supabase Auth Storage for React Native

**What goes wrong:** Using the default `localStorage` (browser) adapter without importing `expo-sqlite/localStorage/install` causes a "localStorage is not defined" error on device.

**Why it happens:** `localStorage` is a browser API. The import from `expo-sqlite` polyfills it for React Native.

**How to avoid:** Always import `'expo-sqlite/localStorage/install'` before `createClient()` in `lib/supabase.ts`. The import must be at the very top of the file.

**Warning signs:** App crashes on first launch with `ReferenceError: localStorage is not defined`.

---

### Pitfall 3: Google Sign-In Web Client ID Confusion

**What goes wrong:** Passing the iOS or Android Client ID as the `webClientId` in `GoogleSignin.configure()` causes auth failures.

**Why it happens:** Supabase uses the Web OAuth client to validate the ID token server-side. The iOS/Android client IDs produce tokens that the web client can't verify.

**How to avoid:** Create a "Web" OAuth 2.0 client in Google Cloud Console → APIs & Services → Credentials. Use that client's Client ID as `webClientId`. Enter the same Client ID + Secret in Supabase Dashboard → Auth → Providers → Google.

**Warning signs:** `supabase.auth.signInWithIdToken()` returns an `invalid_claim: missing sub claim` or `audience mismatch` error.

---

### Pitfall 4: Google Service Config Files Missing from EAS Build

**What goes wrong:** EAS Build succeeds locally (files exist in workspace) but the cloud build fails with "GoogleService-Info.plist not found".

**Why it happens:** EAS Build runs in a clean environment. Config files committed to git are available; files in `.gitignore` are not.

**How to avoid:** Commit `GoogleService-Info.plist` and `google-services.json` to git. These files contain only client IDs (not secrets). The actual OAuth secret is entered in Supabase Dashboard, not in these files.

**Alternative:** Store them as EAS secrets if your security policy forbids committing any Google config.

**Warning signs:** Build log shows `GOOGLE_SERVICES_JSON environment variable not set` or `GoogleService-Info.plist not found`.

---

### Pitfall 5: `react-native-purchases` Build Failure (New Architecture)

**What goes wrong:** Build error `:react-native-purchases-ui:generateCodegenSchemaFromJavaScript FAILED` or app crashes on launch with TurboModule error.

**Why it happens:** Versions < 8.9.2 did not fully support New Architecture (enabled by default in SDK 52 / RN 0.76).

**How to avoid:** Use `react-native-purchases@^10.x` (current npm latest). Run `npx expo-doctor` after install.

**Warning signs:** Build fails with Codegen errors; version of `react-native-purchases` is below 8.9.2.

---

### Pitfall 6: Expo Router `<Redirect>` Redirect Loop

**What goes wrong:** App gets stuck in an infinite redirect loop: sign-in → tabs → sign-in → ...

**Why it happens:** The auth state hasn't been restored when the first render happens. If `isLoading` is not tracked, the tabs layout sees `session = null` and redirects before the session is loaded.

**How to avoid:** Always render a loading state while `isLoading === true` in the tabs `_layout.tsx`. Never redirect based on session state until loading is complete.

**Warning signs:** App briefly flashes to sign-in screen, then back to tabs, then sign-in again on launch.

---

### Pitfall 7: Monorepo npm workspaces hoisting breaking native modules

**What goes wrong:** `pod install` fails because native module files can't be found, or Android build fails with "module not found".

**Why it happens:** npm workspaces hoist shared packages to the root `node_modules/`. Metro in SDK 52 handles this automatically, but `pod install` may not find hoisted packages.

**How to avoid:** Native packages used by Expo (react-native-purchases, @react-native-google-signin/google-signin) must be in `apps/mobile/node_modules/`, not hoisted. Add them to `apps/mobile/package.json` directly (not the root), or configure `.npmrc` with `hoist-pattern[]` exceptions.

**Warning signs:** `pod install` errors mentioning "Could not find pod for 'RNPurchases'"; Android build errors about "Unable to resolve module".

---

## Code Examples

### TanStack Query Setup (apps/mobile)

```tsx
// Source: tanstack.com/query/v5/docs/framework/react/quick-start
// apps/mobile/app/_layout.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
})

export default function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <Slot />
      </SessionProvider>
    </QueryClientProvider>
  )
}
```

### Health Check from Mobile (verifying API connectivity)

```tsx
// Apps call GET /health to verify Vercel API is reachable
const { data } = useQuery({
  queryKey: ['health'],
  queryFn: async () => {
    const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/health`)
    return res.json()
  },
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual Metro `watchFolders` in monorepos | Auto-configured by `expo/metro-config` | SDK 52 | Delete manual config; it works automatically |
| `localStorage` storage adapter via `@react-native-async-storage/async-storage` | `expo-sqlite/localStorage/install` | SDK 52 era | Fewer packages; built-in Expo approach |
| `useSegments` + `useRouter` for auth guards | `<Redirect href="..." />` in group layout | Expo Router v3 | Cleaner, no hooks needed for simple auth |
| `Stack.Protected` for route guarding | Available in SDK 53+ only | SDK 53 / Router v4 | **SDK 52 must use redirect pattern** |
| `react-native-purchases@7.x` | `react-native-purchases@10.x` | 2024 | New Architecture crash fix |
| WebBrowser OAuth for Google Sign-In | Native `@react-native-google-signin/google-signin` | 2023+ | Better UX; Supabase's stated recommendation |

**Deprecated/outdated:**
- `expo-google-app-auth`: Deprecated. Use `@react-native-google-signin/google-signin`.
- `react-native-google-signin` (without `@` scope): Use `@react-native-google-signin/google-signin` (scoped).
- Manual `watchFolders` in SDK 52: No longer needed.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Expo SDK 52 compatible version of expo-apple-authentication is `~7.x`; `npx expo install` resolves correctly | Standard Stack | Minor: wrong version installed; fix with `npx expo install --fix` |
| A2 | `apps/mobile/package.json` should own native packages (not root) to avoid hoisting breaking pod install | Pitfall 7 | Medium: pod install or Android build fails; fix by reorganizing package.json |
| A3 | PostGIS `geography(POINT)` column in villages table can safely be deferred to Phase 2/3 migration | Supabase Schema | Low: adding a column later is a non-breaking migration |
| A4 | `Purchases.configure()` called in root layout useEffect with no products defined yet causes no errors | RevenueCat Pattern | Low: RevenueCat docs confirm configure-only is fine before products are set up |
| A5 | All listed packages passed informal legitimacy review (established repos, long history, high downloads) despite slopcheck being unavailable | Package Legitimacy Audit | Low: these are all well-known, official packages with major ecosystem usage |
| A6 | `EXPO_PUBLIC_` prefix makes env vars available in React Native bundle; non-prefixed vars are server-only | Environment Variables | Medium: secret keys exposed if prefix accidentally added to service role key |

---

## Open Questions (RESOLVED)

1. **RESOLVED: Google Cloud Console project: create new or use Firebase?**
   - Create a standalone Google Cloud Console project (no Firebase). Get `google-services.json` and `GoogleService-Info.plist` directly from Google Cloud Console → APIs & Services → Credentials. This avoids Firebase dependency when Supabase is the backend.

2. **RESOLVED: Supabase project: hosted (dashboard) or needs to be created?**
   - Plan B (Supabase setup) includes a step to create the project via dashboard at supabase.com and copy the project URL + anon key to `.env`.

3. **RESOLVED: Vercel project: personal account or team?**
   - Plan C includes `vercel link` to bind `apps/api/` to a Vercel project. Free tier is sufficient for Phase 1 (`GET /health` only).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm workspaces, EAS CLI, Vercel CLI | Assumed ✓ | Check with `node --version` | None — required |
| npm | Package management | Assumed ✓ | Check with `npm --version` | None — required (D-04) |
| EAS CLI | EAS Build | Check | `npm install -g eas-cli` | None — required for INFRA-06 |
| Vercel CLI | Local API dev, env pull | Check | `npm install -g vercel` | Can deploy via git push instead |
| Supabase CLI | Migration workflow | Check | `npm install -g supabase` | Can use Dashboard SQL editor instead |
| Xcode + iOS Simulator | iOS build/test | Windows: ✗ | N/A | Use EAS cloud build for iOS; Android Emulator for local |
| Android Studio / Emulator | Android build/test | Check | Check with `emulator -list-avds` | EAS cloud build |
| CocoaPods | iOS pod install | Windows: ✗ | N/A | Handled by EAS cloud build |

**Important:** This project is developed on Windows 10. iOS native builds (`pod install`, local iOS Simulator) are not possible on Windows. The development workflow must use:
- EAS Build cloud builds for iOS (`eas build --platform ios --profile development`)
- Local Android Emulator for Android development iteration

**Missing dependencies with no fallback:**
- Xcode / CocoaPods (iOS local builds): Not available on Windows. Use EAS cloud builds for iOS.

**Missing dependencies with fallback:**
- Vercel CLI: Can deploy via `git push` to Vercel's GitHub integration; but `vercel env pull` requires the CLI.
- Supabase CLI: Can use Dashboard SQL editor; but migration files (tracked in git) are the better approach.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + React Native Testing Library (standard with Expo bare workflow) |
| Config file | `jest.config.js` (Wave 0 gap — create in Phase 1) |
| Quick run command | `npm test --workspace=apps/mobile` |
| Full suite command | `npm test --workspace=apps/mobile -- --coverage` |

**Phase 1 is primarily infrastructure + integration, not unit logic.** Most validation is manual (build succeeds, auth completes, API responds) rather than automated unit tests. Automated tests cover: Zustand store shape, supabase client initialization.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Google Sign-In triggers Supabase auth | Manual smoke | — | N/A — E2E only |
| AUTH-02 | Apple Sign-In triggers Supabase auth | Manual smoke | — | N/A — iOS device required |
| AUTH-03 | Session persists after app restart | Manual smoke | — | N/A — device restart required |
| INFRA-01 | RLS prevents cross-user data access | Manual SQL test | `supabase db test` | ❌ Wave 0 |
| INFRA-05 | No secrets in git | CI check | `git log --all -- "*.env"` | ❌ Wave 0 (add to CI) |
| INFRA-06 | EAS build profiles exist | Manual | `eas build:list` | ❌ Wave 0 (eas.json creation) |

### Sampling Rate
- **Per task commit:** `npm test --workspace=apps/mobile` (unit tests; fast)
- **Per wave merge:** Full build smoke test (`eas build --platform android --profile preview --local` if available; otherwise EAS cloud)
- **Phase gate:** All 5 success criteria from ROADMAP verified before marking Phase 1 complete

### Wave 0 Gaps
- [ ] `apps/mobile/jest.config.js` — Jest configuration for Expo bare workflow
- [ ] `apps/mobile/__tests__/supabase.test.ts` — Verifies client initializes without throwing
- [ ] `apps/mobile/__tests__/useAuthStore.test.ts` — Verifies store shape and initialize function
- [ ] `.gitignore` entries for `*.env`, `GoogleService-Info.plist` (if treating as secret), `google-services.json` (if treating as secret)
- [ ] `apps/api/__tests__/health.test.ts` — `GET /health` returns 200 + correct JSON

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Auth (OAuth 2.0 via Google/Apple); no passwords |
| V3 Session Management | Yes | supabase-js autoRefreshToken + expo-sqlite localStorage; JWT expiry enforced |
| V4 Access Control | Yes | Supabase RLS policies on all tables |
| V5 Input Validation | Minimal (Phase 1) | No user-editable inputs in Phase 1 except auth flows; Google/Apple handle their own input |
| V6 Cryptography | No (Phase 1) | No custom crypto; Supabase handles JWT signing |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Supabase service role key exposed in mobile bundle | Information Disclosure | Never use `EXPO_PUBLIC_` prefix on service role key; it must only live in Vercel env vars |
| Session token readable from other apps on device | Tampering | expo-secure-store (for sensitive values) or expo-sqlite (for session tokens); not AsyncStorage (unencrypted) |
| API bypass (direct Supabase calls skipping Express API) | Elevation of Privilege | RLS enforced at DB layer — API bypass still hits RLS |
| OAuth token replay | Repudiation | Supabase validates nonce and `iat`/`exp` on `signInWithIdToken()` |
| Over-broad RLS policy | Elevation of Privilege | Each table has separate SELECT/INSERT/UPDATE policies scoped to `auth.uid()` |

---

## Sources

### Primary (HIGH confidence)
- [docs.expo.dev/more/create-expo/](https://docs.expo.dev/more/create-expo/) — bare workflow init command
- [docs.expo.dev/guides/monorepos/](https://docs.expo.dev/guides/monorepos/) — SDK 52 Metro auto-config
- [docs.expo.dev/router/advanced/authentication-rewrites/](https://docs.expo.dev/router/advanced/authentication-rewrites/) — SDK 52 redirect-based auth
- [supabase.com/docs/guides/getting-started/quickstarts/expo-react-native](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native) — Supabase client setup
- [supabase.com/docs/guides/auth/social-login/auth-apple](https://supabase.com/docs/guides/auth/social-login/auth-apple) — Apple Sign-In implementation
- [supabase.com/docs/guides/auth/social-login/auth-google](https://supabase.com/docs/guides/auth/social-login/auth-google) — Google Sign-In via native SDK
- [supabase.com/docs/guides/deployment/database-migrations](https://supabase.com/docs/guides/deployment/database-migrations) — CLI migration workflow
- [supabase.com/docs/guides/database/extensions/postgis](https://supabase.com/docs/guides/database/extensions/postgis) — PostGIS setup and geography(POINT) schema
- [vercel.com/docs/frameworks/backend/express](https://vercel.com/docs/frameworks/backend/express) — Express on Vercel, export pattern
- [revenuecat.com/docs/getting-started/installation/expo](https://www.revenuecat.com/docs/getting-started/installation/expo) — RevenueCat Expo install
- [react-native-google-signin.github.io/docs/setting-up/expo](https://react-native-google-signin.github.io/docs/setting-up/expo) — Google Sign-In Expo config
- [docs.expo.dev/build/eas-json/](https://docs.expo.dev/build/eas-json/) — EAS build profiles
- [docs.expo.dev/guides/new-architecture/](https://docs.expo.dev/guides/new-architecture/) — New Architecture SDK 52 status

### Secondary (MEDIUM confidence)
- [community.revenuecat.com](https://community.revenuecat.com/sdks-51/react-native-0-76-7-expo-52-revenuecat-paywall-react-native-purchases-ui-causes-app-to-crash-when-passing-fontfamily-options-5879) — New Architecture crash fixed in 8.9.2+
- [expo.dev/blog/simplifying-auth-flows-with-protected-routes](https://expo.dev/blog/simplifying-auth-flows-with-protected-routes) — Stack.Protected is SDK 53+ only

### Tertiary (LOW confidence / [ASSUMED])
- npm registry version checks (npm view commands) — package existence verified, slopcheck unavailable

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages verified on npm registry, official docs consulted
- Architecture (Expo Router auth, Metro monorepo): HIGH — fetched from official Expo docs
- Supabase schema + RLS: HIGH — fetched from official Supabase docs
- RevenueCat New Architecture: MEDIUM — community report confirmed fix in 8.9.2+; latest (10.1.2) should be safe
- Google Sign-In setup details: MEDIUM — docs consulted but exact credential setup involves external Google Cloud Console
- Environment / Windows dev machine: MEDIUM — based on platform detection; iOS builds must use EAS cloud

**Research date:** 2026-05-25
**Valid until:** 2026-07-01 (stable stack, but Expo SDK versions move fast — recheck `npx expo install --fix` before building)
