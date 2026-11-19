// R-H11 · tier 1 · Row house. A footprint of one or two cells, sharing side
// walls with houses of another colour on two opposite sides: its eaves align
// with the row ('in-row': J04 gives it no ridge offset and runs the ridge
// along the row) and its chimney stands on a party wall (J11).
import { type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { houseStructures } from '../joinery/houses.lib';

export default defineRule({
  id: 'R-H11.row-house',
  part: 'roles',
  tier: 1,
  priority: 9890,
  about: 'Reads: structureInfo (footprint, touches). Claims: the role. Tags in-row.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    return houseStructures(ctx)
      .filter((s) => {
        const i = info.get(s.id);
        if (!i || i.footprint > 2) return false;
        // Touching houses are other structures, and houses of one colour merge, so they differ in colour.
        const sides = new Set<Dir4>();
        for (const t of i.touches) if (t.kind === 'house') for (const d of t.sides) sides.add(d);
        return (sides.has(0) && sides.has(2)) || (sides.has(1) && sides.has(3));
      })
      .map((s) => ({ anchor: s.cells[0]!, structure: s.id }));
  },
  apply(c, out) {
    out.role(c.structure!, 'row-house');
    out.tag(c.structure!, 'in-row');
  },
});
