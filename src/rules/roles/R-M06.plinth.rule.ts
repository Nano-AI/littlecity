// R-M06 · Plinth. A single marble cell, one tall, standing on the ground
// beside a plaza with nothing on top: a pedestal (the generator draws it
// slimmer than a block, with a base and a cap) whose top is a 'statue-base'
// socket for D19's statue, sundial or urn.

import { above, below, neighbor, NO_CELL, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { cellInfo } from '@/resolve/facts/cell.fact';

export default defineRule({
  id: 'R-M06.plinth',
  part: 'roles',
  tier: 3,
  priority: 5940,
  about: 'Reads: one-cell marble structures on a walkable top with a plaza cell beside them and nothing above. Emits: role plinth; socket statue-base.',
  find({ plan, facts }) {
    const out = [];
    const info = cellInfo(facts);
    for (const s of plan.structures.values()) {
      if (s.kind !== 'marble' || s.cells.length !== 1) continue;
      const cell = s.cells[0]!;
      if (plan.kinds.has(above(cell)) || below(cell) === NO_CELL || !info.at(cell).walkableTop) continue;
      let plaza = false;
      for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
        const n = neighbor(cell, d);
        if (n !== NO_CELL && plan.world.floors.get(n) === 'plaza') plaza = true;
      }
      if (plaza) out.push({ anchor: cell, structure: s.id });
    }
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, 'plinth');
    out.socket({ type: 'statue-base', cell: c.anchor, structure: c.structure });
  },
});
