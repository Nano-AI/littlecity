# Shaping the land (2026-11-19)

Design section 6, "Shaping the land". Branch `swarm/landshaping`. What changed
in frozen and shared files, and what other owners need to know.

## 1. Frozen files changed

- `src/core/world.ts`, two additions, nothing else:
  - `World.terrainEdits?: ReadonlyMap<number, number>`: column index
    (x + z * 48) → height 0–10, laid over the island the seed and generator
    make. Absent when the island is as generated (raising and digging back
    removes the entry, and the field when it empties), so every existing
    world, fixture and link is the same object as before. `applyEdit` spreads
    the world, so it rides every edit and undo step.
  - `Edit` gains `{ type: 'land'; up: readonly number[]; down: readonly number[] }`
    (column indices). Raise, Dig and Level are all this edit; a brush is one
    edit; columns that cannot move are skipped, and it is refused only if
    none can. Code that switches over `Edit.type` must handle it.
- `src/scenario/**`, `tools/**`: untouched. `TownBuilder.edit` takes land
  edits as it is; its height helpers (`ground`, `onTerrain`) read the island
  as generated, so `scenarios/land/land.ts` reads reshaped heights itself.

## 2. The rule that keeps it simple: `islandOf(world, terrain)`

`src/terrain/land.ts`. Every terrain argument may be the generated island or
any island derived from it; `islandOf` lays the world's edits over its base
(memoised per edits map). `canApply`, `applyEdit`, `resolveShape`,
`terrainOf` and `Game.terrain` all go through it, so a caller holding the
generated island (a scenario, a test, the ship harness) gets the right
ground. A world with no edits always stands on the base island. Code that
builds a world of its own on a handed-in island (Grow a town) takes the
edits with `editsOf(terrain)`.

## 3. Materials (derived, never chosen)

- `MAT_POND = 5` (not in the frozen MAT table, like `MAT_RIVER = 4`): water
  shut in by land. Sea is water joined to the map's edge; a dug column in a
  channel 1–3 wide and 3+ long (or joined to a river) is `MAT_RIVER`.
  Everything that asks "is this water" still asks the height.
- **Logic** (`src/resolve/kinds.ts`, K3): a lighthouse wants the sea, so a
  pond is excluded as a river already was (`isSeaWater` in land.ts says the
  same for anyone else).

## 4. The share codec: version 4, optional sections

Version 4 = version 3 (generator byte) + after the edges: `flags` (varint),
then per set bit, lowest first, `length` (varint) + bytes. Bit 0 is the
land section. A town with no section is written exactly as before (pinned
in `src/world/land-save.test.ts`); an unknown bit decodes as "a different
version". **Mischief (`Block.ruin`)**: please take bit 1 for ruins instead of
a version of your own; nothing of this section needs to change.

## 5. Notes for other owners

- **Look**: `buildTerrainColumns(cols, plan, ink)` in `terrain.gen.ts`
  draws a few columns alone (the ghost, the bounce in
  `src/render/ground-motion.ts`); the terrain chunk key now includes the
  river flow near the chunk (a channel dug far away can turn it).
- **People** (`crowd.ts`, a dozen lines): a resident whose column moved
  rides it (`rideOf`); one whose ground went under hops to the nearest node.
- **Animation** (`src/life/feedback`): `diffTowns` reports `ground` and
  `carried`; carried things are not "erased and placed" any more.
