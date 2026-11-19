// R-D03 · tier 2 · Boardwalk: a straight run of dock cells with level land
// at both ends (a walk across a cove). It gets rope railings along both
// sides: `railing` features of variant 'rope', one per open side of each
// cell. The railing's cell is the cell you stand in ON the deck (level 1),
// so its frame is on the deck's edge, +Z out over the water.

import { above, NO_CELL, turn } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { DOCK } from '@/style/dock';
import { boardwalkOf, deckTaken, dockSide, type DockLine } from './dock-shape';

export default defineRule<DockLine>({
  id: 'R-D03.boardwalk',
  part: 'roles',
  tier: 2,
  priority: 4970,
  about: 'Reads: dock cells and the terrain beside them. Claims: the dock’s role. Emits: rope railings on both sides.',
  find({ facts }) {
    const out: Candidate<DockLine>[] = [];
    for (const s of facts.structures.values()) {
      if (s.kind !== 'dock') continue;
      const line = boardwalkOf(facts, s.cells, DOCK.boardwalkCells);
      if (line) out.push({ anchor: s.cells[0]!, structure: s.id, data: line });
    }
    return out;
  },
  apply(c, out, { facts }) {
    const structure = c.structure!;
    out.role(structure, 'boardwalk');
    for (const cell of c.data.cells) {
      const deck = above(cell);
      if (deck === NO_CELL || deckTaken(facts, cell)) continue;
      for (const dir of [turn(c.data.fwd, 1), turn(c.data.fwd, 3)]) {
        if (dockSide(facts, cell, dir) === 'open') out.feature({ type: 'railing', variant: 'rope', structure, cell: deck, dir });
      }
    }
  },
});
