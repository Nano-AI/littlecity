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

**Stage 1 — PASSED (03:15).** All three merged with no conflicts; 445 tests
green. Two Look fixture tests were rewritten at the gate because Logic now
merges a stack into one structure.

- Logic `3f62149`: every placement rule, share codec (2,148 blocks → 1,940
  characters), island generator checked on 200 seeds, K1–K5, S1–S4,
  structures, 20 facts (`src/resolve/facts/README.md`). `resolveShape`
  median 2.5 ms in the browser; p95 10–12 ms (suspected warm-up; over the
  8 ms budget, revisit in Polish).
- Interface `cb14ab5`: tray with four drawers and 40 drawn icons, all tools,
  ghost, touch gestures, menus, gallery. Stairs `rot` = the direction the
  stairs climb toward (Logic agrees).
- Look `cbb6edd`: ink-and-paper renderer at 11 draw calls for 2,000 blocks,
  terrain and sea, camera, dusk cycle, `docs/swarm/ART.md`.
- Open look issues carried forward: a strip of stray ink along the top edge
  of the frame when the sea runs off-screen; no contact shadows; trees read
  as shaded balls; ghost has no ink; tuning panel does not refresh the
  renderer's cache in-game.
- Dev server for Derek: http://127.0.0.1:5173/ (restart at each gate).

## Stage 2: The town — RUNNING (launched 03:20)

Branches `swarm/houses`, `swarm/monuments`, `swarm/ground` (all Fable 5.2),
plus the Look owner continuing on `swarm/look` with the open look issues.
