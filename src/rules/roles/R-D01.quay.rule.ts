// R-D01 · tier 2 · Quay: 4+ dock cells in a row along the shoreline, each
// with the shore on the same side. Docks are "first match wins": this runs
// before pier, boardwalk and jetty.
//
// The quay's furniture (iron bollards, a stack of goods, a hoist crane once
// the dock has 8+ cells) is emitted by J23, which can claim deck slots for
// each piece without putting the role itself at risk.

import { defineRule, type Candidate } from '@/resolve/engine/api';
import { DOCK } from '@/style/dock';
import { quayOf } from './dock-shape';

export default defineRule({
  id: 'R-D01.quay',
  part: 'roles',
  tier: 2,
  priority: 4990,
  about: 'Reads: dock cells and the terrain beside them. Claims: the dock’s role.',
  find({ facts }) {
    const out: Candidate[] = [];
    for (const s of facts.structures.values()) {
      if (s.kind !== 'dock') continue;
      if (quayOf(facts, s.cells, DOCK.quayCells)) out.push({ anchor: s.cells[0]!, structure: s.id });
    }
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, 'quay');
  },
});
