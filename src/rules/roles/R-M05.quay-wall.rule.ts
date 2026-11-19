// R-M05 · Quay wall. Marble at level 0 or 1 next to open water: bollards
// with mooring rings along the water's edge (every second cell), and a
// narrow stair down the face to the water every six cells.

import { above, keyX, keyY, keyZ, neighbor, NO_CELL, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { openWater } from '@/resolve/facts/lib';
import type { Facts } from '@/resolve/facts/api';
import type { Structure } from '@/resolve/plan';

/** The water-facing sides of a marble structure's low, open-topped cells. */
function quayEdges(s: Structure, f: Facts): { cell: number; dir: Dir4 }[] {
  const out: { cell: number; dir: Dir4 }[] = [];
  for (const cell of s.cells) {
    if (keyY(cell) > 1 || f.kinds.has(above(cell))) continue;
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      const n = neighbor(cell, d);
      if (n === NO_CELL || f.kinds.has(n)) continue;
      if (openWater(f, keyX(n), keyZ(n))) out.push({ cell, dir: d });
    }
  }
  return out;
}

export default defineRule({
  id: 'R-M05.quay-wall',
  part: 'roles',
  tier: 2,
  priority: 5950,
  about:
    'Reads: marble structures with no role and a cell at y ≤ 1 beside open water. Emits: role quay-wall; a bollard (socket mooring) on every second water-side cell; a quay-stair every sixth.',
  find({ plan, facts }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind === 'marble' && quayEdges(s, facts).length) out.push({ anchor: s.cells[0]!, structure: s.id });
    }
    return out;
  },
  apply(c, out, { plan, facts }) {
    const s = plan.structures.get(c.structure!)!;
    out.role(s.id, 'quay-wall');
    const edges = quayEdges(s, facts);
    const sidesOf = new Map<number, number>();
    for (const e of edges) sidesOf.set(e.cell, (sidesOf.get(e.cell) ?? 0) + 1);
    for (const { cell, dir } of edges) {
      const along = dir === 0 || dir === 2 ? keyX(cell) : keyZ(cell);
      // A stair needs a straight stretch of quay: not a corner, not a lone block in the water.
      if (along % 6 === 2 && sidesOf.get(cell) === 1) out.feature({ type: 'quay-stair', structure: s.id, cell, dir });
      else if (along % 2 === 0) {
        const bollard = out.feature({ type: 'bollard', structure: s.id, cell, dir });
        out.socket({ type: 'mooring', owner: bollard, cell, dir, structure: s.id });
      }
    }
  },
});
