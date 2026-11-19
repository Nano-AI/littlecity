// L29 · Mechanisms: fountain jets play. A 'water-jet' actor at every
// 'water-jet' socket R-F01 declared: the tongues of water spilling from a
// tiered fountain's upper bowl, the jet on its finial, the spouts of a
// small basin. The shapes follow the fountain's own measures (FOUNTAIN).
// src/life/mechanisms/water-jet.behaviour.ts makes them run.

import { defineRule } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { FOUNTAIN } from '@/style/props';

interface Jet {
  socket: string;
  variant: 'arc' | 'up';
  reach: number;
  drop: number;
}

const round = (x: number): number => Math.round(x * 1000) / 1000;

export default defineRule<Jet>({
  id: 'L29.fountain-jets',
  part: 'life',
  tier: 2,
  priority: 709,
  about: 'Reads: water-jet sockets and the fountain’s role. Emits: a water-jet actor at each (an arc from a lip or spout, a jet on a finial).',
  find: ({ facts, plan }) =>
    socketsOfType(facts, 'water-jet').flatMap((s) => {
      const name = s.id.slice(s.id.lastIndexOf('/') + 1);
      const role = s.structure === undefined ? undefined : plan.roles.get(s.structure)?.role;
      let jet: Omit<Jet, 'socket'>;
      if (name === 'top') jet = { variant: 'up', reach: 0, drop: 0.15 };
      else if (role === 'tiered-fountain') jet = { variant: 'arc', reach: 0.09, drop: round(FOUNTAIN.bowlHeight - FOUNTAIN.basinHeight + 0.075) };
      else jet = { variant: 'arc', reach: 0.12, drop: round(FOUNTAIN.pierHeight - 0.25) };
      return [{ anchor: s.cell, structure: s.structure, key: s.id, data: { socket: s.id, ...jet } }];
    }),
  apply(c, out) {
    out.actor({ type: 'water-jet', variant: c.data.variant, at: { socket: c.data.socket }, home: c.structure, params: { reach: c.data.reach, drop: c.data.drop } });
  },
});
