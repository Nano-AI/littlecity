// L61 · Dogs. Twelve cottages along a lane and a little square: two dogs,
// each at the heels of whoever of its house is out, or on its doorstep.

import { scenario } from '@/scenario';

export default scenario({
  name: 'L61.dogs',
  seed: 61,
  about: 'Twelve cottages and a square: two dogs and their people.',
  terrain(t) {
    t.flat(1);
  },
  build(b) {
    b.path(8, 20, 34, 20);
    for (let i = 0; i < 6; i++) {
      b.house(9 + i * 4, 17, { floors: 1, w: 2, d: 2, color: i });
      b.house(9 + i * 4, 22, { floors: 1, w: 2, d: 2, color: (i + 3) % 8 });
      b.path(10 + i * 4, 19, 10 + i * 4, 19).path(10 + i * 4, 21, 10 + i * 4, 21);
    }
    b.plaza(18, 24, 22, 27);
    b.path(20, 21, 20, 23);
  },
  cameras: [{ name: 'lane', yaw: 45, pitch: 36, zoom: 4, target: [20, 1, 21] }],
  expect(_plan, dressing, check) {
    const dogs = dressing.sockets.filter((s) => s.type === 'errand' && (s.name ?? '').startsWith('dog|home|'));
    check.equal(dogs.length, 2, 'a dog for every six houses');
    for (const s of dogs) check.ok(s.structure !== undefined && dressing.nav.nodeAt.has(s.cell), `${s.name} at a house door`);
  },
});
