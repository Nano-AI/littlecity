// L03 · the windmill's cap slowly yaws to face the wind. One 'mill-cap'
// actor per 'mill-hub' socket (the cap is drawn about its hub, so the sails
// at the same socket follow it). src/life/mechanisms/mill-cap.behaviour.ts
// turns it; while its part exists the windmill generator leaves the cap out.

import { defineRule } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';

export default defineRule<{ socket: string }>({
  id: 'L03.mill-cap',
  part: 'life',
  tier: 1,
  priority: 969,
  about: 'Reads: mill-hub sockets. Emits: one mill-cap actor per hub, which turns to the wind and carries the sails.',
  find: ({ facts }) => socketsOfType(facts, 'mill-hub').map((s) => ({ anchor: s.cell, structure: s.structure, key: s.id, data: { socket: s.id } })),
  apply(c, out) {
    out.actor({ type: 'mill-cap', at: { socket: c.data.socket }, home: c.structure });
  },
});
