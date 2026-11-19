# Animation handoff (Stage 4 life depth, branch `swarm/life-depth`)

Read `src/life/MOTION.md` first (the motion style), then this.

## Done and committed (each looked at in sequences and unit-tested)
- Stage 3 (still true): runtime, motion kit, fx pool, F01–F05, L03 sails and vanes, L07, L09, L10 fireflies, birds L11–L16, boats L06/L17/L19.
- L02 smoke is MIST: 3 soft puffs a chimney (4 at dawn/dusk, fuller; dimmer at night), drifting with the wind where each puff is.
- Renderer: `src/gen/airborne.ts` (AIRBORNE bit, MIST). Air stays out of the grounding picture and never makes it stale; items redraw it every 4th frame, lifted structures every other.
- Flaws fixed: pigeons wheel clear of roofs; birds airborne (no shade smear); beam fades toward the camera; fireflies are warm points of light; shop panes lead at dusk (param c).
- L03 cap turns to the wind (sails follow via `capTurnOf`); L29 bells, clock hands (game time), fountain jets, hanging signs. Generators skip the moving piece when its part exists.
- L05 leaves/petals, L10 moon and shooting stars (composite shader), L14 sparrows, L15 doves/stork/owl/crow/duck, L18 fishing boat (gulls trail it home), L30 balloon, L31 clouds with shadows, L33 cats, L34 sheep/hens/paddock grazers, L35 butterflies/bees. F06 sound (`src/life/sound/`).

## Not done
- L20 rower. L10 bunting glow (Dressing's bunting part has no `PATTERN.glow` bulbs; add them, then add 'bunting' to `LAMP_TYPES`).
- Gust front: checked numerically (wind field), not convincingly by eye in contact sheets.

## Next, in order
1. L20 rower (two piers 10+ apart; a rowboat between their pier ends, through open water only).
2. A second look at clouds (they only show over the paper round the map) and the cat's size at playing zoom.

## Gotchas
- Shell: heredocs mixed with other commands are refused; use Write, or short python -c edits.
- Only one behaviour per actor type: `small-bird` dispatches by variant (`birds/characters.behaviour.ts`).
- A behaviour that sets a grounded prop's matrix often costs a grounding redraw: set it only when it changed, or make the part AIRBORNE.
- Overlay params: MIST a = opacity, c > 0.5 = cloud rim, d > 0 = flat soft disc of radius d; beam c > 0.5 = own colour, d = point-light radius.
- Do not name a scenario with a word another gallery test filters on (`tests/e2e/gallery.e2e.test.ts`).

## Verifying motion
`node src/life/testing/sequence.mjs <scenario> [--time dusk|night|0.6 --run] --frames N --every ms --zoom Z --target x,y,z --name x` writes `.context/shots/seq/`. Tests: `recordingStage`/`step` from `src/life/testing/stage.ts`. `npm run bench` prints mean triangles and grounding redraws.
