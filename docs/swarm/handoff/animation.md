# Animation handoff (branch `swarm/animation`)

Read `src/life/MOTION.md` first (the motion style), then this.

## Done and committed (tier 1 complete, each looked at in sequences and unit-tested)
- Runtime (`src/life/runtime.ts`): state follows the socket; `ctx.instance` is a stand-in that restores a behaviour's pose after every dressing sync; a throwing behaviour is switched off.
- Motion kit `src/life/motion/`, effects pool `src/life/fx/`, feedback F01–F05 `src/life/feedback/`.
- L02 smoke, L03 sails + weathervanes (`src/life/wind/`, fixture `L02.smoke`).
- L07 windows, lamps, L09 beam (`src/life/dusk/`, fixture `L07.window-light`).
- Birds L11/L12/L13/L16 (`src/life/birds/`, fixtures `L11`–`L16`); boats and rings L06/L17/L19 (`src/life/boats/`, `src/life/water/`, fixture `L17.rowboats`, gallery `part.boats`, `part.birds`).
- Tier 2: L10 fireflies (`src/life/dusk/firefly.behaviour.ts`, fixture `L10.fireflies`).
- `docs/swarm/requests/animation.md` written. Bench with life: 60 fps on a quiet machine, CPU 0.5 ms median; triangles drawn go from 0.29 M to 1.0 M on frames where the grounding picture redraws.

## In the middle of
- Nothing half-done. Next step is the list below.

## Next, in order
1. Main is merged up to 5418dac and `npm run check` is green. Merge again before reporting if main moved.
2. More of tier 2/3, cheapest first: L18 fishing boat (mesh and a floating behaviour exist; needs the rule and a dawn-out, dusk-home route on the sea lane), L05 falling leaves, L14 sparrows, L15 characters. Sound (F06) last.
3. Not doable without another owner (see the requests file): the mill cap yawing (baked by Houses' generator); swinging bells, clock hands and animated fountain jets (the tower and fountain generators already bake static ones: an actor would draw them twice).

## Gotchas
- Shell: compound commands with heredocs or `cd` elsewhere are refused; use the Write tool for files and plain commands from the worktree.
- The renderer resets every item to its base frame and shows it on each `setDressing`; the runtime's `Posed` handle undoes that. Spawned instances are not touched.
- Anything self-lit shows at `page glow × param a`; use `litParam()` in `dusk/glow.ts`. Window params need the structure lifted (`liftStructure`), released by day.
- Feedback sets a lifted structure back to identity before releasing (others may hold the lift).
- `npm run check` takes about 75 s now (the interface browser tests close their pages after each test; before that, open pages of living towns starved the GPU). Do not add timing assertions to unit tests: the machine is often very busy.
- Do not name a scenario or part with a word another gallery test filters on without checking `tests/e2e/gallery.e2e.test.ts`.

## Verifying motion
`node src/life/testing/sequence.mjs <scenario> [--edit …] [--time dusk|night|0.6 --run] --frames N --every ms --name x` writes a contact sheet to `.context/shots/seq/`. Tests step life with `recordingStage`/`step` from `src/life/testing/stage.ts`.
