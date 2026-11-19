// L10, the fireflies: a walled garden, a small bed and a few trees, seen
// at dusk.
//
//   node src/life/testing/sequence.mjs L10.fireflies --time dusk --frames 8 --every 250 --name blink

import { scenario } from '@/scenario';

export default scenario({
  name: 'L10.fireflies',
  seed: 1010,
  about: 'Fireflies over gardens and by grove trees at dusk.',
  time: 'dusk',
  build(b) {
    b.garden(18, 18, 23, 21);
    b.fenceAround(18, 18, 23, 21);
    b.garden(26, 19, 26, 20);
    b.house(25, 22, { floors: 2, w: 2, color: 2 });
    b.put('tree', 19, 19).put('tree', 22, 20);
    b.path(17, 23, 28, 23);
  },
  cameras: [
    { name: 'dusk', yaw: 45, pitch: 30, zoom: 6, target: [22, 1, 20.5], time: 0.69 },
    { name: 'day', yaw: 45, pitch: 30, zoom: 6, target: [22, 1, 20.5], time: 'day' },
  ],
  expect(_plan, _dressing, check) {
    const flies = check.actors({ type: 'firefly', rule: 'L10.fireflies' });
    // 24 cells ÷ 2 capped at 8, and the 2-cell bed gets the least there is: 2.
    check.equal(flies.filter((a) => a.at && 'cell' in a.at).length, flies.length, 'each firefly keeps to a cell');
    check.ok(flies.length >= 10, `8 over the big garden and 2 over the bed, got ${flies.length}`);
    check.noActor({ type: 'firefly', at: [25, 1, 22] });
  },
});
