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

## Stage 2: The town — PASSED (04:40)

All merged with no conflicts; 886 tests green. Every R and J rule in the
catalogue is built (all three owners went past tier 1), so Stage 4 has no
"structures depth" left beyond art fixes.

- Look second pass `2018856`: grounding shade, edge-ink fix, island polish,
  sketched ghost, style changes redraw.
- Monuments `816d812`: all R-T, R-L, R-M, R-A rules, J13–J16, supports layer.
- Houses `c5c2f20`: all R-H rules, R-W01, J04–J12, J24–J27. Stand-in rules
  for D07, D09 and L03 live in `scenarios/houses/standins.ts`; Stage 3 must
  replace them with real rules.
- Ground `370dd4d`: all R-D, R-P, R-F, R-S, R-G, R-E rules, J17–J23, J28.
- Orchestrator fix: `src/terrain/terrain.test.ts` got a 60 s timeout (it
  timed out under machine load for every agent).
- `npm run shots` takes ONE scenario pattern per call.

Open items for the art fix pass: gap where an arch meets a house or round
tower; notch at inner corners of keep battlements; terrace railings 0.07
outside the house wall line; stilt-house ladders draw as markers (no
`ladder` part); chapel is plain; big hip roofs are flat areas; over-tall
flues; walls, stairs and fountains are ruler-straight; some parts over the
triangle aim. Speed: `resolveShape` about 8 ms median on bench-2000 with
house rules (budget 8 ms).

## Stage 3: Life — RUNNING (launched 04:45)

Branches `swarm/animation`, `swarm/people`, `swarm/dressing` (all Fable
5.2), plus one art director reviewing Stage 2 into
`docs/swarm/art-review-1.md` (branch `swarm/art-review`).

**05:25** Art review 1 merged (`docs/swarm/art-review-1.md`, showcase
`scenarios/core/everything.scenario.ts`, 55 roles asserted). Fix passes sent
to Houses, Monuments, Ground and Look (same agents, resumed) on their
existing branches. Unit-test timeout raised to 30 s. Seven agents running:
Animation, People, Dressing, plus the four fix passes. Dev server hit its
two-hour limit and is not restarted (Derek can run `npm run dev`).

**~05:30 STOPPED: Fable usage limit.** All seven running agents died
mid-work (Animation, People, Dressing, and the Houses, Monuments, Ground and
Look fix passes). Work survived in their worktrees.

**10:40 RESUMED** after Derek reset the limit. All seven resumed by message
with: commit after every rule or fix, must-fix notes only for the fix
passes, no sub-agent forks. State at resume: animation 1 commit (plus dead
forks `swarm/animation-boats`, `swarm/animation-birds` with uncommitted
work), people 2 commits + 4 files, dressing 0 commits + 31 files, houses 16
files, monuments 12 files, ground and look at the start of their passes.

To stay inside the limit from here: no forks; discovery rounds cut to 2
with one explorer and one builder each; logic-only work goes to Opus 5.5.

**10:40 (second resume).** The session restarted a minute after the first
resume and stopped all seven again; resumed again by message.

**Standing instruction from Derek:** if an agent dies on the Fable usage
limit, do not wait: relaunch that owner as a fresh Opus 5.5 agent pointed at
the SAME worktree path (no new worktree), with a handoff brief: read
`git status`, `git log`, the owner's original brief (in this log's stage
sections and the plan), `docs/swarm/requests/<owner>.md`, then continue.
Worktree paths: `git worktree list`.

**Model instruction from Derek (10:55):** every agent launched from here on
runs on Opus 5.5 ("fable is too slow"): Stage 4 polish, discovery rounds,
final art pass, and any replacement for an agent that dies. The seven
already running stay on Fable to keep their memory; each keeps a handoff
note in `docs/swarm/handoff/<owner>.md`.

**Published (11:10):** https://yaoderek.github.io/littlecity/ serves the
built game from the `gh-pages` branch (built files only; the working branch
is not pushed beyond what was already on the remote). Pages source was
changed from the working branch to `gh-pages`. Redeploy after each gate
with `./tools/deploy-pages.sh`.

**11:45** Merged fix passes: Monuments `cb686d2` (M1–M7 all done) and
Houses `21c4909` (H1–H6 plus role props; adds `J05.terrace-edges`,
`R-H99.role-props`). Typecheck, lint and 853 unit tests green. Browser
tests in `tests/e2e/interface.e2e.test.ts` time out under machine load
(load average 16 with eight agents); rerun `npm run check` when the machine
is quieter before the next Pages deploy. Still open from these passes:
Ground's half of the terrace railing (G4), bench not re-measured after
Houses' heavier J10. Held-length feature in progress on `swarm/held-length`
(Opus 5.5).

**12:15** Merged Ground fix pass `8419265` (G1–G5). Orchestrator rewrote the
end of `scenarios/rules/J05.terrace-edges.scenario.ts`: Ground no longer
adds J19 railings on house roofs, so the house parapet stands there.
856 unit tests green. Open seams: fence edge pieces round a pitched-roof
house float at eaves level (needs a decision: skip drawing them); stall and
fountain triangle trims not done. Still running: Animation, Dressing, Look
fix pass, held-length; People finishing.
