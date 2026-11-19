# Animation handoff (Stage 4 life depth, branch `swarm/life-depth`)

Read `src/life/MOTION.md` first (the motion style), then this.

## Done and committed (each looked at in sequences and unit-tested)
- Stage 3 (still true): runtime, motion kit, fx pool, F01–F05, L02/L03 sails and vanes, L07, L09, L10 fireflies, birds L11–L16, boats L06/L17/L19.
- L02 smoke is MIST: 3 soft puffs a chimney (4 at dawn/dusk, fuller; dimmer at night), drifting with the wind where each puff is.
- Renderer: `src/gen/airborne.ts` (AIRBORNE pattern bit, MIST). Air is left out of the grounding picture and never makes it stale; items redraw it every 4th frame, lifted structures every other. Bench 1.08 M → 0.90 M triangles a frame.
- Flaws fixed: pigeons wheel clear of roofs (`wheelFor`, `columnTops`); birds are airborne (no shade smear); beam fades when it points at the camera; fireflies are warm points of light (param c = own colour, d = halo radius); shop panes lead at dusk (param c of a lifted structure).
- L03 mill cap turns to the wind (`src/life/mechanisms/`, sails follow via `capTurnOf`); L29 bells, clock hands (game time), fountain jets, hanging signs. Generators skip the moving piece when its part exists (`parts.has`).

## In the middle of
- Nothing half-done.

## Next, in order
1. Part L tier 2/3 not yet built: L05 leaves/petals, L10 night dressing, L14, L15, L18, L20, L30, L31, L33, L34, L35. Then gust check, then F06 sound.

## Gotchas
- Shell: heredocs mixed with other commands are refused; use Write, or short python -c edits.
- The renderer resets every item to its base frame on each `setDressing`; the runtime's `Posed` handle undoes that.
- Self-lit things show at `page glow × param a`; use `litParam()` in `dusk/glow.ts`.
- A behaviour that sets a grounded prop's matrix often costs a grounding redraw (every 4th frame): only set it when it visibly changed (see `sign.behaviour.ts`), or make the part AIRBORNE.
- Do not name a scenario with a word another gallery test filters on (`tests/e2e/gallery.e2e.test.ts`).

## Verifying motion
`node src/life/testing/sequence.mjs <scenario> [--time dusk|night|0.6 --run] --frames N --every ms --zoom Z --target x,y,z --name x` writes `.context/shots/seq/`. Tests: `recordingStage`/`step` from `src/life/testing/stage.ts`. `npm run bench` prints mean triangles and grounding redraws.
