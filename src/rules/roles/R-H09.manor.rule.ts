// R-H09 · tier 2 · Manor. A footprint of 10+ cells with 2+ storeys, or 16+
// cells in all: a hip roof (J04), dormers (J10), two chimneys (J11) and a
// portico with two small columns at the door (J06). A big house of one
// storey is not a manor (FX-06): out by the fields it is a barn (R-H18),
// else a home.
import { defineRule } from '@/resolve/engine/api';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { houseStructures } from '../joinery/houses.lib';

export default defineRule({
  id: 'R-H09.manor',
  part: 'roles',
  tier: 2,
  priority: 9910,
  about: 'Reads: structureInfo (footprint, storeys, cells). Claims: the role.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    return houseStructures(ctx)
      .filter((s) => ((info.get(s.id)?.footprint ?? 0) >= 10 && (info.get(s.id)?.storeys ?? 1) >= 2) || s.cells.length >= 16)
      .map((s) => ({ anchor: s.cells[0]!, structure: s.id }));
  },
  apply(c, out) {
    out.role(c.structure!, 'manor');
  },
});
