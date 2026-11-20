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

**Welcome card added by the orchestrator** (`src/ui/welcome.ts`): first
visit to an empty island shows "Try growing a town… or build your own" with
Grow a town and Build my own; once per browser (`lc:welcomed`). Tools and
tests mark it seen by default (`openPage(..., { welcome: true })` shows it).
**Terrain 2 merged** (`4f3b52c`, Opus 5.5): generator 2 with four island
characters and rivers (measured over 500 seeds: gentle 48%, hilly 28%, steep
13%, archipelago 11%; no river 19%, one 62%, two 19%), rock tops, scree, one
ledge on tall cliffs, `World.terrainGen`, share codec v3. Generator 1 pinned
by digest; existing scenarios pinned to generator 1. Full check green:
1,551 tests. Published. Follow-ups: river look from the overview (same
agent), Grow a town pass 3 for rivers and steep islands (grow-town agent).
Running: coplanar, walk (preview only), ships, terrain2 follow-up,
grow-town pass 3.

**Welcome changed** to a small closable note beside the menu button (Derek
did not want it centred or blocking). Published.
**Grow a town pass 3 merged** (`df16da5`): the street router crosses water
with stone bridges (up to 6 water columns, equal banks), boardwalks between
beaches (up to 12), and climbs cliffs of 2–6 levels on stepped marble; a
riverside district (willows, reeds, boathouse, two barge landings); a
galleon berth sought in the harbour; a small 3×3 square on cramped islands.
Generator-2 towns: 196–444 blocks, 40–61 roles each, a stone bridge on
every river island. Full check green: 1,564 tests. Published.
Still weak: one or two districts per town left without a street; no bridge
between banks of unequal height; no viaduct or sky bridge between steep
shelves; cog berth not built separately.
Running: terrain2 follow-up (rivers from the overview), coplanar, ships,
walk (preview only).

**Terrain 2 follow-up merged** (`ce6a721`): rivers about two wide with
stronger meanders, straight-cut diagonal banks, a river water material and
shader pattern (teal tint, flow marks, bank line, shallows fan at the
mouth), sand spits, visible gorges, calmer gentle islands, stump removal;
K3 lighthouse counts sea water only (three lines in `src/resolve/kinds.ts`).
GENERATOR-2 ISLANDS CHANGED FOR EXISTING SEEDS (public for a few hours):
towns saved or shared on a generator-2 island since then may not fit their
island. Full check green: 1,568 tests. Published.
Open: terrain rebuild p95 30 ms on a steep island (budget 8); banks are
angular, not curved; a free-standing 2×2 summit block can remain.
Running: coplanar, ships, walk (preview only).

**Coplanar cleanup merged** (`722c124`): overlaps removed at the source
(everything 130 → 1, grown-town-1 231 → 1, people-town 82 → 0), regression
test `src/render/testing/coplanar.test.ts`. Flicker scores unchanged (the
tie-break already settled these pairs). Orchestrator added a TEMPORARY
allowance for pairs introduced by Grow a town pass 3 (dock/dock, arch/dock,
marble/marble, arch/marble) → follow-up sent to the same agent, with the
doubled stilt-house ladder (R-H04). Full check green: 1,576 tests.
Published.
**Walk mode preview ready** (`swarm/walk` at `1ec9159`, NOT merged, NOT
published): served from its worktree at http://127.0.0.1:5174/ (try
`/?walk=everything`, `/?walk=grown-town-2`). Waiting on Derek's verdict.
Running: ships, coplanar follow-up.

**Walk preview feedback from Derek ("alright"):** cannot look in some
directions; trees block him completely (should pass through); wants
Minecraft-style flying (double-tap Space; Shift up, Control down); the
glide in looks wrong and must not pass through things (glide out is good).
Sent to the walk agent. Still preview only, still served at port 5174.
Running: ships, coplanar follow-up, walk (preview fixes).

**Two more from Derek:** doormats are badly broken with overlaps (D11) →
added to the top of the coplanar agent's follow-up, with a prop scan;
people walk through each other → animation-polish agent resumed to add
local avoidance with a no-overlap test.
Running: ships, coplanar follow-up (doormats first), walk (preview fixes),
animation-polish (people avoidance).

