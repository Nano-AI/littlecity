# Shaping the land: handoff (branch `swarm/landshaping`)

## Where things are
- Data: `World.terrainEdits` (column → height) + `Edit { type: 'land', up, down }`; frozen-file notes and the codec in `docs/swarm/requests/landshaping.md`.
- `src/terrain/land.ts`: `islandOf` (always use it), derived materials (sea / river / pond, sand, rock), `editsOf`.
- `src/world/land.ts`: carrying and refusals; `src/world/land-edits.ts`: brush columns and random land edits (tests, bench).
- UI: `LAND_IDS` in `pieces.ts` (Nature drawer, first), `planLand`/`brushAt` in `actions.ts`, `ghostForLand`, the stroke in `interface.ts` (one edit per frame), brush = held length (max 3, shared by the three tools), icons `raise`/`dig`/`level`.
- View: `src/render/ground-motion.ts` (raised columns pop, dug ones sink, water closes over in order of distance from the old water); ghost terrain in `setGhost`.
- Life: `feedback` (carried structures ride, dust, splashes), `crowd.ts` `rideOf`, boats need nothing (filled water goes through `waterMask`).

## Behaviour choices (departures from the spec, deliberately)
- Level needs Shift-drag like Raise and Dig (plain drag stays orbit); a plain click levels the brush square toward the pointed column's height.
- Carrying = the stack from the ground up while cells hold blocks, plus the cell on top (floors, edge pieces). A block above a gap stays.
- Refused per column (the rest of the brush still moves): sea border, height 10, digging water, a placed dock or arch on water when raising, top of the world, a floor or block above in the way, and anything that needs dry ground (tree, path, fence, stall, stairs…) being dug into water. Houses dug into water stand there (stilt houses); raising gives them back.
- Ponds have grass banks; sea gets sand. Ponds are drawn as sea water (no flow marks).

## How to check
- `npx vitest run src/world/land*.test.ts src/resolve/land-water.test.ts src/resolve/incremental.test.ts src/townmaker/land.test.ts src/life/ships/land-boats.test.ts`
- `npx vitest run --project e2e tests/e2e/land.e2e.test.ts`; `npm run shots -- 'land-*'` (four quarters each).
- `node src/life/testing/sequence.mjs ui-playground --edit 'raise@20,24,24,26' --frames 12 --every 33 --zoom 3 --target 22,1,25`
- `node src/render/testing/land-bench.mjs` (logic, chunks per edit, steep island, browser rebuild, 20-column stroke frame).

## Open
- Speed at load 20: one land edit 12 ms shape (block edits 10.4 ms same run), browser rebuild 7.4 ms median; a 20-column stroke frame rebuilds 28 ms; steep island worst chunk 34 ms (median 7.6). Not improved.
- Raise bounce only shows its overshoot (the chunk is already at the new height); no water "flow" front beyond the delayed sinking.
