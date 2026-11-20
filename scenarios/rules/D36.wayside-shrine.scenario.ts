// Fixture for D36 (wayside shrine).
//   a crossroads out in the fields, nothing built within 4     a calvary or a niche shrine on a corner,
//                                                              with flowers
//   a crossroads in the village                                none (a fingerpost may stand there)

import { scenario } from '@/scenario';

export default scenario({
  name: 'D36.wayside-shrine',
  seed: 3636,
  about: 'A street junction out in the country, with nothing built within four cells, gets a wayside calvary or a roofed niche shrine with flowers on one of its corners.',
  build(b) {
    // The village crossroads at (10, 20).
    b.path(5, 20, 40, 20).path(10, 14, 10, 19).path(10, 21, 10, 26);
    for (const [x, z] of [[8, 18], [12, 18], [8, 22], [12, 22]] as const) b.house(x, z, { color: (x + z) % 8 });
    // The country crossroads at (30, 20).
    b.path(30, 12, 30, 19).path(30, 21, 30, 28);
  },
  cameras: [
    { name: 'crossroads', yaw: 30, pitch: 30, zoom: 8, target: [30, 1.3, 20] },
    { name: 'all', yaw: 30, pitch: 40, zoom: 2.4, target: [20, 1, 20] },
  ],
  expect(_plan, dressing, check) {
    const shrines = check.props({ type: 'wayside-shrine', rule: 'D36.wayside-shrine' });
    check.equal(shrines.length, 1, 'one shrine');
    check.hasProp({ type: 'wayside-shrine', at: [30, 1, 20] });
    check.noProp({ type: 'wayside-shrine', at: [10, 1, 20] });
    check.ok(shrines.every((p) => 'cell' in p.at && p.at.pos.length === 2), 'on a corner, clear of the walking line');
  },
});
