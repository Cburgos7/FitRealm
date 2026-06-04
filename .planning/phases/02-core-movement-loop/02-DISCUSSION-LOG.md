# Phase 2: Core Movement Loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 2-Core Movement Loop
**Areas discussed:** Village view, Movement tracking (active + passive), Offline allocation, Activity detection, Allocate screen, Decay & survival, game_config, Resource feedback, Passive feeding, Mile Bank, Village init, Map tab, Multiplier math, Anti-cheat, Voice, Reminders

---

## ⭐ Core Mechanic Redesign (user-initiated, mid-discussion)

The user redirected the core loop away from the original four-decaying-resource model to a **food-only survival model**:
- Food is the only survival/decaying resource; the village decays only by losing food.
- No food = starving = locked (can't scout/act) until fed.
- "Defend" is reframed as protection against **raiders** (a separate future threat), NOT a decay-blocker.
- Hunt Food rate set by user: **1 mile → 10 food** (0.1 mi = 1 food ≈ 0.161 km).

This overrides REQUIREMENTS.md VLG-01/03/06 and ALLOC-02 (now updated). Medicine/Wood/Stone/Morale became non-decaying inputs for later systems.

---

## Village view

**User's choices:** Illustrated scene · top overlay bar for meters · single placeholder illustration per state · Allocate via floating action button · state transitions via visual + toast · Starving = dark/desaturated + recovery card · Mile Bank in the top resource bar.

## Movement tracking (active + passive)

**User's choices:** Both active tracker AND passive phone reading, with **gap-fill reconciliation** to prevent double-counting · passive reading included in Phase 2 · full-screen map + bottom stats sheet · session continues off-tab with persistent banner · silent Kalman filtering + accuracy dot · end → summary → bank · passive banked via app-open prompt · orphaned session auto-saves partial silently · health permission on first Move-tab visit · use health platform's own distance value · daily reconciliation resets at local midnight.

## Offline allocation

**User's choices:** Optimistic update + SQLite queue · server authoritative on sync with notify-on-conflict · pending badge near Mile Bank.

## Activity detection

**User's choices:** Auto-detect from pace, no manual override · pace + elevation/GPS signals for ambiguous cases · manual entry derives pace from distance ÷ duration.

## Allocate Miles screen

**User's choices:** Bottom sheet over the village · grouped by resource, basics first · tap-once + quantity stepper · Phase 2 live set = Survival + Defend only (Hunt Food the survival action).

## Decay & survival mechanics

**User's choices:** Grace period shown as countdown badge + reassuring copy · States Thriving → Hungry → Starving (locked) · recovery = hunt any food (unlocks immediately).

## game_config tunable values

**User's choices:** Food decay −4 per 6hr tick (~1.6 mi/day to maintain) · ALL of {decay rate & cadence, food-per-mile, grace + thresholds, activity multipliers} stored in game_config.

## Resource meter feedback

**User's choices:** Color shift + warning at ≤20 (colorblind-safe with icon + label) · animated bar + narrative toast on change.

## Passive feeding vs. banking

**User's choice:** Passive movement **banks miles; player still allocates** (does not auto-feed). Preserves Move → Bank → Allocate.

## Mile Bank rules

**User's choice:** Miles never expire, no cap (matches PROJECT.md v1).

## Village existence in Phase 2

**User's choice:** Auto-create a default village ("Thornhaven", full food) on first authenticated launch; Phase 4 onboarding replaces it later.

## Map tab scope

**User's choice:** Map tab stays a placeholder; Mapbox used only inside the GPS tracker this phase.

## Multiplier math chain

**User's choice:** Multiplier boosts banked miles; food conversion stays flat 1 mi = 10 food (applied once, at banking time).

## Manual-entry anti-cheat

**User's choice:** Daily mile cap + pace sanity check, server-validated, caps in game_config.

## Narrative voice & copy

**User's choice:** Warm high-fantasy, lightly playful.

## Starving reminders

**User's choice:** Fully defer out-of-app reminders to Phase 7; in-app visuals + app-open prompt carry it in Phase 2.

---

## Claude's Discretion

- SQLite schema for offline queue + sync bookkeeping
- Kalman filter tuning + GPS sampling cadence
- Mapbox config inside the tracker
- Reconciliation bookkeeping mechanics
- Starting pace/elevation detection thresholds (seed into game_config)
- Toast/animation library + timing

## Deferred Ideas

- Raider attack + Defend combat system (concept locked, built later; Medicine = raider-damage recovery)
- Medicine/Wood/Stone/Morale active uses (buildings Phase 6, social, raiders)
- Scout/Explore allocations (need Phase 3 map)
- Faction/Outpost/Move Camp allocations (Phase 6)
- Push notifications incl. starvation alerts (Phase 7)
- Real onboarding — name/place/avatar (Phase 4)
- Full Mapbox fantasy world map (Phase 3)
- Background location tracking (out of scope until proven)
