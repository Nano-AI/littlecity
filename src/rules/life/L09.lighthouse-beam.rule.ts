// L09 · Lighthouse beam: a beam at every 'lantern' socket and, with it, the
// pool of light it lays on the water. A taller lighthouse throws a longer
// beam. src/life/dusk/beam.behaviour.ts sweeps them at night.

import { defineRule } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { DUSKY } from '@/style/animation';

export default defineRule<{ socket: string }>({
  id: 'L09.lighthouse-beam',
  part: 'life',
  tier: 1,
  priority: 910,
  about: 'Reads: lantern sockets, the lighthouse’s height. Emits: a lighthouse-beam actor and a beam-glow actor per lantern.',
  find: ({ facts }) => socketsOfType(facts, 'lantern').map((s) => ({ anchor: s.cell, structure: s.structure, data: { socket: s.id } })),
  apply(c, out, ctx) {
    const storeys = c.structure === undefined ? 3 : (structureInfo(ctx.facts).get(c.structure)?.storeys ?? 3);
    const reach = Math.round((DUSKY.beamReach + DUSKY.beamReachPerStorey * storeys) * 10) / 10;
    out.actor({ type: 'lighthouse-beam', at: { socket: c.data.socket }, home: c.structure, params: { reach } });
    out.actor({ type: 'beam-glow', at: { socket: c.data.socket }, home: c.structure, params: { reach } });
  },
});
