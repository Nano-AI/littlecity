// The gallery's lighthouse entry: lighthouses of every height on a
// headland, with the things that change by height: one band per storey, a
// sturdier top as they grow, and a second gallery from six storeys.

import { scenario } from '@/scenario';

export default scenario({
  name: 'gen.lighthouse',
  seed: 47,
  about: 'Lighthouses of 1 to 8 storeys, one on a rock in the sea, one with a block built on top.',
  terrain(t) {
    t.flat(0);
    t.rect(8, 10, 34, 15, 1);
    t.rect(30, 9, 35, 16, 2);
    t.rect(17, 20, 18, 21, 1); // a rock off the shore
  },
  build(b) {
    b.path(9, 14, 29, 14);
    for (let n = 1; n <= 7; n++) b.stack('lighthouse', 7 + n * 3, 12, { floors: n });
    b.stack('lighthouse', 33, 12, { floors: 8 });
    b.stack('lighthouse', 17, 20, { floors: 4 });
    for (let y = 0; y < 3; y++) b.block('lighthouse', 24, y, 19); // straight out of the sea
    b.block('marble', 24, 3, 19); // and built over
  },
  cameras: [
    { name: 'front', yaw: 40, pitch: 28, zoom: 2.5, target: [21, 3, 14] },
    { name: 'back', yaw: 220, pitch: 30, zoom: 2.5, target: [21, 3, 14] },
    { name: 'tops', yaw: 30, pitch: 24, zoom: 6, target: [26.5, 5.2, 12] },
    { name: 'night', yaw: 40, pitch: 28, zoom: 2.5, target: [21, 3, 14], time: 'night' },
  ],
  expect(_plan, _dressing, check) {
    for (let n = 1; n <= 7; n++) check.role(7 + n * 3, 1, 12, 'lighthouse');
    check.equal(check.features({ type: 'gallery', on: [22, 1, 12] }).length, 1, 'five storeys: one gallery');
    check.equal(check.features({ type: 'gallery', on: [25, 1, 12] }).length, 2, 'six storeys: two');
    check.hasSocket({ type: 'lantern', at: [33, 9, 12] });
    check.noFeature({ type: 'cap', on: [24, 0, 19] });
    check.hasTag(24, 0, 19, 'footing:water');
  },
});
