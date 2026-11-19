// J16 · Marble mass. Only exposed faces are emitted and top edges are
// bevelled: that is the generator's work (src/gen/marble). This rule pins the
// one thing later rules ask about: a mass whose top is level with the ground
// beside it somewhere gets the tag 'top:flush' (a path can run straight onto
// it; no coping or railing belongs on that edge).

import { above, columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';

export default defineRule({
  id: 'J16.marble-mass',
  part: 'joinery',
  tier: 1,
  priority: 840,
  about: 'Reads: marble structures and the terrain beside them. Emits: the tag top:flush.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind !== 'marble') continue;
      const mine = new Set(s.cells);
      const flush = s.cells.some((cell) => {
        if (mine.has(above(cell))) return false;
        for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
          const n = neighbor(cell, d);
          if (n === NO_CELL || mine.has(n)) continue;
          if (plan.terrain.height[columnIndex(keyX(n), keyZ(n))] === keyY(cell) + 1) return true;
        }
        return false;
      });
      if (flush) out.push({ anchor: s.cells[0]!, structure: s.id });
    }
    return out;
  },
  apply(c, out) {
    out.tag(c.structure!, 'top:flush');
  },
});
