// D37 · tier 3 · Market cross (discovery round 1, RC-12).
//
// A market's centre is marked by a cross. A plinth (R-M06) with two or more
// stalls within 3 and no fountain within 2 (the marketCrosses fact) carries
// a market cross instead of D19's statue: two octagonal steps, a tall shaft,
// a cross head with a gilt ball. A vendor's place on the ground in front
// ('activity'/'vend').
// Must not: a plinth with a fountain near (the fountain is the centre), a
// plinth with fewer than two stalls near (D19's statue).
//
// Stability: seeded by the plinth's own cell.
//
// Reads: marketCrosses (statue-base sockets, stalls, fountains). Claims: the
// statue-base socket.

import { hash } from '@/core/rand';
import { defineRule, slot } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { marketCrosses } from './market-cross.fact';

const RULE = 'D37.market-cross';

export default defineRule<{ socket: string }>({
  id: RULE,
  part: 'decoration',
  tier: 3,
  priority: 630,
  about: 'Reads: marketCrosses (plinths with 2+ stalls within 3, no fountain within 2). Claims: the statue-base socket.',
  find({ facts }) {
    const crosses = marketCrosses(facts);
    return socketsOfType(facts, 'statue-base')
      .filter((s) => crosses.has(s.id))
      .map((s) => ({ anchor: s.cell, structure: s.structure, key: s.id, data: { socket: s.id } }));
  },
  claims: (c) => [slot.socket(c.data.socket)],
  apply(c, out, ctx) {
    const cross = out.prop({ type: 'market-cross', at: { socket: c.data.socket }, params: { look: hash(ctx.seed, RULE, 'look', c.anchor) % 1000 } });
    out.socket({ type: 'activity', owner: cross, name: 'vend', cell: c.anchor, structure: c.structure });
    out.socket({ type: 'perch', owner: cross, cell: c.anchor, structure: c.structure });
  },
});
