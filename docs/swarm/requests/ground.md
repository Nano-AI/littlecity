# Requests and notes from Ground (Stage 2)

Nothing blocked the work and no frozen file was changed. One thin spot in a
contract was worked around with features (1). The rest are seams the other
owners and the gate should know about.

## 1. Thin spot: what the structure hash covers for floors and edge runs

`hashStructure` covers a floor cell's own floor and its block neighbours, and
for an edge-only fence or wall run only its edge keys. A floor generator
therefore cannot see the floor beside its region (a path meeting a plaza),
and an edge run cannot see what stands beyond its ends. Both are needed to
draw them. Worked around inside the contract: joinery rules pin the answer
on the structure as features.

- `floor-link` (J21, `src/vocab/ground.vocab.ts`): one per floor cell side
  that meets another floor kind, a door, a stair foot or head, or a deck.
- `run-end` (J20, `src/vocab/ground-edges.vocab.ts`): an edge-piece end that
  runs into a structure or a cliff.

**Asked (not urgent):** if the hash ever widens, the floor kind of the four
side neighbours of a floor cell and the solidity of the cells round an edge
piece's two ends would let both features go.

## 2. For Houses

- **Doors drive paths and railings.** J21 reads `door` features (cell + dir)
  to widen a path into a doorstep in front of them; J19 reads them to rail a
  door that opens onto a drop. Neither exists in this branch (fixtures bring
  a stand-in door rule), so the first merged build is the first real test.
- **`railing` features may land on a house.** J19 puts a railing on the
  floor region in the cell if there is one, else on the stairs that arrive
  there, else on the door's building. A house generator must call
  `placeFeatures` with standard frames (or return `undefined` for types it
  does not know) or those railings will not draw. The part is
  `src/parts/ground/railing.part.ts`.
- **No `ladder` part from Ground.** The vocabulary gives `ladder` to both
  R-H04 and R-D02. To avoid two parts for one type, the dock generator draws
  its own ladders and Ground ships no `ladder.part.ts`. If Houses ships none
  either, stilt-house ladders draw as placeholder markers.
- **Roof terraces.** Fence edge pieces stand exactly on the cell boundary.
  House walls stand 0.07 inside it, so an iron railing on a roof terrace
  sits 0.07 outside the wall line. Worth a look at the gate; the fix is an
  inset in `src/gen/fence/fence.gen.ts` once the terrace's real edge is known.
- **Kitchen gardens** are gardens with a `house` block beside one of their
  cells (same level). Wheat fields need a `windmill` block within 2 steps.

## 3. For Monuments

- **`railing` on marble and arches**: same as above. A marble top with a
  plaza or path on it gets its balustrade from the floor region, which
  Ground draws; a bare marble top with a door or stair head gets it on the
  marble structure, which must call `placeFeatures`.
- **Paths on a bridge deck** are drawn as cobbles 0.7 wide at 0.012 above
  the arch's top (`(y + 1) × CELL_H`). A parapet inside 0.35 of the cell's
  centre line would cut into them.
- **Curtain walls** (R-E02) are walls touching marble or a tower side by
  side. They butt 0.1 into the neighbour's cell, expecting a face about 0.07
  inside the cell edge.

## 4. For Dressing and Life (Stage 3)

- **Sockets with real frames**: `pier-end`, `fishing-spot`, `mooring`,
  `perch` (docks); `water-jet`, `water-surface`, `perch` (fountains; new
  socket types in `src/vocab/ground-props.vocab.ts`). Fountains draw a small
  static jet so they read as running in a screenshot; an animated one can
  replace it.
- **Claimed floor slots**: J17 claims the lower path cell's edge slot under
  carved steps; J23 and J28 claim the slots under bollards, goods, the crane
  and the ramp.
- **Trees and gardens already carry some dressing**: a plain tree may have a
  bush or flowers at its foot, a path has seeded clumps and stones along its
  edges (`FLOOR.verge`), a park has round beds. D24 (wild ground) should
  thin out next to them rather than double up.
- **Baked sway**: crowns, willow curtains, reeds, wheat ears, stall awnings
  and the scarecrow's coat use the per-vertex `sway` weight. Nothing of
  Ground's is an actor.
- **Stalls tag which way they face** (`front:n|e|s|w`) and what they sell
  (`goods:*`), for customers and shop logic.

## 5. Readings of the catalogue worth a second opinion

- **R-G01 "in a courtyard"**: the `courtyards` fact counts a yard closed by
  picket fences as a courtyard; the design's definition says blocks, walls
  or cliffs. Ground follows the design: a garden closed only by fences is
  not a herb garden (so a cottage garden can have a fence all round it).
- **R-P01 palm, willow, pine** only grow from the terrain. A tree on a deck,
  a roof or marble falls through to the later lines (planter, fruit, grove,
  the mix).
- **J18 landings**: a stairs cell rises one storey over one cell, so a
  landing cannot be a flat cell. Every third cell of a long flight starts
  with a deeper tread between newel posts instead.
- **J23 cross-bracing** is drawn as raking struts at each stilt. Literal X
  braces turned to ink noise at playing zoom.
- **R-S01 goods** are chosen by town seed and cell so that neighbouring
  stalls never sell the same thing, not by structure seed alone.
- **J21 "a deck the path leads onto"**: a path runs to the edge of its cell
  toward a dock or bridge top only when it is heading straight for it (it
  continues from the opposite side) or is a lone cell, so a street along a
  quay does not grow a stub at every cell.

## 6. After art review 1 (fix pass): seams that need the other side

- **Houses, H4 (roof terrace).** Ground's half is done: a fence edge piece on
  the edge of a house roof now stands `FENCE.roofInset` (0.07) inside the
  cell line, on the wall head, and the iron is light. J19 no longer adds a
  derived railing to a cell on a house roof. Still needed from Houses: leave
  the white parapet out on a side that carries an edge piece (the house can
  read `plan.world.edges` for its own cells' sides), or the terrace still
  shows two barriers.
- **Monuments, M1 (castle stone).** A curtain wall now takes the palette
  index of the tower it touches (else of the marble) and draws
  `rampColor('tower', index)` with `PATTERN.stone` and `PALETTE.stoneShade`
  for its batter and corbel course. For the keep to match, marble in castle
  roles needs the same: `PATTERN.stone` in `RAMPS.stone[its colour]`.
- **Houses, pitched roofs.** A player can put fence edge pieces round a
  house whose roof is pitched (`ground-edges` `roofs`): the railing then
  stands at eaves level in the air. Either J04 should treat "edge pieces
  round it" like a floor (flat terrace), or Ground should not draw them
  there; say which.
- **Stairs against a wall or bank** now run 0.075 into it with closed ends
  (`STAIRS.into`). Nothing needed, but a house plinth wider than 0.075
  beyond the wall would still show a step in the join.

