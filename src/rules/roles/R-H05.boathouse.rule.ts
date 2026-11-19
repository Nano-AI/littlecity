// R-H05 · tier 2 · Boathouse. A house whose ground storey is at level 1 or
// below and looks straight onto water, or that touches a dock: plank walls,
// and wide double doors on the water side (J06 reads the role). The slipway
// and the net on the wall are left to the dressing rules.
import { defineRule } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { houseStructures } from '../joinery/houses.lib';

export default defineRule({
  id: 'R-H05.boathouse',
  part: 'roles',
  tier: 2,
  priority: 9950,
  about: 'Reads: structureInfo (level, touches a dock), facades (water right outside). Claims: the role. Tags plank-walls.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    const all = facades(ctx.facts);
    return houseStructures(ctx)
      .filter((s) => {
        const i = info.get(s.id);
        if (!i) return false;
        if (i.touches.some((t) => t.kind === 'dock' && t.sides.length > 0)) return true;
        return i.minY <= 1 && (all.byStructure.get(s.id) ?? []).some((f) => f.storey === 1 && f.water === 1);
      })
      .map((s) => ({ anchor: s.cells[0]!, structure: s.id }));
  },
  apply(c, out) {
    out.role(c.structure!, 'boathouse');
    out.tag(c.structure!, 'plank-walls');
  },
});
