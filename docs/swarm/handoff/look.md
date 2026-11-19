# Look: handoff

Branch `swarm/look`. Task: Look section of `docs/swarm/art-review-1.md`, then bench.
All four must-fix notes and the measurements are done; see State.

## State
- **L1 rock faces: done.** Banks are one ink group (`bank`), all `PATTERN.rock`; `edge` = rockiness
  (0 earth, 1 rock), blended across a cell at joints; shader draws the border. Ledges on faces of 2+
  levels (`TERRAIN.ledge`), suppressed where something is built at the foot. `PALETTE.rock` is warmer.
- **L2 line weight by zoom: done.** Outline (depth jump) uses `uThick`; seams and creases use
  `uThick * uInner`. Up close: `LOOK.inkWidth` 1.5 outside, `inkWidthInner` 0.85 inside; equal below
  playing zoom. Maths in index.ts `render()`.
- **L3 dusk, L4 night: done** (one mechanism). The composite grades by facing: `tint` on faces toward
  the light and on paper, `shade` on faces away; before the tint, `chroma` (pre-saturation) and
  `contrast` (brightness curve); `sea` multiplies the sea alone. Values per part in `GRADE`
  (src/style/look.ts). `gradeColor()` in grade.ts mirrors the shader for tests: change both together.
- **Bench and grounding cost: done.** `node src/render/testing/bench.mjs [scenario] [--auto]` prints
  frame time, movers, and a rebuild breakdown (`ViewStats.rebuild`, additive in api.ts). Actors and
  spawned things live in a `movers` pool that is hidden from the height pass and whose slots are
  `aloof` (never set `slots.moved`). Layout is lazy (`getLayout()`); `anchorFrames` is a standing map.
- **Left:** would-be-nice list (sage grass, hatching on pale stone) not started. Rebuild over budget
  is generator time (Houses), not the view. Numbers were taken on a machine at load 10–20: redo
  them on a quiet one before quoting.

## How to check
- `npm run shots -- everything` (25 cameras, slow). One pose fast: `node .context/pose-shot.mjs`
  is NOT committed; use `src/render/testing/probe.ts` (`window.__look.open/camera/time/frame`) as
  `src/render/view.e2e.test.ts` does.
- Before each commit: `npx tsc --noEmit && npx eslint . --max-warnings 0 && npx vitest run --project unit`
  (7 s). Full `npm run check` takes 10 min; run it at the end.
- `tests/e2e/interface.e2e.test.ts` "one-finger drag orbits" fails under machine load (long-press
  fires before the drag); it passes alone. Not ours.

## Gotchas
- Shaders are TS template strings: no backticks in GLSL comments. `cast` is a reserved word in GLSL.
- `lineAA(d, w)` uses `fwidth(d)`: if `d` comes from `fract()`, take fwidth of the unbroken
  coordinate instead or a hairline appears at every cell border.
- One surface shader, three passes by `#define`: page (default), `OVERLAY` (beams), `GHOST`.
- Patterns read `edge` (vEdge): grass < 1.5 = distance from sand; water = distance to shore; rock
  < 1.5 = rockiness; marble = bevel; beam = fade. `EDGE_FAR` (9) means "plain".
- Grade (`src/render/grade.ts`) is applied in `shaders/composite.ts` as tint × colour + lift, then
  saturation; glow (alpha of the colour target) bypasses it. The sea pre-compensates the dusk tint
  (`uSeaKeep`, index.ts).
- Grounding: height picture from above (`shaders/ground.ts`), redrawn when a pool changed or
  `slots.moved` (at most every other frame). Anything with a slot that moves triggers it.
- Pools: one `VertexPool` per 16 × 16 chunk + one dynamic; `put` appends and retires the old span;
  only dirty spans upload. Slot 0 = static; a negative glow param marks the view's ghost slots.
- Style: values in modules `look`, `grade`, `wind`, `time` are read per frame; any other style
  change invalidates every mesh (`geometryStyleKey` in index.ts).
- Terrain hash covers blocks/floors only at cells beside a step (they square corners, stop ledges).
