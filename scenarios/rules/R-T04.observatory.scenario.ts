// R-T04: a tower at least 4 tall on the island's highest terrain level, with
// no water within 4 columns, is an observatory: a dome with a slit. On lower
// ground, or near the sea, it is not.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-T04.observatory',
  seed: 73,
  about: 'An observatory on the hilltop; the same tower on the low ground, and one on a hill by the sea, stay watchtowers.',
  terrain(t) {
    t.flat(1);
    t.rect(19, 19, 23, 23, 3);
    t.rect(5, 5, 9, 9, 3);
  },
  build(b) {
    b.tower(21, 21, { floors: 4, color: 7 }); // the hilltop, inland
    b.tower(14, 21, { floors: 4, color: 1 }); // low ground
    b.tower(7, 7, { floors: 4, color: 3 }); // as high, but the sea is 3 columns away
  },
  cameras: [
    { name: 'front', yaw: 40, pitch: 28, zoom: 2.4, target: [15, 3, 15] },
    { name: 'back', yaw: 220, pitch: 32, zoom: 2.4, target: [15, 3, 15] },
  ],
  expect(_plan, _dressing, check) {
    check.role(21, 3, 21, 'observatory');
    check.hasFeature({ type: 'cap', variant: 'dome', at: [21, 6, 21] });
    check.hasSocket({ type: 'telescope', at: [21, 6, 21] });
    check.hasTag(21, 3, 21, 'body:round');
    check.role(14, 1, 21, 'watchtower');
    check.role(7, 3, 7, 'watchtower');
  },
});
