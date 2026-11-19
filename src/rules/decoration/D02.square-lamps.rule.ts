// D02 · tier 1 · Square lamps.
//
// A square (a plaza region containing a full 3 × 3) gets a post lamp at each
// of its outer corners, on the corner slot, at least DRESSING.lampCornerGap
// cells from the next one. A square containing DRESSING.lampSquare² cells in
// a block (5 × 5) with no fountain on it gets the four-arm lamp at the centre
// of that block: the middle of its paving motif.
//
// Reads: plazas (edge cells, largest square), fountains on the region,
// clearways. Claims: the floor slot of each lamp.

import { key, keyX, keyZ, neighbor, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { plazas } from '@/resolve/facts/plazas.fact';
import type { CellPos } from '@/resolve/plan';
import { DRESSING } from '@/style/dressing';
import { largestSquareAt } from '../joinery/J22.plaza-paving.rule';
import { clearways, cornerPos } from './clearways.fact';

interface Lamp {
  pos: CellPos;
  centre: boolean;
  /** For a centre lamp on a square of even side: it stands on the corner of its cell, not on the slot. */
  back: number;
}

/** The middle of a region's largest square: the cell, and whether the true centre is that cell's south-east corner. */
export function squareCentre(cells: readonly CellKey[]): { cell: CellKey; size: number; onCorner: boolean } {
  const sq = largestSquareAt(cells);
  const half = Math.floor((sq.size - 1) / 2);
  return { cell: key(sq.x + half, sq.y, sq.z + half), size: sq.size, onCorner: sq.size % 2 === 0 };
}

export default defineRule<Lamp>({
  id: 'D02.square-lamps',
  part: 'decoration',
  tier: 1,
  priority: 980,
  about: 'Reads: plazas (squares, corners, largest square), fountains, clearways. Claims: the floor slot of each lamp.',
  find({ facts }) {
    const clear = clearways(facts);
    const out: Candidate<Lamp>[] = [];
    for (const plaza of plazas(facts).list) {
      if (!plaza.square) continue;
      const inside = new Set(plaza.cells);
      // Outer corners: two neighbouring sides with no plaza beyond them.
      const taken: [number, number][] = [];
      for (const cell of plaza.edgeCells) {
        for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]] as [Dir4, Dir4][]) {
          if (inside.has(neighbor(cell, a)) || inside.has(neighbor(cell, b))) continue;
          const pos = cornerPos(a, b);
          if (!clear.free(cell, pos) || !clear.headroom(cell, pos)) continue;
          // The corner's own place on the map, in half cells, to keep lamps apart.
          const px = keyX(cell) * 2 + (pos.includes('e') ? 1 : -1), pz = keyZ(cell) * 2 + (pos.includes('s') ? 1 : -1);
          if (taken.some(([x, z]) => Math.abs(x - px) + Math.abs(z - pz) < DRESSING.lampCornerGap * 2)) continue;
          taken.push([px, pz]);
          out.push({ anchor: cell, key: pos, data: { pos, centre: false, back: 0 } });
        }
      }
      if (plaza.largestSquare >= DRESSING.lampSquare && !plaza.cells.some((c) => facts.kinds.get(c) === 'fountain')) {
        const mid = squareCentre(plaza.cells);
        const pos: CellPos = mid.onCorner ? 'se' : 'c';
        if (!facts.kinds.has(mid.cell) && clear.free(mid.cell, pos)) {
          // A corner slot sits 0.35 from the cell's middle; the cell's corner is 0.5 out on each axis.
          out.push({ anchor: mid.cell, key: 'centre', data: { pos, centre: true, back: mid.onCorner ? 0.15 * Math.SQRT2 : 0 } });
        }
      }
    }
    return out;
  },
  claims: (c) => [slot.floor(c.anchor, c.data.pos)],
  apply(c, out, { rand }) {
    const look = Math.floor(rand('look') * 1000);
    const lamp = c.data.centre
      ? out.prop({ type: 'lamp', variant: 'four-arm', at: { cell: c.anchor, pos: c.data.pos }, params: c.data.back ? { look, back: c.data.back } : { look } })
      : out.prop({ type: 'lamp', variant: 'post', at: { cell: c.anchor, pos: c.data.pos }, params: { look } });
    out.socket({ type: 'lamp-head', owner: lamp, cell: c.anchor });
  },
});
