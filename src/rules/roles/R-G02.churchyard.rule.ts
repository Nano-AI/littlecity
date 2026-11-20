// R-G02 · tier 2 · Churchyard (RC-01, FX-07). A garden region beside a
// chapel, closed round by wall or fence, is its churchyard
// (churchyard.lib.ts has the test and what does not count): mown grass in
// place of herb beds or flower drifts, rows of headstones facing east with
// a cross or two, a dark clipped yew in a corner, and a lychgate (a small
// roofed gate) where a path goes through its wall (R-H98). Bare grass
// closed round beside a chapel gets the same headstones, yew and lychgate
// from R-H98, with no role to give.
//
// Priority 3995: before R-G01 (3990), which would make it herb beds.

import { defineRule } from '@/resolve/engine/api';
import type { StructureId } from '@/resolve/plan';
import { chapels, isChurchyard } from './churchyard.lib';

export default defineRule({
  id: 'R-G02.churchyard',
  part: 'roles',
  tier: 2,
  priority: 3995,
  about: 'Reads: garden regions, chapels and steeples (roles), walls and fences round the region, windmills within 2, houses beside. Claims: the garden region’s role.',
  find({ facts, plan }) {
    const churches = chapels(plan);
    if (churches.length === 0) return [];
    const out = [];
    for (const g of facts.structures.values()) {
      if (g.kind !== 'garden' || plan.roles.has(g.id)) continue;
      const church = churches.find(({ chapel, steeple }) => isChurchyard(facts, g.cells, new Set<StructureId>(steeple === null ? [chapel] : [chapel, steeple])));
      if (church) out.push({ anchor: g.cells[0]!, structure: g.id });
    }
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, 'churchyard');
  },
});
