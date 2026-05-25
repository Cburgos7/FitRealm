# Phase 1: Project Foundation - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold the React Native mobile app (iOS + Android), wire up Google and Apple authentication via Supabase Auth, stand up the Vercel Express API, and initialize the RevenueCat SDK. This phase produces the full navigable skeleton that all subsequent phases build into. No game mechanics are implemented — only the structural foundation.

</domain>

<decisions>
## Implementation Decisions

### React Native / Expo Setup
- **D-01:** Use **Bare Expo workflow** (not Expo Managed, not pure RN CLI). Initialized with `npx create-expo-app` using the bare template.
- **D-02:** Target **Expo SDK 52** (React Native 0.76, New Architecture enabled by default).
- **D-03:** Install **expo-dev-client** from day one. Do not use Expo Go. Required for native modules (Mapbox, HealthKit, GPS) that arrive in later phases.
- **D-04:** Use **npm** as the package manager (not yarn, not pnpm).

### Navigation
- **D-05:** Use **Expo Router v3** (file-system routing built on React Navigation). Matches the bare Expo SDK 52 setup.
- **D-06:** Scaffold the **full 4-tab shell** in Phase 1: Village (home), Map, Move, Profile. Each tab displays a placeholder screen ("Coming soon"). Future phases build into existing tab screens rather than adding new tabs.
- **D-07:** Auth screens live in a **separate root-level stack outside the tab navigator**. Unauthenticated users see only auth screens; authenticated users see only the tab shell.
- **D-08:** After successful sign-in, the app redirects to the **Village tab** (placeholder). This is the permanent post-auth landing destination.

### State Management
- **D-09:** Use **Zustand** for synchronous/UI-layer state (game state, village resources, mile bank, app-level flags).
- **D-10:** Use **TanStack Query (React Query v5)** for server state and all Supabase data fetching (queries, mutations, cache invalidation).
- **D-11:** Auth session managed via a dedicated **Zustand `useAuthStore` slice**, subscribed to `supabase.auth.onAuthStateChange`. Components read session from the store — never directly from Supabase client.
- **D-12:** **SQLite / expo-sqlite is deferred to Phase 2.** The offline allocation queue is not needed in Phase 1. Do not install or configure it here.

### Vercel API
- **D-13:** Use **Express.js** as the Vercel API framework (Node runtime, not Edge). Aligns with ROADMAP Phase 1 Plan C spec.
- **D-14:** Monorepo structure with **npm workspaces**: `apps/mobile/` (Expo app) and `apps/api/` (Express/Vercel). Root `package.json` defines workspaces.
- **D-15:** Phase 1 API surface: **`GET /health` only**, returning `{ status: 'ok', version: '1.0.0' }`. All game endpoints (decay cron, allocation, etc.) are built in later phases.
- **D-16:** **RevenueCat SDK** (`react-native-purchases`): install the package and call `Purchases.configure(API_KEY)` on app launch. No products, offerings, or purchase flows defined yet — that is Phase 7.

### Claude's Discretion
- TypeScript `tsconfig.json` strictness settings (use Expo's recommended defaults)
- ESLint and Prettier configuration details
- Supabase client singleton setup and export pattern
- EAS Build profile naming convention (`development`, `preview`, `production`)
- App bundle identifier (`com.fitrealm.app`) and Android package name
- Vercel project name and deployment URL structure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/REQUIREMENTS.md` — Full v1 requirements. Phase 1 covers: AUTH-01, AUTH-02, AUTH-03, INFRA-05, INFRA-06.

### Roadmap
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and planned deliverables (Plans A, B, C).

### Project State
- `.planning/STATE.md` — Current project state and session history.

No external specs or ADRs exist yet — this is the first phase of a new project.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — this is a green-field project. Phase 1 creates the codebase from scratch.

### Established Patterns
- None yet. Phase 1 establishes the patterns all subsequent phases follow.

### Integration Points
- Supabase Auth → Zustand `useAuthStore` → Expo Router auth guard (root `_layout.tsx`)
- Supabase client → TanStack Query as the data-fetching layer
- RevenueCat `Purchases.configure()` → called once in root `_layout.tsx` on mount
- Express API `GET /health` → called from mobile app on startup to verify connectivity

</code_context>

<specifics>
## Specific Ideas

- The user explicitly confirmed this is a **mobile-only product** — no web frontend, no Next.js. Express on Vercel is the right API choice.
- The ROADMAP Plan C specifies "empty Express API" — Phase 1 literally delivers an empty API with one health check route.
- The user wants the full 4-tab navigation shell scaffolded in Phase 1 so later phases build into existing screens rather than creating new routing structure.

</specifics>

<deferred>
## Deferred Ideas

- **SQLite offline queue** — Needed for ALLOC-04 (offline allocation queuing). Deferred to Phase 2 where the Allocate Miles screen is built.
- **Next.js / web frontend** — User confirmed mobile-only. No web surface planned. Out of scope entirely.

</deferred>

---

*Phase: 1-Project Foundation*
*Context gathered: 2026-05-24*
