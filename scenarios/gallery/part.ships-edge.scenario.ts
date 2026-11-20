// Gallery: the edge of the map is a wall ships pass through ("Boats and
// ships": nothing vanishes). Ships lying part way through it, so the cut can
// be judged still, from every quarter, low, and by night:
//
//   east side    a galleon going out, its bow already through
//   west side    a galleon coming in, its stern still beyond
//   south side   a cog and a galley half through
//
// A scenario-local rule anchors each call to a sea cell by the edge.

import { key, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { scenario } from '@/scenario';

type Ship = { variant: 'galleon' | 'cog' | 'galley'; face: Dir4; look: number };

const FLEET: readonly (readonly [number, number, Ship])[] = [
  [45, 24, { variant: 'galleon', face: 1, look: 2 }],
  [1, 24, { variant: 'galleon', face: 1, look: 5 }],
  [18, 46, { variant: 'cog', face: 2, look: 1 }],
  [30, 45, { variant: 'galley', face: 2, look: 0 }],
];

const ships = defineRule<Ship>({
  id: 'X-L.edge-ships',
  part: 'life',
  tier: 1,
  priority: -1000,
  about: 'Gallery only: ships lying part way through the edge of the map.',
  find: () => FLEET.map(([x, z, data]) => ({ anchor: key(x, 0, z), data })),
  apply(c, out) {
    out.actor({ type: 'ship-call', variant: c.data.variant, at: { cell: c.anchor, pos: 'c', face: c.data.face }, params: { look: c.data.look, set: 1 } });
  },
});

export default scenario({
  name: 'part.ships-edge',
  seed: 4040,
  about: 'Ships part way through the edge of the map, cut off at it.',
  rules: [ships],
  terrain(t) {
    t.flat(0);
    t.rect(18, 16, 30, 30, 1);
  },
  build(b) {
    b.house(22, 22, { floors: 2, w: 2, color: 3 });
  },
  cameras: [
    { name: 'east', yaw: 45, pitch: 30, zoom: 4.5, target: [46.5, 1.2, 24.5] },
    { name: 'east-back', yaw: 225, pitch: 30, zoom: 4.5, target: [46.5, 1.2, 24.5] },
    { name: 'east-side', yaw: 135, pitch: 30, zoom: 4.5, target: [46.5, 1.2, 24.5] },
    { name: 'east-other', yaw: 315, pitch: 30, zoom: 4.5, target: [46.5, 1.2, 24.5] },
    { name: 'east-low', yaw: 300, pitch: 10, zoom: 4.5, target: [46.5, 1.4, 24.5] },
    { name: 'west', yaw: 45, pitch: 30, zoom: 4.5, target: [2, 1.2, 24.5] },
    { name: 'south', yaw: 45, pitch: 32, zoom: 3, target: [24, 1, 46] },
    { name: 'night', yaw: 45, pitch: 30, zoom: 4.5, target: [46.5, 1.2, 24.5], time: 'night' },
    { name: 'far', yaw: 45, pitch: 38, zoom: 1.2, target: [24, 0, 24] },
  ],
  expect(_plan, _dressing, check) {
    check.equal(check.actors({ type: 'ship-call', rule: 'X-L.edge-ships' }).length, FLEET.length, 'every ship is a call');
  },
});
