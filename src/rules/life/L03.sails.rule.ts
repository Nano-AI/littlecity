// L03 · Sails: four sails on every windmill hub. The wheel grows with the
// mill (0.78 for a one-cell mill, more per further cell, as the Houses
// owner's part expects). src/life/wind/sails.behaviour.ts turns it.

import { defineRule } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { WINDMILL } from '@/style/houses';

export default defineRule<{ socket: string }>({
  id: 'L03.sails',
  part: 'life',
  tier: 1,
  priority: 970,
  about: 'Reads: mill-hub sockets, the mill’s height. Emits: one windmill-sails actor per hub.',
  find: ({ facts }) => socketsOfType(facts, 'mill-hub').map((s) => ({ anchor: s.cell, structure: s.structure, data: { socket: s.id } })),
  apply(c, out, ctx) {
    const storeys = c.structure === undefined ? 1 : (structureInfo(ctx.facts).get(c.structure)?.storeys ?? 1);
    const size = Math.min(WINDMILL.sailMax, WINDMILL.sail + (storeys - 1) * WINDMILL.sailPerCell);
    out.actor({ type: 'windmill-sails', at: { socket: c.data.socket }, home: c.structure, params: { size: Math.round(size * 100) / 100 } });
  },
});
