// L37 · 2 · Rider. A garrisoned castle (L36) whose gate opens onto a street
// or square → one mounted rider in the garrison's colours with a pennant on
// a lance, who rides out by the gate a few times a day, trots the streets to
// the square and back, walks the horse through crowds, and between rides
// stands the horse tethered by the gate. src/life/people/garrison.system.ts
// finds the ride on the walking graph and runs it (rider.ts).

import { DIR4, keyX, keyY, keyZ, key, inColumnBounds } from '@/core/grid';
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
  about: 'Reads: castles with a gate (as L36), the walking graph. Emits: one rider actor per castle whose gate gives onto a path or plaza.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const out = [];
    for (const c of findCastles(ctx.plan, nav)) {
      if (!c.gate) continue;
      // A street leads from the gate: the gate's own cell, or one beside it, is path or plaza.
      const cell = nav.nodes[c.gate.node]!.cell;
      const street = [[0, 0], ...DIR4].some(([dx, dz]) => {
        const x = keyX(cell) + dx!, z = keyZ(cell) + dz!;
        if (!inColumnBounds(x, z)) return false;
        const n = nav.nodeAt.get(key(x, keyY(cell), z));
        return n !== undefined && (nav.nodes[n]!.surface === 'path' || nav.nodes[n]!.surface === 'plaza');
      });
      if (street) out.push({ anchor: cell, structure: c.id, key: `castle${c.id}` });
    }
    return out;
  },
  apply(c, out, ctx) {
    out.actor({ type: 'rider', at: null, home: c.structure, params: { color: townColor(ctx.seed), look: hash(ctx.seed, 'horse', c.structure ?? 0) % 4 } });
  },
});
