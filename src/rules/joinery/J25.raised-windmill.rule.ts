// J25 · tier 2 · Raised windmill. A windmill standing on a tower or a house
// stack ('raised', from R-W01) gets a timber gallery under its cap. The
// windmill generator draws it.
import { keyY } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';

export default defineRule({
  id: 'J25.raised-windmill',
  part: 'joinery',
  tier: 2,
  priority: 750,
  about: 'Reads: windmill structures tagged raised. Emits: a gallery feature on the mill\'s top cell.',
  find: (ctx) =>
    [...ctx.facts.structures.values()]
      .filter((s) => s.kind === 'windmill' && (ctx.plan.tags.get(s.id)?.has('raised') ?? false))
      .sort((a, b) => a.id - b.id)
      .map((s) => ({ anchor: [...s.cells].sort((a, b) => keyY(b) - keyY(a))[0]!, structure: s.id })),
  apply(c, out) {
    out.feature({ type: 'gallery', structure: c.structure!, cell: c.anchor });
  },
});
