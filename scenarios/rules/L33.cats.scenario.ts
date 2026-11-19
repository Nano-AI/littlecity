// L33: a street of ten separate cottages keeps two cats, each napping on a
// doorstep by day and sitting up to watch the evening.
//
//   node src/life/testing/sequence.mjs L33.cats --time 0.57 --run --frames 8 --every 1500 --name wake --zoom 8 --target 18,1,21

import { scenario } from '@/scenario';

export default scenario({
  name: 'L33.cats',
  seed: 533,
  about: 'Cats on doorsteps: one per five houses, at most six (L33).',
  build(b) {
    for (let i = 0; i < 10; i++) b.house(10 + i * 3, 20, { floors: 1 + (i % 2), color: i % 6 });
    b.path(9, 21, 39, 21);
  },
  cameras: [
    { name: 'street', yaw: 45, pitch: 30, zoom: 3, target: [24, 1, 21] },
    { name: 'dusk', yaw: 45, pitch: 30, zoom: 3, target: [24, 1, 21], time: 'dusk' },
  ],
  expect(_plan, _dressing, check) {
    check.equal(check.actors({ type: 'cat', rule: 'L33.cats' }).length, 2, 'two cats for ten houses');
  },
});
