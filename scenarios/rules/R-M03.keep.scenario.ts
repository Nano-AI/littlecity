// R-M03: marble at least 3 tall whose footprint holds a 2 × 2 is a keep:
// battlements along every exposed edge of its walkable tops, arrow slits in
// its upper walls. A thin wall or a low block is not.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-M03.keep',
  seed: 78,
  about: 'A keep of 2 × 2 × 3 with a raised corner; a wall 1 thick and 3 tall, and a 2 × 2 only 2 tall, stay terraces.',
  build(b) {
    b.fill('marble', 10, 10, 11, 11, { floors: 3 }).block('marble', 10, 4, 10);
    b.fill('marble', 15, 10, 17, 10, { floors: 3 }); // no 2 × 2
    b.fill('marble', 20, 10, 21, 11, { floors: 2 }); // too low
  },
  cameras: [
    { name: 'front', yaw: 40, pitch: 28, zoom: 3.6, target: [15.5, 2.5, 10.5] },
    { name: 'back', yaw: 220, pitch: 32, zoom: 3.6, target: [15.5, 2.5, 10.5] },
  ],
  expect(_plan, _dressing, check) {
    check.role(10, 1, 10, 'keep');
    check.hasFeature({ type: 'battlement', at: [11, 3, 11] }, 2);
    check.equal(check.features({ type: 'battlement', at: [10, 4, 10] }).length, 4, 'all four edges of the raised corner');
    check.noFeature({ type: 'battlement', at: [10, 3, 10] }); // under the raised corner
    check.noFeature({ type: 'arrow-slit', at: [11, 1, 11] }); // none on the ground storey
    check.hasTag(10, 1, 10, 'top:paved');
    check.role(16, 1, 10, 'terrace');
    check.noFeature({ type: 'battlement', on: [16, 1, 10] });
    check.role(20, 1, 10, 'terrace');
  },
});
