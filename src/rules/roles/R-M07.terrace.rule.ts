// R-M07 · Terrace. The default marble role: a mass with an exposed walkable
// top is paved ('top:paved'); balustrades on its drop edges come from J19.

import { above } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';

export default defineRule({
  id: 'R-M07.terrace',
  part: 'roles',
  tier: 1,
  priority: 5930,
  about: 'Reads: marble structures with no role yet. Emits: role terrace; tag top:paved if any top can be walked on.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) if (s.kind === 'marble') out.push({ anchor: s.cells[0]!, structure: s.id });
    return out;
  },
  apply(c, out, { plan }) {
    const s = plan.structures.get(c.structure!)!;
    out.role(s.id, 'terrace');
    if (s.cells.some((cell) => !plan.kinds.has(above(cell)))) out.tag(s.id, 'top:paved');
  },
});
