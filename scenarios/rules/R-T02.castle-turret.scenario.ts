// R-T02: a tower touching marble or wall pieces on two or more sides is a
// castle turret: battlements on corbels, arrow slits, a banner staff. One
// side is not enough.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-T02.castle-turret',
  seed: 71,
  about: 'A turret in a marble corner, one between two wall pieces, and a tower with marble on one side only (a watchtower).',
  build(b) {
    b.stack('marble', 9, 11, { floors: 2 }).stack('marble', 10, 10, { floors: 2 }).tower(10, 11, { floors: 4, color: 1 }); // marble west and north
    b.put('wall', 13, 11).put('wall', 15, 11).tower(14, 11, { floors: 3, color: 3 }); // wall pieces west and east
    b.stack('marble', 18, 11, { floors: 2 }).tower(19, 11, { floors: 4, color: 5 }); // one side: not a turret
  },
  cameras: [
    { name: 'front', yaw: 40, pitch: 28, zoom: 4.2, target: [14, 2.5, 11] },
    { name: 'back', yaw: 220, pitch: 32, zoom: 4.2, target: [14, 2.5, 11] },
  ],
  expect(_plan, _dressing, check) {
    check.role(10, 1, 11, 'castle-turret');
    check.hasTag(10, 1, 11, 'body:round');
    check.hasFeature({ type: 'cap', variant: 'battlements', at: [10, 4, 11] });
    check.hasSocket({ type: 'flag-mount', at: [10, 4, 11] });
    check.hasFeature({ type: 'arrow-slit', on: [10, 1, 11] }, 2);
    check.noFeature({ type: 'window', on: [10, 1, 11] });
    // No slit on a side the marble touches.
    for (const f of check.features({ type: 'arrow-slit', at: [10, 1, 11] })) check.ok(f.dir === 1 || f.dir === 2, 'slits face the open sides');
    check.role(14, 1, 11, 'castle-turret');
    check.role(19, 1, 11, 'watchtower');
  },
});
