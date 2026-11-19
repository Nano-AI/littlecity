// R-T02 · Castle turret. A tower that touches marble or wall pieces on two
// or more of its sides: a crenellated top on corbels, arrow slits instead of
// windows (J13), and a staff for a banner (D13, on the cap's flag-mount).

import { edgeOf, neighbor, NO_CELL, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';

export default defineRule({
  id: 'R-T02.castle-turret',
  part: 'roles',
  tier: 2,
  priority: 8980,
  about: 'Reads: towers with no role; marble blocks, wall pieces and wall edges beside them. Emits: role castle-turret.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind !== 'tower') continue;
      const sides = new Set<Dir4>();
      for (const cell of s.cells) {
        for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
          const n = neighbor(cell, d);
          const kind = n === NO_CELL ? undefined : plan.kinds.get(n);
          const e = edgeOf(cell, d);
          if (kind === 'marble' || kind === 'wall' || (e !== NO_CELL && plan.world.edges.get(e) === 'wall')) sides.add(d);
        }
      }
      if (sides.size >= 2) out.push({ anchor: s.cells[0]!, structure: s.id });
    }
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, 'castle-turret');
  },
});
