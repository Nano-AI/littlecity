// R-T05 · Dovecote. A tower exactly 3 tall with a garden within 2 cells:
// rows of dove holes with perching ledges on its top storey, and a low cone
// roof with a little lantern the birds fly in by (J13). The doves are L15's.

import { above, inBounds, key, keyX, keyY, keyZ, neighbor, NO_CELL, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';

export default defineRule({
  id: 'R-T05.dovecote',
  part: 'roles',
  tier: 3,
  priority: 8950,
  about: 'Reads: towers of height 3 with no role; gardens within 2 cells. Emits: role dovecote; dove-holes on two free sides of the top storey (socket perch).',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind !== 'tower' || s.cells.length !== 3) continue;
      const x = keyX(s.cells[0]!), y = keyY(s.cells[0]!), z = keyZ(s.cells[0]!);
      let near = false;
      for (let dx = -2; dx <= 2 && !near; dx++) {
        for (let dz = -2 + Math.abs(dx); dz <= 2 - Math.abs(dx); dz++) {
          if (inBounds(x + dx, y, z + dz) && plan.world.floors.get(key(x + dx, y, z + dz)) === 'garden') near = true;
        }
      }
      if (near) out.push({ anchor: s.cells[0]!, structure: s.id });
    }
    return out;
  },
  apply(c, out, { plan }) {
    const s = plan.structures.get(c.structure!)!;
    out.role(s.id, 'dovecote');
    const top = s.cells[s.cells.length - 1]!;
    if (plan.kinds.has(above(top))) return;
    const start = hash(s.seed, 'doves') & 3;
    let made = 0;
    for (let k = 0; k < 4 && made < 2; k += 2) {
      for (const d of [((start + k) & 3) as Dir4, ((start + k + 1) & 3) as Dir4]) {
        const n = neighbor(top, d);
        if (n === NO_CELL || plan.kinds.has(n)) continue;
        const holes = out.feature({ type: 'dove-holes', structure: s.id, cell: top, dir: d });
        out.socket({ type: 'perch', owner: holes, cell: top, dir: d, structure: s.id });
        made++;
        break;
      }
    }
  },
});