**Big ships merged** (`3cbedfe`, Opus 5.5): L38 galleon, L39 cog, L40
galley, L41 river barge, L42 passing sails; berths found by sailing a hull
in and out; one big ship at sea at a time; small boats give way; guide
entries for galleon, cog and galley. Full check green: 1,610 tests.
Published. In the grown-town scenarios: galleon calls at 1, 6 and 7; cog
and galley also at 4; none at 2 and 5 (no berth); the river barge fires in
none of them (no pair of river docks 10 apart by water qualifies).
Open: fishing boat only slows for ships, rower ignores them; barge under a
bridge untested; rigging busy at overview.
Running: coplanar follow-up (doormats first), walk (preview fixes),
animation-polish (people avoidance).

**Boat rules rejected by Derek** ("I just want boats"): no thresholds or
prerequisites; any dock space brings whatever boat fits; nothing shrinks or
fades; boats leave and arrive through an invisible barrier at the map edge,
cut off cross-section-wise. Catalogue section "Boats and ships" rewritten
(`eca4f0c`); ships agent resumed to rework L17–L20 and L38–L42, the guide
entries, and add edge clipping in the renderer.
Running: ships rework, coplanar follow-up (doormats first), walk (preview
fixes), animation-polish (people avoidance).

**Walk preview, second version** (`swarm/walk` at `368a554`, still NOT
merged): free look (pitch was capped at 70°, drag stopped at the screen
edge, two handlers fought); collision against solids only (trees are a slim
trunk; one-level hop up); Minecraft-style flying (double-tap Space; Shift or
Space up, Ctrl or C down; Alt or double-tap W to sprint); glide in comes
from above along a checked clear line; near fade fixed. Full `npm run check`
not re-run on that branch. Served at http://127.0.0.1:5174/. Waiting on
Derek.

**Doormats and overlap follow-up merged** (`efd2a21`): D11 mats placed on
the surface outside the door (0.008 slab, 0.004 proud, sized to the door,
clear of the leaf, none where there is no flat spot), props now in the
coplanar scan, R-H04 ladder only on the lowest stilt house, picket scribble
traced to a doubled garden corner post and fixed, temporary allowances
removed. **People avoidance merged** (`6734299`): keep right, overtake,
give way, walk round people standing; sustained overlaps over 7.5 minutes:
people-town 121 → ~20, everything 162 → ~80, dense square 131 → ~27;
remaining ones are squeezes at single-file spots. Generator timing tests
loosened to 900 ms (shared machine). Full run: 1,636 of 1,637; the one
failure (shots CLI) is a timeout at load 20 and passes alone. Published.
**Seasons and weather requested** (design section 13a) → new Opus agent on
`swarm/seasons`.
Running: ships rework, seasons and weather. Walk preview awaiting Derek.

**Boat rework merged** (`963d4fa`): fit is the only test; rowboats at every
dock (cap 14 desktop, 8 phone); big ships take turns at the three longest
quays; sailboats and a passing tall ship on every island; barge on any
river dock; boats arrive and leave through the map edge, cut per pixel with
a filled, inked cut face; nothing shrinks or fades (tests). Full check
green: 1,640 tests. Published. Open: new small boats on a live town still
appear in place; gangplank, sailors and goods still vanish at the hatch;
town birds, balloon and clouds not checked at the edge.

**Stage 4 closed. Stage 5 (discovery) started**, at Derek's prompting, in
parallel with seasons: round 1 explorer on Opus 5.5 (`swarm/discovery-1`)
builds towns and writes proposals to `docs/swarm/discovery/round-1.md`;
the orchestrator curates; one builder implements.
Running: seasons and weather, discovery round 1 explorer. Walk preview
awaiting Derek (served at port 5174 until its two-hour limit).

