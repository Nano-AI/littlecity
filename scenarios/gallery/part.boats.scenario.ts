// Gallery: the three boats, afloat, each seen from every quarter and in
// several paint schemes. Reviewed here before the life rules use them
// (design section 11: "boats are redrawn from scratch").
//
//   north row   rowboats: four headings, four paints
//   middle row  sailboats, sails set to whatever wind this seed blows
//   south row   fishing boats
//
// A scenario-local rule puts each boat at a sea cell facing one way; a boat
// anchored to a cell just floats there (src/life/boats/floating.ts).

import { key, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { scenario } from '@/scenario';

type Boat = { type: 'rowboat' | 'sailboat' | 'fishing-boat'; face: Dir4; look: number };

const FLEET: readonly (readonly [number, number, Boat])[] = [
  ...([0, 1, 2, 3] as const).map((i): [number, number, Boat] => [18 + i * 2, 20, { type: 'rowboat', face: i, look: i }]),
  ...([0, 1, 2, 3] as const).map((i): [number, number, Boat] => [18 + i * 2, 22, { type: 'rowboat', face: ((i + 2) % 4) as Dir4, look: i + 4 }]),
  ...([0, 1, 2, 3] as const).map((i): [number, number, Boat] => [17 + i * 3, 25, { type: 'sailboat', face: i, look: [0, 5, 2, 11][i]! }]),
  ...([0, 1, 2, 3] as const).map((i): [number, number, Boat] => [17 + i * 3, 29, { type: 'fishing-boat', face: i, look: [1, 0, 5, 3][i]! }]),
];

const boats = defineRule<Boat>({
  id: 'X-L.gallery-boats',
  part: 'life',
  tier: 1,
  priority: -1000,
  about: 'Gallery only: one boat at each listed sea cell.',
  find: () => FLEET.map(([x, z, data]) => ({ anchor: key(x, 0, z), data })),
  apply(c, out) {
    const at = { cell: c.anchor, pos: 'c' as const, face: c.data.face };
    if (c.data.type === 'rowboat') out.actor({ type: 'rowboat', at, params: { look: c.data.look } });
    else if (c.data.type === 'sailboat') out.actor({ type: 'sailboat', at, params: { look: c.data.look } });
    else out.actor({ type: 'fishing-boat', at, params: { look: c.data.look } });
  },
});

export default scenario({
  name: 'part.boats',
  seed: 318,
  about: 'The rowboat, the sailboat and the fishing boat, afloat, from every quarter and in several paints.',
  rules: [boats],
  terrain(t) {
    t.flat(1);
    t.water(13, 17, 31, 32);
  },
  build(b) {
    // Something of known size beside them: a house, a tree, a short pier.
    b.house(15, 15, { floors: 1, color: 2 });
    b.put('tree', 29, 15);
    for (let z = 17; z <= 19; z++) b.block('dock', 28, 0, z);
  },
  cameras: [
    { name: 'all', yaw: 45, pitch: 35, zoom: 3.4, target: [22, 0.5, 24.5] },
    { name: 'all-back', yaw: 225, pitch: 35, zoom: 3.4, target: [22, 0.5, 24.5] },
    { name: 'rowboats', yaw: 45, pitch: 33, zoom: 8, target: [21.5, 0.5, 21.5] },
    { name: 'rowboats-west', yaw: 135, pitch: 30, zoom: 8, target: [21.5, 0.5, 21.5] },
    { name: 'sailboats', yaw: 45, pitch: 30, zoom: 5.2, target: [22, 1, 25.5] },
    { name: 'sailboats-east', yaw: 315, pitch: 30, zoom: 5.2, target: [22, 1, 25.5] },
    { name: 'sailboat-close', yaw: 60, pitch: 28, zoom: 11, target: [20.5, 1, 25.5] },
    { name: 'fishing', yaw: 45, pitch: 32, zoom: 5.6, target: [22, 0.7, 29.5] },
    { name: 'fishing-back', yaw: 225, pitch: 32, zoom: 5.6, target: [22, 0.7, 29.5] },
    { name: 'fishing-close', yaw: 120, pitch: 28, zoom: 11, target: [20.5, 0.7, 29.5] },
    { name: 'top', yaw: 0, pitch: 80, zoom: 4.2, target: [22, 0.5, 24.5] },
  ],
  expect(_plan, dressing, check) {
    check.equal(check.actors({ type: 'rowboat', rule: 'X-L.gallery-boats' }).length, 8, 'rowboats');
    check.equal(check.actors({ type: 'sailboat', rule: 'X-L.gallery-boats' }).length, 4, 'sailboats');
    check.equal(check.actors({ type: 'fishing-boat' }).length, 4, 'fishing boats');
    check.ok(dressing.actors.length >= 16, 'every boat is an actor');
  },
});
