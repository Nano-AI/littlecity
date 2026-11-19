// R-A03 · Flying buttress, and R-A05 · Loggia: the two things a hanging run
// (an arch run anchored at one end only) can be. This file is R-A03: the
// anchor is a tower, marble or a chapel, and nothing stands on the run. It
// becomes a slim stone rib (tag 'arch:buttress') with a pinnacle over its
// outer end.

import { defineRule } from '@/resolve/engine/api';
import { archRuns, hangingRun, type Hanging } from '../joinery/J15.arch-runs.fact';

export default defineRule<Hanging>({
  id: 'R-A03.flying-buttress',
  part: 'roles',
  tier: 2,
  priority: 6970,
  about:
    'Reads: arch structures that are one hanging run with nothing on it, anchored on a tower, marble or a chapel. Emits: role flying-buttress, tag arch:buttress, a pinnacle on the outer cell.',
  find({ plan, facts }) {
    const out = [];
    for (const [id, runs] of archRuns(facts).byStructure) {
      const h = hangingRun(plan, runs);
      if (!h) continue;
      const kind = plan.kinds.get(h.anchor);
      const chapel = kind === 'house' && plan.roles.get(plan.structureAt.get(h.anchor)!)?.role === 'chapel';
      if (kind === 'tower' || kind === 'marble' || chapel) out.push({ anchor: plan.structures.get(id)!.cells[0]!, structure: id, data: h });
    }
    return out;
  },
  apply(c, out) {
    const id = c.structure!;
    out.role(id, 'flying-buttress');
    out.tag(id, 'arch:buttress');
    out.feature({ type: 'pinnacle', structure: id, cell: c.data.outer });
  },
});
