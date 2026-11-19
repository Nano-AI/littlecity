// L40 · tier 3 · Galley (town-wide). A lighthouse and a berth of 6+ cells →
// now and then a long low galley (about six cells) rows in with a bank of
// oars each side rising and dipping together, its one square sail furled or
// set by the wind; it rests at the berth with its oars tossed upright, and
// rows out. The visit is run by harbour.system.ts.

import { defineRule } from '@/resolve/engine/api';
import type { ShipPlan } from './berths.fact';
import { emitCall, shipCandidates } from './ships.lib';

export default defineRule<ShipPlan>({
  id: 'L40.galley',
  part: 'life',
  tier: 3,
  priority: 600,
  townWide: true,
  about: 'Reads: lighthouses, dock cells, quay walls, open water to the edge of the map (berths.fact.ts). Emits: one ship-call (galley) with its berth, if the town has a lighthouse and a berth of 6+; haunt-ship sockets along the quay.',
  find: ({ facts }) => shipCandidates(facts, 'galley'),
  apply(c, out, ctx) {
    emitCall('galley', 'L40.galley', c, out, ctx);
  },
});
