// R-H13 · tier 2 · Greenhouse. One storey, a footprint of at most two cells,
// and garden floor right outside on three or more sides: glass walls and a
// glass roof ('glass-walls'; the panes light up at dusk like any window).
import { type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { houseStructures } from '../joinery/houses.lib';

export default defineRule({
  id: 'R-H13.greenhouse',
  part: 'roles',
  tier: 2,
  priority: 9870,
  about: 'Reads: structureInfo (storeys, footprint), facades (garden right outside). Claims: the role. Tags glass-walls.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    const all = facades(ctx.facts);
    return houseStructures(ctx)
      .filter((s) => {
        const i = info.get(s.id);
        if (!i || i.storeys !== 1 || i.footprint > 2) return false;
        const sides = new Set<Dir4>();
        for (const f of all.byStructure.get(s.id) ?? []) if (f.garden === 1) sides.add(f.dir);
        return sides.size >= 3;
      })
      .map((s) => ({ anchor: s.cells[0]!, structure: s.id }));
  },
  apply(c, out) {
    out.role(c.structure!, 'greenhouse');
    out.tag(c.structure!, 'glass-walls');
  },
});
