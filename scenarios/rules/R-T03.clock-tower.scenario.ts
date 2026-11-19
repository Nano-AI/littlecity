// R-T03: a tower at least 4 tall within 2 cells of a square (a plaza holding
// a full 3 × 3) is a clock tower: square, a clock on each free side of its
// top storey, a pyramid roof. Too short, or by a plaza that is no square, it
// is not.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-T03.clock-tower',
  seed: 72,
  about: 'A clock tower beside a square; a 3-storey tower beside it and a 4-storey tower by a 2 × 3 plaza stay watchtowers.',
  build(b) {
    b.plaza(9, 10, 11, 12).tower(12, 11, { floors: 5, color: 6 });
    b.tower(10, 13, { floors: 3, color: 2 }); // too short
    b.plaza(17, 10, 18, 12).tower(19, 11, { floors: 4, color: 4 }); // 2 × 3 is not a square
  },
  cameras: [
    { name: 'front', yaw: 40, pitch: 28, zoom: 3.8, target: [14, 3, 11.5] },
    { name: 'back', yaw: 220, pitch: 32, zoom: 3.8, target: [14, 3, 11.5] },
  ],
  expect(_plan, _dressing, check) {
    check.role(12, 1, 11, 'clock-tower');
    check.hasTag(12, 1, 11, 'body:square');
    check.equal(check.features({ type: 'clock-face', at: [12, 5, 11] }).length, 4, 'four faces');
    check.hasSocket({ type: 'clock-hands', at: [12, 5, 11] }, 4);
    check.hasFeature({ type: 'cap', variant: 'pyramid', at: [12, 5, 11] });
    check.noFeature({ type: 'window', at: [12, 5, 11] });
    check.equal(check.features({ type: 'window', on: [12, 1, 11] }).length, 4, 'windows on the four storeys below the clock');
    check.role(10, 1, 13, 'watchtower');
    check.role(19, 1, 11, 'watchtower');
  },
});
