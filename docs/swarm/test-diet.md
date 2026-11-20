# Test diet (2026-11-19, branch `swarm/test-diet`)

The suite had grown to 1,976 tests in 130 files. A full `npm run check` took five to eleven minutes
and failed most runs on timeouts when other agents were busy. This note records where the time went,
what changed, and how to run the two tiers.

## Two tiers

| command | what it runs | when |
|---|---|---|
| `npm run check` | typecheck, lint, then every test at gate size: unit first, then the browser tests | every merge |
| `npm run check:full` | the same with `LC_FULL=1`: big sweeps, long simulations, timing budgets, review screenshots | before a release, overnight |
| `npm test` / `npm run e2e` | the unit or browser project alone (gate size; prefix `LC_FULL=1` for full) | while working |

What is behind the switch (`tests/helpers/tier.ts`: `FULL`, `sized(fast, full)`, `test.runIf(FULL)`):

- **Bigger sweeps, same invariant.** Incremental resolve: 30/8/50/45/36 edits in the gate, 300/60/150/150/120 in full.
  Path cells: 60 or 120 edits. Grow a town: seeds 1–12 or 1–50, on both generators. Generator-2 towns
  (`tests/terrain2-town.test.ts`): 5 or 10 islands of each character, 30 s or 60 s of life. Floating
  things never overlap: 3 towns or 6. Land tools on slopes: 1 Level seed or 3. Seeds are the same,
  so the gate runs the first part of each full run.
- **Long simulations.** Busy harbour: ten minutes, full only. The other traffic runs (harbour fills,
  narrow channel, docks taken away, determinism) are in the gate and all check that no hulls meet.
- **Wall-clock budgets.** Grow a town under 200 ms (both generators), terrain chunk under 40 ms,
  thirty birds under 1 ms a frame: full only. The view's "same town again rebuilds nothing" now counts
  rebuilt structures and vertices instead of timing them, so it stays in the gate.
- **Pictures for people.** "How it looks" tests and the review screenshots in `land`, `held-length` and
  `land-playthroughs` write `.context/shots/*.png` only in full. They checked nothing beyond "no errors".
- **CLI paths.** The gate runs `shots` once and `inspect <scenario>` once. Full adds the night shot,
  the no-match error, the `inspect` overview, JSON and error paths, and the `bench` CLI.

The gate still covers: every rule and scenario `expect()` (all 281 scenarios, plus a determinism
check); the save and share codec (now with every kind pinned); a town failing to resolve; boats
(3 towns × 5 minutes, all traffic runs but one) and people (all people and town tests) in short
simulations; coplanar faces in all 13 dense towns; doormats in all 12; and every browser flow.

Timeouts: unit 60 s (300 s in full), e2e 120 s. A gate test that needs more than 60 s is too big for
the gate. Several per-file and per-test raises (60 s, 120 s, 240 s, 300 s) were removed where the test
became fast.

## Runner changes (`vitest.config.ts`, `tests/helpers/`)

- **Unit then e2e, never at once** (`sequence.groupOrder`). Thirteen Chromiums starting next to nine
  CPU-bound unit workers caused most of the load failures: `page.goto` timing out at 30 s.
- **Three browsers at a time** (`maxWorkers: 3` in the e2e project).
- **One dev server for every browser file** (`tests/helpers/e2e-server.ts`, a `globalSetup`;
  `startApp()` uses it through `inject('lcServerUrl')` and starts its own outside the project).
  Before, each file started a Vite server and transformed the whole app again on its first page load.
- **Pages close with their test.** `app.open()` called inside a test closes its context when the test
  ends (`onTestFinished`). Pages left open keep drawing a living town every frame and starved later
  tests: `land-slopes`' phone test failed after five other tests and passed alone. A page opened in
  `beforeAll` stays open for the file (view.e2e, land-playthroughs).

## Profile before (base `b83d78b`)

Measured with Vitest's JSON reporter. "Full run" is `npm run check` as the orchestrator runs it, with
other agents working (load 30–36): 641 s wall, 30 failures. "Unit alone" is `npm test` at load ~10.
Browser tests have no "alone" column; on a quiet machine they take about a tenth of the full-run time.

### Where the time went (sum of test durations)

| category | tests | full run (s) | share | unit alone (s) | share |
|---|---|---|---|---|---|
| browser tests | 82 | 1,938 | 51% | — | — |
| life simulations | 285 | 642 | 17% | 97 | 16% |
| mesh and coplanar scans | 264 | 327 | 9% | 209 | 35% |
| tool CLI tests | 4 | 316 | 8% | — | — |
| seed sweeps (islands, grown towns) | 38 | 294 | 8% | 112 | 19% |
| random-edit sweeps (incremental, land) | 11 | 200 | 5% | 113 | 19% |
| scenario runner | 563 | 33 | 1% | 44 | 7% |
| everything else | 729 | 67 | 2% | 22 | 4% |

