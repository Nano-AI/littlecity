// R-D04 · tier 1 · Jetty: the default dock. Every dock that is not a quay,
// a pier or a boardwalk is a jetty: a plain deck on stilts.

import { defineRule, type Candidate } from '@/resolve/engine/api';

export default defineRule({
  id: 'R-D04.jetty',
  part: 'roles',
  tier: 1,
  priority: 4960,
  about: 'Reads: dock structures. Claims: the role of every dock no earlier dock rule claimed.',
  find({ facts }) {
    const out: Candidate[] = [];
    for (const s of facts.structures.values()) if (s.kind === 'dock') out.push({ anchor: s.cells[0]!, structure: s.id });
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, 'jetty');
  },
});
