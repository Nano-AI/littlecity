// L19 · tier 1 · Sailboats (town-wide; "Boats and ships"). The sea is never
// empty: SHIPS.sailBase (two) on any island, dock or no dock, one more for
// every SHIPS.sailPerDocks dock cells, at most SHIPS.sailMax; fewer only
// where the lane is too short or too narrow to hold them. Each sails the sea lane (sea-lanes.fact.ts): a loop round the
// island at least 3 columns from land and docks, through open water only.
// No lane, no boats; a lane too narrow for boats to pass on (a there-and-back
// stretch squeezed against the map's edge) carries one.
//
// The actors are free-roaming (`at: null`) and named by their index alone,
// so a boat keeps its place and its state whatever is built ashore.

import { key } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import { townFacts } from '@/resolve/facts/town.fact';
import { SHIPS } from '@/style/ships';
import { seaLane } from './sea-lanes.fact';

/** A shuttle's two sides must be this far apart for boats to pass each other. */
const PASSING = 0.9;

export default defineRule<{ index: number; count: number }>({
  id: 'L19.sailboats',
  part: 'life',
  tier: 1,
  priority: 810,
  townWide: true,
  about: 'Reads: the sea lane (terrain, every block), dock cells. Emits: two sailboats, one more per 14 dock cells, at most 4; fewer on a short or narrow lane; none without a lane.',
  find({ facts }) {
    const lane = seaLane(facts);
    if (lane.kind === 'none') return [];
    const docks = townFacts(facts).cellsByKind.get('dock') ?? 0;
    let count = Math.min(Math.round(SHIPS.sailMax), Math.round(SHIPS.sailBase) + Math.floor(docks / Math.max(1, SHIPS.sailPerDocks)));
    if (lane.kind === 'shuttle' && lane.width < PASSING) count = Math.min(count, 1);
    // One boat for every 25 columns of lane at most: a short lane is not a regatta.
    count = Math.min(count, Math.max(1, Math.floor(lane.length / 25)));
    return Array.from({ length: Math.max(0, count) }, (_, index) => ({ anchor: key(0, 0, 0), key: index, data: { index, count } }));
  },
  apply(c, out, ctx) {
    out.actor({ type: 'sailboat', at: null, params: { index: c.data.index, count: c.data.count, look: hash(ctx.seed, 'L19', 'look', c.data.index) % 12 } });
  },
});