### Fixed overheads

- Dev server start 0.07 s and Chromium launch 0.2 s (quiet machine), paid by each of 13 browser files.
  A page load was 1.7 s on a cold server and 1.0 s on a warm one. Under load with 13 servers starting
  at once, loads took over 30 s.
- Each CLI test spawns Node, which starts Vite (and for shots and bench, Chromium): 4–20 s a run
  quiet, over 120 s under load. The tools test ran nine of them.
- Scenario discovery (`import.meta.glob`, eager) once per worker that imports it. The scenario
  runner resolved each scenario three times: once for `expect()` and twice for the determinism check.
- Repeated town resolves across files: coplanar (13 towns) and D11 doormats (12 towns) each resolve
  and mesh the same dense towns. Files run in separate workers, so they cannot share them. The resolves
  were only 2–5% of either file; the coplanar scan itself was 95%.
- Vitest import and transform: about 13% of the full run.

### 40 slowest tests (before)

| # | test | full run (s) | unit alone (s) |
|---|---|---|---|
| 1 | `tests/e2e/tools.e2e.test.ts` > inspect CLI prints what town logic decided **(failed)** | 120.2 | e2e |
| 2 | `tests/e2e/tools.e2e.test.ts` > bench CLI reports both logic stages **(failed)** | 120.1 | e2e |
| 3 | `src/resolve/incremental.test.ts` > everything: 300 random legal edits | 71.2 | 62.8 |
| 4 | `tests/e2e/interface.e2e.test.ts` > a share link carries the town; … autosave | 64.3 | e2e |
| 5 | `src/world/land.property.test.ts` > grown town (generator 2): 160 steps | 61.8 | 8.6 |
| 6 | `src/life/ships/traffic.test.ts` > a busy harbour keeps moving | 59.3 | 4.9 |
| 7 | `tests/e2e/land-slopes.e2e.test.ts` > Level, seed 14 | 51.3 | e2e |
| 8 | `src/life/ships/ships.test.ts` > every nasty edit mid-visit **(failed)** | 49.4 | 2.4 |
| 9 | `src/life/ships/traffic.test.ts` > three berths sharing one narrow channel | 47.2 | 6.4 |
| 10 | `tests/e2e/tools.e2e.test.ts` > shots CLI writes a PNG | 46.4 | e2e |
| 11 | `src/render/testing/coplanar.test.ts` > everything | 46.1 | 29.8 |
| 12 | `tests/e2e/interface.e2e.test.ts` > a click is within 5 px; a drag orbits … | 45.3 | e2e |
| 13 | `src/terrain/terrain2.test.ts` > 500 seeds: every hard requirement … | 43.6 | 17.9 |
| 14 | `tests/e2e/land-slopes.e2e.test.ts` > phone: one finger drags Level **(failed)** | 43.3 | e2e |
| 15 | `tests/e2e/house-styles.e2e.test.ts` > the tiles draw in the swatch colour … | 43.2 | e2e |
| 16 | `tests/e2e/grow-town.e2e.test.ts` > on a phone: the entry is there **(failed)** | 42.2 | e2e |
| 17 | `tests/e2e/land.e2e.test.ts` > Level brings a stroke to the height it began at **(failed)** | 41.2 | e2e |
| 18 | `tests/e2e/gallery.e2e.test.ts` > the icon sheet shows an icon for every tray piece **(failed)** | 41.1 | e2e |
| 19 | `src/townmaker/terrain2.test.ts` > seeds 1 to 50: every edit legal | 41.0 | 7.2 |
| 20 | `tests/e2e/gallery.e2e.test.ts` > lists every generator, layer and scenario | 40.8 | e2e |
| 21 | `tests/e2e/interface.e2e.test.ts` > Shift + drag paints a run **(failed)** | 40.5 | e2e |
| 22 | `tests/e2e/welcome.e2e.test.ts` > it never blocks building **(failed)** | 40.1 | e2e |
| 23 | `tests/e2e/app.e2e.test.ts` > a scenario loads by URL, and the gallery lists … **(failed)** | 40.1 | e2e |
| 24 | `tests/e2e/house-styles.e2e.test.ts` > six ground clicks beside a square: one inn | 39.0 | e2e |
| 25 | `tests/e2e/guide.e2e.test.ts` > a house beside a three-tall tower ticks the chapel | 38.9 | e2e |
| 26 | `tests/e2e/guide.e2e.test.ts` > phone: the book button opens a full-height sheet | 38.8 | e2e |
| 27 | `tests/e2e/held-length.e2e.test.ts` > scroll zooms when the piece has no length | 38.7 | e2e |
| 28 | `src/townmaker/townmaker.test.ts` > seeds 1 to 50: every edit is legal | 38.0 | 8.2 |
| 29 | `tests/e2e/held-length.e2e.test.ts` > a pillar grows straight up **(failed)** | 37.5 | e2e |
| 30 | `tests/e2e/held-length.e2e.test.ts` > how a held run looks on a desktop | 34.7 | e2e |
| 31 | `tests/e2e/land.e2e.test.ts` > the Land group starts the Nature drawer … | 34.5 | e2e |
| 32 | `tests/e2e/held-length.e2e.test.ts` > phone: the stepper appears for a path **(failed)** | 34.0 | e2e |
| 33 | `tests/e2e/gallery.e2e.test.ts` > orbit controls turn the view; a slider … **(failed)** | 33.8 | e2e |
| 34 | `tests/e2e/guide.e2e.test.ts` > the book button opens a page beside the town **(failed)** | 33.5 | e2e |
| 35 | `src/life/town/town.test.ts` > L60: the washing comes in when it rains **(failed)** | 33.2 | 1.9 |
| 36 | `tests/e2e/house-styles.e2e.test.ts` > a 5 × 2 footprint in one style **(failed)** | 32.9 | e2e |
| 37 | `src/gen/floor/path-cache.test.ts` > warm builds equal cold builds over 120 edits | 32.9 | 44.6 |
| 38 | `tests/e2e/welcome.e2e.test.ts` > "Grow a town" starts a town growing **(failed)** | 32.7 | e2e |
| 39 | `tests/e2e/land.e2e.test.ts` > a Shift-drag stroke digs a channel **(failed)** | 32.6 | e2e |
| 40 | `tests/e2e/grow-town.e2e.test.ts` > over a town it asks first **(failed)** | 32.6 | e2e |

