// D19 · tier 3 · Statue. Every plinth (R-M06: a one-cell marble pedestal
// beside a square) carries something on its 'statue-base': a figure with a
// raised arm, a sundial, or an urn of flowers, by seed. A figure is the most
// likely (two in four), and the figure turns to a seeded quarter.
//
// Stability: the pick is seeded by the plinth's own cell.
//
// Reads: statue-base sockets. Claims: the socket.

import { hash } from '@/core/rand';
import { defineRule, slot } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';

const RULE = 'D19.statue';
const KINDS = ['figure', 'figure', 'sundial', 'urn'] as const;

export default defineRule<{ socket: string }>({
  id: RULE,
  part: 'decoration',
  tier: 3,
  priority: 810,
  about: 'Reads: statue-base sockets (R-M06 plinths). Claims: the socket. Emits: a statue (figure, sundial or urn).',
  find: ({ facts }) => socketsOfType(facts, 'statue-base').map((s) => ({ anchor: s.cell, structure: s.structure, key: s.id, data: { socket: s.id } })),
  claims: (c) => [slot.socket(c.data.socket)],
  apply(c, out, ctx) {
    const variant = KINDS[hash(ctx.seed, RULE, c.anchor) % KINDS.length]!;
    const statue = out.prop({ type: 'statue', variant, at: { socket: c.data.socket }, params: { look: hash(ctx.seed, RULE, 'look', c.anchor) % 1000 } });
    out.socket({ type: 'perch', owner: statue, cell: c.anchor, structure: c.structure });
  },
});
