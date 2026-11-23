# Nukes Without the Lag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After four nukes, the town burns and mends without frames of 350–717 ms. The settled town stays exactly as it is today.

**Architecture:**
- Mischief edits reach the renderer as "spread" changes. A changed building's new drawing is built under a per-frame time budget; until then, its old drawing stays on screen.
- Edit batches apply to one world copy.
- Mending repairs at most a fixed number of cells per tick, round-robin.
- A damaged building's intact drawing, and its polygons, are cached apart from the damage. A ruin change then only re-runs the damage pass, and the flame placement reuses the renderer's build.

**Tech Stack:** TypeScript, three.js r187, Vitest 5 (`--project unit` in Node, `--project e2e` with headless Chromium).

**Spec:** the Findings section below (measured on 2026-11-23). Raw data: the CDP harness `nukes.mjs`, `nukes.json` and `nuke-findings.md` in the session scratchpad `perf/` folder.

## Findings (the spec)

**Setup:** `?scenario=bench-2000`, 1440×900, DPR 2, headless Chrome on an Apple M4, unminified production builds. Four nukes 2.5 s apart, each 6 cells off the camera target, one per quadrant. Phases:
- **Blast:** 4.4–13 s.
- **Burn:** 13–33 s.
- **Out:** 35–45 s. Every fire is doused at 33 s, and the town is still mending.

One quiet run per build; a second base run was contaminated (load rose to 22).

| Phase (base / perf branch `ea04706`) | fps | Worst frame | Edit calls/s | Edits/s | ms/s inside edits | Dressings/s |
|---|---|---|---|---|---|---|
| Baseline | 59.5 / 59.5 | 17 / 17 | 0 | 0 | 0 | 0 |
| Blast | 38.3 / 31.9 | 533 / 717 | 1.7 / 1.5 | 337 / 293 | 231 / 267 | 1.7 / 1.5 |
| Burn | 32.0 / 27.3 | 500 / 400 | 7.0 / 5.9 | 215 / 211 | 317 / 361 | 7.0 / 5.8 |
| Out | 42.6 / 35.1 | 350 / 467 | 1.7 / 1.4 | 448 / 292 | 311 / 397 | 1.7 / 1.4 |

- **Peak:** about 1,400 cells burning at once.
- **Perf branch:** it doesn't touch this path; the difference between the builds is noise.

**F1. A ruin change redraws the whole building, inside the edit, in the same frame.**
- A block's `ruin` is mixed into its structure's content hash (`src/resolve/engine/hash.ts:138`).
- So every fire char stage and every mend step makes `syncShape` (`src/render/index.ts:871-874`) run `generators.build`. That means the intact generator, then `polysOf`, then `breakPolys`, then debris (`src/gen/damage/damage.ts:315-335`, wrapped by `withDamage` at `:870-876`).
- All of it runs inside `game.editAll` → `show` → `view.setTown`.
- **Cost:** `syncShape` takes 4.2–4.7 s per 20 s of burn, and 2.4–3.0 s per 10 s of out. `polysOf` self time alone is 1.7–1.8 s per 20 s. This is about 45% of script time.

**F2. Edits land as single-frame batches of about 200.**
- The shockwave applies its hits in 0.2 s batches.
- `mendTick` (`src/life/mischief/director.ts:409-457`, every 0.5 s) steps *every* due building at once.
- Each batch then runs `editAll`/`amend` (`src/app/game.ts:142-184`), which calls `applyEdit` per edit. Each `setRuin`/`repair` copies the whole `blocks` Map (`src/world/world.ts:337-344`); `applyEdit` self time is 257–377 ms per 10 s.
- After that comes `resolveShape`, then F1.
- **Result:** 150–280 ms per batch, which is where the 350–717 ms worst frames come from. Those spikes in the out phase are the "lag while it's rebuilding".

**F3. The flame placement draws each burning building a second time.**
- `samplerOf` (`src/life/mischief/mischief.system.ts:432-443`) calls `allGenerators().build` to find roofs.
- Cost: 1.8–1.9 s per 20 s of burn, duplicating the renderer's build of the same hash.