**Discovery round 1 curated.** Explorer report merged
(`docs/swarm/discovery/round-1.md`: 12 towns, 66 proposals). Accepted and
split between two Opus builders:
- `swarm/disc1-structures` (ids R-*, J-*): faults FX-01 (podium not keep),
  FX-02 (inn and shop glut), FX-05, FX-06, FX-08, FX-09, FX-10, FX-11,
  FX-12; roles RC-01 churchyard (+FX-07), RC-02 warehouse, RC-03 watermill,
  RC-05 inhabited bridge, RC-06 smithy, RC-07 theatre, RC-08 obelisk, RC-09
  barn, RC-13 stoa, RC-14 bandstand, RC-16 cathedral, RC-19 schoolhouse,
  RC-21 folly tower.
- `swarm/disc1-fill` (ids U-*, D-*, L-*): faults FX-03 (fingerposts), FX-04
  (lamps in the country); RC-04 orchard, RC-12 market cross, UF-01 to UF-05,
  UF-08 to UF-12, DC-01, DC-03, DC-06, DC-07, LF-01 wedding, LF-02 market
  day, LF-03 ferry, LF-04 shepherd, LF-05 night watchman; NP-01 hedge edge
  piece last, if time.
Deferred: NP-02 placeable water, RC-10, RC-11, RC-15, RC-17, RC-18, RC-20,
UF-06, UF-07, UF-13, UF-14, DC-02, DC-04, DC-05, DC-08, LF-06 to LF-09.
Running: ships (several at once), seasons, disc1-structures, disc1-fill.