### 20 slowest files (before)

| # | file | tests | full run (s) | unit alone (s) |
|---|---|---|---|---|
| 1 | `tests/e2e/interface.e2e.test.ts` | 18 | 405.0 | e2e |
| 2 | `tests/e2e/tools.e2e.test.ts` | 4 | 316.0 | e2e |
| 3 | `tests/e2e/house-styles.e2e.test.ts` | 9 | 260.4 | e2e |
| 4 | `tests/e2e/land-slopes.e2e.test.ts` | 6 | 214.1 | e2e |
| 5 | `src/render/testing/coplanar.test.ts` | 13 | 190.9 | 137.2 |
| 6 | `tests/e2e/held-length.e2e.test.ts` | 5 | 175.4 | e2e |
| 7 | `tests/e2e/welcome.e2e.test.ts` | 5 | 146.4 | e2e |
| 8 | `src/life/ships/traffic.test.ts` | 5 | 142.5 | 17.2 |
| 9 | `tests/e2e/land.e2e.test.ts` | 4 | 140.4 | e2e |
| 10 | `tests/e2e/guide.e2e.test.ts` | 4 | 132.5 | e2e |
| 11 | `src/resolve/incremental.test.ts` | 5 | 118.7 | 96.3 |
| 12 | `tests/e2e/gallery.e2e.test.ts` | 3 | 115.8 | e2e |
| 13 | `tests/e2e/grow-town.e2e.test.ts` | 3 | 105.8 | e2e |
| 14 | `src/life/ships/ships.test.ts` | 10 | 103.9 | 8.1 |
| 15 | `src/townmaker/townmaker.test.ts` | 9 | 101.3 | 14.3 |
| 16 | `src/life/town/town.test.ts` | 12 | 89.3 | 8.6 |
| 17 | `src/life/people/solid.test.ts` | 10 | 85.0 | 8.5 |
| 18 | `src/world/land.property.test.ts` | 6 | 81.2 | 16.8 |
| 19 | `tests/e2e/land-playthroughs.e2e.test.ts` | 6 | 78.5 | e2e |
| 20 | `src/render/view.e2e.test.ts` | 15 | 77.4 | e2e |

## Where the waste was, and what changed

Much of the unit time was not the code under test. It was the checking:

- **The coplanar scan compared every pair of triangles in a plane.** The ground and each floor level
  hold thousands of triangles, so 95% of `coplanar.test.ts` was this loop. A grid per plane now tries
  only triangles whose boxes meet, in the same order. The pairs are identical on all 13 towns (checked
  against the old scan). 137 s → 8 s, all 13 towns kept.
