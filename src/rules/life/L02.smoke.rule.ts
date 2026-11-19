// L02 · Chimney smoke: every chimney puffs. One 'smoke' actor per
// 'chimney-top' socket; the behaviour (src/life/wind/smoke.behaviour.ts)
// leans the plume with the wind and thickens it at dawn and dusk.

import { defineRule } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';

export default defineRule<{ socket: string }>({
  id: 'L02.smoke',
  part: 'life',
  tier: 1,
  priority: 980,
  about: 'Reads: chimney-top sockets. Emits: one smoke actor per chimney, at its socket.',
  find: ({ facts }) => socketsOfType(facts, 'chimney-top').map((s) => ({ anchor: s.cell, structure: s.structure, key: s.id, data: { socket: s.id } })),
  apply(c, out) {
    out.actor({ type: 'smoke', at: { socket: c.data.socket }, home: c.structure });
  },
});
