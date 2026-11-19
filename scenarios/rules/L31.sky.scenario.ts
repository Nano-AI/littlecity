// L31 and L30, with L10's moon and shooting stars: the sky over a small
// island town. Clouds drift with the wind and drag soft shadows across the
// island; now and then a balloon crosses far behind it; at night the page
// shows the moon and, rarely, a shooting star.
//
//   node src/life/testing/sequence.mjs L31.sky --frames 8 --every 4000 --name drift --zoom 1.2 --target 24,1,24
//   node src/life/testing/sequence.mjs L31.sky --time night --frames 12 --every 100 --warm 21000 --name star

import { scenario } from '@/scenario';

export default scenario({
  name: 'L31.sky',
  seed: 531,
  about: 'Clouds and their shadows (L31), the far balloon (L30), the moon and shooting stars (L10).',
  terrain(t) {
    t.flat(0);
    t.disc(24, 24, 11, 1);
    t.disc(22, 22, 5, 2);
  },
  build(b) {
    for (let i = 0; i < 4; i++) b.house(20 + i * 2, 27, { floors: 1 + (i % 2), color: i });
    b.path(19, 26, 28, 26);
    b.put('tree', 24, 22).put('tree', 27, 21);
  },
  cameras: [
    { name: 'island', yaw: 45, pitch: 35, zoom: 1.3, target: [24, 1, 24] },
    { name: 'night', yaw: 45, pitch: 35, zoom: 1.3, target: [24, 1, 24], time: 'night' },
  ],
  expect(_plan, _dressing, check) {
    check.equal(check.actors({ type: 'cloud', rule: 'L31.sky' }).length, 3, 'three clouds');
    check.equal(check.actors({ type: 'balloon', rule: 'L31.sky' }).length, 1, 'one balloon, now and then');
  },
});
