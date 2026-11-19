// R-D02 · tier 1 · Pier: a straight run of 3+ dock cells leading away from
// land. Its seaward end gets
//   a `pier-head` feature (the seat and the lamp's place), owning the sockets
//     'pier-end' (a lamp or a flag stands here) and 'fishing-spot';
//   a `ladder` down to the water on one side of the end cell: the side the
//     default view sees (east or south).
// If something already stands on the end cell, the pier keeps its role and
// goes without both.

import { E, S, turn, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { DOCK } from '@/style/dock';
import { deckTaken, dockSide, pierOf, type Pier } from './dock-shape';

/** The side of a pier's end cell its ladder hangs on. */
export function ladderSide(seaward: Dir4): Dir4 {
  const a = turn(seaward, 1), b = turn(seaward, 3);
  return a === E || a === S ? a : b;
}

export default defineRule<Pier>({
  id: 'R-D02.pier',
  part: 'roles',
  tier: 1,
  priority: 4980,
  about: 'Reads: dock cells, the terrain and blocks beside them. Claims: the dock’s role. Emits: pier-head (sockets pier-end, fishing-spot), ladder.',
  find({ facts }) {
    const out: Candidate<Pier>[] = [];
    for (const s of facts.structures.values()) {
      if (s.kind !== 'dock') continue;
      const pier = pierOf(facts, s.cells, DOCK.pierCells);
      if (pier) out.push({ anchor: s.cells[0]!, structure: s.id, data: pier });
    }
    return out;
  },
  apply(c, out, { facts }) {
    const structure = c.structure!;
    out.role(structure, 'pier');
    const end: CellKey = c.data.cells[c.data.cells.length - 1]!;
    if (deckTaken(facts, end)) return;
    const dir = c.data.seaward;
    const head = out.feature({ type: 'pier-head', structure, cell: end, dir });
    out.socket({ type: 'pier-end', owner: head, structure, cell: end, dir });
    out.socket({ type: 'fishing-spot', owner: head, structure, cell: end, dir });
    const side = ladderSide(dir);
    if (dockSide(facts, end, side) === 'open') out.feature({ type: 'ladder', structure, cell: end, dir: side, params: { length: 1 } });
  },
});
