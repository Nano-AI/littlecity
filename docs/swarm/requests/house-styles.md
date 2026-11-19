# House styles: the contract change (2026-11-19)

Design section 7, "House style". The orchestrator allowed one change to a
frozen file for this feature; this page records it.

## 1. `src/core/world.ts` (frozen): two optional fields

- `Block.style?: number`: the house style, 1–6. Absent or 0 means Random
  (the look rolled from the structure's seed, as before). `applyEdit` writes
  the field only on a house and only when it is non-zero, so every block
  that existed before is byte-for-byte the same object shape.
- The `placeBlock` edit gains `style?: number`. `canApply` refuses a value
  that is not 0–6 ("unknown house style"); an Auto block (or any non-house)
  ignores it.

No `setStyle` edit: nothing needs one. Undo works on whole worlds; Alt-click
only changes the hand; Change and Paint keep the field as it is.

## 2. Everything else (not frozen)

- `src/style/houses.ts`: `HOUSE_STYLES` (six named looks, append only: the
  numbers are saved), `personalityOf(..., style)`. Style 0 runs the old
  function untouched (pinned by a digest over 21 120 personalities in
  `src/style/house-styles.test.ts`). For 1–6 a role still wins for what it
  dictates (chapel, stilt house, greenhouse, boathouse, keeper's cottage,
  town hall), and the style's walls replace the rustic edge-of-town walls.
- `src/resolve/structures.ts`: `structureStyle(world, structure)`, the style
  of the lowest-seq block (whose seq is the structure id). `Structure`
  (frozen `plan.ts`) is unchanged; generators, parts and J09 read the style
  through this helper.
- `src/resolve/engine/hash.ts`: the structure hash mixes in the style when it
  is non-zero, so a Random house hashes exactly as before and a restyled one
  rebuilds.
- `src/world/save.ts`: share codec version 2 = version 1 plus, per block, a
  "styled" bit (bit 7 of the kind/colour byte) and a style byte after it.
  A town with no styled block is still written as version 1, byte for byte;
  the decoder reads both. A pre-styles link is kept as a fixture in
  `src/world/house-style.test.ts`. `save.test.ts`'s "other version" case now
  uses version 3 (`TEMD…`), since 2 is valid.
- Callers passing the style: `src/gen/house/house.gen.ts`,
  `src/parts/openings/lib.ts` (`personaOf`), `src/rules/joinery/J09.windows.rule.ts`.
  `src/parts/openings/chimney.part.ts` reads `persona.chimney` (stack and
  pots); `door.part.ts` is not touched (it reads `persona.door` as before).