**Derek's priority (stated 2026-11-19):** interactions and a town that
feels alive matter more to him than unique buildings ("I love how the boats
have people who unload stuff"). Third discovery builder launched on Opus:
`swarm/living-town` (work chains with carried goods: bread, fish, harvest,
water and washing, trade from the quay; builders arriving when a house is
placed; daily rhythm; wedding, market day, maypole dance, shepherd, night
watchman; L-* ids from L50). The fill builder dropped its life events and
emits sockets for it.
Running: ships (several at once), seasons, disc1-structures, disc1-fill,
living-town. Walk preview awaiting Derek.

**Several big ships at once merged** (`31871fd`): a quay is split into
berths a galleon long; every berth gets ships (cap 8 desktop, 4 phone;
rowboats 24/12; sailboats up to 5); lanes shared by a look-ahead check,
arrivals wait beyond the edge, leavers go first; sailors, goods and
gangplank no longer vanish; new rowboats, sailboats and the fishing boat
come in from the edge. Full run under load (five agents): 8 timeouts; all
8 files pass when run serially (91 tests). Published.
Open: in the app the "already moored at open" fill does not happen, so a
big harbour shows 3–5 big ships in its first minutes; a ship whose quay is
erased can hold ~40 s before leaving; dressing p95 39.7 ms (budget 30) when
an edit changes the sea; rower and barge still appear in place.
Running: seasons, disc1-structures, disc1-fill, living-town.

**Mischief requested by Derek** (player-triggered destruction: fire, bomb,
Viking raid): design section 13b written; new Opus agent on
`swarm/mischief`. Touches saves (`Block.ruin`), the tray (a Mischief
drawer), people (bucket chain, fleeing, rebuilding), ships (longship).
Running: seasons, disc1-structures, disc1-fill, living-town, mischief.
**Mischief is EXPERIMENTAL (Derek): preview only.** Do NOT merge
`swarm/mischief` or publish it until he has tried it locally and said yes
(same treatment as `swarm/walk`). Serve its worktree on a local port when
the agent reports. The design section 13b is on the main branch as a spec
only.

**Seasons and weather merged** (`6885a22`, Opus): the year turns (24 min a
season), autumn trees, bare winter trees, snow falling and settling as
shading, ice, rain, mist, storms, festival lights and a tree in the square,
season and weather buttons. Conflict with the ships' edge cut in
`src/render/index.ts` and `shaders/surface.ts` resolved by hand (both
kept; the bare-tree material swap now skips the movers pool, which would
otherwise have lost its edge cut). Full run: 1,696 of 1,697; the one
failure (shots CLI) is a load timeout and passes alone. Published.
Not done by the seasons agent: people in winter clothes and umbrellas,
seasonal props (stooks, pumpkins, snowman, icicles, leaf drifts), candles,
rainbow, tracks in snow, weather sounds; spring is weak; full snow by day
is flat white; festival bulbs tiny at overview. Follow-up NOT yet sent
(machine is saturated; send when an agent slot frees).
**Derek: terrain must be editable** ("pretty important") → design section 6
"Shaping the land"; new Opus agent on `swarm/landshaping`.
**Derek: boats overlap each other and the river barge passes through
bridges** → ships agent resumed.
Running: disc1-structures, disc1-fill, living-town, mischief (preview),
landshaping, ships fixes.

**Living town merged** (`ed2e2b3`, Opus): L50 scuffle (dust cloud, grawlix
balloon, watchers, dazed ending), L51 bread, L52 water, L53 the catch, L54
builders at a newly placed house, L55 night watchman, L56 market day, L57
wedding; an errand engine in `src/life/town/`; guide group "Days the town
earns". Full check clean: 1,726 tests. Published. Second pass sent to the
same agent: bigger loads at wide zoom, trade carts from the quay, harvest,
laundry, a dog, the watchman breaking up scuffles, the fill builder's
sockets, temporary stalls on the walking graph.
Running: disc1-structures, disc1-fill, mischief (preview), landshaping,
ships fixes, living-town pass 2.

**Boat fixes merged** (`a7b149d`): no two floating things overlap (test
`src/life/ships/afloat.test.ts` over six towns, five minutes each); the
barge treats arches at the water and decks one storey up as blocked, stays
inside river water (river material, or water ≤ 3 wide for ≥ 6), poles back
without turning; rowboats get waiting places clear of berths and lanes.
Full check clean: 1,783 tests. Published. Side effect: grown-town-4 and -7
get no barge (low bridges cut their river docks off). Only the rowboat cap
scales with free water so far.
Running: disc1-structures, disc1-fill, living-town pass 2, mischief
(preview), landshaping.

**Shaping the land merged** (`b046809`, Opus): Raise, Dig and Level in the
Nature drawer; `World.terrainEdits`; one `land` edit type; things ride their
column; water classified as sea, river or pond (`MAT_POND`); share codec
v4 = v3 + flags + length-prefixed sections (bit 0 land; mischief should use
bit 1). One conflict in `src/life/people/crowd.ts` resolved (both lines
kept). Full check clean: 1,837 tests. Published.
Over budget: town logic after a land edit 12.1 ms (budget 8); a 20-column
stroke frame 28 ms rebuild; steep-island worst chunk 34 ms. Weak: one-wide
dug channels look thin; brush-raised hills are square-stepped; water does
not visibly flow in. The six play-throughs were built as scenarios, not
clicked by hand.
**Mischief Phase A ready as a PREVIEW** (`swarm/mischief` at `b9bdb78`, NOT
merged): torch, bomb, mallet, mend; staged damage; ruins of every kind;
repair scaffolding and crew assets. Served at http://127.0.0.1:5175/
(`/?seed=4242&mischief`). It also uses codec version 4 → will conflict with
landshaping's v4 on merge (move ruins to flag bit 1). Waiting on Derek.
Running: disc1-structures, disc1-fill, living-town pass 2.

**Living town pass 2 merged** (`91cb203`): loads 1.65× and carried high,
growing with camera distance; faster bread; scuffles broken up by the
watchman or a guard; L58 quay trade with handcarts; L59 harvest; L60
laundry out and in (rain); L61 dogs; gulls over the catch. Timeouts in the
full run passed serially.
**Discovery 1 structures merged** (`122437b`): R-M08 podium (temples and
stairs no longer keeps; garrison needs a real castle), inn and shop limits
(grown towns: shops 31–58 → 3–26 per town; inns 1 each), chapel roofs,
churchyard, warehouse, watermill, bridge-shop, smithy, theatre, obelisk,
barn, stoa, bandstand, schoolhouse, folly-tower. Not reached: cathedral.
**NOT PUBLISHED: 3 tests fail at the seam** (L51.bread fixture has nowhere
to sell; a scuffle test; people-town overlaps 41 > 30). Sent to the
living-town agent; publish when it reports green. Last published build:
land shaping (`3fb3f2e`).
Running: disc1-fill, living-town (integration, then the new buildings).
Previews awaiting Derek: walk (`swarm/walk`), mischief (`swarm/mischief`,
served at port 5175).

**Discovery 1 fill merged** (`0eb2a5f`): fingerposts 38/22/27 → 2/3/3 in
grown towns; farm-lane lamps 22 → 5; U13 country lanes, U14 back gardens,
U15 village green, U16 shops in the wall, U17 drying green, U18 orchard,
U19 stair forecourt, U20 quay apron, U21 castle bailey, U22 ford, U23
belvedere, D35 stair guardians, D36 shrine, D37 market cross, D38 rope
swing. Guide conflict resolved by hand; guide picture budget raised to 3 MB.
**All three discovery branches are on the main branch but it is RED:**
7 unit failures at the seams (L51.bread, U16 fixture, scuffle test, two
solid.test overlap bounds, two crowd.test cases). Living-town agent has the
people ones; fill agent has U16. DO NOT PUBLISH until `npm test` is green.
Last published build: land shaping (`3fb3f2e`).

**Discovery round 1 fully merged and PUBLISHED** (`28717dd`): living-town
integration (`0904e3b`: any shop bakes, hands keep their load, café seats;
L62 school, smithy, theatre, bandstand, vendors, maypole, orchard pickers)
and fill follow-up (`ed8972d`: booths and vault doors agree, the podium
scene, drying lines join washing day, orchard fruit trees). Orchestrator
removed a market-cross guide entry duplicated by the merge. Full check
clean: 1,950 tests. NP-01 hedge not built (needs frozen core kinds).
**Derek's new list (20:30), dispatched:**
- Mischief (liked; stays UNMERGED; revise): bigger real chunks, better fire
  (attached, not floating cut-outs), smoke that fuses, Mend progressive and
  automatic over time, people respond (firefighters with hoses, bucket
  chains) → mischief agent.
- Bug: new houses get festival lights out of season; sliders for time,
  season, weather with gradual transitions → seasons agent (plus its
  pending follow-up).
- Bug: Level tool does not work → landshaping agent.
- Bug: the sweeper's broom is not in her hands → living-town agent.
- New: Field ground piece (basketball, tennis, grass pitch by shape) with
  people playing → new Opus agent `swarm/field`.

**Orchestrator: nothing-in-hand state** (Derek): clicking the selected
tray piece again, or Escape, puts it down (`TrayState.idle`): no ghost, no
placing or erasing, wheel zooms; test `tests/e2e/idle.e2e.test.ts`. Not yet
committed or published: the full check was still running under load.
**Derek: harvest must really cut the wheat** (no flat overlay, no smoke) →
living-town agent (after the broom fix).
**Derek: bigger islands** (3–4× the map, size chosen at New island, varied
regions) → new Opus agent `swarm/big-islands`, PREVIEW: study, prototype
and measurements first; do not merge without his say.
Running: mischief (preview), seasons, landshaping, living-town, field,
big-islands (preview).
**Nothing-in-hand state committed and published.** Test helpers in three
e2e files no longer re-click a selected piece (that now deselects). New
tests by other agents must do the same. `traffic.test.ts` timeout 300 s
(machine at load 32). Full run under load: only load timeouts; affected
files pass serially. Mischief preview server (5175) hit its two-hour limit.

**Land shaping fixes merged** (`619e367`): with a land tool held a plain
drag on land shapes it (drag on the sea turns the camera); Level brings
every column to the start height in one stroke; soft-edged brush; foam
rushes into dug columns; real-mouse tests on slopes and six play-throughs.
Conflict in `src/ui/interface.ts` resolved (both hints kept; idle respected).
**Seasons follow-up merged** (`ca6d5bb`): festival props no longer shown by
the pop-in out of season (cause: F05 pop-in called setVisible(true));
`src/ui/slider.ts` sliders for time, season, weather; eased transitions;
swept streets in snow; bulbs ≥ 2 px; spring blossom; coats, hats,
umbrellas; a snowman. Unit tests 1,890 green; all e2e green serially (two
load failures passed alone). Published.
Running: mischief (preview), living-town (broom, harvest, tool audit),
field, big-islands (preview).

**Mischief revision ready as a PREVIEW** (`swarm/mischief` at `786a5e6`,
NOT merged; merged with main; ruins use save-section bit 1): rooted layered
flames, fused smoke and dust, whole-part chunks, 32-step mending with crews
that rebuild on their own (Rebuild switch), fire brigade with pump cart,
hoses and a bucket chain, people fleeing and watching, falling windmill
sails, sounds. Served at http://127.0.0.1:5175/?seed=4242&mischief.
Raid not started. Waiting on Derek.
**Test diet launched** (`swarm/test-diet`, Opus): Derek asked to cut the
bloated suite: profile, shrink sweeps, drop duplicates and wall-clock
assertions, fast `check` and `check:full` tiers.
**Source is NOT pushed:** the working branch on GitHub is still the old
spike commit; only `gh-pages` (built site) is pushed. Derek asked to see
the code; offered to push the branch and open a PR: awaiting his word.
Running: living-town, field (finishing), big-islands (preview), test-diet.

**Bigger islands: first report (PREVIEW, `swarm/big-islands` at `a11ddd6`,
NOT merged).** Sizes 48 / 72 / 96 as a world property; key packing extended
above bit 16 so 48-column keys are numerically unchanged (digest of 281
scenarios, 40 islands ×2 generators, 12 grown towns identical to base);
save section bit for size. Drawing holds: 96 with 9,861 blocks runs 56–60
fps (frame cost ~14 ms). Editing does not: shape stage 43–45 ms and
dressing 109 ms per edit at 96 (20 / 44 ms at 72), because every edit
re-resolves the whole town; grown towns are smaller (1,288 blocks at 96:
edits 22–31 ms, worst frame 83–100 ms). Recommendation: offer 72 on
desktop; hold 96 until town logic resolves by region. Served at
http://127.0.0.1:5176/?seed=5&size=96 (or size=72).
CONFLICT TO SETTLE BEFORE ANY MERGE: big-islands takes save-section bit 1
for size; the mischief preview also took bit 1 for ruins.

**Playing field merged** (`ebedee4`): Field floor kind; shape table in
`src/rules/roles/field.lib.ts`; basketball, tennis, football, bowls,
boules, croquet, races, kickabout. **Living town merged** (`1eb67dd`):
broom held in both hands (`src/parts/people/hands.ts`), wheat really cut
row by row with stooks, all tools and loads in hand. Conflicts in
`extras.ts` and `people.system.ts` resolved by hand. Unit tests 1,966
green; core browser tests green serially. Published (`42a072d`).
**SOURCE PUSHED to GitHub** at Derek's word: branch
`yaoderek/bloom-s-monkey-city-builder` → origin at `42a072d` (fast-forward
from the old spike commit). `main` untouched. No PR opened.
**Derek's decisions:** mischief: one more local iteration (cart and hose
arrive physically, continuous water jet, mending on every damaged building
by itself, a nuke with mushroom cloud and crater), then merge and push;
bigger islands and walk mode stay experimental (unmerged previews).
Running: mischief (final iteration), test-diet.

