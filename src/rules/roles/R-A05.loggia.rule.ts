// R-A05 · Loggia. A hanging run anchored on a house, with nothing on it: an
// open balcony. Each cell gets a 'loggia-rail' (the arch generator swaps its
// stone parapet for a white balustrade); the door from the house is J26's.

import { defineRule } from '@/resolve/engine/api';
import { archRuns, hangingRun } from '../joinery/J15.arch-runs.fact';

export default defineRule({
  id: 'R-A05.loggia',
  part: 'roles',
  tier: 2,
  priority: 6950,
  about: 'Reads: arch structures that are one hanging run with nothing on it, anchored on a house. Emits: role loggia; a loggia-rail per cell.',
  find({ plan, facts }) {
    const out = [];
    for (const [id, runs] of archRuns(facts).byStructure) {
      const h = hangingRun(plan, runs);
      if (h && plan.kinds.get(h.anchor) === 'house') out.push({ anchor: plan.structures.get(id)!.cells[0]!, structure: id });
    }
    return out;
  },
  apply(c, out, { plan }) {
    const id = c.structure!;
    out.role(id, 'loggia');
    for (const cell of plan.structures.get(id)!.cells) out.feature({ type: 'loggia-rail', structure: id, cell });
  },
});