**F4. The fire itself is cheap.**
- Fire simulation is 40–46 ms/s; flames and smoke about 15 ms/s.
- Its cost is the edits it makes (F1–F3). Burning vs doused, in the same session, differs by about 8–10 fps.

**F5. Each fire char step re-resolves the town about 7 times a second.**
- `resolveShape` costs about 80 ms/s and `resolveDressing` about 130 ms/s.
- *Out of scope here; see Follow-ups.*

**Correction:**
- The findings' "autosave hashes the world on every change" was a misattribution.
- `hash@save:84` is `src/core/rand.ts` `hash()`, bundled into the `save` chunk. Its time is spread across `hashDressing`, `buildingDamage` and `rand`.
- Autosave is debounced (`src/app/autosave.ts:49-53`), and `saveTown` measured 0 ms in every phase. That fix is dropped.

## Global Constraints

- **The settled town is identical:** same shape and dressing hashes (`incremental.test.ts`, `staged.test.ts` green). A damaged building looks exactly the same once its regeneration lands; a test compares against an unbudgeted rebuild.
- **No frame carries more than one heavy job.** A frame that ran `setTown` or `setDressing` drains no deferred rebuilds.
- **Spreading is for mischief edits only.** A town switch, undo, redo, abort, growth, placing, the style panel and the first draw all rebuild at once, as today.
- **No new dependencies.** Layers per `eslint.config.js` (gen may import resolve; render may import gen).
- **Gate:** `npm run typecheck`, `npm run lint` (`--max-warnings 0`), unit (`npx vitest run --project unit`) and e2e (`npx vitest run --project e2e`) all stay green.
- **Machine load:** the user is DJing on this machine. Run the full suites once per task at most, run e2e only in the tasks that touch render, and never run two suites at once.

## Review Focus

1. **A town switch while rebuilds are pending.** The new island must never show the old island's buildings, even for a frame (structure ids repeat across towns). Pinned by Task 1's e2e test "an ordinary setTown after a spread one leaves nothing pending".
2. **A building changed again, or removed, while its rebuild is pending.** The drain builds the newest hash or drops the id; the picture ends equal to an immediate build. Pinned by Task 1's e2e test "two spread changes in a row land on the final picture".
3. **A building bigger than the mend cap.** It must still mend, never starve. Pinned by Task 3's test "a building bigger than the cap still mends".
4. **The cached intact polygons being mutated by a damage pass.** A second damaged build would then differ. Pinned by Task 4's test "a damaged build from the cache is byte-identical to a fresh one, twice".
5. **A style change while damaged drawings are cached.** It must redraw with the new style. Pinned by Task 4's test "the intact cache follows the style version".

---

### Task 1: Spread mischief rebuilds over frames (F1, F2)

**Files:**
- Create: `src/render/rebuild-budget.ts`, `src/render/rebuild-budget.test.ts`
- Modify:
  - `src/render/index.ts`: `syncShape` :853-905, `setTown` :1171-1179, `setDressing` :1180-1187, `render` :1343-1350, and the stats getter
  - `src/render/api.ts`: `ViewStats` :59-71, `setTown` :98
  - `src/app/main.ts`: `show` :144-146 and `mischief.connect` :164-171
  - `src/render/testing/probe.ts`
  - `src/render/view.e2e.test.ts`

**Interfaces:**
- Produces:
  - `export const REBUILD_BUDGET_MS = 6;`
  - `export function buildWithin<T>(ids: readonly T[], build: (id: T) => void, budgetMs: number, clock: () => number = () => performance.now()): T[]`. It builds in order and stops once `clock() - start >= budgetMs` after a build. It always builds the first id, and returns the ids not built, in order.
  - `TownView.setTown(shape: ShapePlan, dressing: DressingPlan | null, opts?: { spread?: boolean }): void`
  - `ViewStats.pending: number`: structures whose new drawing is still waiting.
