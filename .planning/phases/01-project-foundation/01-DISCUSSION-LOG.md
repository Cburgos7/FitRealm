# Phase 1: Project Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 1-Project Foundation
**Areas discussed:** RN / Expo setup, Navigation structure, State management, Vercel API framework

---

## RN / Expo Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Bare Expo | npx create-expo-app with bare workflow. Native module access + EAS Build tooling. | ✓ |
| Pure RN CLI | Maximum control, no Expo dependency. More manual native config. | |
| Expo Managed | Fastest setup but limited native module support. Mapbox/HealthKit would require ejecting. | |

**User's choice:** Bare Expo

---

| Option | Description | Selected |
|--------|-------------|----------|
| Expo SDK 52 | Current stable. React Native 0.76, New Architecture default. Best Mapbox + EAS compatibility. | ✓ |
| Expo SDK 51 | Previous stable. RN 0.74, Old Architecture by default. | |
| Latest / let planner decide | Install freshest at execution time. Risks SDK compatibility gaps. | |

**User's choice:** Expo SDK 52

---

| Option | Description | Selected |
|--------|-------------|----------|
| Custom dev client from day one | expo-dev-client installed in Phase 1. Required for native modules. | ✓ |
| Expo Go initially, switch when needed | Swap to dev client when Mapbox demands it in Phase 3. | |

**User's choice:** Custom dev client from day one

---

| Option | Description | Selected |
|--------|-------------|----------|
| npm | Default for Expo and EAS Build. Most compatible. | ✓ |
| yarn (classic v1) | Still well-supported in RN community. | |
| pnpm | Fastest, strictest. Some Expo/EAS edge cases. | |

**User's choice:** npm

---

## Navigation Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Expo Router v3 | File-system routing on React Navigation. Native to Expo bare + SDK 52. Deep linking free. | ✓ |
| React Navigation v6/v7 (explicit) | Traditional stack/tab config. Maximum transition control. | |
| React Navigation v7 (latest) | Static API, type-safe routing. Less community familiarity. | |

**User's choice:** Expo Router v3

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full 4-tab shell now | Village, Map, Move, Profile — all tabs scaffolded with placeholder screens. | ✓ |
| Auth + single home screen only | Tabs added in Phase 2. Minimal scope but creates refactoring debt. | |
| You decide | Let planner pick tab structure. | |

**User's choice:** Full 4-tab shell now

---

| Option | Description | Selected |
|--------|-------------|----------|
| Village tab placeholder | Auth redirects to Village tab with placeholder card. Correct post-auth destination for Phase 2. | ✓ |
| Simple 'You're in!' screen | Temporary success screen with user info. Phase 2 replaces it. | |
| Onboarding flow start | Immediately trigger Phase 4 onboarding. Premature for Phase 1. | |

**User's choice:** Village tab placeholder

---

| Option | Description | Selected |
|--------|-------------|----------|
| Outside tabs — separate auth stack | Root-level stack separate from tab navigator. Standard pattern, cleanest separation. | ✓ |
| Inside tabs — tab navigator always present | Tabs locked/hidden until auth completes. More complex conditional rendering. | |

**User's choice:** Outside tabs — separate auth stack

---

## State Management

| Option | Description | Selected |
|--------|-------------|----------|
| Zustand + React Query | Zustand for game state, React Query for server state. Minimal boilerplate, excellent RN support. | ✓ |
| Redux Toolkit + RTK Query | More structure and devtools. Higher boilerplate. | |
| React Context + React Query only | No extra lib. Fine for Phase 1 but likely inadequate for complex game state in Phase 2+. | |

**User's choice:** Zustand + React Query

---

| Option | Description | Selected |
|--------|-------------|----------|
| Zustand auth store + Supabase onAuthStateChange | Dedicated useAuthStore slice synced to Supabase listener. Clean and testable. | ✓ |
| React Context (AuthProvider) | No extra lib needed for auth specifically. Creates two-system pattern. | |
| Expo SecureStore only | Redundant — Supabase already handles persistence internally. | |

**User's choice:** Zustand auth store + Supabase onAuthStateChange

---

| Option | Description | Selected |
|--------|-------------|----------|
| Defer SQLite to Phase 2 | Install expo-sqlite in Phase 1 as dependency only. Phase 2 implements the offline queue. | ✓ |
| Set up SQLite schema in Phase 1 | Initialize with offline queue table structure now. Cleaner Phase 2 handoff. | |
| You decide | Let planner determine SQLite timing. | |

**User's choice:** Defer to Phase 2

---

## Vercel API Framework

| Option | Description | Selected |
|--------|-------------|----------|
| Hono | Edge-native, tiny runtime, excellent TypeScript. | |
| Express.js | Matches ROADMAP spec. Battle-tested, Node runtime. | ✓ |
| Next.js API routes | Overkill for mobile-only project with no web frontend. | |

**User's choice:** Express.js
**Notes:** User initially asked about Next.js but confirmed this is a mobile-only product with no web plans. Reverted to Express.js as specified in ROADMAP.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Subfolder in same repo — monorepo | apps/mobile/ + apps/api/ with npm workspaces. Shared types, one CI. | ✓ |
| Separate repository | Independent repos. More coordination overhead. | |

**User's choice:** Monorepo with npm workspaces

---

| Option | Description | Selected |
|--------|-------------|----------|
| Health check endpoint only | GET /health → { status: 'ok', version: '1.0.0' }. Proves Vercel deployment. | ✓ |
| Health check + auth proxy | Health check + Supabase JWT validation endpoint. | |
| You decide | Let planner determine Phase 1 API surface. | |

**User's choice:** Health check endpoint only

---

| Option | Description | Selected |
|--------|-------------|----------|
| SDK install only | Install react-native-purchases, call Purchases.configure(). No products yet. | ✓ |
| SDK + placeholder product IDs | Define gem pack identifiers in code even though App Store products aren't live. | |
| Defer entirely to Phase 7 | Don't touch RevenueCat in Phase 1. | |

**User's choice:** SDK install only

---

## Claude's Discretion

- TypeScript `tsconfig.json` strictness settings
- ESLint and Prettier configuration details
- Supabase client singleton setup and export pattern
- EAS Build profile naming convention
- App bundle identifier and Android package name
- Vercel project name and deployment URL structure

## Deferred Ideas

- **SQLite offline queue** — Deferred to Phase 2 (Allocate Miles screen, ALLOC-04)
- **Next.js / web frontend** — Out of scope. User confirmed mobile-only product, no web surface planned.
