# Look: handoff

Branch `swarm/look`. Task was the Look section of `docs/swarm/art-review-1.md`, then measurements.

## State
- **L1 rock: done.** Banks are one ink group (`bank`), all `PATTERN.rock`; `edge` = rockiness (0 earth,
  1 rock), blended over a cell at joints; the shader draws the border. Ledges on faces of 2+ levels
  (`TERRAIN.ledge`), none where something is built at the foot.
- **L2 line weight: done.** Outline (depth jump) = `uThick`; seams and creases = `uThick * uInner`.
  Up close 1.5 outside, 0.85 inside (`LOOK.inkWidth`, `inkWidthInner`); maths in index.ts `render()`.
- **L3 dusk, L4 night: done.** Composite grades by facing: `tint` toward the light and on paper,
  `shade` away; before the tint `chroma` and `contrast`; `sea` multiplies the sea. Values in `GRADE`
  (src/style/look.ts). `gradeColor()` in grade.ts mirrors the shader for tests: change both together.
- **Measurements: done.** `node src/render/testing/bench.mjs [scenario] [--auto]` (frame, movers,
  rebuild breakdown via `ViewStats.rebuild`). Actors and spawned things are in a `movers` pool, hidden
  from the height pass, with `aloof` slots (never set `slots.moved`). Layout is lazy (`getLayout()`).
- **Not started:** the would-be-nice list (sage grass, hatching on pale stone).
- **Open:** rebuild over the 8 ms budget is time inside structure generators (Houses), not the view.
  All timings were taken at machine load 10–20: redo on a quiet machine before quoting them.

## How to check
- One pose: drive `src/render/testing/probe.ts` (`window.__look.open/camera/time/frame`) as
  `src/render/view.e2e.test.ts` does. Whole showcase: `npm run shots -- everything` (25 cameras).
- Before each commit: `npx tsc --noEmit && npx eslint . --max-warnings 0 && npx vitest run --project unit`
  (7 s) and `npx vitest run --project e2e src/render`. Full `npm run check` takes 10 minutes.
- `tests/e2e/interface.e2e.test.ts` "one-finger drag orbits" fails under machine load and passes
  alone. Not ours.

## Gotchas
- Shaders are TS template strings: NO backticks in GLSL comments. `cast` is reserved in GLSL.
- `lineAA(d, w)` uses `fwidth(d)`: if `d` comes from `fract()`, take fwidth of the unbroken coordinate
  or a hairline appears at every cell border.
- One surface shader, three passes by `#define`: page (default), `OVERLAY` (beams), `GHOST`.
- Patterns read `edge` (vEdge): grass < 1.5 = distance from sand; water = distance to shore; rock
  < 1.5 = rockiness; marble = bevel; beam = fade. `EDGE_FAR` (9) means plain.
- The sea pre-compensates the dusk tint (`uSeaKeep` in index.ts), times `grade.sea`.
- Grounding: height picture from above (`shaders/ground.ts`), redrawn when a non-mover pool changed
  or `slots.moved` (at most every other frame); shade baked at half size.
- Pools: one `VertexPool` per 16 × 16 chunk, plus `dynamic` (props, ghost) and `movers`. `put` appends
  and retires the old span; only dirty spans upload. Slot 0 = static; negative glow = ghost slot.
- Styles `look`, `grade`, `wind`, `time` are read per frame; any other style change invalidates every
  mesh (`geometryStyleKey`).
