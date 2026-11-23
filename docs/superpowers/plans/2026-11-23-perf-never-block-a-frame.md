# Perf: Never Block a Frame — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the stutter players feel while the first-visit town grows, while placing blocks, on the first hover and on the first tap, without changing what the town looks like once settled.

**Architecture:** No engine rewrite. Each fix spreads or shares existing work so that no single frame carries more than one heavy job: growth playback gets a per-frame time budget and dresses at most every 300 ms, the ghost preview moves from input handlers to the frame loop and yields to a dressing, the three sound systems share one AudioContext, and the two GHOST shader programs compile at idle. Regional resolve / a resolve worker are the next lever and out of scope here.

**Tech Stack:** TypeScript, three.js r187, Vite 8, Vitest 5 (`--project unit`, Node environment).

**Spec:** the Findings section below (measured 2026-11-23, headless Chrome 157, Apple M4, DPR 2, 1440×900, published build of 6df52d6).

## Findings (the spec this plan implements)

| # | Symptom | Root cause (confirmed) |
|---|---|---|
| F1 | First-visit growth: frames climb 17 → 40–110 ms as the town grows; 26–54 fps over 10 fresh runs | `growth.tick` makes up to 3 `game.edit` calls per frame (`src/ui/growth.ts:97-99`), each a whole-town `resolveShape` + geometry rebuild, and `game.poll()` (`src/app/main.ts:382`) runs a whole-town `resolveDressing` every frame after an edit (`src/resolve/staged.ts:54-62`) |
| F2 | Placing a block: p99 frame 150 ms, pointerup handlers 633 ms / pointermove 301 ms over 12 s | `hover()`/`zoom()`/`sync()` call `updateGhost()` synchronously (`src/ui/interface.ts:1039,1045,1342`); each new target cell is a whole-town `resolveShape` inside the input handler, and after a placement it lands in the same frame as the dressing |
| F3 | First tap ~110 ms (up to ~500 ms under load) | three systems each `new AudioContext()` on the first pointerdown: `src/life/sound/sound.system.ts:90`, `src/life/mischief/sound.system.ts:67`, `src/life/raid/sound.system.ts:39` (ctor cost measured 90 / 0.3 / 40 ms) |
| F4 | First hover drops a frame (worse on slow GPUs) | programs `GHOST,CSS,PX` and `GHOST,INNER,WEIGHTS,NEARER,PAGE_STARS` link on first hover; only fly-mode twins are precompiled (`src/render/index.ts:1292-1317`) |

## Global Constraints

- Settled result must be identical: same world, same shape and dressing hashes (`src/resolve/incremental.test.ts`, `staged.test.ts` stay green).
- `npm run typecheck`, `npm run lint` (`--max-warnings 0`) and `npx vitest run --project unit` stay green (baseline: 164 files, 2259 passed, 6 skipped).
- No new dependencies. Comments follow the repo's voice (plain sentences, why not what).
- Commits only on local branch `perf/edit-hitches`; never push.

## Review Focus

1. Slow machine during growth: one edit alone overruns the budget → growth must still advance at least one edit per frame when one is due, and still finish. (Task 1 test `still advances when one edit overruns the budget`.)
2. Growth finishing or skipped → the final town is dressed within one frame (no 300 ms wait after the last edit). (Task 1 test `dressDue is immediate when not growing`.)
3. Ghost after a placement → appears on the next frame without a dressing, never lost, never shown twice for one want. (Task 2 tests.)
4. Town switch / sound off then on with a shared context → a disposed-then-restarted system gets a live context, not a closed one. (Task 3 test `a fresh context after every holder released it`.)
5. Pointer leaves the canvas while a ghost is wanted → no stale ghost; `updateGhost` already clears when `hoverAt` is null, so the deferred run must read `hoverAt` at run time, not at want time. (Task 2 step 4 note.)

---

### Task 1: Growth never blocks a frame

**Files:**
- Modify: `src/ui/growth.ts` (`GrowthOptions`, `createGrowth` tick loop; new export `dressDue`)
- Modify: `src/ui/growth.test.ts` (existing test gets a frozen clock; new tests)
- Modify: `src/app/main.ts:382-388` (gate `game.poll()` with `dressDue`)

**Interfaces:**
- Produces: `GrowthOptions.budgetMs?: number` (default 8), `GrowthOptions.clock?: () => number` (default `() => performance.now()`); `export const DRESS_WHILE_GROWING_MS = 300`; `export function dressDue(now: number, lastDressed: number, growing: boolean): boolean`.

