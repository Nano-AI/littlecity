// R-H15 · tier 1 · Cottage. The default: every house no earlier role rule
// claimed. A gable roof (J04) and a chimney with p = 0.7 (J11).
import { defineRule } from '@/resolve/engine/api';
import { houseStructures } from '../joinery/houses.lib';

export default defineRule({
  id: 'R-H15.cottage',
  part: 'roles',
  tier: 1,
  priority: 9850,
  about: 'Reads: structures. Claims: the role of every house still without one.',
  find: (ctx) => houseStructures(ctx).map((s) => ({ anchor: s.cells[0]!, structure: s.id })),
  apply(c, out) {
    out.role(c.structure!, 'cottage');
  },
});
