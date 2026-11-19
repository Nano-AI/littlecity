// R-A06 · Viaduct. The default arch role: tiers and long runs with one
// continuous cornice and parapet (the generator draws them through
// neighbouring arches, with no cornice between tiers).

import { defineRule } from '@/resolve/engine/api';

export default defineRule({
  id: 'R-A06.viaduct',
  part: 'roles',
  tier: 1,
  priority: 6940,
  about: 'Reads: arch structures with no role yet. Emits: role viaduct.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) if (s.kind === 'arch') out.push({ anchor: s.cells[0]!, structure: s.id });
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, 'viaduct');
  },
});