- [ ] **Step 1: Write the failing tests** in `src/ui/growth.test.ts`. Pass `clock: () => 0` to `createGrowth` in the existing test `plays about 25 edits a second…` so its "capped at 3" assertion stays deterministic. Add:

```ts
test('stops putting edits down once the frame budget is spent', () => {
  const { game, edits } = setup();
  let t = 0;
  const growth = createGrowth(game, { budgetMs: 8, clock: () => (t += 5) }); // each edit "costs" 5 ms
  growth.start(edits);
  growth.tick(0);
  growth.tick(1000); // 25 due, 3 allowed, but the budget is gone after 2
  expect(growth.left).toBe(edits.length - 2);
});

test('still advances when one edit overruns the budget', () => {
  const { game, edits } = setup();
  let t = 0;
  const growth = createGrowth(game, { budgetMs: 8, clock: () => (t += 50) });
  growth.start(edits);
  growth.tick(0);
  growth.tick(1000);
  expect(growth.left).toBe(edits.length - 1);
  for (let now = 1016; growth.active; now += 16) growth.tick(now);
  expect(growth.left).toBe(0);
});

test('dressDue is immediate when not growing, and every 300 ms while growing', () => {
  expect(dressDue(1000, 990, false)).toBe(true);
  expect(dressDue(1000, 800, true)).toBe(false);
  expect(dressDue(1100, 800, true)).toBe(true);
});
```

- [ ] **Step 2: Run** `npx vitest run --project unit src/ui/growth.test.ts` — Expected: the three new tests FAIL (`dressDue` not exported; budget ignored).

- [ ] **Step 3: Implement.** In `tick`, read `clock()` once before the loop; put down an edit while `n-- > 0 && next < queue.length`, and after each edit stop if `clock() - start >= budgetMs` (the first due edit always goes down). Leave `due -= Math.floor(due)` as is, so a slow frame drops its backlog instead of catching up. Update the `perFrame` doc comment to mention the budget. `dressDue` returns `!growing || now - lastDressed >= DRESS_WHILE_GROWING_MS`.

- [ ] **Step 4: Gate the dressing in `src/app/main.ts`.** Keep a module-level `let lastDressed = -Infinity`; call `game.poll()` only when `dressDue(now, lastDressed, ui?.growth.active ?? false)`; set `lastDressed = now` when it returns a dressing. Comment: while a town grows, its dressing follows a few times a second, not after every piece.

- [ ] **Step 5: Run** `npx vitest run --project unit src/ui/growth.test.ts src/resolve/staged.test.ts && npm run typecheck` — Expected: PASS.

- [ ] **Step 6: Commit** `git add src/ui/growth.ts src/ui/growth.test.ts src/app/main.ts && git commit -m "Growth: a time budget per frame, and its dressing a few times a second"`

### Task 2: The ghost preview waits for the frame, and yields to a dressing

**Files:**
- Modify: `src/ui/ghost.ts` (new export `createGhostPace`)
- Create: `src/ui/ghost-pace.test.ts`
- Modify: `src/ui/interface.ts` — `zoom` (~1039), `hover` (~1045), `sync` (~1342), `dressed` (~1319), `frame` (~1327)

**Interfaces:**
- Produces: `export function createGhostPace(): { want(): void; heavy(): void; frame(run: () => void): void }`. `want` marks a ghost as needed; `heavy` marks that this frame already carried a dressing; `frame` runs `run` at most once if wanted and not heavy, then clears `heavy`.

- [ ] **Step 1: Write the failing tests** in `src/ui/ghost-pace.test.ts`:

```ts
const counter = () => { let n = 0; return { run: () => void n++, get n() { return n; } }; };

test('runs once per frame however many wants came in', () => {
  const p = createGhostPace(), c = counter();
  p.want(); p.want(); p.want();
  p.frame(c.run); expect(c.n).toBe(1);
  p.frame(c.run); expect(c.n).toBe(1);
});

test('waits one frame when that frame carried a dressing', () => {
  const p = createGhostPace(), c = counter();
  p.want(); p.heavy();
  p.frame(c.run); expect(c.n).toBe(0);
  p.frame(c.run); expect(c.n).toBe(1);
});

test('a want during a heavy frame is kept, not lost', () => {
  const p = createGhostPace(), c = counter();
  p.heavy(); p.want();
  p.frame(c.run); expect(c.n).toBe(0);
  p.frame(c.run); expect(c.n).toBe(1);
  p.frame(c.run); expect(c.n).toBe(1);
});
```

