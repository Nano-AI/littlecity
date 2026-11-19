# Animation handoff (Stage 4 life depth, branch `swarm/life-depth`)

Read `src/life/MOTION.md` first (the motion style), then this.

## Done and committed (each looked at in sequences and unit-tested)
- Stage 3 (still true): runtime, motion kit, fx pool, F01–F05, L03 sails and vanes, L07, L09, L10 fireflies, birds L11–L16, boats L06/L17/L19.
- L02 smoke is MIST: 3 soft puffs a chimney (4 at dawn/dusk, fuller; dimmer at night), drifting with the wind where each puff is.
- Renderer: `src/gen/airborne.ts` (AIRBORNE bit, MIST). Air stays out of the grounding picture and never makes it stale; items redraw it every 4th frame, lifted structures every other.
- Flaws fixed: pigeons wheel clear of roofs; birds airborne (no shade smear); beam fades toward the camera; fireflies are warm points of light; shop panes lead at dusk (param c).
- L03 cap turns to the wind (sails follow via `capTurnOf`); L29 bells, clock hands (game time), fountain jets, hanging signs. Generators skip the moving piece when its part exists.
- L05 leaves/petals, L10 moon and shooting stars (composite shader), L14 sparrows, L15 doves/stork/owl/crow/duck, L18 fishing boat (gulls trail it home), L30 balloon, L31 clouds with shadows, L33 cats, L34 sheep/hens/paddock grazers, L35 butterflies/bees. F06 sound (`src/life/sound/`).

## Animation polish (branch `swarm/animation-polish`): read `docs/swarm/animation-polish.md`

### How doors work (L29: doors open as people pass through)
- Every door look's leaf is drawn by one shared file, `src/parts/openings/door-leaf.ts` (house plain/panel/arched/glazed and deck, shop, the double door's two halves, the hatch lid; the tower/lighthouse/keep leaf is `towerLeaf` in `src/parts/monuments/openings.ts`). While the `door-leaf` actor part exists (`src/parts/actors/doors/`), `door.part.ts` and `towerDoor` draw a dark doorway (`INTERIOR`) where the leaf was, and rule `L29.door-leaves` puts one `door-leaf` actor at every door's 'door' socket (and one per hatch the graph derives). Shut, the actor stands exactly where the still leaf was: the static look is unchanged.
- Leaves open OUTWARD about a vertical hinge (`hingesOf`: 110° for houses and shops, 100° for each half of a double door, 105° towers), clear of the doorstep's pots, barrel and lantern; a hatch lid flops over onto the terrace (172°).
- Who needs which door is the crowd's: `src/life/people/doors.ts` (the door table, keyed by `NavDoor.feature`). Each step the crowd claims doors for anyone within `DOORS.reach` of a threshold, `DOORS.lead` seconds from coming out, or within `DOORS.clear` past it; nobody steps into a doorway until its door is fully open or while somebody comes the other way (they wait `DOORS.wait` short of it). It holds `DOORS.linger` after the last person, so two in quick succession keep it open. Shops stand open by day, opening and shutting up to `DOORS.shopSpread` seconds apart. A town just opened or edited finds its doors as they should be.
- `src/life/doors/door-leaf.behaviour.ts` only draws the angle (eased, on twos), and touches the matrix only while it changes or the house bounces: ~100 shut doors cost nothing a frame. Actors live in the movers pool, so leaves add no draw call.

### Castle life (L36 garrison, L37 rider)
- `src/rules/life/castle.lib.ts` finds castles (touching or overlapping keep, curtain walls, gatehouses, castle turrets; a keep, or 8+ wall cells with a gatehouse or turret) and their gate (a passage by the walls, else a door). Rules `L36.garrison`, `L37.rider` emit one actor each (drawn by nothing); `src/life/people/garrison.system.ts` runs `troop.ts` and `rider.ts` and draws them piece by piece.
- Troop: one body on a track (`track.ts`, a route sampled with walk.ts at lane 0): ranks `GARRISON.spacing` apart, files `GARRISON.file` either side, so corners wheel; one stride from the distance marched, so in step. Patrol: round the walls within 3 cells of them, else there and back along the longest stretch. Halts at the gate each lap; at dusk and dawn longer, the files facing each other; at night two sentries with torches at the gate and the rest file in through it.
- Rider: tethered a cell out from the gate; by day `RIDER.rides` rides a day: gate → nearest square → across it → back, trotting, walking into sharp turns and through crowds. Horse: `src/parts/people/horse.ts` (walk and trot on twos, legs stepping with the ground, tail flicks).
- Residents wait for soldiers and the horse (`obstacles` in crowd options; `src/life/doors/table.ts` shares the crowd, the door table and those bodies per stage). L23 places no lone guard on a garrisoned keep. Debug: `window.__lcGarrison`.

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
