// L37 · 2 · Rider. Every garrisoned castle (L36) → one mounted rider in the
// garrison's colours with a pennant on a lance. Where a street leads from
// its gate the rider rides out a few times a day: to the town's square and
// across it and back, or, with no square to reach, along the street to its
// far end (or the first crossing a few cells on) and back, walking the horse
// through crowds. With no street the horse stands tethered by the gate all
// day. src/life/people/garrison.system.ts finds the ride on the walking graph
// and runs it (rider.ts).

import { hash } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import { townColor } from '../decoration/lib';
import { findCastles } from './castle.lib';
import { navOf } from './people.lib';

export default defineRule({
  id: 'L37.rider',
  part: 'life',
  tier: 2,
  priority: 734,
  about: 'Reads: castles with a gate (as L36), the walking graph. Emits: one rider actor per garrisoned castle (it rides where a street leads from the gate, else stands tethered there).',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    return findCastles(ctx.plan, nav)
      .filter((c) => c.gate !== null)
      .map((c) => ({ anchor: nav.nodes[c.gate!.node]!.cell, structure: c.id, key: `castle${c.id}` }));
  },
  apply(c, out, ctx) {
    out.actor({ type: 'rider', at: null, home: c.structure, params: { color: townColor(ctx.seed), look: hash(ctx.seed, 'horse', c.structure ?? 0) % 4 } });
  },
});
