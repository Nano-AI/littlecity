// U22 · tier 2 · Ford and stepping stones (discovery round 1, UF-08).
//
// Where a path runs into a stream on one side and out on the other, people
// wade it. Two path dead ends on the ground facing each other straight
// across 1 or 2 cells of open water (same x or same z; the fords fact) get a
// row of stepping stones across each water cell. D03 leaves their ends
// without a view bench.
// Must not: an arch within 2 of the crossing (there is a bridge); water that
// is not a stream (the crossing is 1–2 wide by construction, with a bank on
// both sides); a dead end with nothing coming back on the far bank.
//
// The walking graph (the life builder's, src/resolve/nav.ts) does not cross
// the water by itself: the ends carry 'activity'/'ford' and 'ford-far'
// sockets owned by the first stones prop, so the graph can add a link
// between the two (docs/swarm/requests/disc1-fill.md).
//
// Stability: depends only on the two dead ends and the water between.
//
// Reads: fords. Claims: the centre slot of each water cell.

import { opposite, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { fords, type Ford } from './fords.fact';

const RULE = 'U22.ford';

export default defineRule<Ford>({
  id: RULE,
  part: 'urban',
  tier: 2,
  priority: 780,
  about: 'Reads: fords (path dead ends facing across 1–2 cells of water, no bridge near). Claims: the centre slot of each water cell crossed.',
  find: ({ facts }) => fords(facts).list.map((f): Candidate<Ford> => ({ anchor: f.from, data: f })),
  claims: (c) => c.data.water.map(([x, z]) => slot.floor(x | (z << 6), 'c')),
  apply(c, out, ctx) {
    const face: Dir4 = c.data.dir === 1 ? 2 : 3; // +X along the crossing
    let first = '';
    for (const [x, z] of c.data.water) {
      const id = out.prop({ type: 'stepping-stones', at: { cell: x | (z << 6), pos: 'c', face }, params: { look: hash(ctx.seed, RULE, x, z) % 1000 } });
      if (!first) first = id;
    }
    out.socket({ type: 'activity', owner: first, name: 'ford', cell: c.data.from, dir: c.data.dir });
    out.socket({ type: 'activity', owner: first, name: 'ford-far', cell: c.data.to, dir: opposite(c.data.dir) });
  },
});
