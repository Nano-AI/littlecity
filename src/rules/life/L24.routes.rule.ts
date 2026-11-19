// L24 · tier 1 · Routes. A* over the walking graph (design section 13): path
// or plaza 1 a cell, dock or deck 1.5, grass 3, interiors 1 second a storey.
// People queue at single-file links.
//
// The graph is built by src/resolve/nav.ts and the routing is done by the
// crowd (src/life/people/route.ts); the costs are the `nav` style. What this
// rule adds to the plan is where the queues form: a `queue-point` socket on
// the cell at each open end of every single-file stretch (a narrow stairs
// flight, carved steps, a gate, a ground arch). The crowd lets people into
// such a stretch from one end at a time and has the others wait at these
// cells.

import { defineRule, type Candidate } from '@/resolve/engine/api';
import { navOf } from './people.lib';

export default defineRule<{ run: number }>({
  id: 'L24.routes',
  part: 'life',
  tier: 1,
  priority: 760,
  about: 'Reads: the walking graph (single-file runs). Emits: a queue-point socket at each open end of a single-file stretch.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const out: Candidate<{ run: number }>[] = [];
    for (const run of nav.runs) {
      for (const end of run.ends) out.push({ anchor: nav.nodes[end]!.cell, key: run.id, data: { run: run.id } });
    }
    return out;
  },
  apply(c, out) {
    out.socket({ type: 'queue-point', cell: c.anchor });
  },
});
