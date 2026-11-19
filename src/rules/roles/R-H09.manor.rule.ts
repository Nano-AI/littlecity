// R-H09 · tier 2 · Manor. A footprint of 10+ cells, or 16+ cells in all: a
// hip roof (J04), dormers (J10), two chimneys (J11) and a portico with two
// small columns at the door (J06).
import { defineRule } from '@/resolve/engine/api';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { houseStructures } from '../joinery/houses.lib';

export default defineRule({
  id: 'R-H09.manor',
  part: 'roles',
  tier: 2,
  priority: 9910,
  about: 'Reads: structureInfo (footprint, cells). Claims: the role.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    return houseStructures(ctx)
      .filter((s) => (info.get(s.id)?.footprint ?? 0) >= 10 || s.cells.length >= 16)
      .map((s) => ({ anchor: s.cells[0]!, structure: s.id }));
  },
  apply(c, out) {
    out.role(c.structure!, 'manor');
  },
});
