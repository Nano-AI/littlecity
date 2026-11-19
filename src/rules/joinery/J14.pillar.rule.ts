// J14 · Pillar. A stack of pillar cells is one shaft with one base and one
// capital (the generator draws that). This rule pins what the stack carries
// and stands in, for the rules that come later: a pillar under a block gets
// the tag 'capital:flared', one standing in the sea 'footing:water' (water
// rings, L06), and a free top is a perch for birds.

import { above, columnIndex, keyX, keyY, keyZ } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';

export default defineRule({
  id: 'J14.pillar',
  part: 'joinery',
  tier: 1,
  priority: 860,
  about: 'Reads: pillar structures. Emits: tags capital:flared and footing:water; a perch socket on a free top.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) if (s.kind === 'pillar') out.push({ anchor: s.cells[0]!, structure: s.id });
    return out;
  },
  apply(c, out, { plan }) {
    const s = plan.structures.get(c.structure!)!;
    const bottom = s.cells[0]!;
    const top = s.cells[s.cells.length - 1]!;
    if (plan.kinds.has(above(top))) out.tag(s.id, 'capital:flared');
    else out.socket({ type: 'perch', cell: top, structure: s.id });
    if (keyY(bottom) === 0 && plan.terrain.height[columnIndex(keyX(bottom), keyZ(bottom))] === 0) out.tag(s.id, 'footing:water');
  },
});
