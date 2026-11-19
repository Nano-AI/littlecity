// L39 · tier 2 · Merchant cog (town-wide). A berth of 5+ cells in a port with
// 6+ dock cells → a single-masted, round-bellied trading cog (about four
// cells long) that calls more often than the galleon and stays a shorter
// time. The same visit as L38's (harbour.system.ts), with barrels and sacks.
//
// If the port has a galleon too, the cog takes another berth if there is
// one long enough, else it shares the galleon's (they never call at once).

import { defineRule } from '@/resolve/engine/api';
import type { ShipPlan } from './berths.fact';
import { emitCall, shipCandidates } from './ships.lib';

export default defineRule<ShipPlan>({
  id: 'L39.cog',
  part: 'life',
  tier: 2,
  priority: 610,
  townWide: true,
  about: 'Reads: dock cells, quay walls, open water to the edge of the map (berths.fact.ts). Emits: one ship-call (cog) with its berth, once the port has 6+ dock cells and a berth of 5+; haunt-ship sockets along the quay.',
  find: ({ facts }) => shipCandidates(facts, 'cog'),
  apply(c, out, ctx) {
    emitCall('cog', 'L39.cog', c, out, ctx);
  },
});
