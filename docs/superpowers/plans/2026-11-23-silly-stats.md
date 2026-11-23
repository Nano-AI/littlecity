# Silly Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A strip along the top of the screen with the town's population, a happiness face the Mischief tab can wreck, and one rotating silly count.

**Architecture:** A pure model (mood + tallies) under `src/ui/stats/`, fed a few times a second by a watcher that polls what the life layer already exposes per stage (crowd, scenes, raids, the board) and listens to the mischief director's events. A small DOM strip draws it. One new counter in the board (`Board.delivered`) is the only change below the UI.

**Tech Stack:** TypeScript, plain DOM (`el()` from `src/ui/dom.ts`), CSS, Vitest 5 (`--project unit`, Node).

**Spec:** `docs/superpowers/specs/2026-11-23-silly-stats-design.md`

## Global Constraints

- No money, net worth, score, goal or fail state; nothing saved (session only).
- Must not cost frames: the watcher does work at most every 250 ms; never scans the whole town per frame.
- Plain DOM + CSS, no new dependency. The strip is a direct child of the `.lc-ui` root (`interface.ts:244`) so fly mode hides it (`ui.css:1126-1128`).
- Every visible `.lc-ui button` stays at least 44×44 on phones (`tests/e2e/interface.e2e.test.ts:722-728`); the strip itself has no buttons.
- Copy in the game's voice: short, plain, a little dry.
- `npm run typecheck`, `npm run lint` (`--max-warnings 0`), unit tests stay green. Commits on local branch `feat/silly-stats` only.

## Review Focus

1. Town switch (new island, My towns, a shared link): `crowdOf`/`scenesOnStage` return null between towns → no throw; population keeps its last value until the new crowd exists. (Task 3 test `survives a stage with nothing on it yet`.)
2. A nuke hitting 40 cells at once → happiness clamps at 0, never negative or NaN. (Task 1 test `never below 0 or above 100`.)
3. Mischief undone (`undo`/`reset`) → no happiness change; mending (`mend`) lifts it a little. (Task 1 test `mend lifts, undo does nothing`.)
4. A long-open tab → happiness returns to rest and stays there; counts keep growing without overflow formatting issues ("1,234"). (Task 1 tests on recovery; Task 3 formats with `toLocaleString()`.)
5. Phone width: the strip does not cover the top-right buttons or the toasts. (Task 4 screenshots at 390×844.)

---

### Task 1: Mood and tallies (pure model)

**Files:**
- Create: `src/style/stats.ts` (tunables), `src/ui/stats/mood.ts`, `src/ui/stats/mood.test.ts`

**Interfaces:**
- Produces:
  - `export type MoodCause = 'scene' | 'market' | 'festival' | 'mend' | 'fire' | 'bomb' | 'nuke' | 'lightning' | 'mallet' | 'ruin' | 'scuffle' | 'raid' | 'sunk'`
  - `export function createMood(rest?: number): { readonly value: number; hit(cause: MoodCause, n?: number): void; step(dt: number): void }`
  - `export type SillyKey = 'loaves' | 'fish' | 'weddings' | 'nukes' | 'bombs' | 'lightning' | 'fires' | 'ruined' | 'scuffles' | 'raids' | 'burning'`
  - `export function createTally(): { add(key: SillyKey, n?: number): void; set(key: SillyKey, n: number): void; get(key: SillyKey): number; next(): { key: SillyKey; n: number } | null }`
  - In `src/style/stats.ts`: `MOOD = { rest: 70, recoverySeconds: 90 }`, `MOOD_WEIGHTS: Record<MoodCause, number>` with `scene: 6, market: 3, festival: 8, mend: 2, fire: -6, bomb: -10, nuke: -45, lightning: -4, mallet: -2, ruin: -1, scuffle: -3, raid: -15, sunk: -5`; `SILLY: Record<SillyKey, string>` labels: loaves "Loaves delivered", fish "Fish landed", weddings "Weddings", nukes "Times nuked", bombs "Bombs dropped", lightning "Lightning strikes", fires "Fires started", ruined "Buildings ruined", scuffles "Scuffles", raids "Raids survived", burning "On fire right now". The order of `SILLY`'s keys is the rotation order.

