// R-T06 · Campanile. The tallest tower in town, if it is at least 6 tall
// (town-wide): a square bell tower with an open belfry on its top storey and
// a pyramid roof (J13). The bell rings at dusk (L29, on the 'bell' socket).

import { above } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { townFacts } from '@/resolve/facts/town.fact';

export default defineRule({
  id: 'R-T06.campanile',
  part: 'roles',
  tier: 2,
  priority: 8940,
  townWide: true,
  about: 'Reads: townFacts.tallestByKind (town-wide). Emits: role campanile on the tallest tower if it has 6+ storeys and no role; a belfry on its top cell (socket bell).',
  find({ plan, facts }) {
    const tallest = townFacts(facts).tallestByKind.get('tower');
    if (!tallest || tallest.storeys < 6) return [];
    const s = plan.structures.get(tallest.id);
    return s ? [{ anchor: s.cells[0]!, structure: s.id }] : [];
  },
  apply(c, out, { plan }) {
    const s = plan.structures.get(c.structure!)!;
    out.role(s.id, 'campanile');
    const top = s.cells[s.cells.length - 1]!;
    if (plan.kinds.has(above(top))) return;
    const belfry = out.feature({ type: 'belfry', structure: s.id, cell: top });
    out.socket({ type: 'bell', owner: belfry, cell: top, structure: s.id });
  },
});
