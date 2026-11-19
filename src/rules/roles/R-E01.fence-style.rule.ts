// R-E01 · tier 1 · Fence style (first match wins, per fence run):
//   on a dock or bridge deck   → rope and post
//   on a roof terrace          → iron railing
//   on marble                  → stone balustrade
//   otherwise                  → white picket
//
// "On" is what a piece stands on: the block under a cell piece, or under
// either of the two cells an edge piece separates (where a person could
// stand). A run is one structure and has one style, so the earliest line
// that any of its pieces matches wins. Towers and lighthouses count as
// roofs; pillars count as marble.

import { below, edgeCells, NO_CELL, type CellKey } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import type { Structure } from '@/resolve/plan';
import { FENCE_ROLE_ORDER, fenceRoleOn, standable, type FenceRole } from '../joinery/edges-lib';

export function fenceRoleOf(f: Facts, s: Structure): FenceRole {
  let best = FENCE_ROLE_ORDER.length - 1;
  const stand = (cell: CellKey): void => {
    const under = below(cell);
    const rank = FENCE_ROLE_ORDER.indexOf(fenceRoleOn(under === NO_CELL ? undefined : f.kinds.get(under)));
    if (rank < best) best = rank;
  };
  for (const c of s.cells) stand(c);
  for (const e of s.edges) for (const c of edgeCells(e)) if (c !== NO_CELL && standable(f, c)) stand(c);
  return FENCE_ROLE_ORDER[best]!;
}

export default defineRule<{ role: FenceRole }>({
  id: 'R-E01.fence-style',
  part: 'roles',
  tier: 1,
  priority: 3990,
  about: 'Reads: the block under each cell piece and beside each edge piece of a fence run. Claims: the run’s role.',
  find({ facts }) {
    const out: Candidate<{ role: FenceRole }>[] = [];
    for (const s of facts.structures.values()) {
      if (s.kind !== 'fence') continue;
      out.push({ anchor: s.cells[0] ?? s.edges[0]! >> 1, structure: s.id, data: { role: fenceRoleOf(facts, s) } });
    }
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, c.data.role);
  },
});