- [ ] **Step 1: Write the failing tests** in `src/ui/stats/mood.test.ts`:
  - `starts at rest` — `createMood().value === 70`.
  - `a nuke craters it and a wedding lifts it` — `hit('nuke')` → 25; then `hit('scene')` → 31.
  - `never below 0 or above 100` — `hit('ruin', 400)` → 0; `createMood(98)` then `hit('festival')` → 100.
  - `mending lifts it a little` — from 70, `hit('mend')` → 72. (Undo and reset have no cause at all; Task 3 maps them to nothing.)
  - `drifts back to rest` — from 25, `step(90)` → between 50 and 60 (one time constant: 70 − 45·e⁻¹ ≈ 53.4); `step(600)` → within 0.5 of 70; from 100, `step(600)` → within 0.5 of 70.
  - `step(0)` and negative dt change nothing.
  - tally: `next()` is null when all zero; after `add('nukes')`, `add('loaves', 3)`: `next()` → `{key:'loaves', n:3}` then `{key:'nukes', n:1}` then `loaves` again (skips zeros, follows `SILLY` order, wraps); `set('burning', 0)` removes it from rotation.
- [ ] **Step 2: Run** `npx vitest run --project unit src/ui/stats/mood.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** both factories. Recovery: `value = rest + (value - rest) * Math.exp(-dt / MOOD.recoverySeconds)` for `dt > 0`; hits add `MOOD_WEIGHTS[cause] * n` then clamp to 0..100.
- [ ] **Step 4: Run** the same test — PASS. `npm run typecheck && npm run lint` — PASS.
- [ ] **Step 5: Commit** `git commit -m "Stats: the town's mood and its silly tallies (a model, no drawing yet)"`.

### Task 2: The board counts what it is given

**Files:**
- Modify: `src/life/town/board.ts` (interface ~116, `put` impl ~277)
- Test: `src/life/town/town.test.ts` (existing board tests live here; add one)

**Interfaces:**
- Produces: `Board.delivered: ReadonlyMap<Load, number>` — how many of each kind have been laid in any store since the board was made (counts only successful `put`s).

- [ ] **Step 1: Write the failing test** `counts what is laid in its stores, not what was refused` — make a board and a 2-spot store the way the existing town tests do; `put(store,'loaf')` ×3 (third refused, store full) → `delivered.get('loaf') === 2`; `put(store2,'fish')` → `delivered.get('fish') === 1`.
- [ ] **Step 2: Run** `npx vitest run --project unit src/life/town/town.test.ts` — FAIL.
- [ ] **Step 3: Implement** a `Map<Load, number>` incremented in `put` after the successful lay, exposed read-only.
- [ ] **Step 4: Run** `npx vitest run --project unit src/life` — PASS; typecheck + lint PASS.
- [ ] **Step 5: Commit** `git commit -m "Board: counts what it is given (loaves, fish, sacks…), for the stats"`.

### Task 3: The watcher and the strip

**Files:**
- Create: `src/ui/stats/watch.ts`, `src/ui/stats/watch.test.ts`, `src/ui/stats/strip.ts`, `src/ui/stats/stats.css`
- Modify: `src/app/main.ts` (beside the scene note, ~401), `src/ui/ui.css:790-805,1092` (toasts move below the strip)

**Interfaces:**
- Consumes: Task 1 `createMood`, `createTally`, `MOOD`, `SILLY`; Task 2 `Board.delivered`.
- Produces:
  - `export interface StatsView { population: number | null; mood: number; silly: { label: string; n: number } | null }`
  - `export function createStatsWatch(): { update(stage: object, now: number): StatsView | null }` — returns null unless ≥ 250 ms passed since the last returned view (`now` in ms).
  - `export function createStatsStrip(root: HTMLElement): { show(v: StatsView): void }`.

Sources, all read inside `update` (each may be null; skip when null):
- population: `crowdOf(stage)?.people` filtered `p.mode !== 'gone' && !p.leaving && !p.raider && !p.ashore` (`src/life/doors/table.ts:30`, `crowd.ts:93-233`).
- scenes: `scenesOnStage(stage)` — each scene in `.on` whose `n` is above the highest `n` seen → `hit('scene')`; kind `'raid'` scenes are skipped here (raids are counted below); kind `'wedding'` also `tally.add('weddings')`.
- mischief: subscribe once per stage (a `WeakSet` of stages) to `mischiefOf(stage).on` (`src/life/mischief/director.ts:162`; events `director.ts:93-106`): `lit` → `hit('fire')`, `add('fires')`; `drop` with `bomb.nuke` → `hit('nuke')`, `add('nukes')`; other `drop` → `hit('bomb')`, `add('bombs')`; `strike` → `hit('lightning')`, `add('lightning')`; `knock` → `hit('mallet')`; `blast` → `hit('ruin', blast.hit.length)`, `add('ruined', blast.hit.length)`; `mend` → `hit('mend')`; `reset`, `undo`, `cloud` → nothing. Events are queued and applied on the next `update`.
- raids: `raidsOf(stage).count` (`src/life/raid/raids.ts:53`) increases → `hit('raid')`, `add('raids')`.
- scuffles: `crowdOf(stage)?.scuffles.now?.n` new value → `hit('scuffle')`, `add('scuffles')`.
- goods: `raidsOf(stage).board?.delivered` — deltas of `'loaf'` → `add('loaves')`, `'fishes'` → `add('fish')` (use the `Load` names the chains put: `bread.ts:148`, `fish.ts:48`).
- burning now: `tally.set('burning', mischiefOf(stage).engine.burning().length)` (`engine.ts:534`).
- market and festival: a rising edge of the market chain's `open` (`market-day.ts:54-56`, via `board.chains`) → `hit('market')`; `board.season.festival` crossing 0.5 upwards → `hit('festival')`.
- mood `step(dt)` with dt from the previous update, in seconds.

- [ ] **Step 1: Write the failing tests** in `watch.test.ts` for what can run without a stage: `returns null more often than every 250 ms` (update at 0 → view, at 100 → null, at 260 → view) and `survives a stage with nothing on it yet` (a fresh `{}` stage → view with `population: null`, `mood: 70`, `silly: null`, no throw).
- [ ] **Step 2: Run** `npx vitest run --project unit src/ui/stats/watch.test.ts` — FAIL.
- [ ] **Step 3: Implement** `watch.ts` per the sources above; keep each source in its own small function so a missing one cannot break the others.
- [ ] **Step 4: Implement** `strip.ts` + `stats.css`: three chips in one `lc-card`-styled row, `position: fixed; top: calc(10px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%)`; chip 1 a people glyph and the population (`toLocaleString()`, "—" when null); chip 2 an inline SVG face in the game's ink style with five expressions by band (≥80, ≥60, ≥40, ≥20, below) and the number beside it (`aria-label="Happiness 72 of 100"`); chip 3 the silly label and count, hidden when null, cross-fading when it changes (`prefers-reduced-motion`: no fade). `pointer-events: none`. Phones (`(pointer: coarse), (max-width: 640px)`): sit under the top-right group (`top: calc(64px + env(safe-area-inset-top)); right: 10px; left: auto; transform: none`), silly chip hidden. Toasts move down to clear the strip: desktop `.lc-toasts { top: 60px }`, phones `top: 108px`.
- [ ] **Step 5: Wire it in `src/app/main.ts`** beside the scene note: create the watch and strip once (`createStatsStrip(ui.root)` — expose `root` on `Interface` if it is not already public), then each frame `const v = watch.update(view.stage, now); if (v) strip.show(v);`.
- [ ] **Step 6: Run** `npx vitest run --project unit src/ui src/life/town && npm run typecheck && npm run lint` — PASS.
- [ ] **Step 7: Commit** `git commit -m "Stats along the top: how many live here, how happy they are, and something silly"`.

### Task 4: See it (controller)

- [ ] **Step 1:** `npm run build`; with the CDP harness on `dist/`, take screenshots at 1440×900 DPR 2 and 390×844 DPR 3 on `?scenario=bench-2000`, after `?scenario=L57.wedding` has run 20 s, and after a nuke (drive the Mischief tab or `__lc` hooks): the face changes expression, the count updates, nothing overlaps.
- [ ] **Step 2:** Frame check on bench-2000 idle: p95 frame unchanged (±1 ms) against the base build.
- [ ] **Step 3:** `npm run check`.

---

## Amendment (2026-11-23, after the user saw it running)

The user's feedback after trying it: "the happiness score is so fluctuating... If one person is affected by a bomb in a small proximity, it shouldn't impact the happiness of the whole town", and "Sims games usually have this kind of stuff at the top right... sticking that in the top right might be a good idea." Task 4 (see it) runs after these two.

### Task 5: The strip sits in the top right

**Files:** Modify `src/ui/stats/stats.css`, `src/ui/ui.css` (the toast offsets Task 3 changed).

- [ ] **Step 1:** On desktop, place `.lc-stats` directly under the top-right group (`.lc-corner-right`, `ui.css:138-150`), right-aligned with it: `top: calc(60px + env(safe-area-inset-top)); right: calc(10px + env(safe-area-inset-right)); left: auto; transform: none`. Keep all three chips on desktop, and keep the phone rule as it is (two chips, under the top-right group). Update the comment at the top of stats.css.
- [ ] **Step 2:** Desktop toasts go back to where they were before Task 3 (`.lc-toasts` `top: calc(14px + env(safe-area-inset-top))`, with Task 3's comment removed). Phones keep `108px`, because on phones the strip shares the top-right with the toasts' column.
- [ ] **Step 3:** `npm run lint` passes. Commit: `"Stats: in the top right, under the clock and weather, the way a town sim keeps them"`.

### Task 6: Happiness by the share of the town touched

**Files:**
- Modify `src/style/stats.ts`, `src/ui/stats/mood.ts`, `src/ui/stats/watch.ts`, `src/life/people/crowd.ts` (beside `residents`) and `src/app/main.ts` (the watch's lookup).
- Tests: `src/ui/stats/mood.test.ts`, `src/ui/stats/watch.test.ts`.

**Interfaces:**
- `Crowd.homes: ReadonlyMap<StructureId, number>`: residents per home (every resident actor with a home, counted in the same sync loop as `residents`, before the cap). Spawning stays byte-identical.
- `createMood()` gains `drag(d: number): void`. `step(dt)` relaxes toward `clamp(rest - drag, 0, 100)` instead of `rest`, and the drag defaults to 0, so the existing tests hold.
- `createStatsWatch(opts?: { structureAt?: (cell: CellKey) => StructureId | undefined })`. `main.ts` passes `(cell) => game.shape.structureAt.get(cell)`, read at call time because the shape changes with every edit.
- `src/style/stats.ts` tunables:
  - **Flat hits** (the whole town hears it): scene +4, market +2, festival +6, mend +1, raid −8, scuffle −1, sunk −2, nuke −4 (the siren and the flash), bomb −1.
  - **Share hits** (× the share of all residents whose homes were touched, 0–1): ruin −60, lightning −40, mallet −40.
  - **Fire** no longer hits per cell. While homes burn, the mood is dragged: `drag = MOOD.fireDrag (40) × share of residents whose homes are burning now`.

**Share** = (sum of `crowd.homes.get(s)` over the distinct structures touched) / `crowd.residents`. It is 0 when there is no crowd or no residents. A blast's `hit` cells and a strike's or knock's cell map to structures through `structureAt`, deduplicated per event. `engine.burning()` items carry `structure` (`engine.ts:67-73`), deduplicated per update. A cell with no structure touches no one. The silly tallies are unchanged: every fire, bomb and ruin still counts.

- [ ] **Step 1: Write the failing tests:**
  - `mood.test.ts`, `drag lowers where it settles`: `drag(40)`, `step(600)` → within 0.5 of 30; then `drag(0)`, `step(600)` → within 0.5 of 70.
  - `watch.test.ts`, `one bomb on one house barely moves it`: 1,500 residents, the blasted house holds 5 → the mood stays ≥ 69.5 (70 − 60·5/1500 = 69.8).
  - `watch.test.ts`, `a blast across a fifth of the homes drops it about twelve`: blast cells covering homes that hold 200 of 1,000 residents → 58 ± 0.5. Test the blast event alone, without a drop.
  - `watch.test.ts`, `fires drag it down while they burn and let go when they are out`: homes holding half the residents burning, after a long run of updates → within 1 of 50; with burning emptied, after a long run → within 1 of 70.
  - `watch.test.ts`, `a blast on empty ground touches no one`: cells with no structure → the mood is unchanged (no drop event), and nothing throws.
- [ ] **Step 2:** Run `npx vitest run --project unit src/ui/stats` and see it FAIL.
- [ ] **Step 3:** Implement. Keep each source in its own small function.
- [ ] **Step 4:** Run `npx vitest run --project unit src/ui/stats src/life/people && npm run typecheck && npm run lint` and see it PASS. Then run the full unit suite once.
- [ ] **Step 5:** Commit: `"Stats: happiness moves with the share of the town touched; fires weigh on it while they burn"`.
