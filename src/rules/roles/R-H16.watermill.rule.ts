// R-H16 · tier 2 · Watermill (RC-03). A house on a river bank is its mill:
//
//   a house of 2 or more cells whose ground storey stands at level 1 (on the
//   bank, at the water's edge) and has a facade with river water right
//   outside it, level with the ground (river.lib.ts: generator 2's river,
//   or a channel with a bank within 3 on both sides);
//   at most one mill to a reach of river: of candidates within 8 of each
//   other, the lowest id;
//   not a house that stands over the water (a stilt house, R-H04, decided
//   first), nor one on the sea or a wide lagoon (those stay boathouses).
//
// Draws: a timber wheel housing and axle bearing on the water side ('mill-
// race' feature, J30 places it; it owns the 'wheel-hub' socket) where the
// undershot wheel turns (the 'water-wheel' actor, R-H98, turned by its
// behaviour); a timber weir with a foam line across the stream beside it,
// and flour sacks at the land door (R-H98). Plank upper storey.
//
// Priority 9955: before the boathouse (9950), which would take the same
// house by the water.

import { keyX, keyZ, neighbor, NO_CELL, type Dir4 } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { houseStructures } from '../joinery/houses.lib';
import { riverAt } from './river.lib';

/** Two mills stand at least this far apart (Chebyshev, columns). */
const MILL_SPACING = 8;

export interface MillSide {
  cell: number;
  dir: Dir4;
}

/** The facade of a house that a mill wheel would turn on: the middle one of its ground storey's river sides. */
export function millSide(s: { id: number; cells: readonly number[] }, ctx: Parameters<typeof facades>[0]): MillSide | null {
  const sides = (facades(ctx).byStructure.get(s.id) ?? []).filter((f) => {
    if (f.storey !== 1 || f.water !== 1 || f.touching) return false;
    const n = neighbor(f.cell, f.dir);
    return n !== NO_CELL && riverAt(ctx.terrain, keyX(n), keyZ(n));
  });
  if (sides.length === 0) return null;
  const f = sides[Math.floor((sides.length - 1) / 2)]!;
  return { cell: f.cell, dir: f.dir };
}

export default defineRule<MillSide>({
  id: 'R-H16.watermill',
  part: 'roles',
  tier: 2,
  priority: 9955,
  about: 'Reads: structureInfo (cells, level), facades (river water right outside the ground storey), the terrain (river or channel). Claims: the role; one mill to 8 columns.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    const cands: (Candidate<MillSide> & { x: number; z: number })[] = [];
    for (const s of houseStructures(ctx)) {
      const i = info.get(s.id);
      if (!i || s.cells.length < 2 || i.minY !== 1 || ctx.plan.roles.has(s.id)) continue;
      const side = millSide(s, ctx.facts);
      if (!side) continue;
      cands.push({ anchor: s.cells[0]!, structure: s.id, data: side, x: keyX(side.cell), z: keyZ(side.cell) });
    }
    return cands
      .filter((c) => !cands.some((o) => o.structure! < c.structure! && Math.max(Math.abs(o.x - c.x), Math.abs(o.z - c.z)) <= MILL_SPACING))
      .map(({ anchor, structure, data }) => ({ anchor, structure, data }));
  },
  apply(c, out) {
    out.role(c.structure!, 'watermill');
  },
});
