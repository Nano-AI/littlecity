// L29 · Mechanisms: a bell in every belfry, and the hands of every tower
// clock. Bells swing at dusk (src/life/mechanisms/bell.behaviour.ts); clock
// hands show the game's time (clock.behaviour.ts). While their parts exist
// the tower generator leaves its still bell and hands out.

import { defineRule } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';

export default defineRule<{ socket: string; type: 'bell' | 'clock-hands' }>({
  id: 'L29.bells',
  part: 'life',
  tier: 2,
  priority: 710,
  about: 'Reads: bell and clock-hands sockets. Emits: a bell actor in each belfry and a clock-hands actor on each clock face.',
  find: ({ facts }) =>
    (['bell', 'clock-hands'] as const).flatMap((type) =>
      socketsOfType(facts, type).map((s) => ({ anchor: s.cell, structure: s.structure, key: s.id, data: { socket: s.id, type } })),
    ),
  apply(c, out) {
    out.actor({ type: c.data.type, at: { socket: c.data.socket }, home: c.structure });
  },
});
