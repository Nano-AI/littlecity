// R-M05: marble at level 0 or 1 beside open water is a quay wall: bollards
// with mooring rings on every second water-side cell, a narrow stair down to
// the water every sixth. Marble two levels up, or away from the water, is
// not.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-M05.quay-wall',
  seed: 79,
  about: 'A quay of nine cells along the shore, a quay block standing in the sea, and marble inland (a terrace).',
  terrain(t) {
    t.flat(1);
    t.water(4, 16, 43, 43);
  },
  build(b) {
    for (let x = 8; x <= 16; x++) b.put('marble', x, 15);
    b.block('marble', 20, 0, 16).block('marble', 21, 0, 16); // in the water, at sea level
    b.put('marble', 12, 10);
  },
  cameras: [
    { name: 'front', yaw: 40, pitch: 28, zoom: 3.6, target: [14, 1, 15.5] },
    { name: 'back', yaw: 220, pitch: 32, zoom: 3.6, target: [14, 1, 15.5] },
  ],
  expect(_plan, _dressing, check) {
    check.role(12, 1, 15, 'quay-wall');
    check.equal(check.features({ type: 'bollard', on: [12, 1, 15] }).length, 3, 'bollards on cells 10, 12 and 16: every second, less the stairs');
    check.hasSocket({ type: 'mooring', at: [10, 1, 15] });
    check.equal(check.features({ type: 'quay-stair', on: [12, 1, 15] }).length, 2, 'stairs at cells 8 and 14');
    check.hasFeature({ type: 'quay-stair', at: [14, 1, 15], dir: 2 });
    check.hasTag(12, 1, 15, 'top:paved');
    check.role(20, 0, 16, 'quay-wall');
    check.role(12, 1, 10, 'terrace');
  },
});
