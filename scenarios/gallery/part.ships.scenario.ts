// Gallery: the big ships (L38–L41), lying still so their drawing can be
// judged: under full sail heading each way (so every quarter is seen from
// any one camera), and furled alongside a quay with a house and a tree for
// scale. Cameras close and far; shoot with --time dusk and --time night too.
//
//   row z = 15   galleons under sail, heading N, E, S, W
//   row z = 26   cogs under sail, heading N, E, S, W
//   row z = 36   galleys and barges
//   the quay     a galleon and a cog moored, sails furled
//
// A scenario-local rule anchors each call to a sea cell; the harbour system
// draws an anchored call as a ship lying there (harbour.system.ts).

import { key, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { scenario } from '@/scenario';

type Ship = { variant: 'galleon' | 'cog' | 'galley' | 'barge'; face: Dir4; look: number; set: number };

const FLEET: readonly (readonly [number, number, Ship])[] = [
  [10, 15, { variant: 'galleon', face: 0, look: 0, set: 1 }],
  [19, 15, { variant: 'galleon', face: 1, look: 1, set: 1 }],
  [28, 15, { variant: 'galleon', face: 2, look: 2, set: 1 }],
  [37, 15, { variant: 'galleon', face: 3, look: 3, set: 1 }],
  [11, 26, { variant: 'cog', face: 0, look: 0, set: 1 }],
  [19, 26, { variant: 'cog', face: 1, look: 1, set: 1 }],
  [27, 26, { variant: 'cog', face: 2, look: 2, set: 1 }],
  [35, 26, { variant: 'cog', face: 3, look: 3, set: 1 }],
  [12, 36, { variant: 'galley', face: 1, look: 0, set: 1 }],
  [22, 36, { variant: 'galley', face: 3, look: 1, set: 0 }],
  [31, 36, { variant: 'barge', face: 1, look: 0, set: 1 }],
  [37, 36, { variant: 'barge', face: 2, look: 2, set: 0 }],
  // Alongside the quay (z = 8 is the quay; its water side is south).
  [14, 10, { variant: 'galleon', face: 1, look: 4, set: 0 }],
  [26, 10, { variant: 'cog', face: 1, look: 5, set: 0 }],
];

const ships = defineRule<Ship>({
  id: 'X-L.gallery-ships',
  part: 'life',
  tier: 1,
  priority: -1000,
  about: 'Gallery only: one ship lying at each listed sea cell.',
  find: () => FLEET.map(([x, z, data]) => ({ anchor: key(x, 0, z), data })),
  apply(c, out) {
    out.actor({ type: 'ship-call', variant: c.data.variant, at: { cell: c.anchor, pos: c.data.set === 0 && c.data.variant !== 'galley' && c.data.variant !== 'barge' ? 'n' : 'c', face: c.data.face }, params: { look: c.data.look, set: c.data.set } });
  },
});

export default scenario({
  name: 'part.ships',
  seed: 4038,
  about: 'The galleon, cog, galley and barge, under sail from every quarter and furled at a quay.',
  rules: [ships],
  terrain(t) {
    t.flat(1);
    t.water(4, 8, 43, 43);
  },
  build(b) {
    for (let x = 9; x <= 29; x++) b.block('dock', x, 0, 8);
    b.path(9, 7, 29, 7);
    b.house(12, 5, { floors: 3, w: 2, color: 2 });
    b.house(20, 5, { floors: 2, w: 2, color: 4 });
    b.put('tree', 16, 5);
  },
  cameras: [
    { name: 'all', yaw: 45, pitch: 35, zoom: 1.5, target: [23, 0.5, 23] },
    { name: 'galleons', yaw: 45, pitch: 30, zoom: 2.6, target: [23, 1, 15] },
    { name: 'galleon-close', yaw: 50, pitch: 26, zoom: 6, target: [19, 1.6, 15] },
    { name: 'galleon-stern', yaw: 200, pitch: 24, zoom: 6.5, target: [19, 1.4, 15] },
    { name: 'quay', yaw: 30, pitch: 32, zoom: 3.2, target: [19, 1, 9] },
    { name: 'quay-back', yaw: 210, pitch: 30, zoom: 3.2, target: [19, 1, 9] },
    { name: 'cogs', yaw: 45, pitch: 30, zoom: 2.8, target: [23, 1, 26] },
    { name: 'cog-close', yaw: 300, pitch: 26, zoom: 6.5, target: [27, 1.4, 26] },
    { name: 'galleys', yaw: 45, pitch: 30, zoom: 3, target: [24, 0.8, 36] },
    { name: 'galley-close', yaw: 120, pitch: 26, zoom: 6, target: [12, 0.8, 36] },
    { name: 'barge-close', yaw: 60, pitch: 30, zoom: 8, target: [34, 0.6, 36] },
    { name: 'far', yaw: 45, pitch: 40, zoom: 1.1, target: [24, 0, 24] },
  ],
  expect(_plan, _dressing, check) {
    check.equal(check.actors({ type: 'ship-call', rule: 'X-L.gallery-ships' }).length, FLEET.length, 'every ship is a call');
  },
});
