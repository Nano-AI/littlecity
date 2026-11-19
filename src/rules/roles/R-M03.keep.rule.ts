// R-M03 · Keep. A marble structure at least 3 tall whose footprint holds a
// 2 × 2: battlements along every exposed edge of its walkable tops, and
// arrow slits in its upper walls.

import { above, columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, type Dir4 } from '@/core/grid';
import { KINDS } from '@/core/kinds';
import { rand } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import { structureInfo } from '@/resolve/facts/structure.fact';

export default defineRule({
  id: 'R-M03.keep',
  part: 'roles',
  tier: 2,
  priority: 5970,
  about:
    'Reads: marble structures with no role, 3+ storeys, a 2 × 2 in the footprint. Emits: role keep; a battlement on each exposed edge of a walkable top; arrow-slits on upper walls.',
  find({ plan, facts }) {
    const out = [];
    const info = structureInfo(facts);
    for (const s of plan.structures.values()) {
      if (s.kind !== 'marble') continue;
      const i = info.get(s.id);
      if (!i || i.storeys < 3) continue;
      const columns = new Set(s.cells.map((c) => columnIndex(keyX(c), keyZ(c))));
      const square = s.cells.some((c) => {
        const x = keyX(c), z = keyZ(c);
        return columns.has(columnIndex(x + 1, z)) && columns.has(columnIndex(x, z + 1)) && columns.has(columnIndex(x + 1, z + 1));
      });
      if (square) out.push({ anchor: s.cells[0]!, structure: s.id });
    }
    return out;
  },
  apply(c, out, { plan, facts }) {
    const s = plan.structures.get(c.structure!)!;
    out.role(s.id, 'keep');
    const mine = new Set(s.cells);
    const minY = structureInfo(facts).get(s.id)!.minY;
    for (const cell of s.cells) {
      const walkableTop = !plan.kinds.has(above(cell));
      for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
        const n = neighbor(cell, d);
        if (n !== NO_CELL && mine.has(n)) continue;
        const kind = n === NO_CELL ? undefined : plan.kinds.get(n);
        const ground = n !== NO_CELL && plan.terrain.height[columnIndex(keyX(n), keyZ(n))]! > keyY(cell);
        if (ground || (kind !== undefined && KINDS[kind].solid)) continue;
        if (walkableTop) out.feature({ type: 'battlement', structure: s.id, cell, dir: d });
        // Slits on the upper storeys, about one wall in three, never crowded.
        if (keyY(cell) - minY >= 1 && rand(s.seed, 'slit', cell, d) < 0.34 && (keyX(cell) + keyZ(cell) + keyY(cell)) % 2 === 0) {
          out.feature({ type: 'arrow-slit', structure: s.id, cell, dir: d });
        }
      }
    }
  },
});