- **One `expect()` per column or per block.** The terrain sweeps called `expect` 460,000 times (200
  seeds × 2,304 columns), and land carrying called it per block per step. Now each seed or step
  gathers its problems and makes one `expect`, with the same message. Terrain 5 s → 1 s; generator 2's
  500 seeds 18 s → 5 s; rivers and materials 12 s → 1.5 s; land carrying 17 s → 4 s, all at full size.
- **`toEqual` over whole meshes.** The path-cache test compared every byte of every path mesh with
  `toEqual`, which was nearly all of its 45 s. A plain loop compares first, and `toEqual` runs only
  on a mismatch to show the difference.
- **A full resolve after every growth edit.** The growth playback test exercises playback (rate, cap,
  one undo step) but resolved the town with every rule after each of ~700 edits. It now uses
  `rules: []`: 11 s → 0.4 s.
- **The scenario runner's third resolve.** The determinism test now compares a fresh build and
  resolve with the one the `expect()` test just made, and resolves with the scenario's own rules (it
  used to leave them out).

### What was cut, by category

| category | tests | what |
|---|---|---|
| sweeps sized for the gate (full keeps the old size) | 13 | incremental ×5, path cells, grow a town ×2, terrain2-town ×3 (the spread feeds two; life), afloat (3 of 6 towns), land-slopes (1 of 3 seeds) |
| same coverage, faster | 22 + 281 | coplanar ×13 (scan), terrain sweeps ×4 and land carrying ×3 (one expect a seed), path cells (compare), growth (no rules), scenario runner ×281 (2 resolves, not 3) |
| long simulation to full | 1 | busy harbour (ten minutes) |
| wall-clock assertions | 5 | 4 to full (grow a town ×2, terrain chunk, birds); 1 made work-based (view rebuild) |
| redundant browser tests deleted | 2 | `app.e2e.test.ts`: place/stack/erase/undo/drag is `interface.e2e` tests 1–2; scenario by URL is every interface test; the gallery list is `gallery.e2e` test 1 |
| screenshot-only tests to full | 3 + 8 shots | interface desktop and phone, held-length desktop; review shots in land, held-length, land-playthroughs |
| CLI runs to full | 7 of 9 process runs | night shot, no-match, inspect overview, JSON, error path, bench |
| fixed sleeps replaced with waits on state | 11 | land-slopes (camera settled, ground changed, message shown), land-playthroughs (camera settled) |
| added | 1 | `src/world/codec-kinds.test.ts`: the share code of a town with one of every kind, pinned |

## Today's flaky tests, and what became of each

