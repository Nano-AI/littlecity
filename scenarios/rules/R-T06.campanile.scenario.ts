// R-T06 (town-wide): the tallest tower in town, if it is 6 or more tall, is
// the campanile: a square bell tower with an open belfry and a pyramid roof.
// Only one tower in town can be it.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-T06.campanile',
  seed: 75,
  about: 'Three towers of 7, 6 and 4 storeys: the tallest is the campanile, the others are watchtowers.',
  build(b) {
    b.tower(10, 11, { floors: 7, color: 4 });
    b.tower(13, 11, { floors: 6, color: 1 });
    b.tower(16, 11, { floors: 4, color: 6 });
  },
  cameras: [
    { name: 'front', yaw: 40, pitch: 28, zoom: 3, target: [13, 4, 11] },
    { name: 'back', yaw: 220, pitch: 32, zoom: 3, target: [13, 4, 11] },
  ],
  expect(plan, _dressing, check) {
    check.role(10, 1, 11, 'campanile');
    check.hasTag(10, 1, 11, 'body:square');
    check.hasFeature({ type: 'belfry', at: [10, 7, 11] });
    check.hasSocket({ type: 'bell', at: [10, 7, 11] });
    check.hasFeature({ type: 'cap', variant: 'pyramid', at: [10, 7, 11] });
    check.role(13, 1, 11, 'watchtower');
    check.role(16, 1, 11, 'watchtower');
    check.equal(plan.trace.find((t) => t.rule === 'R-T06.campanile')?.applied, 1, 'one campanile');
  },
});
