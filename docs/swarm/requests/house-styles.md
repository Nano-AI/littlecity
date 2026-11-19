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
  `tests/house-styles.test.ts` (not beside the code: the tuning panel imports every file in `src/style` in the browser)). For 1–6 a role still wins for what it
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

## 3. One building, not a row of strangers (fix, 2026-11-19)

Each style has a signature wall colour (`HouseStyle.wall`): Harbour cream
(5), Thatch pink (2), Tudor peach (6), Manor yellow (0), Farm blue (4),
Villa mint (3). With a style chosen and the swatch on auto, `planUse`
places every house in that colour wherever the click lands, so touching
blocks of one style are one building. The ghost frames the cells of the
building a block would join (`joinedCells` in `src/ui/ghost.ts`, drawn
through the `shimmer` boxes, since `Ghost` in the frozen `render/api.ts`
has nothing else; the whole building was already drawn translucent, but
over itself that barely showed).

What still stands between a player and a big house, found by building on a
generated island (seed 4242) with Playwright. None is in my files, so these
are requests, not changes:

1. **DONE (e026d07): houses now join across a one-level step** (see the
   design doc's merge table and `scenarios/rules/J02.split-level`). Was:
   **Sloping ground (merge logic, Logic).** Ground clicks on two touching
   columns one level apart make two buildings: a house block merges only
   across shared faces, and (x, 1, z) beside (x+1, 2, z) shares none. The
   second storey bridges them ((x, 2, z) touches (x+1, 2, z)), after which
   all twelve blocks of a 3 × 2 × 2 house on a one-step slope were one
   building. So it works, but only once storeys are added; a one-storey
   manor on a slope stays in pieces. Option: let house blocks of one colour
   also merge diagonally one level apart when the lower one's top is open
   ground, or leave it and say so in the guide.
2. **DONE (ac76a9d): R-H05 is limited to a footprint of 4 or fewer and 2
   storeys at most.** Was: **Big houses by the water become boathouses (R-H05, Houses).** R-H05
   (priority 9950) runs before the town hall (9945), the inn (9940) and the
   manor: any house with a ground storey at level 1 or below looking onto
   water is a boathouse, whatever its size. My 12-block house on the shore
   was a boathouse, not an inn. Ask: limit R-H05 to small houses (say a
   footprint of 4 or fewer), so a big one on the quay can still be an inn.
3. **A shop row in one style (design question).** Shops are separate
   buildings side by side, but houses of one style now join, so a row
   clicked in one style becomes one long building (an inn, then a manor).
   Today's ways round it: leave a gap, or set the Colour swatch to a
   different colour for every other house (touching houses of different
   colours never merge). If the owner wants terraces of one style, the
   merge rule or a "start a new building" modifier is the place for it.
4. **Restyling on top of an older house.** With a style chosen, a block on
   top of a Random (or other-style) house takes the style's colour and so
   sits on it as a separate building. That is what the spec says ("wherever
   you click"); Alt-click on the old house first copies its colour and
   style, which extends it instead.
