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

**(time: see git log)** Merged fix passes: Monuments `cb686d2` (M1–M7 all done) and
Houses `21c4909` (H1–H6 plus role props; adds `J05.terrace-edges`,
`R-H99.role-props`). Typecheck, lint and 853 unit tests green. Browser
tests in `tests/e2e/interface.e2e.test.ts` time out under machine load
(load average 16 with eight agents); rerun `npm run check` when the machine
is quieter before the next Pages deploy. Still open from these passes:
Ground's half of the terrace railing (G4), bench not re-measured after
Houses' heavier J10. Held-length feature in progress on `swarm/held-length`
(Opus 5.5).

**(time: see git log)** Merged Ground fix pass `8419265` (G1–G5). Orchestrator rewrote the
end of `scenarios/rules/J05.terrace-edges.scenario.ts`: Ground no longer
adds J19 railings on house roofs, so the house parapet stands there.
856 unit tests green. Open seams: fence edge pieces round a pitched-roof
house float at eaves level (needs a decision: skip drawing them); stall and
fountain triangle trims not done. Still running: Animation, Dressing, Look
fix pass, held-length; People finishing.

**(time: see git log)** Merged Animation `409c40c` (L02, L03, L06, L07, L09, L10 part,
L11–L13, L16, L17, L19, F01–F05; `src/life/MOTION.md`; sequence tool
`src/life/testing/sequence.mjs`). Full `npm run check` green: 972 tests,
browser tests included (Animation fixed the slow e2e file by closing pages).
Published to Pages. Open: windmill cap does not yaw; L29 blocked (bell,
clock hands, fountain jet baked as static geometry); grounding picture
redraws every other frame so GPU load is about 3.5x (check on phone);
remaining L rules and sound not done.

**(time: see git log)** Merged Dressing `ea3274c`: D01–D11 (not D12), D13, D15, D20, D24,
U01–U08, U12 (centre half). Full check green: 1,089 tests. Published.
Not built: U09–U11 and U12 edge half (need Houses files), D12, D14, D17–D19,
D21–D23, D25–D28, D30–D34. `resolveDressing` 13 ms of 30 ms. Orchestrator
note: chimney smoke reads as stacked white lumps and is too dense; a laundry
line can cross above a public stair.

**(time: see git log)** Stage 4 depth launched on Opus 5.5: `swarm/dressing-depth`
(remaining D and U rules; may edit Houses files for U09–U11) and
`swarm/life-depth` (remaining L rules, L29 unblock, cap yaw, sound, smoke
tuning; may edit the generators that bake bell, clock hands and jets).

**(time: see git log)** Merged Look fix pass `61ba162` (L1–L4; actors kept out of the
grounding picture). Orchestrator relaxed one assertion in
`src/render/view.e2e.test.ts` (actor pool may exist at rest). Full check
green: 1,095 tests. Published. Open from Look's bench: geometry rebuild
after one Auto edit is 11 ms median / 30 ms p95 on bench-2000 (budget 8 ms),
almost all inside structure generators rebuilding a whole merged structure;
`npm run bench -- everything` throws (use
`node src/render/testing/bench.mjs <scenario>`); ART.md pictures are stale.
Running: People (finishing), held-length, dressing-depth, life-depth.

Note: the clock times on the six entries above were guesses and have been
removed; the merge commits carry the real times (all between 11:08 and
11:54 on 2026-11-19).

**11:55** Merged held length `9772953` (scroll or the − n + stepper
stretches run pieces; `src/ui/length.ts`). Full check green: 1,117 tests.
Published. Running: People (final check), dressing-depth, life-depth.

**12:00** Merged People `8f9901d` (walking graph, L21–L28, L32, L08 round).
Typecheck and lint green; 5 unit tests fail at the seam with real Dressing
props and Animation actors (lamp and pigeon counts, shut-in residents,
children). Sent back to the People agent to fix on `swarm/people`; NOT
published until green. Last published build: held length (`5bb587c`).

