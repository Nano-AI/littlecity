// R-M03 · Keep. A marble structure at least 3 tall whose footprint holds a
// 2 × 2: battlements along every exposed edge of its walkable tops, and an
// opening to every two cells of wall: arrow slits below, glazed round-headed
// windows on the top storey. (The generator builds it of the towers' coursed
// stone, with string courses, quoins and a corbel table.)

import { columnIndex, keyX, keyY, keyZ } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { battlements, wallOpenings } from './R-M03.castle';
import { columnCount, grandSteps } from './R-M04.steps';

export default defineRule({
  id: 'R-M03.keep',
  part: 'roles',
  tier: 2,
  priority: 5970,
  about:
    'Reads: marble structures with no role, 3+ storeys, a 2 × 2 in the footprint. Emits: role keep; a battlement on each exposed edge of a walkable top; arrow-slits, and windows (socket window) on top storeys.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind !== 'marble' || s.cells.length < 6) continue;
      if (keyY(s.cells[s.cells.length - 1]!) - keyY(s.cells[0]!) + 1 < 3) continue; // cells ascend by level
      const columns = new Set(s.cells.map((c) => columnIndex(keyX(c), keyZ(c))));
      const square = s.cells.some((c) => {
        const x = keyX(c), z = keyZ(c);
        return columns.has(columnIndex(x + 1, z)) && columns.has(columnIndex(x, z + 1)) && columns.has(columnIndex(x + 1, z + 1));
      });
      // A mass that is mostly a flight of steps is a grand stair (R-M04), not a keep.
      if (square && grandSteps(s, plan).length * 2 < columnCount(s)) out.push({ anchor: s.cells[0]!, structure: s.id });
    }
    return out;
  },
  apply(c, out, { plan }) {
    const s = plan.structures.get(c.structure!)!;
    out.role(s.id, 'keep');
    const stair = new Set(grandSteps(s, plan).map((st) => st.cell)); // no battlements across the treads of its stair
    battlements(s, plan, out, stair);
    wallOpenings(s, plan, out, stair);
  },
});
