// L38 · tier 2 · Galleon (town-wide). A berth of 8+ cells in a port with 12+
// dock cells → once or twice a day a three-masted galleon comes up over the
// edge of the map under full sail, shortens sail as it nears, glides
// alongside and moors. Gangplank down; its crew carry crates and barrels
// onto the quay, where they pile up, and residents come to look. After a
// while it casts off, sets sail and leaves by another edge. At night it
// stays, its stern lanterns lit. Gulls wheel round its masts.
//
// The rule only says that the galleon calls, at which berth and lying which
// way (berths.fact.ts finds the berth and checks that a whole hull can come
// in and go out again). The harbour system (src/life/ships/harbour.system.ts)
// sails it. The rule also offers residents places along the quay to stand
// and watch, which they choose only while a ship is in.

import { defineRule } from '@/resolve/engine/api';
import type { ShipPlan } from './berths.fact';
import { emitCall, shipCandidates } from './ships.lib';

export default defineRule<ShipPlan>({
  id: 'L38.galleon',
  part: 'life',
  tier: 2,
  priority: 620,
  townWide: true,
  about: 'Reads: dock cells, quay walls, open water to the edge of the map (berths.fact.ts). Emits: one ship-call (galleon) with its berth, once the port has 12+ dock cells and a berth of 8+; haunt-ship sockets along the quay.',
  find: ({ facts }) => shipCandidates(facts, 'galleon'),
  apply(c, out, ctx) {
    emitCall('galleon', 'L38.galleon', c, out, ctx);
  },
});