**Derek: Grow a town must choose and have flavour** (it still builds the
old stair-and-temple and ignores the new buildings) → grow-town agent
resumed for pass 4: town characters (great harbour, marble city, castle
town, market and townhouse town, river town, farming village, hill town,
games and gardens), a budgeted plan that drops districts instead of
squeezing them, composed marble ensembles, coverage across seeds rather
than within one town, no wall-clock test assertions.
Running: mischief (final iteration), test-diet, grow-town pass 4.

**MISCHIEF MERGED AND PUBLISHED** (`9ea58b4`, at Derek's word after the
final local iteration): torch, bomb, nuke, mallet, mend; staged damage and
ruins saved as section bit 1; fire brigade with a parked pump cart, hose
paid out along the walked path, continuous jet; every damaged building
mends itself (crews speed it up); nuke with crater via terrain edits.
Unit tests 2,013 green; core browser tests green serially. Source pushed.
**Derek on the nuke (after merge):** it has no asset of its own and the
mushroom cloud "looks pretty bad… super goofy": wants a fast shockwave
first, then a fireball that rises quickly into a mushroom cloud, settles
into smoke and dissipates, like nukes in video games → sent to the
mischief agent.
Note for big-islands (experimental): mischief owns save-section bit 1; the
size section must move to bit 2 before that branch could merge.
Running: test-diet, grow-town pass 4, mischief (nuke redo).

