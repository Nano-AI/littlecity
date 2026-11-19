// R-E02 · tier 1 · Wall style (first match wins, per wall run):
//   touching marble or a tower  → crenellated curtain wall, one storey tall
//                                 (people cannot walk on it)
//   around a garden             → low stone wall, with creepers p = 0.4
//   otherwise                   → the spike's low wall
//
// "Touching": a cell piece with marble or a tower beside it, or an edge
// piece with marble or a tower in one of the cells it separates, or in the
// cells beyond one of its free ends (the wall runs into it). Standing ON
// marble does not count: that is a parapet, and stays low.
// "Around a garden": a cell piece on or beside a garden cell, or an edge
// piece with a garden cell on either side.

import { edgeCells, neighbor, NO_CELL, type CellKey } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import type { Structure } from '@/resolve/plan';
import { WALL } from '@/style/edges';
import { cellsBeyond, DIRS, edgeEndIsFree, type WallRole } from '../joinery/edges-lib';

export function wallRoleOf(f: Facts, s: Structure): WallRole {
  const castle = (c: CellKey): boolean => c !== NO_CELL && (f.kinds.get(c) === 'marble' || f.kinds.get(c) === 'tower');
  const garden = (c: CellKey): boolean => c !== NO_CELL && f.world.floors.get(c) === 'garden';
  let byGarden = false;
  for (const c of s.cells) {
    if (DIRS.some((d) => castle(neighbor(c, d)))) return 'curtain-wall';
    if (garden(c) || DIRS.some((d) => garden(neighbor(c, d)))) byGarden = true;
  }
  for (const e of s.edges) {
    const sides = edgeCells(e);
    if (sides.some(castle)) return 'curtain-wall';
    for (const end of [0, 1] as const) {
      if (edgeEndIsFree(f, e, end, 'wall') && cellsBeyond(e, end).some(castle)) return 'curtain-wall';
    }
    if (sides.some(garden)) byGarden = true;
  }
  return byGarden ? 'garden-wall' : 'low-wall';
}

export default defineRule<{ role: WallRole }>({
  id: 'R-E02.wall-style',
  part: 'roles',
  tier: 1,
  priority: 3980,
  about: 'Reads: marble and towers beside a wall run, garden floors on or beside it. Claims: the run’s role. Tags a garden wall with creepers by seeded chance.',
  find({ facts }) {
    const out: Candidate<{ role: WallRole }>[] = [];
    for (const s of facts.structures.values()) {
      if (s.kind !== 'wall') continue;
      out.push({ anchor: s.cells[0] ?? s.edges[0]! >> 1, structure: s.id, data: { role: wallRoleOf(facts, s) } });
    }
    return out;
  },
  apply(c, out, { rand }) {
    out.role(c.structure!, c.data.role);
    if (c.data.role === 'garden-wall' && rand('creepers') < WALL.creepers) out.tag(c.structure!, 'creepers');
  },
});