| test | cause | decision |
|---|---|---|
| `src/terrain/terrain.test.ts` 200 seeds (60 s timeout raised) | an `expect` per column | **fixed**: one expect a seed, 1 s; timeout raise removed |
| generator tests with 240 s timeouts (`growth`, `townmaker` 50 seeds, `path-cache`, `incremental`, `D11`) | big work under load | **fixed** (growth: no rules; path-cache: compare) or **sized** (townmaker, incremental); D11 timeout removed (1 s a town) |
| generator timing tests (loosened to 900 ms) | wall clock | **full tier** |
| `tests/e2e/tools.e2e.test.ts` shots CLI (load timeouts, three times today) | process + Vite + Chromium next to unit workers | **gate lighter** (one shots run, one inspect run), e2e no longer overlaps unit; bench and the rest **full** |
| ships: 8 timeouts in one run, `traffic.test.ts` 300 s timeout | minutes of simulation under load | busy harbour **full**; the rest under the 60 s default (2–11 s each); e2e no longer runs at the same time |
| `held-length` stepper 43 px | measured mid-press (fixed by the orchestrator earlier) | unchanged; pages now close with their test |
| my baseline run, load 36: 25 browser tests (`page.goto` 30 s timeouts, starved assertions) | 13 browsers and 13 Vite servers next to 9 unit workers | **fixed**: e2e after unit, 3 browsers, one shared server, pages closed per test; e2e alone now 80 s with none failing |
| `land-slopes` phone test (failed after other tests, passed alone; failed in the "before" timing run too) | leaked pages starving the GPU; fixed sleeps | **fixed**: pages closed per test; waits on state |
| `src/gen/terrain/terrain.test.ts` chunk under 40 ms (61.7 ms) | wall clock | **full tier** |
| `src/render/view.e2e.test.ts` lifted structure: rebuild under 8 ms (98 ms) | wall clock | **work-based**: 0 structures and 0 vertices rebuilt |
| `tools.e2e` inspect and bench (120 s timeouts) | see shots | inspect **lighter**, bench **full** |
| `src/life/ships/ships.test.ts` every nasty edit (30 s timeout; 2.4 s alone) | load timeout | unit timeout 60 s, no e2e alongside; kept in the gate |
| `src/life/town/town.test.ts` L60 washing (30 s timeout; 1.9 s alone) | load timeout | same; file not touched (owned by the living-town agent) |
| `src/life/people/crowd.test.ts` "a step costs a fraction of a millisecond" (failed in the full run at load 24) | wall clock (mean step < 1.5 ms) | **not touched** (people agent's file): should be full-tier or work-based |

## Mutations tried (each reverted)

Each mutation was applied alone, the whole unit gate was run, and the change was undone.

| what was broken | caught in the gate by |
|---|---|
| codec: tower and lighthouse swapped in the kind list | **nothing, gate or full** (the pinned codes hold no tower or lighthouse). Added `codec-kinds.test.ts`, which now catches it |
| incremental: content key without the colour | `incremental.test` (J02 split-level; generator-2 land run) |
| incremental: content key without the resolved kind | **nothing, gate or full (300 edits)**: either redundant in the key or a gap; for the logic owner |
| Auto kinds: tower needs a run longer than `towerRun` | `kinds.test` ×5, `guide.test`, `scenarios` |
| supports: a bracket only against terrain-grounded neighbours | `scenarios` ×11, `supports.test` |
| structure merging: colour ignored | `scenarios` ×32, `structures.test` |
| festival: pop-in shows seasonal props, and the festival system no longer holds them down (the original bug) | `festival.test` ×4 (each guard alone is covered by the other) |
| boats: no look-ahead for a big ship | `afloat.test` (ships-harbour, a gate town) |
| people: avoidance mostly off (look 0.3, clear 0.1) | `crowd.test`, `town.test` (8 tests) |
| people: stepping aside off their line (room 0.6) | `crowd.test` "nobody leaves the graph" and 14 more |
| doormats: mat in the plane of the ground | `D11.doorstep.test` (all 12 towns) |
| coplanar: dock deck flush with the ground line (a fix from today undone) | `coplanar.test` (several towns), `dock.test` |
| undo: land edits back to the base height kept in the save | `land-save.test`, `land.property.test` ×3, `land.test` |
| carrying: floors not carried with their column | `land.property.test` ×3, `land.test` |
| view: hash check off (everything rebuilt) | `view.e2e` lifted structure (36 structures rebuilt) |

Three coplanar mutations (ridge cap end, arrow slit, wall gate face) were not caught. The scan tool
showed that the first two create no coplanar faces at all; the third was not checked.

## For the agents editing people, town, mischief, field and big islands

- `src/life/people/crowd.test.ts`: "sixty people on the 2,000-block town … a step costs a fraction
  of a millisecond" asserts a mean step time under 1.5 ms and failed under load. Move that assertion
  to `if (FULL)` or assert the work done. The 400 s and 300 s simulations (`30 * 400`, `30 * 300`)
  could take `sized()`.
- `src/life/people/route.test.ts`: it times searches with `performance.now()`. It already counts
  `router.stats.searches`; assert on that.
- `src/life/people/solid.test.ts`: three tests carry 120 s timeouts (a day and an evening, the
  everything town, the dense square). They take 2–3 s alone, so the timeouts can go; the simulated
  time could take `sized()`.
- `src/life/town/town.test.ts`: L60 washing timed out at 30 s under load (1.9 s alone). The new 60 s
  default should hold.
- Everyone writing tests: use `tests/helpers/tier.ts` for big sweeps; make one `expect` per seed or
  step, not per column or block; compare big arrays with a loop before `toEqual`; do not assert wall
  clock in the gate; in browser tests, wait on state instead of `waitForTimeout`. A page opened in a
  test closes when it ends, so open a page in `beforeAll` if several tests share it.

## Measured after (same machine, back to back, load 12–25)

| run | tests | wall | sum of test durations |
|---|---|---|---|
| before: `npm run check` at `b83d78b` | 1,976 in 130 files | 299 s (1 failure: land-slopes phone) | 1,696 s (unit 637, e2e 1,060) |
| after: `npm run check` (gate) | 1,961 run + 9 full-only, in 130 files | 153 s, all pass | 609 s (unit 380, e2e 229) |
| after: `npm run check:full` | 1,975 in 130 files | 484 s (1 failure: crowd.test timing, above) | 1,948 s |

Typecheck and lint take 12–20 s of each run.
