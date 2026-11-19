// DEMO FIXTURE, not a catalogue rule. A role rule: every house is a cottage.
import { defineRule } from '@/resolve/engine/api';

export default defineRule({
  id: 'R-X01.demo-cottage',
  part: 'roles',
  tier: 1,
  priority: 10,
  about: 'Reads: structures. Claims: the role of each house (implicit).',
  find({ facts }) {
    return [...facts.structures.values()]
      .filter((s) => s.kind === 'house')
      .map((s) => ({ anchor: s.cells[0]!, structure: s.id }));
  },
  apply(c, out) {
    out.role(c.structure!, 'cottage');
  },
});