- [ ] **Step 2: Run** `npx vitest run --project unit src/ui/ghost-pace.test.ts` — Expected: FAIL (`createGhostPace` not exported).

- [ ] **Step 3: Implement `createGhostPace`** in `src/ui/ghost.ts` (two booleans).

- [ ] **Step 4: Wire it in `src/ui/interface.ts`.** One `const ghostPace = createGhostPace()`. In `zoom`, `hover` and `sync`, replace the synchronous `updateGhost()` with `ghostPace.want()` (keep the `if (hoverAt)` guards). In `dressed(...)`, call `ghostPace.heavy()`. In `frame()`, call `ghostPace.frame(updateGhost)` after `growth.tick(...)`. `updateGhost` reads `hoverAt` when it runs, so a pointer that left meanwhile clears the ghost. Leave the other `updateGhost()` callers (length stepper ~754, run placement ~828, tray change ~1278) synchronous: they follow a deliberate click, not a stream of moves.

- [ ] **Step 5: Run** `npx vitest run --project unit src/ui && npm run typecheck && npm run lint` — Expected: PASS.

- [ ] **Step 6: Commit** `git commit -m "Ghost: worked out once a frame, never in the same frame as a dressing"` (with the three files).

### Task 3: One AudioContext for every sound

**Files:**
- Create: `src/life/sound/context.ts`, `src/life/sound/context.test.ts`
- Modify: `src/life/sound/sound.system.ts:90,234`, `src/life/mischief/sound.system.ts:67,317`, `src/life/raid/sound.system.ts:39,190`

**Interfaces:**
- Produces: `export function holdAudio(): AudioContext` (creates the shared context on first hold, or anew if the last one was closed; counts holders) and `export function releaseAudio(): void` (closes the context when the last holder releases).

- [ ] **Step 1: Write the failing tests** in `src/life/sound/context.test.ts`, with `vi.stubGlobal('AudioContext', Fake)` where `Fake` counts constructions and `close()` calls and sets `state = 'closed'`:
  - `three holders share one context` — 3× `holdAudio()` → same object, 1 construction.
  - `closes only when the last holder lets go` — hold×2, release → 0 closes; release → 1 close.
  - `a fresh context after every holder released it` — hold, release, hold → 2 constructions, second not closed.

