// R-T03 · Clock tower. A tower at least 4 tall whose base is within 2 cells
// of a square (a plaza containing a full 3 × 3): a square body, a clock face
// on each free side of its top storey, a pyramid roof (J13). The hands are
// L29's, on each face's 'clock-hands' socket.

import { above, inBounds, key, keyX, keyY, keyZ, neighbor, NO_CELL, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { plazas } from '@/resolve/facts/plazas.fact';

export default defineRule({
  id: 'R-T03.clock-tower',
  part: 'roles',
  tier: 2,
  priority: 8970,
  about: 'Reads: towers of height 4+ with no role; squares (plazas fact). Emits: role clock-tower; a clock-face per free side of the top storey (socket clock-hands).',
  find({ plan, facts }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind !== 'tower' || s.cells.length < 4) continue;
      const x = keyX(s.cells[0]!), y = keyY(s.cells[0]!), z = keyZ(s.cells[0]!);
      // Plaza cells within 2 steps of the base; only then is the plazas fact worth asking for.
      let near = false;
      for (let dx = -2; dx <= 2 && !near; dx++) {
        for (let dz = -2 + Math.abs(dx); dz <= 2 - Math.abs(dx); dz++) {
          const c = inBounds(x + dx, y, z + dz) ? key(x + dx, y, z + dz) : -1;
          if (c >= 0 && plan.world.floors.get(c) === 'plaza' && plazas(facts).byCell.get(c)?.square) near = true;
        }
      }
      if (near) out.push({ anchor: s.cells[0]!, structure: s.id });
    }
    return out;
  },
  apply(c, out, { plan }) {
    const s = plan.structures.get(c.structure!)!;
    out.role(s.id, 'clock-tower');
    const top = s.cells[s.cells.length - 1]!;
    if (plan.kinds.has(above(top))) return;
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      const n = neighbor(top, d);
      if (n === NO_CELL || plan.kinds.has(n)) continue;
      const face = out.feature({ type: 'clock-face', structure: s.id, cell: top, dir: d });
      out.socket({ type: 'clock-hands', owner: face, cell: top, dir: d, structure: s.id });
    }
  },
});
