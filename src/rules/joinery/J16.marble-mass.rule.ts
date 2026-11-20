// J16 · Marble mass. Only exposed faces are emitted and a cornice runs under
// every top edge: that is the generator's work (src/gen/marble). This rule
// pins two things about a mass for the generator and for later rules:
//   'top:paved'  some top of it can be walked on (nothing stands there): the
//                generator paves those tops inside a marble coping;
//   'top:flush'  its top is level with the ground beside it somewhere: a
//                path can run straight onto it, and no coping or railing
//                belongs on that edge.

import { above, columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';

export default defineRule({
  id: 'J16.marble-mass',
  part: 'joinery',
  tier: 1,
  priority: 840,
  about: 'Reads: marble structures, what stands on them, the terrain beside them. Emits: tags top:paved and top:flush.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) if (s.kind === 'marble') out.push({ anchor: s.cells[0]!, structure: s.id });
    return out;
  },
  apply(c, out, { plan }) {
    const s = plan.structures.get(c.structure!)!;
    const mine = new Set(s.cells);
    // A temple's top is under its roof (and a bandstand's and a stoa's, R-M11, R-M12).
    const role = plan.roles.get(s.id)?.role;
    const roofed = role === 'bandstand' || role === 'stoa' || (plan.featuresByStructure.get(s.id) ?? []).some((f) => f.type === 'pediment');
    if (!roofed && s.cells.some((cell) => !plan.kinds.has(above(cell)))) out.tag(s.id, 'top:paved');
    const flush = s.cells.some((cell) => {
      if (mine.has(above(cell))) return false;
      for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
        const n = neighbor(cell, d);
        if (n === NO_CELL || mine.has(n)) continue;
        if (plan.terrain.height[columnIndex(keyX(n), keyZ(n))] === keyY(cell) + 1) return true;
      }
      return false;
    });
    if (flush) out.tag(s.id, 'top:flush');
  },
});