**Stage 3: Life — PASSED.** People integration `60d63c3` merged; full check
green: 1,203 tests. Published. All three life owners plus four fix passes
and held length are in. Lamplighter's round = the ten lamp posts nearest the
biggest square; lamps on the round wait for him (`deferLamp`); windows light
only where someone is home; the walking graph reads decoration props.
Flaky: `tests/e2e/held-length.e2e.test.ts` once measured a stepper button
at 43 px against a 44 px minimum (passes on rerun): fix in polish.
Running: dressing-depth, life-depth (both Opus 5.5).

**Life depth merged** (`ad8e993`, Opus 5.5): soft smoke, flaw fixes, L29
mechanisms and mill cap unblocked, L05, L10 (moon, shooting star), L14, L15,
L18, L30, L31, L33–L35, sound F06. Conflict in `src/render/index.ts` and
`slots.ts` against the Look fix pass resolved by keeping both mechanisms
(Look's `aloof` slots and movers pool; life depth's slot kinds and `urgent`).
One view test threshold updated (moving props refresh ground shade every 4th
frame). Full check green: 1,240 tests. Published. Not done: L20 rower,
bunting glow at night, gust front unverified by eye; sound defaults to ON
(interface's stored default) where the brief said off.
Dev server hit its two-hour limit again and is NOT restarted; the public
site serves the same build. Running: dressing-depth, grow-town (Opus 5.5).

**Dressing depth merged** (`121520d`, Opus 5.5): U09, U10 (turret only),
U11 (+U11-F), U12-E, D12, D14, D17–D19, D21–D23, D25–D28, D30–D34, laundry
height fix, J20-F floating fences. Full check green: 1,323 tests. Published.
Every catalogue rule now has an implementation except L20 (rower).

Bench on bench-2000 (machine at load 10, so approximate): frame rate 60 fps,
14 draw calls; `resolveShape` 12.8 ms median / 40 ms p95 in the browser
(budget 8); geometry rebuild 9.3 / 20 ms (budget 8); `resolveDressing`
9.4 / 22 ms (budget 30). Slowest rules: J09 windows 1.9 ms, R-H05 boathouse
1.7, D01 lamps 1.5, L19 sailboats 1.2, J11 chimneys 1.1.

**Stage 4 polish launched** on Opus 5.5 (`swarm/polish`): shape-stage and
rebuild speed, phone viewport pass, and the small-fix list (walls on
pitched roofs, stepper 44 px flake, bunting glow, L20 rower, stale ART.md
pictures). Also running: grow-town.

**Two more requests from Derek, both specced in the design and launched on
Opus 5.5:** house styles (`swarm/house-styles`: six named looks plus Random
as the default, chosen from a flyout on the House tray button, stored as
`Block.style`; Alt-click copies a look) and animation polish
(`swarm/animation-polish`: doors that open, roof hatches, a watching pass
over all motion, the gust front). Running now: grow-town, polish (speed),
house-styles, animation-polish. Expect merge overlap in
`src/parts/openings/door.part.ts` and `src/style/houses.ts`.

**Grow a town merged** (`ffa1ee9`, Opus 5.5): `src/townmaker/`, menu entry
with dice button, animated playback, one undo step. 62–66 distinct roles per
grown town; every part-R role reached across seeds 1–5 except willow
(islands 1–5 have no non-sand shore). Orchestrator added `town-hall` (new
role from dressing depth) to the coverage list as PENDING. Full check green:
1,343 tests. Published. Second pass sent to the same agent: town hall,
denser centre, new dressing-depth rules, streets to summits, a viaduct.
Running: polish (speed), house-styles, animation-polish, grow-town pass 2.

**House styles merged** (`c033878`, Opus 5.5). Conflict in
`src/ui/interface.ts` with Grow a town resolved (both guards kept); second
`dice` icon renamed `styleDice`. Orchestrator fixed the flaky stepper test
(`.lc-step` no longer shrinks in its flex row). Full check green: 1,369
tests. Published.

**Three more requests from Derek, all launched on Opus 5.5:**
- Castle life: garrison troop marching round the castle and a mounted rider
  (catalogue L36, L37) → added to the animation-polish agent's list.
- The guide: a side panel with a picture and a one-line recipe for each
  special building (design section 7 "The guide") → `swarm/guide`.
- Flicker and clipping on camera rotation → `swarm/steady-ink` (renderer).
Running: polish (speed), animation-polish, grow-town pass 2, guide,
steady-ink.

**Grow a town pass 2 merged** (`d614f3a`): town hall on every square with a
ring road, dense two-ring centre, corner houses, courtyard block, summit
streets up two-level cliffs, a valley viaduct on 4 of 5 seeds, harbour
access. 58–68 roles per town. One seed in five is a "pump town" with no
fountains (D33 needs none). Orchestrator fixed `L10.fireflies` (negative
seeds gave a negative index) and the stepper test (it measured a button
mid-press, scaled to 0.97). Full check green: 1,370 tests. Published.
Running: polish (speed), animation-polish, guide, steady-ink.

**Animation polish merged** (`27c6c6d`, Opus 5.5): door leaves that open
(`L29.door-leaves`), roof hatches, shore arrivals and leavers, workers'
tools, gust shiver fix, castle garrison (L36) and rider with a horse (L37).
Full run: 1,401 of 1,403 passed; the two failures were 30 s timeouts on
heavy generator tests with the machine at load 23 (both pass alone; their
timeouts are now 240 s). Published. The watching pass is only partly done:
`docs/swarm/animation-polish.md` lists what is still unwatched (benches,
birds, boats, smoke, beam, sails, flags, clock, lamps, windows, bounce,
wobble, pop-in). Second pass sent to the same agent.
Running: polish (speed), guide, steady-ink, animation-polish pass 2.

**Polish merged** (`f20fc9b`, Opus 5.5): incremental town logic
(per-structure facts and local rules reused across resolves, with an
equivalence test over 360 random edits), cell-by-cell path meshes, phone
bench (`node tools/phone-bench.mjs`), and all small fixes (walls on pitched
roofs, bunting glow, L20 rower, fishing-boat route, bench tool, sound off
by default, soft cloud shadows). Orchestrator fix at merge: the new caches
ignored `Block.style` (added to content keys and `sameWorld`).
**The guide merged** (`613d9ec`, Opus 5.5): 44 entries plus the Auto block,
45 pictures (986 KB) in `public/guide/`, proof test per recipe.
Full check green: 1,480 tests. Published. Follow-up sent to the guide
agent: garrison and rider entries. Running: steady-ink, animation-polish
pass 2, guide follow-up.

**Guide follow-up merged** (`1e821fa`): Garrison and Rider entries, 47
pictures (1,052 KB) re-rendered. Full check green: 1,485 tests. Published.
Found by the guide agent and sent to animation-polish: a lone keep gets no
garrison (no gate is found), and the rider is only drawn when a plaza
exists; both contradict catalogue L36/L37.
Running: steady-ink, animation-polish pass 2.

**Four more requests from Derek, specced (commit `b6c3910`) and dispatched:**
- Rivers and varied islands (gentle, hilly, steep, archipelago), rock tops,
  `World.terrainGen` so old towns keep their island → new Opus agent on
  `swarm/terrain2`. After it merges, Grow a town needs a third pass
  (bridge rivers, build on steep islands).
- House style did not let him build an inn or manor (same roof, different
  wall colours, so blocks never merged) → house-styles agent resumed: each
  style gets a signature wall colour so houses of one style join.
- Night: lights should go out through the night, silhouettes in lit windows
  (catalogue L07 rewritten) → animation-polish agent.
- Fireflies removed entirely → animation-polish agent.
Running: steady-ink, animation-polish pass 2, house-styles fix, terrain2.
Not started: discovery rounds (Stage 5), final art pass (Stage 6).

**Animation polish pass 2 merged** (`aca629f`): calmer Grow-a-town
playback, rows no longer jump, door glass follows who is home, pigeons land
cleanly, fishing boat banks, troop reads as two files, rider sits astride,
lone keep gets its troop, rider cases for no plaza and no street. The agent
is still running on the night-windows and fireflies items.
**Steady ink merged** (`7224daf`): flicker on camera motion cut (mean blink
score 0.103 → 0.015): coplanar tie-break per ink group, tighter near and far
planes, four samples for thin lines, pen wobble anchored to the drawing,
wave marks fixed to the water. Costs about 1 ms a frame at 1280 × 800 at 2×.
Tools: `node src/render/testing/flicker.mjs`, `coplanar.mjs`. Remaining
coplanar overlaps listed in `docs/swarm/requests/steady-ink.md` → new Opus
agent `swarm/coplanar`.
Full check green: 1,500 tests. Published.
Running: animation-polish (night windows, fireflies), house-styles fix,
terrain2, coplanar.

**House styles fix merged** (`570dd8a`): each style has a signature wall
colour (Harbour cream, Thatch pink, Tudor peach, Manor yellow, Farm blue,
Villa mint), so houses of one style join; inn and manor proven by real
clicks in a browser test; ghost frames the building a block would join.
Full check green: 1,508 tests. Published. Follow-ups sent to the same
agent: houses must join across a one-level terrain step; R-H05 boathouse
must not pre-empt inn, manor and town hall for big houses. Known limit,
left as is: a row of identical same-style houses joins into one building
(workaround: a different swatch colour per house, or gaps).
Running: animation-polish (night windows, fireflies), terrain2, coplanar,
house-styles follow-ups.

**Night windows and firefly removal merged** (`b6ead9e`): houses put lights
out through the first half of the night until about one in six stays lit;
inns stay lit; silhouettes (four at most) in lit windows; a held night
still changes; fireflies deleted everywhere. Cause of "all lit": the sun
button held the night at its midpoint while homes went to bed at a random
30–85% of the night. Full check green: 1,509 tests. Published.
Still open from animation: gust front not visible; everything-town troop
has no loop; bell small; gulls, small birds, sailboats near piers and the
rower's route not watched.
Running: terrain2, coplanar, house-styles follow-ups.

**House follow-ups merged** (`5f45fbb`): a house joins a same-colour house
one level up or down in a side-adjacent column (step must be terrain,
marble, arch, dock or pillar; never across two levels or diagonally);
storeys counted on the tallest column; R-H05 boathouse limited to footprint
≤ 4 and ≤ 2 storeys. Full check green: 1,515 tests. Published. Split-level
houses draw with a separate roof and door per level (stepped look); a
continuous roof across a step is not built.
Running: terrain2, coplanar.

**Link previews added by the orchestrator:** Open Graph and Twitter card
tags in `index.html`, `public/og.jpg` (1200 × 630, 240 KB, a render of the
`everything` town with a title tag), favicon and touch icon. Verified live:
tags and image served; a share link made on the public site reopens the
same town in a fresh browser. Per-town preview pictures are not possible on
GitHub Pages (crawlers run no scripts and never see the `#t=` part).
**Walk mode requested by Derek** (design section 7 "Walk mode") → new Opus
agent on `swarm/walk`.
Running: terrain2, coplanar, walk.

**Walk mode is a PREVIEW ONLY (Derek):** do NOT merge `swarm/walk` into the
main branch and do NOT publish it until he has tried it locally and said
yes. When the agent reports, serve its worktree on a separate local port
for him. Scope trimmed to: perspective camera and ink, basic walking,
enter and exit.
**Big ships requested** (catalogue L38–L42: galleon, cog, galley, river
barge, passing sails) → new Opus agent on `swarm/ships`.
Running: terrain2, coplanar, walk (preview), ships.
