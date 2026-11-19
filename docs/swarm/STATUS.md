# Little City build: run log

Orchestrator's log. Newest stage at the bottom. Plan:
`docs/superpowers/plans/2026-11-19-little-city-swarm-master.md`.

## How to resume (for the orchestrator)

1. Read this file, then `git log --oneline | head -20` and `git branch --list 'swarm/*'`.
2. A stage is done when its gate line below says PASSED. Otherwise look for
   finished `swarm/<owner>` branches to merge, or relaunch the missing owner.
3. Gate = merge owner branches into `yaoderek/bloom-s-monkey-city-builder`,
   `npm run check`, `npm run shots`, look at the shots, update this file,
   commit.

## Stage 0: Foundation — PASSED (02:00)

- Head `23e3a24`. 143 tests green. Shots, inspect and bench CLIs work
  headless with real WebGL (Apple M5, ANGLE Metal).
- `docs/swarm/CONTRACTS.md` is the API reference. It lists 25 deviations from
  the plan's contract sketch in its section 15; the important ones: `define*`
  functions return objects that files export; rule callbacks take a `ctx`;
  floor regions and fence/wall runs are structures; `defineLayer` and
  `defineSystem` are new.
- Known over-budget numbers are stub artefacts (3,039 draw calls, one mesh
  per structure).

## Stage 1: Core — RUNNING (launched 02:00)

Three owners in parallel worktrees, branches `swarm/logic` (Opus 5.5),
`swarm/look` (Fable 5.2), `swarm/interface` (Fable 5.2). Look may make
additive changes to `src/render/api.ts` and `LifeStage`.
