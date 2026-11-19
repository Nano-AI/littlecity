// J27 · tier 2 · Jettied room. A house cell carried on brackets (support
// rule S2) is a jetty: the generator draws it, and whatever is stacked on
// it, half-timbered, standing on a timber beam.
import { defineRule } from '@/resolve/engine/api';

export default defineRule({
  id: 'J27.jettied-room',
  part: 'joinery',
  tier: 2,
  priority: 730,
  about: 'Reads: supports (brackets). Emits: a jetty feature per bracketed house cell.',
  find(ctx) {
    const out = [];
    for (const sup of ctx.facts.supports) {
      if (sup.type !== 'bracket' || ctx.facts.kinds.get(sup.carries) !== 'house') continue;
      const structure = ctx.facts.structureAt.get(sup.carries);
      if (structure !== undefined) out.push({ anchor: sup.carries, structure });
    }
    return out;
  },
  apply(c, out) {
    out.feature({ type: 'jetty', structure: c.structure!, cell: c.anchor });
  },
});
