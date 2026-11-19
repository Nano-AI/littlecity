// R-H03 · tier 2 · Mill house. A house touching a windmill. The role is what
// later rules read: the flour sacks and the cart by its door are D25's, the
// miller walking between mill and house is L23's.
import { defineRule } from '@/resolve/engine/api';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { houseStructures } from '../joinery/houses.lib';

export default defineRule({
  id: 'R-H03.mill-house',
  part: 'roles',
  tier: 2,
  priority: 9970,
  about: 'Reads: structureInfo (touches a windmill). Claims: the role.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    return houseStructures(ctx)
      .filter((s) => (info.get(s.id)?.touches ?? []).some((t) => t.kind === 'windmill' && !t.above))
      .map((s) => ({ anchor: s.cells[0]!, structure: s.id }));
  },
  apply(c, out) {
    out.role(c.structure!, 'mill-house');
  },
});