- Behaviour:
  - **With `spread`:**
    - Structures already drawn whose hash changed go through `buildWithin` with `REBUILD_BUDGET_MS`. The rest join a pending set, and their old drawing stays.
    - New structures, removals and layers are done at once.
  - **Without `spread`** (and the style-change sync in `render`): every mismatch is rebuilt and the pending set is cleared.
  - **`render()` drain:** it drains pending ids with `buildWithin`, only if no `setTown`/`setDressing` ran since the last `render()`.
    - An id that is gone, or already drawn at its current hash, is dropped.
    - A drained rebuild calls `setAnchors` and `rebuildLayout()`, never `syncDressing` (a ruin change keeps the generator's anchors: `damage.ts:873` returns `out.anchors`).
    - A drain does not overwrite `ViewStats.rebuild`.
- `main.ts`: a module-level `fromMischief` flag is true only while the host's `apply`/`edit`/`amend` calls `game.editAll`/`game.amend` (`try`/`finally`). `show` passes `{ spread: fromMischief }`. `begin`, `end` and `abort` never spread.

- [ ] **Step 1: Write the failing unit tests** in `src/render/rebuild-budget.test.ts`, with a fake clock that advances by what `build` adds:
  - `builds everything when the budget allows`: clock fixed at 0, ids `[1,2,3]` → all built in order, returns `[]`.
  - `stops once the budget is spent`: each build adds 4 ms, budget 6 → builds `1,2`, returns `[3,4]`.
  - `always builds the first, even over budget`: each build adds 50 ms → builds `1`, returns `[2,3]`.
  - `an empty list builds nothing`: returns `[]`, `build` never called.
- [ ] **Step 2: Run** `npx vitest run --project unit src/render/rebuild-budget.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `buildWithin` and `REBUILD_BUDGET_MS`, then the view changes and `main.ts` wiring described under Interfaces.
- [ ] **Step 4: Add probe support and the e2e tests.**
  - Add `ruinHouses(n: number, ruin: number, spread: boolean): number` to `src/render/testing/probe.ts`. It sets `ruin` on every cell of the first `n` houses of the open scenario, re-resolves, calls `view.setTown(next, null, { spread })`, and returns `stats.pending`. Use `packRuin` for the value. Pick a scenario with at least 20 houses that `open()` accepts.
  - Add to `src/render/view.e2e.test.ts`:
    - `a spread rebuild lands on the same picture as an immediate one, never in the edit's frame`:
      - `ruinHouses(20, r, true)` > 0.
      - After one `frameOnly()`, `pending` is unchanged.
      - Frame until `pending === 0`. Then `settled().thumb` equals the thumb from a fresh `open` + `ruinHouses(20, r, false)`.
    - `two spread changes in a row land on the final picture`: two different ruin values, spread, before draining → the thumb equals an immediate build of the second.
    - `an ordinary setTown after a spread one leaves nothing pending`: spread, then the same shape with `spread: false` → `pending === 0` immediately.
- [ ] **Step 5: Run** `npx vitest run --project unit src/render` and `npx vitest run --project e2e src/render/view.e2e.test.ts tests/e2e/mischief.e2e.test.ts`, then `npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 6: Commit** `git commit -m "Mischief rebuilds a few buildings a frame, not every changed building in the edit's frame"`

### Task 2: One world copy per edit batch (F2)

**Files:**
- Modify: `src/world/world.ts` (beside `applyEdit` :281), `src/app/game.ts` (`editAll` :142-153, `amend` :171-182)
- Test: `src/world/world.test.ts`

**Interfaces:**
- Produces: `export function applyEdits(w: World, t: Terrain, edits: readonly Edit[]): { world: World; applied: number }`.
  - Edits are checked with `canApply` against the world so far, and refused ones are skipped, exactly as `editAll` does today.
  - A run of `setRuin`/`repair` edits shares one copy of `blocks`, written in place. Any other edit goes through `applyEdit`.
  - It returns the input world object when `applied === 0`.
- `game.editAll`/`amend` use it. Their history and `show` behaviour are unchanged.

- [ ] **Step 1: Write the failing tests** in `src/world/world.test.ts`:
  - `applyEdits gives the same world as applying the edits one by one`. The batch mixes `setRuin`, `repair`, a refused `repair` on an empty cell, a `placeBlock`, and a `setRuin` on the new block. The result's `[...blocks]`, `[...floors]`, `[...edges]` and `nextSeq` equal a fold of `canApply`-guarded `applyEdit`, and `applied` equals the number of edits that fold accepted.
  - `applyEdits leaves the world it was given untouched`: `[...w.blocks]` is the same before and after.
  - `a batch with nothing accepted returns the same world`: `applied === 0` and `world === w`.
- [ ] **Step 2: Run** `npx vitest run --project unit src/world/world.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `applyEdits`, and switch `editAll`/`amend` to it.
- [ ] **Step 4: Run** `npx vitest run --project unit src/world src/app src/life/mischief src/resolve`, then `npm run typecheck && npm run lint`. Expected: PASS (the incremental and staged hash tests included).
- [ ] **Step 5: Commit** `git commit -m "An edit batch is applied to one copy of the town, not one copy per edit"`

### Task 3: Mending in bounded batches (F2)

**Files:**
- Modify: `src/life/mischief/director.ts` (`MEND` :26, `mendTick` :409-457)
- Test: `src/life/mischief/carryover.test.ts`. Follow its real-game host pattern: `amend: (edits) => void game.amend(edits)`.

**Interfaces:**
- Produces: `MEND.cellsPerTick = 96`.
- Behaviour:
  - A tick repairs at most `MEND.cellsPerTick` cells; scaffolding counts.
  - The first building of a tick is always served, even if it is bigger than the cap.
  - Buildings are served round-robin by `StructureId`, starting after the last one served in the previous tick (a private `mendFrom` cursor).
  - A building that is due but not served keeps `min(owed, MEND.step)`, so it takes one step when its turn comes.
  - Waits and phases stay `rand(sid, 'mend-wait' | 'mend-phase')`, as today.

- [ ] **Step 1: Write the failing tests:**
  - `a big aftermath mends in batches no bigger than MEND.cellsPerTick, and every building is mended`.
    - Set `MEND.cellsPerTick = 6` (restore it in `finally`), so that today's single-tick batches exceed it.
    - At least 12 two-floor houses, every cell set to a blast ruin. Record each `amend`/`apply` batch's length.
    - Run `d.update(1/30, ENV)` for up to 600 simulated seconds (`ENV` as in `response.test.ts`).
    - Expect the largest batch ≤ 6, and no block with `ruin` at the end.
  - `a building bigger than the cap still mends`: set `MEND.cellsPerTick = 4` (restore it in `finally`); one house with more than 4 cells is fully mended in the end.
- [ ] **Step 2: Run** `npx vitest run --project unit src/life/mischief/carryover.test.ts`. Expected: the first test FAILS on batch size.
- [ ] **Step 3: Implement** the cap, the cursor and the owed clamp in `mendTick`.
- [ ] **Step 4: Run** `npx vitest run --project unit src/life`, then `npm run typecheck && npm run lint`. Expected: PASS. The existing mend tests, such as `engine.test.ts` "a knock is a stage; a repair puts the scaffolding up…" and `response.test.ts`, must stay green: a small mend is under the cap and unchanged.
- [ ] **Step 5: Commit** `git commit -m "The town mends a few dozen cells a tick, round the town in turn, not every building at once"`

### Task 4: Cache the intact drawing apart from its damage (F1, F3)

**Files:**
- Modify:
  - `src/resolve/engine/hash.ts` (`hashStructure` :115, ruin mix :138)
  - `src/gen/damage/damage.ts`: `damageOutput` :315, the `polysOfMesh(intact)` calls at :301, :326, :643, :650 and :814, and `withDamage` :870-876
- Test: `src/gen/damage/damage.test.ts` (use its `damaged(kind, ruin, floors)` helper); create `src/resolve/engine/hash.test.ts`.

**Interfaces:**
- Produces:
  - `hashStructure(s: Structure, plan: ShapePlan, ignoreRuin = false): number`. With `ignoreRuin`, the ruin mix is skipped. The default is byte-identical to today.
  - `damageOutput(out: GenOutput, s: Structure, plan: ShapePlan, polys?: readonly Poly[]): GenOutput`. When given, `polys` stands in for `polysOfMesh(out.mesh)`.
  - `withDamage(reg)` keeps a per-registry `Map<StructureId, { key: number; style: number; intact: GenOutput; polys: Poly[]; hash: number; out: GenOutput }>`.
- Behaviour of `build(s, plan, parts)`:
  - **A sound structure** (no cell has `ruin`): `reg.build` as today, and its entry is deleted.
  - **A damaged structure:** `key = hashStructure(s, plan, true)`.
    - If the entry's `key` and `style` (`styleVersion()`) match, it reuses `intact` and `polys`.
    - If the entry's `hash === s.hash`, it returns the same `out` object. That is what makes `samplerOf` free after the renderer's build, since both use `allGenerators()`.
    - Otherwise it builds the intact output, takes `polysOf` once, runs `damageOutput(intact, s, plan, polys)`, and stores the entry.
  - **Bound:** at most `INTACT_CACHE_MAX = 512` entries; past that, the map is cleared. Add a `// ponytail:` note: this is a blunt bound, and a per-town sweep is the upgrade if it ever thrashes.

- [ ] **Step 1: Write the failing tests:**
  - `hash.test.ts`:
    - `ignoring ruin, a ruined structure hashes like its sound self`.
    - `with ruin, the two hashes differ`.
  - `damage.test.ts`:
    - `a damaged build from the cache is byte-identical to a fresh one, twice`. Through `allGenerators()`, build a house at ruin A, then at ruin B (an intact-cache hit), then at ruin A again (a hit, after a damage pass has run over the cached polygons). Each mesh's arrays equal `damageOutput(reg.intact.build(s, plan, parts), s, plan)` computed fresh for that ruin.
    - `changing only the ruin reuses the intact drawing`. Wrap a registry's `build` in a counter under `withDamage`: two ruin stages of one house → the intact build is called once.
    - `the same hash returns the same output`: `build(s)` twice → `toBe` the same object.
    - `the intact cache follows the style version`: after `resetStyles()`, the intact build runs again.
- [ ] **Step 2: Run** `npx vitest run --project unit src/gen/damage src/resolve/engine/hash.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the hash flag, the `polys` parameter and the cache.
- [ ] **Step 4: Run** `npx vitest run --project unit src/gen src/resolve src/life/mischief`, then `npx vitest run --project e2e src/render/view.e2e.test.ts tests/e2e/mischief.e2e.test.ts`, then `npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "A ruined building keeps its sound drawing to break, and the flames borrow the town's"`

### Task 5: Measure (controller)

- [ ] **Step 1:** Build both trees unminified into the scratchpad, outside the repos:
  - The plan's base commit `ea04706` → `nomin-base`.
  - This branch → `nomin-branch`.
  - Command: `npx vite build --minify false --outDir <scratchpad>/<name> --emptyOutDir`.
- [ ] **Step 2:** `node nukes.mjs 2 base=<nomin-base> branch=<nomin-branch>`, interleaved. It waits until the 1-minute load is ≤ 8, and every row records the load before and after. Discard any row whose load after is above 10, and rerun it.
- [ ] **Step 3:** Record each phase's fps and worst frame, and the edit and dressing rates, in the PR.
  - **Expected:** out- and blast-phase worst frames under about 100 ms (from 350–717 ms), and burn-phase fps at or above base.
  - **ViewStats check:** `pending` reaches 0 within about 2 s of the last mischief edit.
- [ ] **Step 4:** Full gate once: `npm run typecheck && npm run lint && npx vitest run --project unit && npx vitest run --project e2e`.

## Follow-ups (not in this plan)

- **F5, the ruin-only resolve fast path.** A batch of only `setRuin`/`repair` skips the 97 shape rules and refreshes structure hashes, content keys and the ruined set. `flush` hands fire edits over at most about 4 times a second. Expected savings: about 80 ms/s of resolve and about 60 ms/s of dressing while burning. It touches the resolver's contract, so it needs its own plan.
