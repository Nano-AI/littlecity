// R-H12 · tier 2 · Cliff house. A side of the house abuts terrain rising 2+
// levels above its floor: no windows on that side (there is no facade
// there), a stone ground storey ('stone-ground'), and a balcony on the
// opposite side (J09 places it, on the top storey).
import { defineRule } from '@/resolve/engine/api';
import { cliffSide, houseStructures } from '../joinery/houses.lib';

export default defineRule({
  id: 'R-H12.cliff-house',
  part: 'roles',
  tier: 2,
  priority: 9880,
  about: 'Reads: terrain beside the house\'s cells. Claims: the role. Tags stone-ground.',
  find: (ctx) =>
    houseStructures(ctx)
      .filter((s) => cliffSide(ctx, s) !== null)
      .map((s) => ({ anchor: s.cells[0]!, structure: s.id })),
  apply(c, out) {
    out.role(c.structure!, 'cliff-house');
    out.tag(c.structure!, 'stone-ground');
  },
});
