// L36 · 2 · Garrison. A castle (a keep, or a curtain wall of 8+ cells with a
// gatehouse or turret: castle.lib.ts) with a gate → a troop of 4–6 soldiers
// in tabards of the castle's colour (its banners', D21), helmets and pikes,
// who march in step in a column of twos round the outside of the walls, halt
// at the gate each lap, change the guard at dawn and dusk and leave two
// sentries with torches at night. The rule says only that there is a troop
// and how big; src/life/people/garrison.system.ts finds the patrol on the
// walking graph and marches it (troop.ts). Where a garrison is, L23 places no
// lone guard on the keep.

import { defineRule } from '@/resolve/engine/api';
import { townColor } from '../decoration/lib';
import { findCastles } from './castle.lib';
import { navOf } from './people.lib';

export default defineRule<{ size: number }>({
  id: 'L36.garrison',
  part: 'life',
  tier: 2,
  priority: 735,
  about: 'Reads: keeps, curtain walls, gatehouses and castle turrets; the walking graph. Emits: one garrison actor per castle with a gate (4 soldiers, 6 for a keep with walls).',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    return findCastles(ctx.plan, nav)
      .filter((c) => c.gate !== null)
      .map((c) => ({ anchor: nav.nodes[c.gate!.node]!.cell, structure: c.id, key: `castle${c.id}`, data: { size: c.troop } }));
  },
  apply(c, out, ctx) {
    out.actor({ type: 'garrison', at: null, home: c.structure, params: { size: c.data.size, color: townColor(ctx.seed) } });
  },
});