**Test diet merged** (`6d9bfeb`, Opus). `npm run check` is the merge gate
(typecheck, lint, unit tests, THEN browser tests on one shared server);
`npm run check:full` (`LC_FULL=1`) adds big sweeps, long simulations,
timing budgets and extra CLI runs. Helper: `tests/helpers/tier.ts`
(`FULL`, `sized()`). Coplanar scan grid-based (137 s → 8 s). One browser
file deleted (`app.e2e`). Gate on the merged build: 2,086 passed, 9
skipped; 159 s and 288 s in two runs at load ~25 (was 10+ minutes with
timeouts). Orchestrator fixed the new codec pin test (it iterated current
kind lists; the Field floor kind appended since then changed the town).
Rules for everyone: no wall-clock assertions in the gate; one expect per
seed; wait on state, not sleeps; pages close at the end of their test.
Pass on to the people agent: crowd.test.ts mean-step-time assertion →
full tier; route.test.ts assert on search count; drop 120 s timeouts in
solid.test.ts. Open question for logic: the incremental content key's
resolved-kind part is untested (or redundant).
Running: grow-town pass 4, mischief (nuke redo).

**Grow a town pass 4 merged** (`08b8b96` → merge `df3a0b9`, Opus). A town
now has a character rolled from the seed and weighted by what the island
offers: harbour town, marble city, castle town, market town, river town,
farming village, hill town, garden town; a second character flavours it.
A budgeted planner builds each character's list in priority order; the
marble city gets the forum (temple on a podium, basilica, obelisk,
rotunda, grand steps). Banner names the town ("A marble city is
growing."); the dice avoid repeating the last character. Survey test:
seeds 1–30 on both generators, every character rolled, promises kept
(≤15 % misses), every placeable role and guide entry appears somewhere.
`grown-town-1..7` are frozen legacy replays
(`scenarios/core/grown-town-legacy.ts`); new `grown-<character>`
scenarios. Conflicts resolved by hand: `townmaker.test.ts` (pass 4's
survey; the old wall-clock test is gone), `interface.ts` (kept
`mischief.undo()` in `grow`). Gate: 2,104 passed, 8 skipped, 196 s.
Published `df3a0b9`. Caveats from the agent: marble city is rare (4 of
60 towns); the forum stair may face away from the default camera; hand
pump vs fountain still waits on Derek.
Running: mischief (nuke redo). Unmerged experiments: walk, big-islands.

**After pass 4 (orchestrator).** Derek: "I don't see the grown town update
at all". The build was live (checked in a fresh browser: banners name the
town), but eight dice rolls gave only market, river and castle towns.
Two changes: the marble city's weight raised (expected share about 17 %
on generator 1, 9 % on generator 2; was 3 of 60), and the dice now work
through every character that suits an island before repeating any
(`GrowOptions.avoid` is the list shown so far; `never` is the planner's
own marble fallback). A first roll with nothing shown is unchanged, so
the scenarios and survey are as before. Gate: 2,106 passed, 8 skipped.

