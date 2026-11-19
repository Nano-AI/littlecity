// R-H10 · tier 1 · Townhouse. A footprint of exactly one cell, three or more
// storeys: a stepped gable (J04 reads the role), and a balcony on each upper
// storey with p = 0.5 (J09 places them on the door side, once it is known).
import { defineRule } from '@/resolve/engine/api';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { houseStructures } from '../joinery/houses.lib';

export default defineRule({
  id: 'R-H10.townhouse',
  part: 'roles',
  tier: 1,
  priority: 9900,
  about: 'Reads: structureInfo (footprint, storeys). Claims: the role.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    return houseStructures(ctx)
      .filter((s) => {
        const i = info.get(s.id);
        return i !== undefined && i.footprint === 1 && i.storeys >= 3;
      })
      .map((s) => ({ anchor: s.cells[0]!, structure: s.id }));
  },
  apply(c, out) {
    out.role(c.structure!, 'townhouse');
  },
});
