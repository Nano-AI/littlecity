// R-M02: marble touching one end of a gateway arch whose other end also
// touches marble or a wall is a gatehouse: the arch gets a portcullis and a
// lantern either side. An arch with marble on one side only stays a plain
// gateway.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-M02.gatehouse',
  seed: 77,
  about: 'A gatehouse of two marble blocks; one of marble and a wall piece; a gateway with marble on one side only.',
  build(b) {
    b.path(10, 8, 10, 14).put('arch', 10, 11).stack('marble', 9, 11, { floors: 2 }).stack('marble', 11, 11, { floors: 2 });
    b.path(15, 8, 15, 14).put('arch', 15, 11).stack('marble', 14, 11, { floors: 2 }).put('wall', 16, 11);
    b.path(20, 8, 20, 14).put('arch', 20, 11).stack('marble', 19, 11, { floors: 2 });
  },
  cameras: [
    { name: 'front', yaw: 40, pitch: 28, zoom: 4.2, target: [15, 1.8, 11] },
    { name: 'back', yaw: 220, pitch: 32, zoom: 4.2, target: [15, 1.8, 11] },
  ],
  expect(_plan, _dressing, check) {
    check.role(9, 1, 11, 'gatehouse');
    check.role(11, 1, 11, 'gatehouse');
    check.role(10, 1, 11, 'gateway');
    check.equal(check.features({ type: 'portcullis', at: [10, 1, 11] }).length, 1, 'one portcullis for the two blocks');
    check.role(14, 1, 11, 'gatehouse');
    check.hasFeature({ type: 'portcullis', at: [15, 1, 11] });
    check.role(19, 1, 11, 'terrace');
    check.noFeature({ type: 'portcullis', at: [20, 1, 11] });
  },
});