**Nuke redo merged** (`2c5cce7`, Opus). Its own casing and tray icon; a
white-out; a shockwave ring with a dust wall (damage arrives with the
ring, in 0.2 s batches; trees fall away from the middle, direction saved
with the damage); a fireball that rises on a stem into a rolling cap,
dies to dark smoke, goes grey and drifts off over about 40 s; firelight on
the town; a scorched crater; crack, boom, rumble. Timing in
`src/life/mischief/nuke-timing.ts`, drawing in `nuke.system.ts`. Gate:
2,107 passed, 8 skipped. Agent's own caveats: the cloud still reads as
outlined puffs, not one billowing mass; fire can look like flat red
tiles mid-way; the town glow has a visible oval edge; the second of the
bang runs at about 46 fps in a grown town (redrawing the flattened town,
not the cloud); the white-out was not checked in pictures.
Running: nothing. Unmerged experiments: walk, big-islands.

**Derek after pass 4 and the nuke redo (2026-11-20).**
- Bug: a new island keeps the old island's scorch marks and burning
  windows; bug: automatic mending skips buildings over water → mischief
  agent (`ac4e8c4f1f7628058`, `swarm/mischief`), resumed.
- Grow a town: far too few trees (wants forests, orchards); each
  character must be unmistakable, not one token piece (farming village
  with several farms and fields, castle town with walls everywhere, port
  town with several quays, more marble through the marble city) → grow-town
  agent (`a5aa1417a439de127`, `swarm/grow-town`), pass 5, resumed.
