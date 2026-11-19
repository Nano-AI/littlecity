# Animation handoff (branch `swarm/animation`)

Read `src/life/MOTION.md` first (the motion style), then this.

## Done and committed
- Runtime (`src/life/runtime.ts`): state follows the socket; `ctx.instance` is a stand-in that restores a behaviour's pose after every dressing sync; a throwing behaviour is switched off.
- Motion kit `src/life/motion/` (ease, twos, pose), effects pool `src/life/fx/`, feedback F01–F05 `src/life/feedback/` (tests + looked at).
- L02 smoke, L03 sails + weathervanes (`src/life/wind/`, fixture `L02.smoke`). The L03 stand-in in `scenarios/houses/standins.ts` is removed.
- Brought over from two dead forks, unit tests green, gallery shots look good, motion NOT yet reviewed by eye: birds L11/L12/L13/L16 (`src/life/birds/`, tests exist), boats and rings L06/L17/L19 (`src/life/boats/`, `src/life/water/`, `src/rules/life/sea-lanes.fact.ts`; NO tests and NO rule fixtures yet).
- Main (`yaoderek/bloom-s-monkey-city-builder`) merged once at c6eebfa.

## In the middle of
- Dusk things (`src/life/dusk/`): L07 window-light (rule, behaviour, occupancy API), lamps system, L09 beam + pool. Code written and typechecks; fixture `scenarios/rules/L07.window-light.scenario.ts` has a failing expect (count of houses) and nothing has been looked at yet. No tests yet.

## Next, in order
1. Finish dusk: fix fixture, look at dusk/night shots and an evening sequence, add `dusk.test.ts`, commit.
2. Boats: fixtures `L06/L17/L19` + a test file; look at motion sequences. Birds: look at motion sequences.
3. Feedback in the real app at dusk; `npm run bench` with life running; write `docs/swarm/requests/animation.md` (cap cannot yaw: baked by the windmill generator; per-pane window order is the shader's).
4. Merge main again, `npm run check` green, report. Then tier 2/3 (L05, L10, L14, L15, L18, L20, L29…), sound last.

## Gotchas
- Shell: compound commands with heredocs or `cd` elsewhere are refused; use the Write tool for files and plain commands from the worktree.
- The renderer resets every item to its base frame and shows it on each `setDressing`; the runtime's `Posed` handle undoes that. Spawned instances are not touched.
- Anything self-lit shows at `page glow × param a`; use `litParam()` in `dusk/glow.ts`. Window params need the structure lifted (`liftStructure`), released by day.
- Feedback sets a lifted structure back to identity before releasing (others may hold the lift).
- `npm run check` takes about 7 minutes; one phone-touch e2e test (`interface.e2e`, one-finger orbit) failed on the untouched baseline under load. Use `npx tsc --noEmit && npx eslint . --max-warnings 0 && npx vitest run --project unit` while working.

## Verifying motion
`node src/life/testing/sequence.mjs <scenario> [--edit …] [--time dusk|night|0.6 --run] --frames N --every ms --name x` writes a contact sheet to `.context/shots/seq/`. Tests step life with `recordingStage`/`step` from `src/life/testing/stage.ts`.
