# Animation handoff (branch `swarm/animation`)

Read `src/life/MOTION.md` first (the motion style), then this.

## Done and committed (tier 1 complete, each looked at in sequences and unit-tested)
- Runtime (`src/life/runtime.ts`): state follows the socket; `ctx.instance` is a stand-in that restores a behaviour's pose after every dressing sync; a throwing behaviour is switched off.
- Motion kit `src/life/motion/`, effects pool `src/life/fx/`, feedback F01–F05 `src/life/feedback/`.
- L02 smoke, L03 sails + weathervanes (`src/life/wind/`, fixture `L02.smoke`).
- L07 windows, lamps, L09 beam (`src/life/dusk/`, fixture `L07.window-light`).
- Birds L11/L12/L13/L16 (`src/life/birds/`, fixtures `L11`–`L16`); boats and rings L06/L17/L19 (`src/life/boats/`, `src/life/water/`, fixture `L17.rowboats`, gallery `part.boats`, `part.birds`).
- `docs/swarm/requests/animation.md` written. Bench with life: 60 fps, CPU 0.4 ms median.

## In the middle of
- Nothing half-done. Next step is the list below.

## Next, in order
1. Merge `yaoderek/bloom-s-monkey-city-builder` again, `npm run check` green, report.
2. Tier 2/3 if budget allows, cheapest first: L29 (fountain jets at `water-jet` sockets, clock hands at `clock-hands`, bell at `bell`), L18 fishing boat (mesh and a floating behaviour exist; needs the rule and a dawn/dusk route on the sea lane), L10 fireflies, L05 falling leaves, L14 sparrows. Sound (F06) last.

## Gotchas
- Shell: compound commands with heredocs or `cd` elsewhere are refused; use the Write tool for files and plain commands from the worktree.
- The renderer resets every item to its base frame and shows it on each `setDressing`; the runtime's `Posed` handle undoes that. Spawned instances are not touched.
- Anything self-lit shows at `page glow × param a`; use `litParam()` in `dusk/glow.ts`. Window params need the structure lifted (`liftStructure`), released by day.
- Feedback sets a lifted structure back to identity before releasing (others may hold the lift).
- `npm run check` takes about 7 minutes; one phone-touch e2e test (`interface.e2e`, one-finger orbit) failed on the untouched baseline under load. Use `npx tsc --noEmit && npx eslint . --max-warnings 0 && npx vitest run --project unit` while working.

## Verifying motion
`node src/life/testing/sequence.mjs <scenario> [--edit …] [--time dusk|night|0.6 --run] --frames N --every ms --name x` writes a contact sheet to `.context/shots/seq/`. Tests step life with `recordingStage`/`step` from `src/life/testing/stage.ts`.
