// R-T07 · Watchtower. The default tower role: a round stone tower with a cone
// roof and small windows spiralling a quarter turn per storey. J13 turns the
// role into the cap and the windows; the flag (p = 0.5) is D13's, on the
// cap's flag-mount socket.

import { defineRule } from '@/resolve/engine/api';

export default defineRule({
  id: 'R-T07.watchtower',
  part: 'roles',
  tier: 1,
  priority: 8930,
  about: 'Reads: tower structures with no role yet. Emits: role watchtower.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) if (s.kind === 'tower') out.push({ anchor: s.cells[0]!, structure: s.id });
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, 'watchtower');
  },
});
