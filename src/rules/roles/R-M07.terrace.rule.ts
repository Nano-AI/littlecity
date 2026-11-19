// R-M07 · Terrace. The default marble role: a plain mass. Its exposed
// walkable tops are paved (J16 pins 'top:paved' for every marble role, the
// generator draws it); balustrades on its drop edges come from J19.

import { defineRule } from '@/resolve/engine/api';

export default defineRule({
  id: 'R-M07.terrace',
  part: 'roles',
  tier: 1,
  priority: 5930,
  about: 'Reads: marble structures with no role yet. Emits: role terrace.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) if (s.kind === 'marble') out.push({ anchor: s.cells[0]!, structure: s.id });
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, 'terrace');
  },
});