- [ ] **Step 2: Run** `npx vitest run --project unit src/life/sound/context.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `context.ts` (module-level `ac: AudioContext | null`, `holders: number`).

- [ ] **Step 4: Use it.** In each `start()`, `holdAudio()` replaces `new AudioContext()`. In each `dispose()`, `releaseAudio()` replaces `ac.close()`, and only when that system holds one (its `audio` is set), so a system that never started never releases. Each system keeps its own master gain. Leave the ambient `stop()` suspend as it is: all three listen to the same `lc:sound` toggle, so they go quiet together.

- [ ] **Step 5: Run** `npx vitest run --project unit src/life && npm run typecheck && npm run lint` — Expected: PASS.

- [ ] **Step 6: Commit** `git commit -m "Sound: one AudioContext for the town, the fires and the raids"`.

### Task 4: The ghost's shaders compile at idle

**Files:**
- Modify: `src/render/api.ts:129` (add `prepareGhost?(): void;` beside `prepareEye`)
- Modify: `src/render/index.ts` (implement `prepareGhost` beside `prepareEye`, ~1292)
- Modify: `src/app/main.ts` (schedule it once at idle after the first dressing: `requestIdleCallback` with `{ timeout: 4000 }`, `setTimeout(…, 1500)` fallback, mirroring `src/ui/fly.ts:427-431`)

- [ ] **Step 1: Implement** `prepareGhost()`: once only; `renderer.compileAsync(ghostScene, camera)` and `renderer.compileAsync(ghostPostScene, postCamera)`, each with `.catch(() => undefined)`. Allocate no render target: the RawShaderMaterial program key ignores it. If the ghost view object is skipped because it is invisible or empty, compile `ghostMaterial` through a one-mesh scene instead.

- [ ] **Step 2: Verify** (no WebGL in unit tests): build, then run the link probe (Task 5 harness) on `?scenario=bench-2000`. Expected: no `linkProgram` with `GHOST` in the `hover`, `drag` or `wheel` phases, and 2 more programs linked during load (16 instead of 14).

- [ ] **Step 3: Run** `npm run typecheck && npm run lint` — PASS. **Commit** `git commit -m "Ghost shaders are compiled while the page is idle, not on the first hover"`.

### Task 5: Measure before and after (controller)

- [ ] **Step 1:** `npm run build`; point the CDP harness at `dist/` (`LC_ROOT=…/littlecity/dist`) and run: growth sweep with fresh profiles (seeds 1 2 3 4, `r r`), `suite.mjs place`, `suite.mjs panzoom`, `links.mjs`, `hover.mjs`.
- [ ] **Step 2:** Compare with the baseline (F1–F4). Target: growth p95 ≤ 33 ms with no 0.5 s window averaging above 25 ms; placement p99 ≤ 50 ms; first hover ≤ 17 ms; no `AudioContext` above 100 ms of self time in the pan/zoom profile.
- [ ] **Step 3:** Full gate: `npm run check` (typecheck, lint, unit + e2e as configured). Report the numbers in a table.

## Added 2026-11-23 from the per-frame audit (run before Task 5's measurement)

Two shared functions rebuild the same result over and over; both are memoized at the function itself, so every caller benefits and outputs stay bit-identical.

### Task 6: The sea's distance field is worked out once per mask

**Files:**
- Modify: `src/rules/life/ship-routes.ts:58` (`seaField`)
- Test: `src/rules/life/ship-routes.test.ts` (create if absent; else add to it)

**Interfaces:**
- Unchanged signature `seaField(blocked: Uint8Array): SeaField`. Callers (L42 passing sails, berths.fact, barge.ts ×2, raid/site.ts, L41 river barge) are untouched.

Evidence: `seaField` is the top self-time function in first-visit growth profiles (1.55 s of a 25 s run; the sea-lanes `distanceField` another 0.97 s): it runs on every resolve with a mask that rarely changes.

- [ ] **Step 1: Write the failing tests:** `gives the same field for the same mask without working it out again` — two calls with equal-content (different) `Uint8Array`s return the identical `SeaField` object (`toBe`); `a different mask gets its own field` — flipping one byte returns a different object whose `dist` equals a fresh uncached computation (export the uncached function as `seaFieldUncached` for the test, or compare against a snapshot of the first call made before the cache existed); `the cache holds a few masks` — after 4 distinct masks, the first is still cached.
- [ ] **Step 2: Run** `npx vitest run --project unit src/rules/life/ship-routes.test.ts` — FAIL.
- [ ] **Step 3: Implement:** keep the last 4 results keyed by an FNV-1a hash of the mask bytes, confirmed by a byte-for-byte compare (no false hits); store a private copy of the mask as the key. Before relying on sharing, check every caller and `SeaField` consumer for writes to `blocked` or `dist`; if any writes, the cache returns that caller a copy (say which in the report).
- [ ] **Step 4: Run** `npx vitest run --project unit src/rules/life src/life/ships src/life/raid src/resolve` — PASS (resolve hashes unchanged). typecheck + lint PASS.
- [ ] **Step 5: Commit** `git commit -m "The sea's distance field is worked out once for a shape of shore, not on every resolve"`.

### Task 7: A dog's mesh is made once per pose and coat

**Files:**
- Modify: `src/parts/people/dog.ts:28` (`dogMesh`)
- Test: `src/parts/people/dog.test.ts` (create if absent)

Evidence: `src/life/town/chains/dogs.ts:258-262` calls `dogMesh(p, d.coat)` for all `DOG_POSES` of every dog; each build smooths normals over vertices × lumps (146 ms in the frame loop during growth). There are only poses × coats distinct results.

- [ ] **Step 1: Write the failing test:** `the same pose and coat give the same mesh` — `dogMesh(p, c)` twice → `toBe` the same object; a different coat → a different object.
- [ ] **Step 2: Run** the test — FAIL.
- [ ] **Step 3: Implement** a `Map` keyed by `` `${pose}|${coat}` ``. Before sharing, check that `stage.spawnMesh` (and anything else given a `MeshData`) copies rather than keeps and mutates it; if anything mutates, cache and hand out a copy instead, and say so in the report.
- [ ] **Step 4: Run** `npx vitest run --project unit src/parts src/life/town` — PASS. typecheck + lint PASS.
- [ ] **Step 5: Commit** `git commit -m "A dog is drawn from a mesh made once per pose and coat"`.
