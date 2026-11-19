// R-D03 Boardwalk: a straight run of dock cells with level land at both
// ends gets rope railings on both sides.
//   three across a cove               a boardwalk, with a ramp onto each beach
//   five across a wider inlet         a boardwalk
//   four out from one bank only       a pier, no railings

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-D03.boardwalk',
  seed: 103,
  about: 'Boardwalks across a cove and an inlet, with rope railings; a run touching land at one end only is a pier.',
  terrain(t) {
    t.flat(1);
    t.water(14, 18, 16, 30); // a cove, three wide
    t.water(24, 18, 28, 30); // an inlet, five wide
    t.water(4, 31, 43, 43); // the sea
  },
  build(b) {
    for (let x = 14; x <= 16; x++) b.block('dock', x, 0, 24);
    for (let x = 24; x <= 28; x++) b.block('dock', x, 0, 22);
    for (let z = 31; z <= 34; z++) b.block('dock', 34, 0, z);
    b.path(8, 24, 13, 24).path(17, 24, 20, 24).path(20, 22, 23, 22).path(29, 22, 34, 22);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 34, zoom: 3.2, target: [22, 1, 25] },
    { name: 'back', yaw: 225, pitch: 34, zoom: 3.2, target: [22, 1, 25] },
    { name: 'close', yaw: 30, pitch: 32, zoom: 7, target: [15.5, 1, 24] },
  ],
  expect(_plan, _dressing, check) {
    check.role(15, 0, 24, 'boardwalk');
    check.role(26, 0, 22, 'boardwalk');
    check.role(34, 0, 32, 'pier');
    // A rope railing on each open side of each cell, standing on the deck (level 1).
    check.hasFeature({ type: 'railing', variant: 'rope', at: [15, 1, 24], dir: 0 });
    check.hasFeature({ type: 'railing', variant: 'rope', at: [15, 1, 24], dir: 2 });
    check.equal(check.features({ type: 'railing', rule: 'R-D03.boardwalk' }).length, 16, 'railings: two sides of eight cells');
    check.noFeature({ type: 'railing', on: [34, 0, 32], rule: 'R-D03.boardwalk' });
    // Nothing is moored to a boardwalk, and it steps onto each beach by a ramp.
    check.noFeature({ type: 'bollard', on: [15, 0, 24] });
    check.hasFeature({ type: 'ramp', at: [14, 0, 24], dir: 3 });
    check.hasFeature({ type: 'ramp', at: [16, 0, 24], dir: 1 });
  },
});
