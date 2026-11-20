# Shaping the land: handoff (branch `swarm/landshaping`)

## Where things are
- Data: `World.terrainEdits` (column → height) + `Edit { type: 'land', up, down }`; frozen-file notes and the codec in `docs/swarm/requests/landshaping.md`.
- `src/terrain/land.ts`: `islandOf` (always use it), derived materials (sea / river / pond, sand, rock), `editsOf`.
- `src/world/land.ts`: carrying and refusals; `src/world/land-edits.ts`: brush columns and random land edits (tests, bench).
- UI: `LAND_IDS` in `pieces.ts` (Nature drawer, first), `planLand`/`brushAt` in `actions.ts`, `ghostForLand`, the stroke in `interface.ts` (one edit per frame), brush = held length (max 3, shared by the three tools), icons `raise`/`dig`/`level`.
- View: `src/render/ground-motion.ts` (raised columns pop, dug ones sink, water closes over in order of distance from the old water); ghost terrain in `setGhost`.
- Life: `feedback` (carried structures ride, dust, splashes), `crowd.ts` `rideOf`, boats need nothing (filled water goes through `waterMask`).

## Behaviour choices (departures from the spec, deliberately)
- With Raise, Dig or Level held, a plain drag that starts on the land shapes it (one finger on touch); a drag that starts on the sea or beside the island orbits; Shift-drag paints from anywhere. A one-line hint shows the first time (fix of 2026-11-19: Level used to need Shift-drag and seemed dead).
- Level goes all the way to the starting height in one stroke (one undo); a Level click with brush 1 explains itself, with brush 2–3 flattens the square. Raise and Dig move one level per column per stroke. The 3-wide brush has a soft edge (corners lag a dab).
- Carrying = the stack from the ground up while cells hold blocks, plus the cell on top (floors, edge pieces). A block above a gap stays.
- Refused per column (the rest of the brush still moves): sea border, height 10, digging water, a placed dock or arch on water when raising, top of the world, a floor or block above in the way, and anything that needs dry ground (tree, path, fence, stall, stairs…) being dug into water. Houses dug into water stand there (stilt houses); raising gives them back.
- Ponds have grass banks; sea gets sand. Ponds are drawn as sea water (no flow marks).

## How to check
- `npx vitest run src/world/land*.test.ts src/resolve/land-water.test.ts src/resolve/incremental.test.ts src/townmaker/land.test.ts src/life/ships/land-boats.test.ts`
- `npx vitest run --project e2e tests/e2e/land*.e2e.test.ts` (real pointer events on generated slopes, phone touch through CDP, the six play-throughs); `npm run shots -- 'land-*'` (four quarters each).
- `node src/life/testing/sequence.mjs ui-playground --edit 'raise@20,24,24,26' --frames 12 --every 33 --zoom 3 --target 22,1,25`
- `node src/render/testing/land-bench.mjs` (logic, chunks per edit, steep island, browser rebuild, 20-column stroke frame).

## Open
- Speed at load 20: one land edit 12 ms shape (block edits 10.4 ms same run), browser rebuild 7.4 ms median; a 20-column stroke frame rebuilds 28 ms; steep island worst chunk 34 ms (median 7.6). Not improved.
- Raise bounce only shows its overshoot (the chunk is already at the new height); no water "flow" front beyond the delayed sinking.