- He was confused by the two grow buttons. Orchestrator: the entry is
  now "Grow a town here" and grows a different kind of town each time on
  the same island; the dice are "New island with a new town" (`4045a25`).
Running: mischief (two bugs), grow-town pass 5.

**Carry-over fix merged** (`6054819`, Opus; Derek: urgent). Root cause:
when the town is replaced the life layer is rebuilt and each mischief
part must remove what it drew; the burning-window glows and the nuke's
finished scorch were never removed. Now every mischief part keeps a list
of all it draws (`src/life/mischief/owned.ts`) and drops the lot on a
town change or undo. New tests: `carryover.test.ts`,
`tests/e2e/mischief.e2e.test.ts`. Orchestrator checked in a browser:
nuke, 75 s, New island → nothing drawn, clean island. Gate: 2,110
passed, 1 timeout under load 24 (`tests/terrain2-town.test.ts`, the
minute of life; 12.7 s and passing alone). Not covered by tests: open a
town file, share link, grow on the same island (code only).
Running: mischief (mending over water), grow-town pass 5.

**Grow a town pass 5 merged** (`a7cd292`, Opus). Every character repeats
its signature (`src/townmaker/districts/emphasis.ts`): farming up to
three wheat farms, barns, orchards, paddocks, greenhouses; harbour up to
four more quays, piers, a fish market; castle a town wall with gateways
and corner towers, walled towers, watchtowers; marble shrines,
colonnades, obelisks besides the forum; market more market places;
river willows, watermills, bridges; hill cliff houses, stairs, viaducts;
garden parks with bandstands, walled gardens, avenues. Woods on bare
land, tree lines on outer streets, orchards in five characters (40–140
trees a town). Survey prints a signature count per character. Gate:
2,109 passed; 3 browser tests timed out on page load at load ~20
(interface, land-slopes, welcome), all pass serially. Orchestrator's
eye on the overviews: marble, harbour, castle, garden convincing;
farming better but the scenario seed shows one wheat field and a big
village core; river, hill, market weakest (agent agrees). Town wall has
gaps where houses stand on its ring.
Running: mischief (mending over water).

**Orchestrator's checkout moved (2026-11-20, about 00:35).** Another
session switched the workspace folder
(`/Users/yaoderek/conductor/workspaces/littlecity/prague`) to a new branch
`capture/promo` (brand and promo-capture work, its own agent worktree
`agent-a072417d202503b83`) and is working there with uncommitted files.
Two orchestrator commits landed on that branch by accident (the pass 5 run
log and the nuke-on-water fix); both were cherry-picked onto the working
branch. From here on the orchestrator works in
`/Users/yaoderek/conductor/repos/littlecity/.claude/worktrees/orchestrator`
(branch `yaoderek/bloom-s-monkey-city-builder`): merge, gate and deploy
from there, and leave the workspace folder to the other session. Lint in
the workspace folder fails on that session's `tools/capture/lib.mjs` and
`shots/drone.mjs`; not ours.

**Nuke on water (orchestrator, `a72c359`).** Derek: "the first nuke
seems to always do nothing". Cause: `blastPlan` returned no hits when the
point was water (river, pond, sea), so the cloud rose and nothing was
touched; 3 of 10 random grown towns have water under the middle of the
screen. Fix: the nuke plans with `wet: true` and always craters the land
round the point. Unit test in `engine.test.ts`; checked in a browser on
the three islands that were duds (337/346, 375/414, 380/405 blocks
ruined). Full gate not completed: load 40 (two agents, the other
session), only timeouts; typecheck, lint, mischief unit and browser
tests pass serially.
Running: mischief (mending over water, scorch fade), grow-town pass 5b.
