<!-- GSD:project-start source:PROJECT.md -->
## Project

**FitRealm**

FitRealm is a cross-platform mobile RPG (iOS + Android) where real-world physical movement — walking, running, cycling, hiking, or any indoor workout — directly powers in-game village survival and progression. Players own a village anywhere on Earth (freely chosen, never tied to real location), bank miles from any activity, and strategically allocate those miles as the universal in-game currency to keep their village alive and growing. This is not a fitness tracker with rewards bolted on — the movement is the core mechanic.

**Core Value:** **Move → Bank → Allocate**: the strategic decision of how to spend earned miles (feed the village now or invest in a building that pays off next week?) is what makes FitRealm a game, not a tracker. No movement = village decays. Every step is a meaningful choice.

### Constraints

- **Platform**: iOS + Android simultaneous — every feature must target both
- **Infrastructure**: Vercel (serverless, free tier) + Supabase (PostgreSQL + PostGIS + Auth + Realtime, free/Pro tiers) — no self-managed infra until scale demands it
- **App Store compliance**: Location permissions requested on first movement (not onboarding), "Restore Purchases" button required, subscription easy-cancel link required, HealthKit usage description mandatory
- **Monetization ethics**: Never sell resources, miles, or movement credit. Free game, no content paywalls. Gems earn/spend ratio target 40–60%.
- **Decay is server-only**: Vercel Cron only — never trust client-side decay calculations
- **Balance invariant**: Even a fully maxed village must still lose resources without movement. Buildings buy time, not freedom.
- **North Star metric**: Weekly Active Movers (WAM) — users who logged ≥1 movement session in the last 7 days
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
